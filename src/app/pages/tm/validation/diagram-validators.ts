/**
 * Diagram type-specific validators
 * Provides flexible validation for different diagram types and versions
 */

import { DiagramValidator, ValidationError, ValidationContext } from './types';
import { BaseValidator, ValidationUtils } from './base-validator';

/**
 * Abstract base class for diagram validators
 */
export abstract class BaseDiagramValidator extends BaseValidator implements DiagramValidator {
  abstract diagramType: string;
  abstract versionPattern: RegExp;

  /**
   * Validate a diagram object
   */
  validate(diagram: any, context: ValidationContext): ValidationError[] {
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
   * Perform diagram type-specific validation (to be implemented by subclasses)
   */
  protected abstract validateDiagramSpecific(diagram: any, context: ValidationContext): void;

  /**
   * Validate cells within the diagram (to be implemented by subclasses)
   */
  abstract validateCells(cells: any[], context: ValidationContext): ValidationError[];
}

/**
 * Data Flow Diagram (DFD) validator
 * Supports DFD-1.0.0 and future minor versions (1.0.x)
 */
export class DfdDiagramValidator extends BaseDiagramValidator {
  diagramType = 'DFD-1.0.0';
  versionPattern = /^DFD-1\.0\.\d+$/;

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

  protected validateDiagramSpecific(_diagram: any, _context: ValidationContext): void {
    // No additional validation needed for base DFD structure
    // Future versions could add specific validation rules here
  }

  validateCells(cells: any[], context: ValidationContext): ValidationError[] {
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

  /**
   * Validate a single DFD cell
   */
  private validateDfdCell(cell: any, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!cell || typeof cell !== 'object') {
      errors.push(
        ValidationUtils.createError('INVALID_CELL', 'Cell must be a valid object', cellPath),
      );
      return errors;
    }

    // Required fields
    if (!cell.id || typeof cell.id !== 'string') {
      errors.push(
        ValidationUtils.createError(
          'MISSING_CELL_ID',
          'Cell must have a valid string id',
          ValidationUtils.buildPath(cellPath, 'id'),
        ),
      );
    }

    // Validate vertex/edge properties
    const isVertex = cell.vertex === true;
    const isEdge = cell.edge === true;

    if (!isVertex && !isEdge) {
      errors.push(
        ValidationUtils.createError(
          'INVALID_CELL_TYPE',
          'Cell must be either a vertex (vertex: true) or edge (edge: true)',
          cellPath,
        ),
      );
    }

    if (isVertex && isEdge) {
      errors.push(
        ValidationUtils.createError(
          'AMBIGUOUS_CELL_TYPE',
          'Cell cannot be both vertex and edge',
          cellPath,
        ),
      );
    }

    // Validate vertex-specific properties
    if (isVertex) {
      const vertexErrors = this.validateVertexCell(cell, cellPath);
      errors.push(...vertexErrors);
    }

    // Validate edge-specific properties
    if (isEdge) {
      const edgeErrors = this.validateEdgeCell(cell, cellPath);
      errors.push(...edgeErrors);
    }

    return errors;
  }

  /**
   * Validate vertex cell properties
   */
  private validateVertexCell(cell: any, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate geometry for vertices
    if (cell.geometry) {
      const geometry = cell.geometry;
      const geometryPath = ValidationUtils.buildPath(cellPath, 'geometry');

      if (typeof geometry.x !== 'number' || typeof geometry.y !== 'number') {
        errors.push(
          ValidationUtils.createError(
            'INVALID_GEOMETRY',
            'Vertex geometry must have numeric x and y coordinates',
            geometryPath,
          ),
        );
      }

      if (typeof geometry.width !== 'number' || typeof geometry.height !== 'number') {
        errors.push(
          ValidationUtils.createError(
            'INVALID_GEOMETRY',
            'Vertex geometry must have numeric width and height',
            geometryPath,
          ),
        );
      }

      if (geometry.width <= 0 || geometry.height <= 0) {
        errors.push(
          ValidationUtils.createError(
            'INVALID_DIMENSIONS',
            'Vertex dimensions must be positive numbers',
            geometryPath,
            'warning',
          ),
        );
      }
    }

    return errors;
  }

  /**
   * Validate edge cell properties
   */
  private validateEdgeCell(cell: any, cellPath: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Edges should have source and target
    if (!cell.source || typeof cell.source !== 'string') {
      errors.push(
        ValidationUtils.createError(
          'MISSING_EDGE_SOURCE',
          'Edge must have a valid source cell id',
          ValidationUtils.buildPath(cellPath, 'source'),
        ),
      );
    }

    if (!cell.target || typeof cell.target !== 'string') {
      errors.push(
        ValidationUtils.createError(
          'MISSING_EDGE_TARGET',
          'Edge must have a valid target cell id',
          ValidationUtils.buildPath(cellPath, 'target'),
        ),
      );
    }

    // Self-referencing edges warning
    if (cell.source === cell.target) {
      errors.push(
        ValidationUtils.createError(
          'SELF_REFERENCING_EDGE',
          'Edge references itself (source equals target)',
          cellPath,
          'warning',
          { source: cell.source, target: cell.target },
        ),
      );
    }

    return errors;
  }

  /**
   * Validate relationships between cells
   */
  private validateCellRelationships(cells: any[], basePath: string): ValidationError[] {
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
      if (cell?.edge && cell.source && cell.target) {
        const cellPath = ValidationUtils.buildPath(basePath, index);

        // Check if source exists
        if (!cellIds.has(cell.source)) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_EDGE_SOURCE',
              `Edge source '${cell.source}' does not reference an existing cell`,
              ValidationUtils.buildPath(cellPath, 'source'),
              'error',
              { sourceId: cell.source, availableIds: Array.from(cellIds) },
            ),
          );
        }

        // Check if target exists
        if (!cellIds.has(cell.target)) {
          errors.push(
            ValidationUtils.createError(
              'INVALID_EDGE_TARGET',
              `Edge target '${cell.target}' does not reference an existing cell`,
              ValidationUtils.buildPath(cellPath, 'target'),
              'error',
              { targetId: cell.target, availableIds: Array.from(cellIds) },
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
