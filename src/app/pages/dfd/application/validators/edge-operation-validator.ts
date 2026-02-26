/**
 * Validator for edge-related operations
 */

import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { isValidColor } from '@app/shared/utils/color-validation.util';
import { BaseOperationValidator } from './base-operation-validator';
import {
  GraphOperation,
  OperationContext,
  ValidationResult,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation,
} from '../../types/graph-operation.types';
import { EdgeAttrs } from '../../domain/value-objects/edge-attrs';
import { EdgeLabel } from '../../domain/value-objects/edge-label';

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

  private validateCreateEdge(
    operation: CreateEdgeOperation,
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

    const edgeInfo = operation.edgeInfo;

    // Validate edge ID
    if (edgeInfo.id) {
      const idError = this.validateCellId(edgeInfo.id, 'Edge ID');
      if (idError) {
        errors.push(idError);
      }

      // Check for ID conflicts
      if (this.getCell(context.graph, edgeInfo.id)) {
        errors.push(`Edge with ID '${edgeInfo.id}' already exists`);
      }
    }

    // Validate source node
    const sourceIdError = this.validateCellId(operation.sourceNodeId, 'Source node ID');
    if (sourceIdError) {
      errors.push(sourceIdError);
    } else {
      const sourceNode = this.getNode(context.graph, operation.sourceNodeId);
      if (!sourceNode) {
        errors.push(`Source node '${operation.sourceNodeId}' not found`);
      }
    }

    // Validate target node
    const targetIdError = this.validateCellId(operation.targetNodeId, 'Target node ID');
    if (targetIdError) {
      errors.push(targetIdError);
    } else {
      const targetNode = this.getNode(context.graph, operation.targetNodeId);
      if (!targetNode) {
        errors.push(`Target node '${operation.targetNodeId}' not found`);
      }
    }

    // Check for self-loops
    if (operation.sourceNodeId === operation.targetNodeId) {
      warnings.push('Creating self-loop edge (source and target are the same node)');
    }

    // Check for duplicate edges (only if no errors so far, i.e., nodes exist)
    if (errors.length === 0) {
      this._checkDuplicateEdge(
        context.graph,
        operation.sourceNodeId,
        operation.targetNodeId,
        warnings,
      );
    }

    // Validate labels
    this.validateEdgeLabels(edgeInfo.labels, errors, warnings);

    // Validate attrs (visual styling)
    if (edgeInfo.attrs) {
      this.validateEdgeAttrs(edgeInfo.attrs, errors, warnings);
    }

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  private _checkDuplicateEdge(
    graph: any,
    sourceNodeId: string,
    targetNodeId: string,
    warnings: string[],
  ): void {
    const existingEdges = graph.getEdges();
    const duplicateEdge = existingEdges.find((edge: any) => {
      const source = edge.getSource();
      const target = edge.getTarget();
      const sourceId = typeof source === 'object' ? source.cell : source;
      const targetId = typeof target === 'object' ? target.cell : target;
      return sourceId === sourceNodeId && targetId === targetNodeId;
    });

    if (duplicateEdge) {
      warnings.push(`Similar edge already exists between these nodes (ID: ${duplicateEdge.id})`);
    }
  }

  private validateUpdateEdge(
    operation: UpdateEdgeOperation,
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
    if (updates.source) {
      const sourceIdError = this.validateCellId(updates.source.cell, 'New source node ID');
      if (sourceIdError) {
        errors.push(sourceIdError);
      } else {
        const sourceNode = this.getNode(context.graph, updates.source.cell);
        if (!sourceNode) {
          errors.push(`New source node '${updates.source.cell}' not found`);
        }
      }
    }

    // Validate new target node if being updated
    if (updates.target) {
      const targetIdError = this.validateCellId(updates.target.cell, 'New target node ID');
      if (targetIdError) {
        errors.push(targetIdError);
      } else {
        const targetNode = this.getNode(context.graph, updates.target.cell);
        if (!targetNode) {
          errors.push(`New target node '${updates.target.cell}' not found`);
        }
      }
    }

    // Check for self-loops if both source and target are being updated
    const newSourceId = updates.source?.cell;
    const newTargetId = updates.target?.cell;
    if (newSourceId && newTargetId && newSourceId === newTargetId) {
      warnings.push('Update will create self-loop edge (source and target are the same node)');
    }

    // Validate label updates
    if (updates.labels !== undefined) {
      this.validateEdgeLabels(updates.labels ?? [], errors, warnings);
    }

    // Validate attrs updates
    if (updates.attrs) {
      this.validateEdgeAttrs(updates.attrs, errors, warnings);
    }

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  private validateDeleteEdge(
    operation: DeleteEdgeOperation,
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

    return errors.length > 0
      ? this.createInvalidResult(errors, warnings)
      : this.createValidResult(warnings);
  }

  private validateEdgeLabels(labels: EdgeLabel[], errors: string[], warnings: string[]): void {
    if (!Array.isArray(labels)) {
      return;
    }

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const labelText = label.attrs?.text?.text;

      if (labelText !== undefined && labelText !== null) {
        if (typeof labelText !== 'string') {
          errors.push(`Edge label ${i} text must be a string`);
        } else if (labelText.length > 50) {
          warnings.push(`Edge label ${i} is very long, consider shortening for better display`);
        }
      }

      // Validate label position if specified
      if (label.position !== undefined && typeof label.position === 'number') {
        if (label.position < 0 || label.position > 1) {
          warnings.push(`Edge label ${i} position should be between 0 and 1`);
        }
      }

      // Validate label text color
      const textFill = label.attrs?.text?.fill;
      if (textFill && !isValidColor(textFill)) {
        errors.push(`Invalid label ${i} text color: ${textFill}`);
      }
    }
  }

  private validateEdgeAttrs(attrs: EdgeAttrs, errors: string[], warnings: string[]): void {
    // Validate line styling
    if (attrs.line) {
      // Validate stroke color
      if (attrs.line.stroke && !isValidColor(attrs.line.stroke)) {
        errors.push(`Invalid stroke color: ${attrs.line.stroke}`);
      }

      // Validate stroke width
      if (attrs.line.strokeWidth !== undefined) {
        const strokeWidthError = this.validatePositive(attrs.line.strokeWidth, 'Stroke width');
        if (strokeWidthError) {
          errors.push(strokeWidthError);
        } else if (attrs.line.strokeWidth > 10) {
          warnings.push('Very thick stroke width may affect visual appearance');
        }
      }

      // Validate stroke dash array
      if (attrs.line.strokeDasharray !== undefined && attrs.line.strokeDasharray !== null) {
        if (typeof attrs.line.strokeDasharray === 'string') {
          if (!/^[\d\s,.-]+$/.test(attrs.line.strokeDasharray)) {
            errors.push('Invalid stroke dash array format');
          }
        } else {
          errors.push('Stroke dash array must be a string or null');
        }
      }

      // Validate target marker
      if (attrs.line.targetMarker?.fill && !isValidColor(attrs.line.targetMarker.fill)) {
        errors.push(`Invalid target marker fill color: ${attrs.line.targetMarker.fill}`);
      }
      if (attrs.line.targetMarker?.stroke && !isValidColor(attrs.line.targetMarker.stroke)) {
        errors.push(`Invalid target marker stroke color: ${attrs.line.targetMarker.stroke}`);
      }

      // Validate source marker
      if (attrs.line.sourceMarker?.fill && !isValidColor(attrs.line.sourceMarker.fill)) {
        errors.push(`Invalid source marker fill color: ${attrs.line.sourceMarker.fill}`);
      }
      if (attrs.line.sourceMarker?.stroke && !isValidColor(attrs.line.sourceMarker.stroke)) {
        errors.push(`Invalid source marker stroke color: ${attrs.line.sourceMarker.stroke}`);
      }
    }

    // Validate text styling
    if (attrs.text) {
      if (attrs.text.fill && !isValidColor(attrs.text.fill)) {
        errors.push(`Invalid text color: ${attrs.text.fill}`);
      }

      if (attrs.text.fontSize !== undefined) {
        const fontSizeError = this.validatePositive(attrs.text.fontSize, 'Font size');
        if (fontSizeError) {
          errors.push(fontSizeError);
        } else if (attrs.text.fontSize < 8) {
          warnings.push('Very small font size may be difficult to read');
        } else if (attrs.text.fontSize > 18) {
          warnings.push('Very large font size may not fit well on edge');
        }
      }
    }
  }
}
