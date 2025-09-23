/**
 * Executor for batch operations
 * Handles executing multiple operations as a single atomic unit
 */

import { Injectable } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../../core/services/logger.service';
import { BaseOperationExecutor } from './base-operation-executor';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationExecutor,
  BatchOperation,
} from '../../types/graph-operation.types';

@Injectable()
export class BatchOperationExecutor extends BaseOperationExecutor {
  readonly priority = 50; // Lower priority to ensure individual executors are tried first

  private _individualExecutors: Map<string, OperationExecutor> = new Map();

  constructor(logger: LoggerService) {
    super(logger);
  }

  canExecute(operation: GraphOperation): boolean {
    return operation.type === 'batch-operation';
  }

  /**
   * Register individual executors for use in batch processing
   */
  registerExecutor(operationType: string, executor: OperationExecutor): void {
    this._individualExecutors.set(operationType, executor);
    this.logger.debug('Registered executor for batch operations', { operationType });
  }

  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    const batchOperation = operation as BatchOperation;
    this.logOperationStart(operation);

    return this.validateGraph(context.graph, operation).pipe(
      switchMap(() => this.executeBatchOperations(batchOperation, context)),
      map(result => {
        this.logOperationComplete(operation, result);
        return result;
      }),
      catchError(error => {
        const errorMessage = `Batch operation failed: ${error}`;
        this.logger.error(errorMessage, { operationId: operation.id, error });
        return of(this.createFailureResult(operation, errorMessage));
      }),
    );
  }

  private executeBatchOperations(
    batchOperation: BatchOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    const { operations } = batchOperation;

    if (operations.length === 0) {
      return of(
        this.createSuccessResult(batchOperation, [], {
          individualResults: [],
          operationCount: 0,
        }),
      );
    }

    this.logger.debug('Executing batch operation', {
      batchId: batchOperation.id,
      operationCount: operations.length,
      operationTypes: operations.map(op => op.type),
    });

    // Execute all operations in parallel
    const executionObservables = operations.map(op => this.executeIndividualOperation(op, context));

    return forkJoin(executionObservables).pipe(
      map(results => this.createBatchResult(batchOperation, results)),
      catchError(error => {
        // If any operation fails, we need to handle rollback
        this.logger.error('Batch operation failed, may need rollback', {
          batchId: batchOperation.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }),
    );
  }

  private executeIndividualOperation(
    operation: GraphOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    const executor = this._individualExecutors.get(operation.type);

    if (!executor) {
      const error = `No executor found for operation type: ${operation.type}`;
      this.logger.warn(error, { operationId: operation.id, operationType: operation.type });
      return of(this.createFailureResult(operation, error));
    }

    return executor.execute(operation, context).pipe(
      catchError(error => {
        const errorMessage = `Individual operation failed in batch: ${error}`;
        this.logger.error(errorMessage, {
          operationId: operation.id,
          operationType: operation.type,
          error,
        });
        return of(this.createFailureResult(operation, errorMessage));
      }),
    );
  }

  private createBatchResult(
    batchOperation: BatchOperation,
    individualResults: OperationResult[],
  ): OperationResult {
    const successfulResults = individualResults.filter(r => r.success);
    const failedResults = individualResults.filter(r => !r.success);

    const allAffectedCellIds = new Set<string>();
    individualResults.forEach(result => {
      result.affectedCellIds.forEach(id => allAffectedCellIds.add(id));
    });

    const success = failedResults.length === 0;
    const metadata = {
      individualResults,
      operationCount: batchOperation.operations.length,
      successfulCount: successfulResults.length,
      failedCount: failedResults.length,
      operationTypes: batchOperation.operations.map(op => op.type),
      failedOperations: failedResults.map(r => ({
        operationId: r.operationId,
        operationType: r.operationType,
        error: r.error,
      })),
    };

    if (success) {
      this.logger.debug('Batch operation completed successfully', {
        batchId: batchOperation.id,
        operationCount: batchOperation.operations.length,
        affectedCellsCount: allAffectedCellIds.size,
      });

      return this.createSuccessResult(batchOperation, Array.from(allAffectedCellIds), metadata);
    } else {
      const error = `Batch operation partially failed: ${failedResults.length}/${batchOperation.operations.length} operations failed`;

      this.logger.warn('Batch operation completed with failures', {
        batchId: batchOperation.id,
        operationCount: batchOperation.operations.length,
        failedCount: failedResults.length,
        failedOperationTypes: failedResults.map(r => r.operationType),
      });

      return {
        success: false,
        operationId: batchOperation.id,
        operationType: batchOperation.type,
        affectedCellIds: Array.from(allAffectedCellIds),
        timestamp: Date.now(),
        error,
        metadata,
      };
    }
  }
}
