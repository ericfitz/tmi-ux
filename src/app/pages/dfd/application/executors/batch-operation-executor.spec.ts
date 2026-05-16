/**
 * Test suite for BatchOperationExecutor.
 *
 * BatchOperationExecutor orchestrates registered per-type executors; the
 * tests register lightweight stub executors and assert the aggregated
 * result, the success/partial-failure handling, and missing-executor and
 * empty-batch edge cases.
 */

import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { BatchOperationExecutor } from './batch-operation-executor';
import {
  BatchOperation,
  GraphOperation,
  OperationContext,
  OperationExecutor,
  OperationResult,
} from '../../types/graph-operation.types';

/** Build a stub executor that returns a fixed result for one operation type. */
function stubExecutor(result: OperationResult): OperationExecutor {
  return {
    priority: 100,
    canExecute: () => true,
    execute: vi.fn().mockReturnValue(of(result)),
  };
}

function makeChildOp(id: string, type: string): GraphOperation {
  return {
    id,
    type: type as GraphOperation['type'],
    source: 'user-interaction',
    priority: 'normal',
    timestamp: Date.now(),
  };
}

function successResult(op: GraphOperation, cellIds: string[]): OperationResult {
  return {
    success: true,
    operationId: op.id,
    operationType: op.type,
    affectedCellIds: cellIds,
    timestamp: Date.now(),
    metadata: {},
  };
}

function failureResult(op: GraphOperation, error: string): OperationResult {
  return {
    success: false,
    operationId: op.id,
    operationType: op.type,
    affectedCellIds: [],
    timestamp: Date.now(),
    error,
    metadata: {},
  };
}

describe('BatchOperationExecutor', () => {
  let executor: BatchOperationExecutor;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let context: OperationContext;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    executor = new BatchOperationExecutor(mockLogger as never);

    context = {
      graph: { getCellById: vi.fn() } as never,
      diagramId: 'd1',
      threatModelId: 'tm1',
      providerId: 'user-1',
      isCollaborating: false,
      permissions: ['read', 'write'],
    };
  });

  describe('capabilities', () => {
    it('only handles batch-operation', () => {
      expect(executor.canExecute({ type: 'batch-operation' } as GraphOperation)).toBe(true);
      expect(executor.canExecute({ type: 'create-node' } as GraphOperation)).toBe(false);
    });

    it('has a lower priority than individual executors', () => {
      expect(executor.priority).toBe(50);
    });
  });

  describe('execute', () => {
    it('fails when the graph is unavailable', () =>
      new Promise<void>((resolve, reject) => {
        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [],
        };

        executor.execute(batch, { ...context, graph: null as never }).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Batch operation failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('succeeds with an empty operation list', () =>
      new Promise<void>((resolve, reject) => {
        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [],
        };

        executor.execute(batch, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual([]);
              expect(result.metadata?.['operationCount']).toBe(0);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('runs all registered child operations and aggregates affected cells', () =>
      new Promise<void>((resolve, reject) => {
        const op1 = makeChildOp('c1', 'create-node');
        const op2 = makeChildOp('c2', 'create-edge');
        executor.registerExecutor('create-node', stubExecutor(successResult(op1, ['n1'])));
        executor.registerExecutor('create-edge', stubExecutor(successResult(op2, ['e1'])));

        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [op1, op2],
        };

        executor.execute(batch, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds.sort()).toEqual(['e1', 'n1']);
              expect(result.metadata?.['successfulCount']).toBe(2);
              expect(result.metadata?.['failedCount']).toBe(0);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('reports partial failure when a registered executor is missing', () =>
      new Promise<void>((resolve, reject) => {
        const op1 = makeChildOp('c1', 'create-node');
        const op2 = makeChildOp('c2', 'create-edge');
        // Only register one of the two operation types.
        executor.registerExecutor('create-node', stubExecutor(successResult(op1, ['n1'])));

        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [op1, op2],
        };

        executor.execute(batch, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('partially failed');
              expect(result.metadata?.['failedCount']).toBe(1);
              expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No executor found'),
                expect.anything(),
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('reports partial failure when a child executor returns a failure', () =>
      new Promise<void>((resolve, reject) => {
        const op1 = makeChildOp('c1', 'create-node');
        const op2 = makeChildOp('c2', 'create-edge');
        executor.registerExecutor('create-node', stubExecutor(successResult(op1, ['n1'])));
        executor.registerExecutor(
          'create-edge',
          stubExecutor(failureResult(op2, 'edge creation failed')),
        );

        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [op1, op2],
        };

        executor.execute(batch, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.metadata?.['failedCount']).toBe(1);
              expect(result.metadata?.['successfulCount']).toBe(1);
              const failed = result.metadata?.['failedOperations'] as { error: string }[];
              expect(failed[0].error).toBe('edge creation failed');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('converts a thrown child-executor error into a failure result', () =>
      new Promise<void>((resolve, reject) => {
        const op1 = makeChildOp('c1', 'create-node');
        const throwingExecutor: OperationExecutor = {
          priority: 100,
          canExecute: () => true,
          execute: vi.fn().mockReturnValue(throwError(() => new Error('boom'))),
        };
        executor.registerExecutor('create-node', throwingExecutor);

        const batch: BatchOperation = {
          ...makeChildOp('batch-1', 'batch-operation'),
          type: 'batch-operation',
          operations: [op1],
        };

        executor.execute(batch, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.metadata?.['failedCount']).toBe(1);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });
});
