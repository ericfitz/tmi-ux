/**
 * GraphOperationManager - Unified handler for all graph operations
 * 
 * This service replaces the scattered operation logic across multiple services
 * with a single, consistent, and extensible operation processing system.
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, throwError, of } from 'rxjs';
import { map, catchError, tap, switchMap, timeout } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { IGraphOperationManager } from '../interfaces/graph-operation-manager.interface';
import {
  NodeOperationExecutor,
  EdgeOperationExecutor,
  BatchOperationExecutor,
  LoadDiagramExecutor
} from './executors';
import {
  NodeOperationValidator,
  EdgeOperationValidator,
  GeneralOperationValidator
} from './validators';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationConfig,
  OperationStats,
  OperationCompletedEvent,
  OperationValidator,
  OperationExecutor,
  OperationInterceptor,
  DEFAULT_OPERATION_CONFIG,
  BatchOperation
} from '../types/graph-operation.types';

/**
 * Internal operation tracking
 */
interface OperationExecution {
  readonly operation: GraphOperation;
  readonly context: OperationContext;
  readonly startTime: number;
  readonly timeout: any;
}

@Injectable({
  providedIn: 'root'
})
export class GraphOperationManager implements IGraphOperationManager {
  private _config: OperationConfig = { ...DEFAULT_OPERATION_CONFIG };
  private _validators: OperationValidator[] = [];
  private _executors: OperationExecutor[] = [];
  private _interceptors: OperationInterceptor[] = [];
  
  // State tracking
  private _pendingOperations = new Map<string, OperationExecution>();
  private _stats: OperationStats = this._createEmptyStats();
  
  // Event subjects
  private readonly _operationCompleted$ = new Subject<OperationCompletedEvent>();
  private readonly _operationFailed$ = new Subject<{ operation: GraphOperation; error: string }>();
  private readonly _operationValidated$ = new Subject<{ operation: GraphOperation; valid: boolean }>();
  
  // Public observables
  public readonly operationCompleted$ = this._operationCompleted$.asObservable();
  public readonly operationFailed$ = this._operationFailed$.asObservable();
  public readonly operationValidated$ = this._operationValidated$.asObservable();

  constructor(private logger: LoggerService) {
    this.logger.info('GraphOperationManager initialized');
    this._initializeBuiltInExecutors();
    this._initializeBuiltInValidators();
  }

  /**
   * Execute a single operation
   */
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const startTime = Date.now();
    
    this.logger.debug('GraphOperationManager: Executing operation', {
      operationId: operation.id,
      type: operation.type,
      source: operation.source,
      priority: operation.priority
    });

    // Update statistics
    this._stats.totalOperations++;
    this._stats.operationsByType[operation.type] = (this._stats.operationsByType[operation.type] || 0) + 1;
    this._stats.operationsBySource[operation.source] = (this._stats.operationsBySource[operation.source] || 0) + 1;

    // Track pending operation
    const execution: OperationExecution = {
      operation,
      context,
      startTime,
      timeout: setTimeout(() => this._handleTimeout(operation.id), this._config.operationTimeoutMs)
    };
    this._pendingOperations.set(operation.id, execution);

