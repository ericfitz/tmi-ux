/**
 * Diagram type-specific validators
 * Provides flexible validation for different diagram types and versions
 */

import { DiagramValidator, ValidationError, ValidationContext } from './types';
import { BaseValidator, ValidationUtils } from './base-validator';
import { Diagram, Cell } from '../models/diagram.model';

/**
 * Abstract base class for diagram validators
 */
export abstract class BaseDiagramValidator extends BaseValidator implements DiagramValidator {
  abstract diagramType: string;
  abstract versionPattern: RegExp;

  /**
   * Validate a diagram object
   */
  validate(diagram: Diagram, context: ValidationContext): ValidationError[] {
    this.clearErrors();

    if (!diagram || typeof diagram !== 'object') {
      this.addError(
        ValidationUtils.createError(
          'INVALID_DIAGRAM',
          'Diagram must be a valid object',
          context.currentPath,
        ),
      );
      return this.getResults().errors;
    }

    // Validate diagram type
    if (!diagram.type || !this.supportsType(diagram.type)) {
      this.addError(
        ValidationUtils.createError(
          'UNSUPPORTED_DIAGRAM_TYPE',
          `Diagram type '${diagram.type}' is not supported by this validator`,
          ValidationUtils.buildPath(context.currentPath, 'type'),
          'error',
          { supportedType: this.diagramType, actualType: diagram.type },
        ),
      );
      return this.getResults().errors;
    }

    // Perform type-specific validation
    this.validateDiagramSpecific(diagram, context);

    // Validate cells if present
    if (diagram.cells) {
      const cellErrors = this.validateCells(diagram.cells, {
        ...context,
        currentPath: ValidationUtils.buildPath(context.currentPath, 'cells'),
      });
      cellErrors.forEach(error => this.addError(error));
    }

    return this.getResults().errors;
  }

  /**
   * Check if this validator supports the given diagram type
   */
  protected supportsType(type: string): boolean {
    return this.versionPattern.test(type);
  }

  /**
   * Validate cells within the diagram (to be implemented by subclasses)
   */
  abstract validateCells(cells: Cell[], context: ValidationContext): ValidationError[];

  /**
   * Perform diagram type-specific validation (to be implemented by subclasses)
   */
  protected abstract validateDiagramSpecific(diagram: Diagram, context: ValidationContext): void;
}

/**
 * Data Flow Diagram (DFD) validator
 * Supports DFD-1.0.0 and future minor versions (1.0.x)
 */
export class DfdDiagramValidator extends BaseDiagramValidator {
  /**
   * Valid cell shapes for DFD diagrams
   */
  private static readonly VALID_DFD_SHAPES = [
    'actor',
    'process',
    'store',
    'security-boundary',
    'textbox',
    'edge',
  ];

  diagramType = 'DFD-1.0.0';
  versionPattern = /^DFD-1\.0\.\d+$/;

