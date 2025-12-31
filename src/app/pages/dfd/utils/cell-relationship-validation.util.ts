/**
 * Cell Relationship Validation Utility
 *
 * Validates and fixes parent-child relationships in diagram cells to ensure mutual consistency.
 * When cells are received from external sources (REST API, WebSocket, file import), this utility:
 * - Validates that parent/child relationships are mutual
 * - Detects and fixes missing parent or child references
 * - Validates embedding rules (e.g., text-boxes cannot be parents, security boundaries can only embed security boundaries)
 * - Detects circular parent-child relationships
 * - Logs warnings for any issues found and applied fixes
 */

import { Cell } from '../../../core/types/websocket-message.types';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Result of relationship validation
 */
export interface ValidationResult {
  /** Whether any fixes were applied */
  hadIssues: boolean;
  /** Number of issues fixed */
  fixCount: number;
  /** List of issues found and fixed */
  issues: ValidationIssue[];
  /** Corrected cell array */
  cells: Cell[];
}

/**
 * Details about a specific validation issue
 */
export interface ValidationIssue {
  type:
    | 'missing-parent'
    | 'missing-child'
    | 'circular'
    | 'invalid-parent-type'
    | 'invalid-child-type';
  childId: string;
  parentId?: string;
  message: string;
  action: string;
}

/**
 * Embedding rules for different shape types
 * Based on InfraEmbeddingService.validateEmbedding()
 */
const EMBEDDING_RULES = {
  /** Shapes that cannot be parents (cannot contain other nodes) */
  CANNOT_BE_PARENT: ['text-box'],

  /** Security boundaries can only contain other security boundaries */
  SECURITY_BOUNDARY_RULE: {
    childShape: 'security-boundary',
    allowedParents: ['security-boundary'],
  },
};

/**
 * Context object passed to validation helper functions
 */
interface ValidationContext {
  cellMap: Map<string, Cell>;
  issues: ValidationIssue[];
  fixCount: number;
  logger: LoggerService;
}

/**
 * Validate and fix parent-child relationships in diagram cells
 *
 * This function ensures mutual consistency of parent-child relationships:
 * - For each child with a parent reference, ensures the parent exists and lists the child
 * - For each parent with children, ensures those children reference the parent
 * - Validates embedding rules based on shape types
 * - Detects circular relationships
 *
 * @param cells - Array of cells to validate
 * @param logger - Logger service for warning messages
 * @returns ValidationResult with corrected cells and issue details
 */
export function validateAndFixParentChildRelationships(
  cells: Cell[],
  logger: LoggerService,
): ValidationResult {
  // Create a map of cell ID -> cell for quick lookups
  const cellMap = new Map<string, Cell>();
  cells.forEach(cell => cellMap.set(cell.id, cell));

  const context: ValidationContext = {
    cellMap,
    issues: [],
    fixCount: 0,
    logger,
  };

  // Validate parent references (child -> parent direction)
  validateParentReferences(cells, context);

  // Validate child references (parent -> children direction)
  validateChildReferences(cells, context);

  // Log summary
  logValidationSummary(cells, context);

  return {
    hadIssues: context.fixCount > 0,
    fixCount: context.fixCount,
    issues: context.issues,
    cells,
  };
}

/**
 * Validate parent references from each cell
 * Ensures referenced parents exist and embedding rules are satisfied
 */
function validateParentReferences(cells: Cell[], context: ValidationContext): void {
  cells.forEach(cell => {
    const parent = cell['parent'] as string | null | undefined;
    if (!parent || parent === null) {
      return;
    }

    const parentCell = context.cellMap.get(parent);

    // Check if parent exists
    if (!parentCell) {
      addIssueAndFix(context, {
        type: 'missing-parent',
        childId: cell.id,
        parentId: parent,
        message: `Cell ${cell.id} references non-existent parent ${parent}`,
        action: 'Removed parent reference',
      });
      cell['parent'] = null;
      return;
    }

    // Check for circular relationships
    if (hasCircularRelationship(cell.id, parent, context.cellMap)) {
      addIssueAndFix(context, {
        type: 'circular',
        childId: cell.id,
        parentId: parent,
        message: `Circular parent-child relationship detected for cell ${cell.id}`,
        action: 'Removed parent reference to break cycle',
      });
      cell['parent'] = null;
      return;
    }

    // Validate embedding rules
    validateEmbeddingRules(cell, parentCell, context);
  });
}