    return this._processOperation(operation, context).pipe(
      timeout(this._config.operationTimeoutMs),
      tap(result => {
        const executionTime = Date.now() - startTime;
        this._handleOperationCompleted(operation, result, context, executionTime);
      }),
      catchError(error => {
        const executionTime = Date.now() - startTime;
        this._handleOperationFailed(operation, error, context, executionTime);
        return throwError(() => error);
      }),
      tap(() => {
        // Clean up tracking
        const execution = this._pendingOperations.get(operation.id);
        if (execution) {
          clearTimeout(execution.timeout);
          this._pendingOperations.delete(operation.id);
        }
      })
    );
  }

  /**
   * Execute multiple operations as a batch
   */
  executeBatch(operations: GraphOperation[], context: OperationContext): Observable<OperationResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    if (operations.length === 1) {
      return this.execute(operations[0], context).pipe(map(result => [result]));
    }

    this.logger.debug('GraphOperationManager: Executing batch operation', {
      operationCount: operations.length,
      types: operations.map(op => op.type)
    });

    // Create a batch operation wrapper
    const batchOperation: BatchOperation = {
      id: uuid(),
      type: 'batch-operation',
      source: operations[0].source,
      priority: Math.max(...operations.map(op => this._getPriorityValue(op.priority))),
      timestamp: Date.now(),
      operations: operations,
      description: `Batch of ${operations.length} operations`
    };

    return this.execute(batchOperation, context).pipe(
      map(batchResult => {
        // Extract individual results from batch result metadata
        return batchResult.metadata?.['individualResults'] as OperationResult[] || [];
      })
    );
  }

  /**
   * Validate an operation
   */
  validate(operation: GraphOperation, context: OperationContext): Observable<boolean> {
    if (!this._config.enableValidation) {
      return of(true);
    }

    const applicableValidators = this._validators.filter(v => v.canValidate(operation));
    
    if (applicableValidators.length === 0) {
      this._operationValidated$.next({ operation, valid: true });
      return of(true);
    }

    // Run all applicable validators
    const validationResults = applicableValidators.map(validator => {
      try {
        return validator.validate(operation, context);
      } catch (error) {
        this.logger.warn('Validator threw error', { error, operation: operation.type });
        return { valid: false, errors: ['Validator error'], warnings: [] };
      }
    });

    // Combine results
    const allValid = validationResults.every(result => result.valid);
    const allErrors = validationResults.flatMap(result => result.errors);
    const allWarnings = validationResults.flatMap(result => result.warnings);

    if (!allValid) {
      this.logger.warn('Operation validation failed', {
        operationId: operation.id,
        errors: allErrors,
        warnings: allWarnings
      });
    }

    this._operationValidated$.next({ operation, valid: allValid });
    return of(allValid);
  }

  /**
   * Check if an operation can be executed
   */
  canExecute(operation: GraphOperation, context: OperationContext): boolean {
    // Check if there's an executor for this operation
    const executor = this._findExecutor(operation);
    if (!executor) {
      return false;
    }

    // Check context constraints
    if (context.suppressValidation && !this._config.enableValidation) {
      return false;
    }

    return true;
  }

  /**
   * Configure the operation manager
   */
  configure(config: Partial<OperationConfig>): void {
    this._config = { ...this._config, ...config };
    this.logger.debug('GraphOperationManager configuration updated', config);
  }

  /**
   * Get current configuration
   */
  getConfiguration(): OperationConfig {
    return { ...this._config };
  }

  /**
   * Add a validator
   */
  addValidator(validator: OperationValidator): void {
    this._validators.push(validator);
    this.logger.debug('Added operation validator');
  }

  /**
   * Remove a validator
   */
  removeValidator(validator: OperationValidator): void {
    const index = this._validators.indexOf(validator);
    if (index >= 0) {
      this._validators.splice(index, 1);
      this.logger.debug('Removed operation validator');
    }
  }

  /**
   * Add an executor
   */
  addExecutor(executor: OperationExecutor): void {
    this._executors.push(executor);
    this._executors.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.logger.debug('Added operation executor', { priority: executor.priority });
  }

  /**
   * Remove an executor
   */
  removeExecutor(executor: OperationExecutor): void {
    const index = this._executors.indexOf(executor);
    if (index >= 0) {
      this._executors.splice(index, 1);
      this.logger.debug('Removed operation executor');
    }
  }

  /**
   * Add an interceptor
   */
  addInterceptor(interceptor: OperationInterceptor): void {
    this._interceptors.push(interceptor);
    this._interceptors.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.logger.debug('Added operation interceptor', { priority: interceptor.priority });
  }

  /**
   * Remove an interceptor
   */
  removeInterceptor(interceptor: OperationInterceptor): void {
    const index = this._interceptors.indexOf(interceptor);
    if (index >= 0) {
      this._interceptors.splice(index, 1);
      this.logger.debug('Removed operation interceptor');
    }
  }

  /**
   * Get operation statistics
   */
  getStats(): OperationStats {
    // Calculate average execution time
    const totalTime = this._stats.totalOperations > 0 ? 
      this._stats.successfulOperations * this._stats.averageExecutionTimeMs : 0;
    
    return {
      ...this._stats,
      averageExecutionTimeMs: this._stats.successfulOperations > 0 ? 
        totalTime / this._stats.successfulOperations : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = this._createEmptyStats();
    this.logger.debug('Operation statistics reset');
  }

  /**
   * Check if an operation is pending
   */
  isPending(operationId: string): boolean {
    return this._pendingOperations.has(operationId);
  }

  /**
   * Get all pending operations
   */
  getPendingOperations(): GraphOperation[] {
    return Array.from(this._pendingOperations.values()).map(exec => exec.operation);
  }

  /**
   * Cancel a pending operation
   */
  cancelOperation(operationId: string): boolean {
    const execution = this._pendingOperations.get(operationId);
    if (execution) {
      clearTimeout(execution.timeout);
      this._pendingOperations.delete(operationId);
      this.logger.debug('Operation cancelled', { operationId });
      return true;
    }
    return false;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Cancel all pending operations
    for (const execution of this._pendingOperations.values()) {
      clearTimeout(execution.timeout);
    }
    this._pendingOperations.clear();

    // Complete subjects
    this._operationCompleted$.complete();
    this._operationFailed$.complete();
    this._operationValidated$.complete();

    // Clear arrays
    this._validators = [];
    this._executors = [];
    this._interceptors = [];

    this.logger.debug('GraphOperationManager disposed');
  }

  /**
   * Process an operation through the full pipeline
   */
  private _processOperation(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    // 1. Apply interceptors
    return this._applyInterceptors(operation, context).pipe(
      switchMap(interceptedOperation => {
        // 2. Validate if enabled
        if (this._config.enableValidation && !context.suppressValidation) {
          return this.validate(interceptedOperation, context).pipe(
            switchMap(valid => {
              if (!valid) {
                return throwError(() => new Error('Operation validation failed'));
              }
              return this._executeOperation(interceptedOperation, context);
            })
          );
        } else {
          return this._executeOperation(interceptedOperation, context);
        }
      })
    );
  }

  /**
   * Apply interceptors to an operation
   */
  private _applyInterceptors(operation: GraphOperation, context: OperationContext): Observable<GraphOperation> {
    if (this._interceptors.length === 0) {
      return of(operation);
    }

    return this._interceptors.reduce(
      (obs, interceptor) => obs.pipe(
        switchMap(op => interceptor.intercept(op, context))
      ),
      of(operation)
    );
  }

  /**
   * Execute an operation using appropriate executor
   */
  private _executeOperation(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const executor = this._findExecutor(operation);
    if (!executor) {
      return throwError(() => new Error(`No executor found for operation type: ${operation.type}`));
    }

    return executor.execute(operation, context);
  }

  /**
   * Find appropriate executor for an operation
   */
  private _findExecutor(operation: GraphOperation): OperationExecutor | null {
    return this._executors.find(executor => executor.canExecute(operation)) || null;
  }

  /**
   * Handle completed operation
   */
  private _handleOperationCompleted(
    operation: GraphOperation, 
    result: OperationResult, 
    context: OperationContext, 
    executionTimeMs: number
  ): void {
    this._stats.successfulOperations++;
    this._updateAverageExecutionTime(executionTimeMs);

    const event: OperationCompletedEvent = {
      operation,
      result,
      context,
      executionTimeMs
    };

    this._operationCompleted$.next(event);

    this.logger.debug('Operation completed successfully', {
      operationId: operation.id,
      type: operation.type,
      executionTimeMs,
      affectedCells: result.affectedCellIds.length
    });
  }

  /**
   * Handle failed operation
   */
  private _handleOperationFailed(
    operation: GraphOperation, 
    error: any, 
    context: OperationContext, 
    executionTimeMs: number
  ): void {
    this._stats.failedOperations++;
    
    const errorMessage = error?.message || String(error);
    this._operationFailed$.next({ operation, error: errorMessage });

    this.logger.error('Operation failed', {
      operationId: operation.id,
      type: operation.type,
      error: errorMessage,
      executionTimeMs
    });
  }

  /**
   * Handle operation timeout
   */
  private _handleTimeout(operationId: string): void {
    const execution = this._pendingOperations.get(operationId);
    if (execution) {
      this._pendingOperations.delete(operationId);
      this.logger.warn('Operation timed out', {
        operationId,
        type: execution.operation.type,
        timeoutMs: this._config.operationTimeoutMs
      });
    }
  }

  /**
   * Create empty statistics object
   */
  private _createEmptyStats(): OperationStats {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTimeMs: 0,
      operationsByType: {},
      operationsBySource: {},
      lastResetTime: new Date()
    };
  }

  /**
   * Update average execution time
   */
  private _updateAverageExecutionTime(newExecutionTime: number): void {
    const currentAvg = this._stats.averageExecutionTimeMs;
    const count = this._stats.successfulOperations;
    
    if (count === 1) {
      this._stats.averageExecutionTimeMs = newExecutionTime;
    } else {
      this._stats.averageExecutionTimeMs = ((currentAvg * (count - 1)) + newExecutionTime) / count;
    }
  }

  /**
   * Get numeric value for priority comparison
   */
  private _getPriorityValue(priority: string): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  /**
   * Initialize built-in executors
   * These handle the core operation types
   */
  private _initializeBuiltInExecutors(): void {
    // Create and register built-in executors
    const nodeExecutor = new NodeOperationExecutor(this.logger);
    const edgeExecutor = new EdgeOperationExecutor(this.logger);
    const loadExecutor = new LoadDiagramExecutor(this.logger);
    const batchExecutor = new BatchOperationExecutor(this.logger);

    // Register individual executors first
    this.addExecutor(nodeExecutor);
    this.addExecutor(edgeExecutor);
    this.addExecutor(loadExecutor);

    // Register batch executor and provide it access to individual executors
    batchExecutor.registerExecutor('create-node', nodeExecutor);
    batchExecutor.registerExecutor('update-node', nodeExecutor);
    batchExecutor.registerExecutor('delete-node', nodeExecutor);
    batchExecutor.registerExecutor('create-edge', edgeExecutor);
    batchExecutor.registerExecutor('update-edge', edgeExecutor);
    batchExecutor.registerExecutor('delete-edge', edgeExecutor);
    batchExecutor.registerExecutor('load-diagram', loadExecutor);
    this.addExecutor(batchExecutor);

    this.logger.debug('Built-in executors initialized', {
      executorCount: this._executors.length,
      executorTypes: ['node', 'edge', 'load-diagram', 'batch']
    });
  }

  /**
   * Initialize built-in validators
   * These handle validation for core operation types
   */
  private _initializeBuiltInValidators(): void {
    // Create and register built-in validators
    const nodeValidator = new NodeOperationValidator(this.logger);
    const edgeValidator = new EdgeOperationValidator(this.logger);
    const generalValidator = new GeneralOperationValidator(this.logger);

    // Register specific validators first (higher priority)
    this.addValidator(nodeValidator);
    this.addValidator(edgeValidator);

    // Register general validator last (lower priority)
    this.addValidator(generalValidator);

    this.logger.debug('Built-in validators initialized', {
      validatorCount: this._validators.length,
      validatorTypes: ['node', 'edge', 'general']
    });
  }
}