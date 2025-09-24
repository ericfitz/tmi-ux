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
export abstract class BaseOperationValidator implements OperationValidator {
  abstract readonly priority: number;

  constructor(protected logger: LoggerService) {}

  abstract canValidate(operation: GraphOperation): boolean;
  abstract validate(operation: GraphOperation, context: OperationContext): ValidationResult;

  /**
   * Create a successful validation result
   */
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
  protected getCell(graph: Graph | null, cellId: string): Cell | null {
    if (!graph) {
      return null;
    }
    return graph.getCellById(cellId);
  }

  /**
   * Safely get a node from the graph
   */
  protected getNode(graph: Graph | null, nodeId: string): Node | null {
    const cell = this.getCell(graph, nodeId);
    return cell?.isNode() ? cell : null;
  }

  /**
   * Safely get an edge from the graph
   */
  protected getEdge(graph: Graph | null, edgeId: string): Edge | null {
    const cell = this.getCell(graph, edgeId);
    return cell?.isEdge() ? cell : null;
  }

  /**
   * Check if graph is available
   */
  protected validateGraphExists(graph: Graph | null): boolean {
    return graph !== null;
  }

  /**
   * Validate that a string is not empty
   */
  protected validateNotEmpty(value: string | undefined | null, fieldName: string): string | null {
    if (!value || value.trim() === '') {
      return `${fieldName} cannot be empty`;
    }
    return null;
  }

  /**
   * Validate that a number is positive
   */
  protected validatePositive(value: number | undefined | null, fieldName: string): string | null {
    if (value === undefined || value === null || value <= 0) {
      return `${fieldName} must be a positive number`;
    }
    return null;
  }

  /**
   * Validate that coordinates are valid
   */
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
  protected logValidationStart(operation: GraphOperation): void {
    this.logger.debug(`Validating ${operation.type} operation`, {
      operationId: operation.id,
      source: operation.source,
    });
  }

  /**
   * Log validation result
   */
  protected logValidationResult(operation: GraphOperation, result: ValidationResult): void {
    if (result.valid) {
      this.logger.debug(`Validation passed for ${operation.type}`, {
        operationId: operation.id,
        warnings: result.warnings,
      });
    } else {
      this.logger.warn(`Validation failed for ${operation.type}`, {
        operationId: operation.id,
        errors: result.errors,
        warnings: result.warnings,
      });
    }
  }
}
