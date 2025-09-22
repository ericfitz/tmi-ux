/**
 * General validator for common operation validations
 * Applies to all operation types for basic validation requirements
 */

import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../../core/services/logger.service';
import { BaseOperationValidator } from './base-operation-validator';
import {
  GraphOperation,
  OperationContext,
  ValidationResult
} from '../../types/graph-operation.types';

@Injectable()
export class GeneralOperationValidator extends BaseOperationValidator {
  readonly priority = 10; // Low priority - runs after specific validators

  constructor(logger: LoggerService) {
    super(logger);
  }

  canValidate(_operation: GraphOperation): boolean {
    // This validator applies to all operations
    return true;
  }

  validate(_operation: GraphOperation, context: OperationContext): ValidationResult {
    this.logValidationStart(_operation);

    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate operation structure
      this.validateOperationStructure(_operation, errors, warnings);

      // Validate context
      this.validateContext(context, errors, warnings);

      // Validate timing constraints
      this.validateTiming(_operation, context, errors, warnings);

      // Validate collaboration constraints
      this.validateCollaboration(_operation, context, errors, warnings);

    } catch (error) {
      this.logger.error('General validation error', { operationId: _operation.id, error });
      errors.push(`General validation error: ${String(error)}`);
    }

    const result = errors.length > 0 ? this.createInvalidResult(errors, warnings) : this.createValidResult(warnings);
    this.logValidationResult(_operation, result);
    return result;
  }

  private validateOperationStructure(operation: GraphOperation, errors: string[], warnings: string[]): void {
    // Validate required fields
    if (!operation.id) {
      errors.push('Operation ID is required');
    } else if (typeof operation.id !== 'string' || operation.id.trim() === '') {
      errors.push('Operation ID must be a non-empty string');
    }

    if (!operation.type) {
      errors.push('Operation type is required');
    } else if (typeof operation.type !== 'string') {
      errors.push('Operation type must be a string');
    }

    if (!operation.source) {
      warnings.push('Operation source not specified');
    } else if (typeof operation.source !== 'string') {
      errors.push('Operation source must be a string');
    }

    // Validate priority
    if (operation.priority) {
      const validPriorities = ['low', 'normal', 'high', 'critical'];
      if (!validPriorities.includes(operation.priority)) {
        warnings.push(`Unknown priority '${operation.priority}', will default to 'normal'`);
      }
    }

    // Validate timestamp
    if (operation.timestamp) {
      if (typeof operation.timestamp !== 'number' || operation.timestamp <= 0) {
        errors.push('Operation timestamp must be a positive number');
      } else {
        const now = Date.now();
        const ageMs = now - operation.timestamp;
        const maxAgeMs = 5 * 60 * 1000; // 5 minutes

        if (ageMs > maxAgeMs) {
          warnings.push(`Operation is ${Math.round(ageMs / 1000)}s old, may be stale`);
        }

        if (operation.timestamp > now + 1000) { // 1 second tolerance for clock skew
          warnings.push('Operation timestamp is in the future');
        }
      }
    }

    // Validate description
    if (operation.description && typeof operation.description !== 'string') {
      errors.push('Operation description must be a string');
    }
  }

  private validateContext(context: OperationContext, errors: string[], warnings: string[]): void {
    // Validate graph
    if (!context.graph) {
      errors.push('Operation context must include a graph instance');
    }

    // Validate user context
    if (!context.userId) {
      warnings.push('User ID not provided in operation context');
    } else if (typeof context.userId !== 'string' || context.userId.trim() === '') {
      errors.push('User ID must be a non-empty string');
    }

    // Validate diagram context
    if (!context.diagramId) {
      warnings.push('Diagram ID not provided in operation context');
    } else if (typeof context.diagramId !== 'string' || context.diagramId.trim() === '') {
      errors.push('Diagram ID must be a non-empty string');
    }

    // Validate permissions array
    if (context.permissions && !Array.isArray(context.permissions)) {
      errors.push('Permissions must be an array');
    }

    // Validate collaboration mode
    if (typeof context.isCollaborating !== 'boolean') {
      warnings.push('Collaboration mode not clearly specified in context');
    }

    // Validate suppression flags
    if (typeof context.suppressValidation !== 'boolean') {
      // This is fine - defaults to false
    }

    if (typeof context.suppressHistory !== 'boolean') {
      // This is fine - defaults to false
    }

    if (typeof context.suppressBroadcast !== 'boolean') {
      // This is fine - defaults to false
    }
  }

  private validateTiming(operation: GraphOperation, context: OperationContext, errors: string[], warnings: string[]): void {
    // Check for operation conflicts based on timing
    if (context.lastOperationTime) {
      const timeSinceLastOp = operation.timestamp - context.lastOperationTime;
      
      if (timeSinceLastOp < 0) {
        warnings.push('Operation timestamp is before the last operation');
      } else if (timeSinceLastOp < 10) { // Less than 10ms
        warnings.push('Operation follows very quickly after previous operation, possible duplicate');
      }
    }

    // Check operation timeout
    const operationAge = Date.now() - operation.timestamp;
    const timeoutMs = 30000; // 30 seconds
    
    if (operationAge > timeoutMs) {
      warnings.push(`Operation is ${Math.round(operationAge / 1000)}s old and may have timed out`);
    }
  }

  private validateCollaboration(operation: GraphOperation, context: OperationContext, errors: string[], warnings: string[]): void {
    if (!context.isCollaborating) {
      return; // No collaboration constraints in solo mode
    }

    // Check for concurrent modification protection
    if (operation.source === 'user-interaction' && !context.suppressBroadcast) {
      // This operation will be broadcast to other users
      if (!context.sessionId) {
        warnings.push('Session ID not provided for collaborative operation');
      }
    }

    // Check permissions for collaborative operations
    if (context.permissions && context.permissions.length > 0) {
      const hasWritePermission = context.permissions.includes('write');
      const hasAdminPermission = context.permissions.includes('admin');

      if (!hasWritePermission && !hasAdminPermission) {
        const readOnlyTypes = ['load-diagram']; // Operations allowed in read-only mode
        if (!readOnlyTypes.includes(operation.type)) {
          errors.push('Operation requires write permission in collaborative mode');
        }
      }
    }

    // Validate collaborative operation metadata
    if (operation.source === 'websocket-message') {
      // This operation came from another user
      if (!context.originUserId) {
        warnings.push('Origin user ID not provided for collaborative operation');
      } else if (context.originUserId === context.userId) {
        warnings.push('Received collaborative operation from same user');
      }
    }
  }
}