/**
 * Validate embedding rules based on shape types
 */
function validateEmbeddingRules(cell: Cell, parentCell: Cell, context: ValidationContext): void {
  const childShape = cell.shape;
  const parentShape = parentCell.shape;
  const parent = cell['parent'] as string;

  // Rule: text-box cannot be a parent
  if (EMBEDDING_RULES.CANNOT_BE_PARENT.includes(parentShape)) {
    addIssueAndFix(
      context,
      {
        type: 'invalid-parent-type',
        childId: cell.id,
        parentId: parent,
        message: `Cell ${cell.id} cannot be embedded in ${parentShape} (shape type ${parentShape} cannot contain other nodes)`,
        action: 'Removed parent reference',
      },
      { childShape, parentShape },
    );
    cell['parent'] = null;
    return;
  }

  // Rule: security-boundary can only be embedded in security-boundary
  if (
    childShape === EMBEDDING_RULES.SECURITY_BOUNDARY_RULE.childShape &&
    !EMBEDDING_RULES.SECURITY_BOUNDARY_RULE.allowedParents.includes(parentShape)
  ) {
    addIssueAndFix(
      context,
      {
        type: 'invalid-child-type',
        childId: cell.id,
        parentId: parent,
        message: `Security boundary ${cell.id} can only be embedded in other security boundaries, not ${parentShape}`,
        action: 'Removed parent reference',
      },
      { childShape, parentShape },
    );
    cell['parent'] = null;
  }
}

/**
 * Validate child references from parent cells
 * Ensures children exist and reference the parent back
 */
function validateChildReferences(cells: Cell[], context: ValidationContext): void {
  cells.forEach(cell => {
    const children = cell['children'] as string[] | undefined;
    if (!children || !Array.isArray(children)) {
      return;
    }

    const validChildren: string[] = [];

    children.forEach(childId => {
      const childCell = context.cellMap.get(childId);

      // Check if child exists
      if (!childCell) {
        addIssueAndFix(context, {
          type: 'missing-child',
          childId: childId,
          parentId: cell.id,
          message: `Cell ${cell.id} has non-existent child ${childId} in children array`,
          action: 'Removed child from children array',
        });
        return;
      }

      // Check if child references this parent
      const childParent = childCell['parent'] as string | null | undefined;
      if (childParent !== cell.id) {
        addIssueAndFix(
          context,
          {
            type: 'missing-child',
            childId: childId,
            parentId: cell.id,
            message: `Cell ${cell.id} lists ${childId} as child, but ${childId} doesn't reference ${cell.id} as parent (has parent: ${childParent || 'null'})`,
            action: 'Added parent reference to child',
          },
          { childCurrentParent: childParent || null },
        );
        childCell['parent'] = cell.id;
      }

      validChildren.push(childId);
    });

    // Update children array if we removed any invalid entries
    if (validChildren.length !== children.length) {
      cell['children'] = validChildren;
    }
  });
}

/**
 * Add an issue to the context and increment fix count
 */
function addIssueAndFix(
  context: ValidationContext,
  issue: ValidationIssue,
  extraLogData?: Record<string, unknown>,
): void {
  context.issues.push(issue);
  context.fixCount++;
  context.logger.warn(issue.message, {
    childId: issue.childId,
    parentId: issue.parentId,
    action: issue.action,
    ...extraLogData,
  });
}

/**
 * Log validation summary
 */
