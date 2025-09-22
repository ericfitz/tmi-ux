/**
 * Validator for edge-related operations
 */

import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../../core/services/logger.service';
import { BaseOperationValidator } from './base-operation-validator';
import {
  GraphOperation,
  OperationContext,
  ValidationResult,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation
} from '../../types/graph-operation.types';

@Injectable()
export class EdgeOperationValidator extends BaseOperationValidator {
  readonly priority = 100;

  constructor(logger: LoggerService) {
    super(logger);
  }

  canValidate(operation: GraphOperation): boolean {
    return ['create-edge', 'update-edge', 'delete-edge'].includes(operation.type);
  }

  validate(operation: GraphOperation, context: OperationContext): ValidationResult {
    this.logValidationStart(operation);

    let result: ValidationResult;

    try {
      switch (operation.type) {
        case 'create-edge':
          result = this.validateCreateEdge(operation as CreateEdgeOperation, context);
          break;
        case 'update-edge':
          result = this.validateUpdateEdge(operation as UpdateEdgeOperation, context);
          break;
        case 'delete-edge':
          result = this.validateDeleteEdge(operation as DeleteEdgeOperation, context);
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

  private validateCreateEdge(operation: CreateEdgeOperation, context: OperationContext): ValidationResult {
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

    const edgeData = operation.edgeData;

    // Validate edge ID if provided
    if (edgeData.id) {
      const idError = this.validateCellId(edgeData.id, 'Edge ID');
      if (idError) {
        errors.push(idError);
      }

      // Check for ID conflicts
      if (this.getCell(context.graph, edgeData.id)) {
        errors.push(`Edge with ID '${edgeData.id}' already exists`);
      }
    }

    // Validate source node
    const sourceIdError = this.validateCellId(edgeData.sourceNodeId, 'Source node ID');
    if (sourceIdError) {
      errors.push(sourceIdError);
    } else {
      const sourceNode = this.getNode(context.graph, edgeData.sourceNodeId);
      if (!sourceNode) {
        errors.push(`Source node '${edgeData.sourceNodeId}' not found`);
      }
    }

    // Validate target node
    const targetIdError = this.validateCellId(edgeData.targetNodeId, 'Target node ID');
    if (targetIdError) {
      errors.push(targetIdError);
    } else {
      const targetNode = this.getNode(context.graph, edgeData.targetNodeId);
      if (!targetNode) {
        errors.push(`Target node '${edgeData.targetNodeId}' not found`);
      }
    }

    // Check for self-loops
    if (edgeData.sourceNodeId === edgeData.targetNodeId) {
      warnings.push('Creating self-loop edge (source and target are the same node)');
    }

    // Check for duplicate edges
    if (errors.length === 0) { // Only check if nodes exist
      const existingEdges = context.graph.getEdges();
      const duplicateEdge = existingEdges.find(edge => {
        const source = edge.getSource();
        const target = edge.getTarget();
        const sourceId = typeof source === 'object' ? source.cell : source;
        const targetId = typeof target === 'object' ? target.cell : target;
        return sourceId === edgeData.sourceNodeId && targetId === edgeData.targetNodeId;
      });

      if (duplicateEdge) {
        warnings.push(`Similar edge already exists between these nodes (ID: ${duplicateEdge.id})`);
      }
    }

    // Validate edge type
    if (!edgeData.edgeType) {
      warnings.push('Edge type not specified, will default to "dataflow"');
    } else {
      const validEdgeTypes = ['dataflow', 'control-flow', 'trust-boundary'];
      if (!validEdgeTypes.includes(edgeData.edgeType)) {
        warnings.push(`Unusual edge type '${edgeData.edgeType}', expected one of: ${validEdgeTypes.join(', ')}`);
      }
    }

    // Validate label
    if (edgeData.label !== undefined && edgeData.label !== null) {
      if (typeof edgeData.label !== 'string') {
        errors.push('Edge label must be a string');
      } else if (edgeData.label.length > 50) {
        warnings.push('Edge label is very long, consider shortening for better display');
      }
    }

    // Validate style properties
    if (edgeData.style) {
      this.validateEdgeStyle(edgeData.style, errors, warnings);
    }

    return errors.length > 0 ? this.createInvalidResult(errors, warnings) : this.createValidResult(warnings);
  }

  private validateUpdateEdge(operation: UpdateEdgeOperation, context: OperationContext): ValidationResult {
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

    // Validate edge ID
    const idError = this.validateCellId(operation.edgeId, 'Edge ID');
    if (idError) {
      errors.push(idError);
    }

    // Check that edge exists
    const edge = this.getEdge(context.graph, operation.edgeId);
    if (!edge) {
      errors.push(`Edge with ID '${operation.edgeId}' not found`);
      return this.createInvalidResult(errors, warnings);
    }

    const updates = operation.updates;

    // Validate new source node if being updated
    if (updates.sourceNodeId) {
      const sourceIdError = this.validateCellId(updates.sourceNodeId, 'New source node ID');
      if (sourceIdError) {
        errors.push(sourceIdError);
      } else {
        const sourceNode = this.getNode(context.graph, updates.sourceNodeId);
        if (!sourceNode) {
          errors.push(`New source node '${updates.sourceNodeId}' not found`);
        }
      }
    }

    // Validate new target node if being updated
    if (updates.targetNodeId) {
      const targetIdError = this.validateCellId(updates.targetNodeId, 'New target node ID');
      if (targetIdError) {
        errors.push(targetIdError);
      } else {
        const targetNode = this.getNode(context.graph, updates.targetNodeId);
        if (!targetNode) {
          errors.push(`New target node '${updates.targetNodeId}' not found`);
        }
      }
    }

    // Check for self-loops if both source and target are being updated
    const newSourceId = updates.sourceNodeId;
    const newTargetId = updates.targetNodeId;
    if (newSourceId && newTargetId && newSourceId === newTargetId) {
      warnings.push('Update will create self-loop edge (source and target are the same node)');
    }

    // Validate label update
    if (updates.label !== undefined && updates.label !== null) {
      if (typeof updates.label !== 'string') {
        errors.push('Edge label must be a string');
      } else if (updates.label.length > 50) {
        warnings.push('Edge label is very long, consider shortening for better display');
      }
    }

    // Validate style updates
    if (updates.style) {
      this.validateEdgeStyle(updates.style, errors, warnings);
    }

    return errors.length > 0 ? this.createInvalidResult(errors, warnings) : this.createValidResult(warnings);
  }

  private validateDeleteEdge(operation: DeleteEdgeOperation, context: OperationContext): ValidationResult {
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

    // Validate edge ID
    const idError = this.validateCellId(operation.edgeId, 'Edge ID');
    if (idError) {
      errors.push(idError);
    }

    // Check that edge exists (warning only - deletion of non-existent edge is often acceptable)
    const edge = this.getEdge(context.graph, operation.edgeId);
    if (!edge) {
      warnings.push(`Edge with ID '${operation.edgeId}' not found - deletion will be skipped`);
    }

    return errors.length > 0 ? this.createInvalidResult(errors, warnings) : this.createValidResult(warnings);
  }

  private validateEdgeStyle(style: any, errors: string[], warnings: string[]): void {
    // Validate colors
    if (style.stroke && !this.isValidColor(style.stroke)) {
      errors.push(`Invalid stroke color: ${style.stroke}`);
    }
    if (style.textColor && !this.isValidColor(style.textColor)) {
      errors.push(`Invalid text color: ${style.textColor}`);
    }
    if (style.labelBackground && !this.isValidColor(style.labelBackground)) {
      errors.push(`Invalid label background color: ${style.labelBackground}`);
    }
    if (style.labelBorder && !this.isValidColor(style.labelBorder)) {
      errors.push(`Invalid label border color: ${style.labelBorder}`);
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
      } else if (style.fontSize > 18) {
        warnings.push('Very large font size may not fit well on edge');
      }
    }

    // Validate stroke dash array
    if (style.strokeDasharray !== undefined) {
      if (typeof style.strokeDasharray === 'string') {
        // Basic validation for dash array format
        if (!/^[\d\s,.-]+$/.test(style.strokeDasharray)) {
          errors.push('Invalid stroke dash array format');
        }
      } else if (style.strokeDasharray !== null) {
        errors.push('Stroke dash array must be a string or null');
      }
    }
  }

  private isValidColor(color: string): boolean {
    // Basic color validation - hex colors and common named colors
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return true; // Hex color
    }
    
    const namedColors = ['red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'grey'];
    if (namedColors.includes(color.toLowerCase())) {
      return true; // Named color
    }

    return false;
  }
}