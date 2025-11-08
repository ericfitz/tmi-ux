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
  const issues: ValidationIssue[] = [];
  let fixCount = 0;

  // Create a map of cell ID -> cell for quick lookups
  const cellMap = new Map<string, Cell>();
  cells.forEach(cell => cellMap.set(cell.id, cell));

  // Build a map of parent ID -> child IDs based on parent references
  const parentToChildren = new Map<string, Set<string>>();
  cells.forEach(cell => {
    const parent = cell['parent'] as string | null | undefined;
    if (parent && parent !== null) {
      if (!parentToChildren.has(parent)) {
        parentToChildren.set(parent, new Set());
      }
      parentToChildren.get(parent)!.add(cell.id);
    }
  });

  // Validate each cell with a parent reference
  cells.forEach(cell => {
    const parent = cell['parent'] as string | null | undefined;
    if (!parent || parent === null) {
      return; // No parent, nothing to validate
    }

    const parentCell = cellMap.get(parent);

    // Issue 1: Parent doesn't exist
    if (!parentCell) {
      const issue: ValidationIssue = {
        type: 'missing-parent',
        childId: cell.id,
        parentId: parent,
        message: `Cell ${cell.id} references non-existent parent ${parent}`,
        action: 'Removed parent reference',
      };
      issues.push(issue);
      logger.warn(issue.message, { childId: cell.id, parentId: parent, action: issue.action });

      // Fix: Remove invalid parent reference
      cell['parent'] = null;
      fixCount++;
      return;
    }

    // Issue 2: Check for circular relationships
    if (hasCircularRelationship(cell.id, parent, cellMap)) {
      const issue: ValidationIssue = {
        type: 'circular',
        childId: cell.id,
        parentId: parent,
        message: `Circular parent-child relationship detected for cell ${cell.id}`,
        action: 'Removed parent reference to break cycle',
      };
      issues.push(issue);
      logger.warn(issue.message, { childId: cell.id, parentId: parent, action: issue.action });

      // Fix: Remove parent reference to break cycle
      cell['parent'] = null;
      fixCount++;
      return;
    }

    // Issue 3: Validate embedding rules based on shape types
    const childShape = cell.shape;
    const parentShape = parentCell.shape;

    // Rule 3a: text-box cannot be a parent
    if (EMBEDDING_RULES.CANNOT_BE_PARENT.includes(parentShape)) {
      const issue: ValidationIssue = {
        type: 'invalid-parent-type',
        childId: cell.id,
        parentId: parent,
        message: `Cell ${cell.id} cannot be embedded in ${parentShape} (shape type ${parentShape} cannot contain other nodes)`,
        action: 'Removed parent reference',
      };
      issues.push(issue);
      logger.warn(issue.message, {
        childId: cell.id,
        parentId: parent,
        childShape,
        parentShape,
        action: issue.action,
      });

      // Fix: Remove invalid parent reference
      cell['parent'] = null;
      fixCount++;
      return;
    }

    // Rule 3b: security-boundary can only be embedded in security-boundary
    if (
      childShape === EMBEDDING_RULES.SECURITY_BOUNDARY_RULE.childShape &&
      !EMBEDDING_RULES.SECURITY_BOUNDARY_RULE.allowedParents.includes(parentShape)
    ) {
      const issue: ValidationIssue = {
        type: 'invalid-child-type',
        childId: cell.id,
        parentId: parent,
        message: `Security boundary ${cell.id} can only be embedded in other security boundaries, not ${parentShape}`,
        action: 'Removed parent reference',
      };
      issues.push(issue);
      logger.warn(issue.message, {
        childId: cell.id,
        parentId: parent,
        childShape,
        parentShape,
        action: issue.action,
      });

      // Fix: Remove invalid parent reference
      cell['parent'] = null;
      fixCount++;
      return;
    }
  });

  // Validate reverse direction: if parent.children contains a child, that child must reference the parent
  cells.forEach(cell => {
    const children = cell['children'] as string[] | undefined;
    if (!children || !Array.isArray(children)) {
      return; // No children array, nothing to validate
    }

    // Collect valid children (filter out invalid ones)
    const validChildren: string[] = [];

    children.forEach(childId => {
      const childCell = cellMap.get(childId);

      // Issue 4: Child in parent.children array doesn't exist
      if (!childCell) {
        const issue: ValidationIssue = {
          type: 'missing-child',
          childId: childId,
          parentId: cell.id,
          message: `Cell ${cell.id} has non-existent child ${childId} in children array`,
          action: 'Removed child from children array',
        };
        issues.push(issue);
        logger.warn(issue.message, {
          parentId: cell.id,
          childId: childId,
          action: issue.action,
        });

        // Don't add to validChildren (effectively removes it)
        fixCount++;
        return;
      }

      // Issue 5: Child exists but doesn't reference this cell as parent
      const childParent = childCell['parent'] as string | null | undefined;
      if (childParent !== cell.id) {
        const issue: ValidationIssue = {
          type: 'missing-child',
          childId: childId,
          parentId: cell.id,
          message: `Cell ${cell.id} lists ${childId} as child, but ${childId} doesn't reference ${cell.id} as parent (has parent: ${childParent || 'null'})`,
          action: 'Added parent reference to child',
        };
        issues.push(issue);
        logger.warn(issue.message, {
          parentId: cell.id,
          childId: childId,
          childCurrentParent: childParent || null,
          action: issue.action,
        });

        // Fix: Add parent reference to child
        childCell['parent'] = cell.id;
        fixCount++;
      }

      // Add to valid children
      validChildren.push(childId);
    });

    // Update children array if we removed any invalid entries
    if (validChildren.length !== children.length) {
      cell['children'] = validChildren;
    }
  });

  // Log summary
  if (fixCount > 0) {
    logger.warn('Fixed parent-child relationship issues in diagram cells', {
      totalCells: cells.length,
      issuesFound: issues.length,
      fixesApplied: fixCount,
      issueTypes: issues.reduce(
        (acc, issue) => {
          acc[issue.type] = (acc[issue.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    });
  } else {
    logger.debug('All parent-child relationships validated successfully', {
      totalCells: cells.length,
      cellsWithParents: cells.filter(c => {
        const parent = c['parent'] as string | null | undefined;
        return parent && parent !== null;
      }).length,
    });
  }

  return {
    hadIssues: fixCount > 0,
    fixCount,
    issues,
    cells,
  };
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

  logger.debug('Validating affected cell relationships', {
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