  validateCells(cells: Cell[], context: ValidationContext): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Array.isArray(cells)) {
      errors.push(
        ValidationUtils.createError('INVALID_CELLS', 'Cells must be an array', context.currentPath),
      );
      return errors;
    }

    // Validate each cell
    cells.forEach((cell, _index) => {
      const cellPath = ValidationUtils.buildPath(context.currentPath, _index);
      const cellErrors = this.validateDfdCell(cell, cellPath);
      errors.push(...cellErrors);
    });

    // Validate cell relationships
    const relationshipErrors = this.validateCellRelationships(cells, context.currentPath);
    errors.push(...relationshipErrors);

    return errors;
  }

  protected validateDiagramSpecific(_diagram: Diagram, _context: ValidationContext): void {
    // No additional validation needed for base DFD structure
    // Future versions could add specific validation rules here
  }

  /**
   * Validate a single DFD cell
   */
  private validateDfdCell(cell: Cell, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!cell || typeof cell !== 'object') {
      errors.push(
        ValidationUtils.createError('INVALID_CELL', 'Cell must be a valid object', cellPath),
      );
      return errors;
    }

    // Required fields - validate cell.id is a valid UUID string
    if (!cell.id || typeof cell.id !== 'string') {
      errors.push(
        ValidationUtils.createError(
          'MISSING_CELL_ID',
          'Cell must have a valid string id',
          ValidationUtils.buildPath(cellPath, 'id'),
        ),
      );
    } else {
      // Validate UUID format (RFC 4122)
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(cell.id)) {
        errors.push(
          ValidationUtils.createError(
            'INVALID_CELL_ID',
            `Cell id must be a valid UUID. Got: ${cell.id}`,
            ValidationUtils.buildPath(cellPath, 'id'),
          ),
        );
      }
    }

    // Validate cell type based on shape property (per OpenAPI spec)
    const NODE_SHAPES = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
    const EDGE_SHAPES = ['edge'];

    if (!cell.shape || typeof cell.shape !== 'string') {
      errors.push(
        ValidationUtils.createError(
          'MISSING_SHAPE',
          'Cell must have a valid shape property',
          ValidationUtils.buildPath(cellPath, 'shape'),
        ),
      );
      return errors;
    }

    const isNode = NODE_SHAPES.includes(cell.shape);
    const isEdge = EDGE_SHAPES.includes(cell.shape);

    if (!isNode && !isEdge) {
      errors.push(
        ValidationUtils.createError(
          'INVALID_CELL_TYPE',
          `Cell shape '${cell.shape}' is not a valid node or edge type. Valid nodes: ${NODE_SHAPES.join(', ')}. Valid edges: ${EDGE_SHAPES.join(', ')}`,
          ValidationUtils.buildPath(cellPath, 'shape'),
        ),
      );
      return errors;
    }

    // Validate node-specific properties
    if (isNode) {
      const nodeErrors = this.validateNodeCell(cell, cellPath);
      errors.push(...nodeErrors);
    }

    // Validate edge-specific properties
    if (isEdge) {
      const edgeErrors = this.validateEdgeCell(cell, cellPath);
      errors.push(...edgeErrors);
    }

    return errors;
  }

  /**
   * Validate node cell properties
   * Accepts both X6 native flat format (x, y, width, height) and nested format (position, size)
   */
  private validateNodeCell(cell: Cell, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for position in either flat or nested format
    const hasNestedPosition = cell.position && typeof cell.position === 'object';
    const hasFlatPosition = typeof cell['x'] === 'number' && typeof cell['y'] === 'number';

    if (!hasNestedPosition && !hasFlatPosition) {
      errors.push(
        ValidationUtils.createError(
          'MISSING_POSITION',
          'Node must have position (either x,y properties or position object with x,y)',
          cellPath,
        ),
      );
    }

    // Validate nested position format if present
    if (hasNestedPosition) {
      const position = cell.position as { x?: unknown; y?: unknown };
      if (typeof position.x !== 'number' || typeof position.y !== 'number') {
        errors.push(
          ValidationUtils.createError(
            'INVALID_POSITION',
            'Node position object must have numeric x and y coordinates',
            ValidationUtils.buildPath(cellPath, 'position'),
          ),
        );
      }
    }

    // Validate flat position format if present
    if (hasFlatPosition && !hasNestedPosition) {
      // Position values are already validated by type check above
      // Just ensure they are finite numbers
      const x = cell['x'] as number;
      const y = cell['y'] as number;
      if (!isFinite(x) || !isFinite(y)) {
        errors.push(
          ValidationUtils.createError(
            'INVALID_POSITION',
            'Node x,y coordinates must be finite numbers',
            cellPath,
          ),
        );
      }
    }

    // Check for size in either flat or nested format
    const hasNestedSize = cell.size && typeof cell.size === 'object';
    const hasFlatSize = typeof cell['width'] === 'number' && typeof cell['height'] === 'number';

    if (!hasNestedSize && !hasFlatSize) {
      errors.push(
        ValidationUtils.createError(
          'MISSING_SIZE',
          'Node must have size (either width,height properties or size object with width,height)',
          cellPath,
        ),
      );
    }

    // Validate nested size format if present
    if (hasNestedSize) {
      const size = cell.size as { width?: unknown; height?: unknown };
      if (typeof size.width !== 'number' || typeof size.height !== 'number') {
        errors.push(
          ValidationUtils.createError(
            'INVALID_SIZE',
            'Node size object must have numeric width and height',
            ValidationUtils.buildPath(cellPath, 'size'),
          ),
        );
      } else {
        // Validate minimum dimensions per OpenAPI spec (width >= 40, height >= 30)
        if (size.width < 40 || size.height < 30) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_DIMENSIONS',
              `Node dimensions must meet minimum requirements (width >= 40, height >= 30). Got width=${size.width}, height=${size.height}`,
              ValidationUtils.buildPath(cellPath, 'size'),
              'error',
            ),
          );
        }

        // Warn if dimensions are not positive
        if (size.width <= 0 || size.height <= 0) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_DIMENSIONS',
              'Node dimensions must be positive numbers',
              ValidationUtils.buildPath(cellPath, 'size'),
              'warning',
            ),
          );
        }
      }
    }

    // Validate flat size format if present
    if (hasFlatSize && !hasNestedSize) {
      const width = cell['width'] as number;
      const height = cell['height'] as number;

      if (!isFinite(width) || !isFinite(height)) {
        errors.push(
          ValidationUtils.createError(
            'INVALID_SIZE',
            'Node width,height must be finite numbers',
            cellPath,
          ),
        );
      } else {
        // Validate minimum dimensions per OpenAPI spec (width >= 40, height >= 30)
        if (width < 40 || height < 30) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_DIMENSIONS',
              `Node dimensions must meet minimum requirements (width >= 40, height >= 30). Got width=${width}, height=${height}`,
              cellPath,
              'error',
            ),
          );
        }

        // Warn if dimensions are not positive
        if (width <= 0 || height <= 0) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_DIMENSIONS',
              'Node dimensions must be positive numbers',
              cellPath,
              'warning',
            ),
          );
        }
      }
    }

    return errors;
  }

  /**
   * Validate edge cell properties
   */
  private validateEdgeCell(cell: Cell, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Edges should have source and target (can be string or object)
    if (!cell.source) {
      errors.push(
        ValidationUtils.createError(
          'MISSING_EDGE_SOURCE',
          'Edge must have a valid source cell id',
          ValidationUtils.buildPath(cellPath, 'source'),
        ),
      );
    } else if (
      typeof cell.source !== 'string' &&
      (typeof cell.source !== 'object' || !cell.source.cell)
    ) {
      errors.push(
        ValidationUtils.createError(
          'INVALID_EDGE_SOURCE',
          'Edge source must be a string or object with cell property',
          ValidationUtils.buildPath(cellPath, 'source'),
        ),
      );
    }

    if (!cell.target) {
      errors.push(
        ValidationUtils.createError(
          'MISSING_EDGE_TARGET',
          'Edge must have a valid target cell id',
          ValidationUtils.buildPath(cellPath, 'target'),
        ),
      );
    } else if (
      typeof cell.target !== 'string' &&
      (typeof cell.target !== 'object' || !cell.target.cell)
    ) {
      errors.push(
        ValidationUtils.createError(
          'INVALID_EDGE_TARGET',
          'Edge target must be a string or object with cell property',
          ValidationUtils.buildPath(cellPath, 'target'),
        ),
      );
    }

    // Self-referencing edges warning
    const sourceId = typeof cell.source === 'string' ? cell.source : cell.source?.cell;
    const targetId = typeof cell.target === 'string' ? cell.target : cell.target?.cell;
    if (sourceId && targetId && sourceId === targetId) {
      errors.push(
        ValidationUtils.createError(
          'SELF_REFERENCING_EDGE',
          'Edge references itself (source equals target)',
          cellPath,
          'warning',
          { source: sourceId, target: targetId },
        ),
      );
    }

    return errors;
  }

  /**
   * Validate relationships between cells
   */
  private validateCellRelationships(cells: Cell[], basePath: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const cellIds = new Set<string>();
    const duplicateIds: string[] = [];

    // Build cell ID map and check for duplicates
    cells.forEach((cell, _index) => {
      if (cell?.id) {
        if (cellIds.has(cell.id)) {
          duplicateIds.push(cell.id);
        } else {
          cellIds.add(cell.id);
        }
      }
    });

    // Report duplicate IDs
    if (duplicateIds.length > 0) {
      errors.push(
        ValidationUtils.createError(
          'DUPLICATE_CELL_IDS',
          `Duplicate cell IDs found: ${duplicateIds.join(', ')}`,
          basePath,
          'error',
          { duplicateIds },
        ),
      );
    }

    // Validate edge references
    cells.forEach((cell, index) => {
      if (cell?.shape === 'edge' && cell.source && cell.target) {
        const cellPath = ValidationUtils.buildPath(basePath, index);

        // Extract source ID (handle both string and object formats)
        const sourceId = typeof cell.source === 'string' ? cell.source : cell.source.cell;
        // Check if source exists
        if (!cellIds.has(sourceId)) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_EDGE_SOURCE',
              `Edge source '${sourceId}' does not reference an existing cell`,
              ValidationUtils.buildPath(cellPath, 'source'),
              'error',
              { sourceId, availableIds: Array.from(cellIds) },
            ),
          );
        }

        // Extract target ID (handle both string and object formats)
        const targetId = typeof cell.target === 'string' ? cell.target : cell.target.cell;
        // Check if target exists
        if (!cellIds.has(targetId)) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_EDGE_TARGET',
              `Edge target '${targetId}' does not reference an existing cell`,
              ValidationUtils.buildPath(cellPath, 'target'),
              'error',
              { targetId, availableIds: Array.from(cellIds) },
            ),
          );
        }
      }
    });

    return errors;
  }
}

/**
 * Factory for creating diagram validators
 */
export class DiagramValidatorFactory {
  private static validators: DiagramValidator[] = [
    new DfdDiagramValidator(),
    // Future diagram types can be added here
  ];

  /**
   * Get a validator for the specified diagram type
   */
  static getValidator(diagramType: string): DiagramValidator | null {
    return this.validators.find(validator => validator.versionPattern.test(diagramType)) || null;
  }

  /**
   * Register a custom diagram validator
   */
  static registerValidator(validator: DiagramValidator): void {
    // Remove existing validator for the same type pattern
    this.validators = this.validators.filter(
      v => v.versionPattern.source !== validator.versionPattern.source,
    );
    this.validators.push(validator);
  }

  /**
   * Get all supported diagram types
   */
  static getSupportedTypes(): string[] {
    return this.validators.map(v => v.diagramType);
  }
}
