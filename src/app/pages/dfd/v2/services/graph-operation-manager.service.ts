/**
 * GraphOperationManager - Central orchestrator for all graph operations
 *
 * This service coordinates the execution of all graph operations, including:
 * - Operation validation and execution
 * - Executor management and routing
 * - Statistics tracking and monitoring
 * - Batch operation processing
 * - Error handling and recovery
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError, of, forkJoin } from 'rxjs';
import { map, catchError, timeout, tap, finalize } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { NodeOperationExecutor } from './executors/node-operation-executor';
import {
  GraphOperation,
  OperationContext,
  OperationResult,
  OperationExecutor,
  OperationValidator,
  OperationConfig,
  OperationStats,
  OperationCompletedEvent,
  IGraphOperationManager,
  DEFAULT_OPERATION_CONFIG,
  GraphOperationType,
  OperationSource,
} from '../types/graph-operation.types';

@Injectable({
  providedIn: 'root',
})
export class GraphOperationManager implements IGraphOperationManager {
  private readonly _config$ = new BehaviorSubject<OperationConfig>(DEFAULT_OPERATION_CONFIG);
  private readonly _operationCompleted$ = new Subject<OperationCompletedEvent>();
  private readonly _disposed$ = new Subject<void>();

  private readonly _executors = new Map<string, OperationExecutor>();
  private readonly _validators = new Map<string, OperationValidator>();
  private readonly _pendingOperations = new Map<string, GraphOperation>();

  private _stats: OperationStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageExecutionTimeMs: 0,
    operationsByType: {} as Record<GraphOperationType, number>,
    operationsBySource: {} as Record<OperationSource, number>,
    lastResetTime: new Date(),
  };

  private _totalExecutionTimeMs = 0;

  constructor(private readonly logger: LoggerService) {
    this.logger.debug('GraphOperationManager initialized');
    this._initializeBuiltInExecutors();
  }

  /**
   * Initialize built-in executors
   */
  private _initializeBuiltInExecutors(): void {
    // Register the NodeOperationExecutor
    const nodeExecutor = new NodeOperationExecutor(this.logger);
    this.addExecutor(nodeExecutor);

    this.logger.debug('Built-in executors initialized', {
      executorCount: this._executors.size,
    });
  }

  /**
   * Configuration Management
   */
  getConfiguration(): Partial<OperationConfig> {
    return { ...this._config$.value };
  }

  configure(config: Partial<OperationConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
    this.logger.debug('GraphOperationManager configuration updated', { config: newConfig });
  }

  /**
   * Operation Execution
   */
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const startTime = performance.now();

    this.logger.debug('Executing operation', {
      operationId: operation.id,
      type: operation.type,
      source: operation.source,
    });

    // Add to pending operations
    this._pendingOperations.set(operation.id, operation);

    // Find suitable executor
    const executor = this._findExecutor(operation);
    if (!executor) {
      this._pendingOperations.delete(operation.id);
      const error = `No suitable executor found for operation type: ${operation.type}`;
      this.logger.error(error, { operation });
      return throwError(() => new Error(error));
    }

    // Execute with timeout and error handling
    const config = this._config$.value;
    return executor.execute(operation, context).pipe(
      timeout(config.operationTimeoutMs),
      tap(result => {
        const executionTime = performance.now() - startTime;
        this._updateStats(operation, result, executionTime);
        this._emitOperationCompleted(operation, result, context, executionTime);
      }),
      catchError(error => {
        const executionTime = performance.now() - startTime;
        const failureResult: OperationResult = {
          success: false,
          operationType: operation.type,
          affectedCellIds: [],
          timestamp: Date.now(),
          error: error.message || 'Operation execution failed',
        };
        this._updateStats(operation, failureResult, executionTime);
        this._emitOperationCompleted(operation, failureResult, context, executionTime);
        return throwError(() => error);
      }),
      finalize(() => {
        this._pendingOperations.delete(operation.id);
      }),
    );
  }

  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debug('Executing batch operations', { count: operations.length });

    // Execute all operations in parallel
    const executions = operations.map(operation => this.execute(operation, context));

    return forkJoin(executions).pipe(
      catchError(error => {
        this.logger.error('Batch operation failed', { error, operationCount: operations.length });
        return throwError(() => error);
      }),
    );
  }

  validate(operation: GraphOperation, context: OperationContext): Observable<boolean> {
    const config = this._config$.value;

    if (!config.enableValidation) {
      return of(true);
    }

    // Find suitable validator
    const validator = this._findValidator(operation);
    if (!validator) {
      // No validator available, consider it valid
      return of(true);
    }

    try {
      const result = validator.validate(operation, context);
      return of(result.valid);
    } catch (error) {
      this.logger.error('Validation failed', { operation, error });
      return throwError(() => error);
    }
  }

  canExecute(operation: GraphOperation, context: OperationContext): boolean {
    const executor = this._findExecutor(operation);
    return executor !== null;
  }

  /**
   * Executor Management
   */
  addExecutor(executor: OperationExecutor): void {
    const key = this._getExecutorKey(executor);
    this._executors.set(key, executor);
    this.logger.debug('Executor added', { priority: executor.priority });
  }

  removeExecutor(executor: OperationExecutor): void {
    const key = this._getExecutorKey(executor);
    const removed = this._executors.delete(key);
    if (removed) {
      this.logger.debug('Executor removed', { priority: executor.priority });
    }
  }

  /**
   * Statistics and Monitoring
   */
  getStats(): OperationStats {
    return { ...this._stats };
  }

  resetStats(): void {
    this._stats = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageExecutionTimeMs: 0,
      operationsByType: {} as Record<GraphOperationType, number>,
      operationsBySource: {} as Record<OperationSource, number>,
      lastResetTime: new Date(),
    };
    this._totalExecutionTimeMs = 0;
    this.logger.debug('Statistics reset');
  }

  get operationCompleted$(): Observable<OperationCompletedEvent> {
    return this._operationCompleted$.asObservable();
  }

  /**
   * Pending Operations
   */
  isPending(operationId: string): boolean {
    return this._pendingOperations.has(operationId);
  }

  getPendingOperations(): GraphOperation[] {
    return Array.from(this._pendingOperations.values());
  }

  cancelOperation(operationId: string): boolean {
    if (this._pendingOperations.has(operationId)) {
      this._pendingOperations.delete(operationId);
      this.logger.debug('Operation cancelled', { operationId });
      return true;
    }
    return false;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this._disposed$.next();
    this._disposed$.complete();
    this._operationCompleted$.complete();
    this._config$.complete();
    this._executors.clear();
    this._validators.clear();
    this._pendingOperations.clear();
    this.logger.debug('GraphOperationManager disposed');
  }

  /**
   * Private helper methods
   */
  private _findExecutor(operation: GraphOperation): OperationExecutor | null {
    const executors = Array.from(this._executors.values())
      .filter(executor => executor.canExecute(operation))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    return executors[0] || null;
  }

  private _findValidator(operation: GraphOperation): OperationValidator | null {
    const validators = Array.from(this._validators.values()).filter(validator =>
      validator.canValidate(operation),
    );

    return validators[0] || null;
  }

  private _getExecutorKey(executor: OperationExecutor): string {
    return `${executor.constructor.name}-${executor.priority}`;
  }

  private _updateStats(
    operation: GraphOperation,
    result: OperationResult,
    executionTimeMs: number,
  ): void {
    this._stats.totalOperations++;
    this._totalExecutionTimeMs += executionTimeMs;
    this._stats.averageExecutionTimeMs = this._totalExecutionTimeMs / this._stats.totalOperations;

    if (result.success) {
      this._stats.successfulOperations++;
    } else {
      this._stats.failedOperations++;
    }

    // Update by type
    if (!this._stats.operationsByType[operation.type]) {
      this._stats.operationsByType[operation.type] = 0;
    }
    this._stats.operationsByType[operation.type]++;

    // Update by source
    if (!this._stats.operationsBySource[operation.source]) {
      this._stats.operationsBySource[operation.source] = 0;
    }
    this._stats.operationsBySource[operation.source]++;
  }

  private _emitOperationCompleted(
    operation: GraphOperation,
    result: OperationResult,
    context: OperationContext,
    executionTimeMs: number,
  ): void {
    const event: OperationCompletedEvent = {
      operation,
      result,
      context,
      executionTimeMs,
    };
    this._operationCompleted$.next(event);
  }
}
