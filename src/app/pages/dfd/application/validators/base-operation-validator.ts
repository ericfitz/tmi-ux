/**
 * Base class for operation validators
 * Provides common functionality and patterns for all graph operation validators
 */

import { Injectable } from '@angular/core';
import { Graph, Cell, Node, Edge } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  GraphOperation,
  OperationContext,
  OperationValidator,
  ValidationResult,
} from '../../types/graph-operation.types';

/**
 * Abstract base validator providing common functionality
 */
@Injectable()
// SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: abstract base providing shared validation helpers for graph operations (pure)
export abstract class BaseOperationValidator implements OperationValidator {
  abstract readonly priority: number;

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register the logger dependency for subclass validators (pure)
  constructor(protected logger: LoggerService) {}

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: filter whether this validator handles the given graph operation (pure)
  abstract canValidate(operation: GraphOperation): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a graph operation against the current context and return result (pure)
  abstract validate(operation: GraphOperation, context: OperationContext): ValidationResult;

  /**
   * Create a successful validation result
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a successful ValidationResult with optional warnings (pure)
  protected createValidResult(warnings: string[] = []): ValidationResult {
    return {
      valid: true,
      errors: [],
      warnings,
    };
  }

  /**
   * Create a failed validation result
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a failed ValidationResult with errors and optional warnings (pure)
  protected createInvalidResult(errors: string[], warnings: string[] = []): ValidationResult {
    return {
      valid: false,
      errors,
      warnings,
    };
  }

  /**
   * Safely get a cell from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a graph cell by ID, returning null if graph or cell is absent (pure)
  protected getCell(graph: Graph | null, cellId: string): Cell | null {
    if (!graph) {
      return null;
    }
    return graph.getCellById(cellId);
  }

  /**
   * Safely get a node from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a node cell by ID, returning null if absent or not a node (pure)
  protected getNode(graph: Graph | null, nodeId: string): Node | null {
    const cell = this.getCell(graph, nodeId);
    return cell?.isNode() ? cell : null;
  }

  /**
   * Safely get an edge from the graph
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch an edge cell by ID, returning null if absent or not an edge (pure)
  protected getEdge(graph: Graph | null, edgeId: string): Edge | null {
    const cell = this.getCell(graph, edgeId);
    return cell?.isEdge() ? cell : null;
  }

  /**
   * Check if graph is available
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate that a graph reference is non-null (pure)
  protected validateGraphExists(graph: Graph | null): boolean {
    return graph !== null;
  }

  /**
   * Validate that a string is not empty
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a string field is non-empty, returning an error message or null (pure)
  protected validateNotEmpty(value: string | undefined | null, fieldName: string): string | null {
    if (!value || value.trim() === '') {
      return `${fieldName} cannot be empty`;
    }
    return null;
  }

  /**
   * Validate that a number is positive
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a numeric field is positive, returning an error message or null (pure)
  protected validatePositive(value: number | undefined | null, fieldName: string): string | null {
    if (value === undefined || value === null || value <= 0) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  }

  /**
   * Validate that coordinates are valid
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate x/y position coordinates are finite numbers, returning error or null (pure)
  protected validateCoordinates(
    x: number | undefined | null,
    y: number | undefined | null,
  ): string | null {
    if (x === undefined || x === null || y === undefined || y === null) {
      return 'Position coordinates (x, y) are required';
    }
    if (typeof x !== 'number' || typeof y !== 'number') {
      return 'Position coordinates must be numbers';
    }
    if (!isFinite(x) || !isFinite(y)) {
      return 'Position coordinates must be finite numbers';
    }
    return null;
  }

  /**
   * Validate that size dimensions are valid
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate width/height dimensions are positive finite numbers, returning error or null (pure)
  protected validateSize(
    width: number | undefined | null,
    height: number | undefined | null,
  ): string | null {
    if (width === undefined || width === null || height === undefined || height === null) {
      return 'Size dimensions (width, height) are required';
    }
    if (typeof width !== 'number' || typeof height !== 'number') {
      return 'Size dimensions must be numbers';
    }
    if (width <= 0 || height <= 0) {
      return 'Size dimensions must be positive';
    }
    if (!isFinite(width) || !isFinite(height)) {
      return 'Size dimensions must be finite numbers';
    }
    return null;
  }

  /**
   * Validate that a cell ID is properly formatted
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a cell ID is non-empty and contains only allowed characters (pure)
  protected validateCellId(cellId: string | undefined | null, fieldName: string): string | null {
    if (!cellId || cellId.trim() === '') {
      return `${fieldName} is required`;
    }
    // Basic ID format validation - could be more sophisticated
    if (!/^[a-zA-Z0-9_-]+$/.test(cellId)) {
      return `${fieldName} contains invalid characters`;
    }
    return null;
  }

  /**
   * Validate operation permissions
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate the operation context grants the required permission (pure)
  protected validatePermissions(
    operation: GraphOperation,
    context: OperationContext,
  ): string | null {
    // If no permissions provided, assume allowed
    if (!context.permissions || context.permissions.length === 0) {
      return null;
    }

    const requiredPermission = this.getRequiredPermission(operation.type);
    if (requiredPermission && !context.permissions.includes(requiredPermission)) {
      return `Operation ${operation.type} requires ${requiredPermission} permission`;
    }

    return null;
  }

  /**
   * Get the required permission for an operation type
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: map a graph operation type to its required permission string (pure)
  protected getRequiredPermission(operationType: string): string | null {
    switch (operationType) {
      case 'create-node':
      case 'create-edge':
      case 'update-node':
      case 'update-edge':
      case 'delete-node':
      case 'delete-edge':
      case 'batch-operation':
        return 'write';
      case 'load-diagram':
        return 'write'; // Loading typically requires write access
      default:
        return null;
    }
  }

  /**
   * Log validation start
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: log a debug entry when a graph operation validation begins (mutates shared state)
  protected logValidationStart(operation: GraphOperation): void {
    this.logger.debugComponent('BaseOperationValidator', `Validating ${operation.type} operation`, {
      operationId: operation.id,
      source: operation.source,
    });
  }

  /**
   * Log validation result
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: log the validation outcome at debug or warn level after validation completes (mutates shared state)
  protected logValidationResult(operation: GraphOperation, result: ValidationResult): void {
    if (result.valid) {
      this.logger.debugComponent(
        'BaseOperationValidator',
        `Validation passed for ${operation.type}`,
        {
          operationId: operation.id,
          warnings: result.warnings,
        },
      );
    } else {
      this.logger.warn(`Validation failed for ${operation.type}`, {
        operationId: operation.id,
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }
}
