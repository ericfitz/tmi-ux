/**
 * Validator for node-related operations
 */

import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { isValidColor } from '@app/shared/utils/color-validation.util';
import { BaseOperationValidator } from './base-operation-validator';
import {
  GraphOperation,
  OperationContext,
  ValidationResult,
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
} from '../../types/graph-operation.types';

@Injectable()
// SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate create, update, and delete node operations against graph context (pure)
export class NodeOperationValidator extends BaseOperationValidator {
  readonly priority = 100;

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register the logger dependency on the base validator (pure)
  constructor(logger: LoggerService) {
    super(logger);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: report whether this validator handles node-typed graph operations (pure)
  canValidate(operation: GraphOperation): boolean {
    return ['create-node', 'update-node', 'delete-node'].includes(operation.type);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch a node operation to the appropriate validation method and return the result (pure)
  validate(operation: GraphOperation, context: OperationContext): ValidationResult {
    this.logValidationStart(operation);

    let result: ValidationResult;

    try {
      switch (operation.type) {
        case 'create-node':
          result = this.validateCreateNode(operation as CreateNodeOperation, context);
          break;
        case 'update-node':
          result = this.validateUpdateNode(operation as UpdateNodeOperation, context);
          break;
        case 'delete-node':
          result = this.validateDeleteNode(operation as DeleteNodeOperation, context);
          break;
        default:
          result = this.createInvalidResult([`Unsupported operation type: ${operation.type}`]);
      }
    } catch (error) {
      this.logger.error('Validation error', { operationId: operation.id, error });
      result = this.createInvalidResult([`Validation error: ${String(error)}`]);
    }

    this.logValidationResult(operation, result);
    return result;
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate a create-node operation for ID conflicts, type, position, size, and style (pure)
  private validateCreateNode(
    operation: CreateNodeOperation,
    context: OperationContext,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check graph availability
    if (!this.validateGraphExists(context.graph)) {
      errors.push('Graph is not available');
      return this.createInvalidResult(errors);
    }

    // Check permissions
    const permissionError = this.validatePermissions(operation, context);
    if (permissionError) {
      errors.push(permissionError);
    }

    const nodeData = operation.nodeData;

    // Validate node ID if provided (will be generated if not)
    if (nodeData.id) {
      const idError = this.validateCellId(nodeData.id, 'Node ID');
      if (idError) {
        errors.push(idError);
      }

      // Check for ID conflicts
      if (this.getCell(context.graph, nodeData.id)) {
        errors.push(`Node with ID '${nodeData.id}' already exists`);
      }
    }

    // Validate node type
    if (!nodeData.nodeType) {
      warnings.push('Node type not specified, will default to "process"');
    } else {
      const validNodeTypes = ['process', 'external-entity', 'data-store', 'trust-boundary'];
      if (!validNodeTypes.includes(nodeData.nodeType)) {
        warnings.push(
          `Unusual node type '${nodeData.nodeType}', expected one of: ${validNodeTypes.join(', ')}`,
        );
      }
    }

    // Validate position if provided
    if (nodeData.position) {
      const positionError = this.validateCoordinates(nodeData.position.x, nodeData.position.y);
      if (positionError) {
        errors.push(positionError);
      }
    }

    // Validate size if provided
    if (nodeData.size) {
      this._validateNodeSize(nodeData.size, errors, warnings);
    }

    // Validate label
    if (nodeData.label !== undefined && nodeData.label !== null) {
      if (typeof nodeData.label !== 'string') {
        errors.push('Node label must be a string');
      } else if (nodeData.label.length > 100) {
        warnings.push('Node label is very long, consider shortening for better display');
      }
    }

    // Validate style properties
    if (nodeData.style) {
      this.validateNodeStyle(nodeData.style, errors, warnings);
    }

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate an update-node operation ensuring the node exists and proposed changes are legal (pure)
  private validateUpdateNode(
    operation: UpdateNodeOperation,
    context: OperationContext,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check graph availability
    if (!this.validateGraphExists(context.graph)) {
      errors.push('Graph is not available');
      return this.createInvalidResult(errors);
    }

    // Check permissions
    const permissionError = this.validatePermissions(operation, context);
    if (permissionError) {
      errors.push(permissionError);
    }

    // Validate node ID
    const idError = this.validateCellId(operation.nodeId, 'Node ID');
    if (idError) {
      errors.push(idError);
    }

    // Check that node exists
    const node = this.getNode(context.graph, operation.nodeId);
    if (!node) {
      errors.push(`Node with ID '${operation.nodeId}' not found`);
      return this.createInvalidResult(errors, warnings);
    }

    const updates = operation.updates;

    // Validate position update
    if (updates.position) {
      const positionError = this.validateCoordinates(updates.position.x, updates.position.y);
      if (positionError) {
        errors.push(positionError);
      }
    }

    // Validate size update
    if (updates.size) {
      const sizeError = this.validateSize(updates.size.width, updates.size.height);
      if (sizeError) {
        errors.push(sizeError);
      }
    }

    // Validate label update
    if (updates.label !== undefined && updates.label !== null) {
      if (typeof updates.label !== 'string') {
        errors.push('Node label must be a string');
      } else if (updates.label.length > 100) {
        warnings.push('Node label is very long, consider shortening for better display');
      }
    }

    // Validate style updates
    if (updates.style) {
      this.validateNodeStyle(updates.style, errors, warnings);
    }

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a delete-node operation, warning about connected edges (pure)
  private validateDeleteNode(
    operation: DeleteNodeOperation,
    context: OperationContext,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check graph availability
    if (!this.validateGraphExists(context.graph)) {
      errors.push('Graph is not available');
      return this.createInvalidResult(errors);
    }

    // Check permissions
    const permissionError = this.validatePermissions(operation, context);
    if (permissionError) {
      errors.push(permissionError);
    }

    // Validate node ID
    const idError = this.validateCellId(operation.nodeId, 'Node ID');
    if (idError) {
      errors.push(idError);
    }

    // Check that node exists (warning only - deletion of non-existent node is often acceptable)
    const node = this.getNode(context.graph, operation.nodeId);
    if (!node) {
      warnings.push(`Node with ID '${operation.nodeId}' not found - deletion will be skipped`);
    } else {
      // Warn about connected edges
      const connectedEdges = context.graph.getConnectedEdges(node);
      if (connectedEdges.length > 0) {
        warnings.push(`Deleting node will also remove ${connectedEdges.length} connected edge(s)`);
      }
    }

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: validate node dimensions are positive and within recommended min/max bounds (pure)
  private _validateNodeSize(
    size: { width: number; height: number },
    errors: string[],
    warnings: string[],
  ): void {
    const sizeError = this.validateSize(size.width, size.height);
    if (sizeError) {
      errors.push(sizeError);
    }

    const maxSize = 1000;
    const minSize = 10;
    if (size.width > maxSize || size.height > maxSize) {
      warnings.push(
        `Node size is very large (${size.width}x${size.height}), maximum recommended is ${maxSize}x${maxSize}`,
      );
    }
    if (size.width < minSize || size.height < minSize) {
      warnings.push(
        `Node size is very small (${size.width}x${size.height}), minimum recommended is ${minSize}x${minSize}`,
      );
    }
  }

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: validate node style colors, stroke width, and font size are within acceptable ranges (pure)
  private validateNodeStyle(style: any, errors: string[], warnings: string[]): void {
    // Validate colors
    if (style.fill && !isValidColor(style.fill)) {
      errors.push(`Invalid fill color: ${style.fill}`);
    }
    if (style.stroke && !isValidColor(style.stroke)) {
      errors.push(`Invalid stroke color: ${style.stroke}`);
    }
    if (style.textColor && !isValidColor(style.textColor)) {
      errors.push(`Invalid text color: ${style.textColor}`);
    }

    // Validate stroke width
    if (style.strokeWidth !== undefined) {
      const strokeWidthError = this.validatePositive(style.strokeWidth, 'Stroke width');
      if (strokeWidthError) {
        errors.push(strokeWidthError);
      } else if (style.strokeWidth > 10) {
        warnings.push('Very thick stroke width may affect visual appearance');
      }
    }

    // Validate font size
    if (style.fontSize !== undefined) {
      const fontSizeError = this.validatePositive(style.fontSize, 'Font size');
      if (fontSizeError) {
        errors.push(fontSizeError);
      } else if (style.fontSize < 8) {
        warnings.push('Very small font size may be difficult to read');
      } else if (style.fontSize > 24) {
        warnings.push('Very large font size may not fit well in node');
      }
    }
  }
}