function logValidationSummary(cells: Cell[], context: ValidationContext): void {
  if (context.fixCount > 0) {
    context.logger.warn('Fixed parent-child relationship issues in diagram cells', {
      totalCells: cells.length,
      issuesFound: context.issues.length,
      fixesApplied: context.fixCount,
      issueTypes: context.issues.reduce(
        (acc, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    });
  } else {
    context.logger.debugComponent(
      'CellRelationshipValidation',
      'All parent-child relationships validated successfully',
      {
        totalCells: cells.length,
        cellsWithParents: cells.filter(c => {
          const parent = c['parent'] as string | null | undefined;
          return parent && parent !== null;
        }).length,
      },
    );
  }
}

/**
 * Check if there's a circular relationship in the parent chain
 *
 * @param cellId - ID of the cell to check
 * @param parentId - ID of the parent to check
 * @param cellMap - Map of all cells by ID
 * @returns true if circular relationship detected
 */
function hasCircularRelationship(
  cellId: string,
  parentId: string,
  cellMap: Map<string, Cell>,
): boolean {
  const visited = new Set<string>();
  let currentId: string | null = parentId;

  // Traverse up the parent chain
  while (currentId && currentId !== null) {
    // If we've seen this cell before, we have a cycle
    if (visited.has(currentId)) {
      return true;
    }

    // If we've reached the original cell, we have a cycle
    if (currentId === cellId) {
      return true;
    }

    visited.add(currentId);

    // Move to the next parent
    const currentCell = cellMap.get(currentId);
    if (!currentCell) {
      break; // Parent doesn't exist, no cycle
    }

    const nextParent = currentCell['parent'] as string | null | undefined;
    currentId = nextParent || null;

    // Safety check: prevent infinite loops
    if (visited.size > 100) {
      return true; // Assume circular if chain is too long
    }
  }

  return false;
}

/**
 * Validate relationships for cells affected by a patch operation
 * This is used for incremental WebSocket updates where only some cells changed
 *
 * @param affectedCellIds - IDs of cells that were added or updated
 * @param allCells - Complete current cell array including the changes
 * @param logger - Logger service
 * @returns ValidationResult with any fixes applied
 */
export function validateAffectedCellRelationships(
  affectedCellIds: string[],
  allCells: Cell[],
  logger: LoggerService,
): ValidationResult {
  // Build cell map
  const cellMap = new Map<string, Cell>();
  allCells.forEach(cell => cellMap.set(cell.id, cell));

  // Find all cells that need validation:
  // 1. The affected cells themselves
  // 2. Any cells that reference affected cells as parents
  // 3. Any cells that are children of affected cells
  const cellsToValidate = new Set<string>();

  affectedCellIds.forEach(affectedId => {
    cellsToValidate.add(affectedId);

    // Add children of affected cell
    allCells.forEach(cell => {
      const parent = cell['parent'] as string | null | undefined;
      if (parent === affectedId) {
        cellsToValidate.add(cell.id);
      }
    });

    // Add parent of affected cell (to validate it still exists)
    const affectedCell = cellMap.get(affectedId);
    const affectedParent = affectedCell?.['parent'] as string | null | undefined;
    if (affectedParent) {
      cellsToValidate.add(affectedParent);
    }
  });

  logger.debugComponent('CellRelationshipValidation', 'Validating affected cell relationships', {
    affectedCells: affectedCellIds.length,
    totalCellsToValidate: cellsToValidate.size,
    affectedCellIds,
    cellsToValidateIds: Array.from(cellsToValidate),
  });

  // Validate the full array but only report issues for affected cells
  const result = validateAndFixParentChildRelationships(allCells, logger);

  // Filter issues to only those involving affected cells
  const relevantIssues = result.issues.filter(
    issue =>
      cellsToValidate.has(issue.childId) || (issue.parentId && cellsToValidate.has(issue.parentId)),
  );

  return {
    ...result,
    issues: relevantIssues,
    fixCount: relevantIssues.length,
    hadIssues: relevantIssues.length > 0,
  };
}
