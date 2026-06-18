/**
 * AppGraphOperationManager - Central orchestrator for all graph operations
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
import { catchError, timeout, tap, finalize } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { NodeOperationExecutor } from '../executors/node-operation-executor';
import { EdgeOperationExecutor } from '../executors/edge-operation-executor';
import { BatchOperationExecutor } from '../executors/batch-operation-executor';
import { LoadDiagramExecutor } from '../executors/load-diagram-executor';
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
} from '../../types/graph-operation.types';

@Injectable()
// SEM@ffa374dd1c9de88fc1c583a4695e280597118d74: central orchestrator that routes, validates, and executes all graph operations (mutates shared state)
export class AppGraphOperationManager implements IGraphOperationManager {
  private readonly _config$ = new BehaviorSubject<OperationConfig>(DEFAULT_OPERATION_CONFIG);
  private readonly _operationCompleted$ = new Subject<OperationCompletedEvent>();
  private readonly _operationFailed$ = new Subject<{ operation: GraphOperation; error: string }>();
  private readonly _operationValidated$ = new Subject<{
    operation: GraphOperation;
    valid: boolean;
  }>();
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

  // SEM@ffa374dd1c9de88fc1c583a4695e280597118d74: initialize the operation manager and register built-in executors (mutates shared state)
  constructor(
    private readonly logger: LoggerService,
    private readonly infraNodeService: InfraNodeService,
  ) {
    this.logger.debugComponent('AppGraphOperationManager', 'initialized');
    this._initializeBuiltInExecutors();
  }

  /**
   * Initialize built-in executors
   */
  // SEM@ffa374dd1c9de88fc1c583a4695e280597118d74: register node, edge, batch, and load-diagram executors with the operation registry (mutates shared state)
  private _initializeBuiltInExecutors(): void {
    // Register all built-in executors
    const nodeExecutor = new NodeOperationExecutor(this.logger, this.infraNodeService);
    const edgeExecutor = new EdgeOperationExecutor(this.logger);
    const batchExecutor = new BatchOperationExecutor(this.logger);
    const loadDiagramExecutor = new LoadDiagramExecutor(this.logger);

    this.addExecutor(nodeExecutor);
    this.addExecutor(edgeExecutor);
    this.addExecutor(batchExecutor);
    this.addExecutor(loadDiagramExecutor);

    // Register individual executors with the batch executor for delegation
    batchExecutor.registerExecutor('create-node', nodeExecutor);
    batchExecutor.registerExecutor('update-node', nodeExecutor);
    batchExecutor.registerExecutor('delete-node', nodeExecutor);
    batchExecutor.registerExecutor('create-edge', edgeExecutor);
    batchExecutor.registerExecutor('update-edge', edgeExecutor);
    batchExecutor.registerExecutor('delete-edge', edgeExecutor);
    batchExecutor.registerExecutor('load-diagram', loadDiagramExecutor);

    // this.logger.debugComponent('AppGraphOperationManager', 'Built-in executors initialized', {
    //   executorCount: this._executors.size,
    //   executorTypes: ['node', 'edge', 'batch', 'load-diagram'],
    // });
  }

  /**
   * Configuration Management
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return a snapshot copy of the current operation configuration (pure)
  getConfiguration(): Partial<OperationConfig> {
    return { ...this._config$.value };
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: merge partial settings into the operation configuration (mutates shared state)
  configure(config: Partial<OperationConfig>): void {
    const currentConfig = this._config$.value;
    const newConfig = { ...currentConfig, ...config };
    this._config$.next(newConfig);
    this.logger.debugComponent('AppGraphOperationManager', 'configuration updated', {
      config: newConfig,
    });
  }

  /**
   * Operation Execution
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch a graph operation via its executor, tracking stats and emitting completion events (mutates shared state)
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const startTime = performance.now();

    this.logger.debugComponent('AppGraphOperationManager', 'Executing operation', {
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

        // Emit operation failed event
        this._operationFailed$.next({
          operation,
          error: error.message || 'Operation execution failed',
        });

        return throwError(() => error);
      }),
      finalize(() => {
        this._pendingOperations.delete(operation.id);
      }),
    );
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch multiple graph operations in parallel and collect results (mutates shared state)
  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]> {
    if (operations.length === 0) {
      return of([]);
    }

    this.logger.debugComponent('AppGraphOperationManager', 'Executing batch operations', {
      count: operations.length,
    });

    // Execute all operations in parallel
    const executions = operations.map(operation => this.execute(operation, context));

    return forkJoin(executions).pipe(
      catchError(error => {
        this.logger.error('Batch operation failed', { error, operationCount: operations.length });
        return throwError(() => error);
      }),
    );
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a graph operation against a registered validator and emit result (mutates shared state)
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

      // Emit validation event
      this._operationValidated$.next({ operation, valid: result.valid });

      return of(result.valid);
    } catch (error) {
      this.logger.error('Validation failed', { operation, error });

      // Emit validation failed event
      this._operationValidated$.next({ operation, valid: false });

      return throwError(() => error);
    }
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether a registered executor exists for a graph operation (pure)
  canExecute(operation: GraphOperation, _context: OperationContext): boolean {
    const executor = this._findExecutor(operation);
    return executor !== null;
  }

  /**
   * Executor Management
   */
  // SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: register an operation executor for graph operation dispatch (mutates shared state)
  addExecutor(executor: OperationExecutor): void {
    const key = this._getExecutorKey(executor);
    this._executors.set(key, executor);
    // this.logger.debugComponent('AppGraphOperationManager', 'Executor added', { priority: executor.priority });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: unregister a previously registered operation executor (mutates shared state)
  removeExecutor(executor: OperationExecutor): void {
    const key = this._getExecutorKey(executor);
    const removed = this._executors.delete(key);
    if (removed) {
      this.logger.debugComponent('AppGraphOperationManager', 'Executor removed', {
        priority: executor.priority,
      });
    }
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: register an operation validator for graph operation validation (mutates shared state)
  addValidator(validator: OperationValidator): void {
    const key = `${validator.constructor.name}-${Date.now()}`;
    this._validators.set(key, validator);
    this.logger.debugComponent('AppGraphOperationManager', 'Validator added');
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: unregister a previously registered operation validator (mutates shared state)
  removeValidator(validator: OperationValidator): void {
    const key = `${validator.constructor.name}`;
    // Find and remove validator by constructor name
    const keys = Array.from(this._validators.keys()).filter(k => k.startsWith(key));
    let removed = false;
    keys.forEach(k => {
      if (this._validators.get(k) === validator) {
        this._validators.delete(k);
        removed = true;
      }
    });
    if (removed) {
      this.logger.debugComponent('AppGraphOperationManager', 'Validator removed');
    }
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: register an operation interceptor (stub; mutates shared state)
  addInterceptor(_interceptor: any): void {
    // For now, just log that interceptor was added
    this.logger.debugComponent('AppGraphOperationManager', 'Interceptor added');
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: unregister a previously registered operation interceptor (stub; mutates shared state)
  removeInterceptor(_interceptor: any): void {
    // For now, just log that interceptor was removed
    this.logger.debugComponent('AppGraphOperationManager', 'Interceptor removed');
  }

  /**
   * Statistics and Monitoring
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a snapshot of operation execution statistics (pure)
  getStats(): OperationStats {
    return { ...this._stats };
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: clear all accumulated operation statistics back to zero (mutates shared state)
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
    this.logger.debugComponent('AppGraphOperationManager', 'Statistics reset');
  }

  get operationCompleted$(): Observable<OperationCompletedEvent> {
    return this._operationCompleted$.asObservable();
  }

  get operationFailed$(): Observable<{ operation: GraphOperation; error: string }> {
    return this._operationFailed$.asObservable();
  }

  get operationValidated$(): Observable<{ operation: GraphOperation; valid: boolean }> {
    return this._operationValidated$.asObservable();
  }

  /**
   * Pending Operations
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether an operation is currently pending execution (pure)
  isPending(operationId: string): boolean {
    return this._pendingOperations.has(operationId);
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: list all currently in-flight graph operations (pure)
  getPendingOperations(): GraphOperation[] {
    return Array.from(this._pendingOperations.values());
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: remove a pending operation from the in-flight queue by ID (mutates shared state)
  cancelOperation(operationId: string): boolean {
    if (this._pendingOperations.has(operationId)) {
      this._pendingOperations.delete(operationId);
      this.logger.debugComponent('AppGraphOperationManager', 'Operation cancelled', {
        operationId,
      });
      return true;
    }
    return false;
  }

  /**
   * Cleanup
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: complete all subjects and clear all registries on teardown (mutates shared state)
  dispose(): void {
    this._disposed$.next();
    this._disposed$.complete();
    this._operationCompleted$.complete();
    this._operationFailed$.complete();
    this._operationValidated$.complete();
    this._config$.complete();
    this._executors.clear();
    this._validators.clear();
    this._pendingOperations.clear();
    this.logger.debugComponent('AppGraphOperationManager', 'disposed');
  }

  /**
   * Private helper methods
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: find the highest-priority registered executor that can handle a graph operation (pure)
  private _findExecutor(operation: GraphOperation): OperationExecutor | null {
    const executors = Array.from(this._executors.values())
      .filter(executor => executor.canExecute(operation))
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    return executors[0] || null;
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: find the first registered validator that can validate a graph operation (pure)
  private _findValidator(operation: GraphOperation): OperationValidator | null {
    const validators = Array.from(this._validators.values()).filter(validator =>
      validator.canValidate(operation),
    );

    return validators[0] || null;
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: build a unique registry key for an executor from its class name and priority (pure)
  private _getExecutorKey(executor: OperationExecutor): string {
    return `${executor.constructor.name}-${executor.priority}`;
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: aggregate operation execution result into running statistics (mutates shared state)
  private _updateStats(
    operation: GraphOperation,
    result: OperationResult,
    executionTimeMs: number,
  ): void {
    this._totalExecutionTimeMs += executionTimeMs;

    // Create new stats object with updated values
    const newOperationsByType = { ...this._stats.operationsByType };
    if (!newOperationsByType[operation.type]) {
      newOperationsByType[operation.type] = 0;
    }
    newOperationsByType[operation.type]++;

    const newOperationsBySource = { ...this._stats.operationsBySource };
    if (!newOperationsBySource[operation.source]) {
      newOperationsBySource[operation.source] = 0;
    }
    newOperationsBySource[operation.source]++;

    const newTotalOperations = this._stats.totalOperations + 1;
    const newSuccessfulOperations = result.success
      ? this._stats.successfulOperations + 1
      : this._stats.successfulOperations;
    const newFailedOperations = !result.success
      ? this._stats.failedOperations + 1
      : this._stats.failedOperations;

    this._stats = {
      totalOperations: newTotalOperations,
      successfulOperations: newSuccessfulOperations,
      failedOperations: newFailedOperations,
      averageExecutionTimeMs: this._totalExecutionTimeMs / newTotalOperations,
      operationsByType: newOperationsByType,
      operationsBySource: newOperationsBySource,
      lastResetTime: this._stats.lastResetTime,
    };
  }

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: notify subscribers that a graph operation has completed with its result (mutates shared state)
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
