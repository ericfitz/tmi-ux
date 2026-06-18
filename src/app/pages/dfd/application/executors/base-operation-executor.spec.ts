/**
 * Test suite for BaseOperationExecutor.
 *
 * BaseOperationExecutor is abstract; its protected helpers are exercised
 * through a minimal concrete TestExecutor subclass that exposes them.
 */

import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';
import type { Graph } from '@antv/x6';

import { BaseOperationExecutor } from './base-operation-executor';
import { GraphOperation, OperationResult } from '../../types/graph-operation.types';

/**
 * Concrete subclass that surfaces the protected helpers for testing.
 */
// SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: test double exposing protected executor methods for unit testing (pure)
class TestExecutor extends BaseOperationExecutor {
  readonly priority = 1;

  // SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: report that this test executor can handle any operation (pure)
  canExecute(): boolean {
    return true;
  }

  // SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: execute a graph operation and return a success result observable (pure)
  execute(operation: GraphOperation): ReturnType<BaseOperationExecutor['execute']> {
    return of(this.createSuccessResult(operation, []));
  }

  // Expose protected members.
  pubCreateSuccess = (op: GraphOperation, ids: string[], meta?: Record<string, unknown>) =>
    this.createSuccessResult(op, ids, meta);
  pubCreateFailure = (op: GraphOperation, error: string, ids?: string[]) =>
    this.createFailureResult(op, error, ids);
  pubGetCell = (graph: Graph | null, id: string) => this.getCell(graph, id);
  pubGetNode = (graph: Graph | null, id: string) => this.getNode(graph, id);
  pubGetEdge = (graph: Graph | null, id: string) => this.getEdge(graph, id);
  pubValidateGraph = (graph: Graph | null, op: GraphOperation) => this.validateGraph(graph, op);
  pubGenerateCellId = () => this.generateCellId();
  pubLogStart = (op: GraphOperation) => this.logOperationStart(op);
  pubLogComplete = (op: GraphOperation, r: OperationResult) => this.logOperationComplete(op, r);
}

describe('BaseOperationExecutor', () => {
  let executor: TestExecutor;
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const operation: GraphOperation = {
    id: 'op-1',
    type: 'create-node',
    source: 'user-interaction',
    priority: 'normal',
    timestamp: 1_700_000_000_000,
  };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    executor = new TestExecutor(mockLogger as never);
  });

  describe('createSuccessResult', () => {
    it('builds a success result with the operation id, type and affected cells', () => {
      const result = executor.pubCreateSuccess(operation, ['c1', 'c2']);

      expect(result.success).toBe(true);
      expect(result.operationId).toBe('op-1');
      expect(result.operationType).toBe('create-node');
      expect(result.affectedCellIds).toEqual(['c1', 'c2']);
      expect(result.metadata).toEqual({});
      expect(typeof result.timestamp).toBe('number');
    });

    it('includes provided metadata', () => {
      const result = executor.pubCreateSuccess(operation, [], { foo: 'bar' });

      expect(result.metadata).toEqual({ foo: 'bar' });
    });
  });

  describe('createFailureResult', () => {
    it('builds a failure result carrying the error message', () => {
      const result = executor.pubCreateFailure(operation, 'something went wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('something went wrong');
      expect(result.operationId).toBe('op-1');
      expect(result.affectedCellIds).toEqual([]);
    });

    it('carries affected cell ids when supplied', () => {
      const result = executor.pubCreateFailure(operation, 'err', ['c9']);

      expect(result.affectedCellIds).toEqual(['c9']);
    });
  });

  describe('getCell / getNode / getEdge', () => {
    it('getCell returns null when the graph is null', () => {
      expect(executor.pubGetCell(null, 'x')).toBeNull();
    });

    it('getCell delegates to graph.getCellById', () => {
      const cell = { id: 'x' };
      const graph = { getCellById: vi.fn().mockReturnValue(cell) } as unknown as Graph;

      expect(executor.pubGetCell(graph, 'x')).toBe(cell);
      expect(
        (graph as unknown as { getCellById: ReturnType<typeof vi.fn> }).getCellById,
      ).toHaveBeenCalledWith('x');
    });

    it('getNode returns the cell only when it is a node', () => {
      const node = { id: 'n', isNode: () => true, isEdge: () => false };
      const graph = { getCellById: vi.fn().mockReturnValue(node) } as unknown as Graph;

      expect(executor.pubGetNode(graph, 'n')).toBe(node);
    });

    it('getNode returns null when the cell is an edge', () => {
      const edge = { id: 'e', isNode: () => false, isEdge: () => true };
      const graph = { getCellById: vi.fn().mockReturnValue(edge) } as unknown as Graph;

      expect(executor.pubGetNode(graph, 'e')).toBeNull();
    });

    it('getEdge returns the cell only when it is an edge', () => {
      const edge = { id: 'e', isNode: () => false, isEdge: () => true };
      const graph = { getCellById: vi.fn().mockReturnValue(edge) } as unknown as Graph;

      expect(executor.pubGetEdge(graph, 'e')).toBe(edge);
    });

    it('getEdge returns null when the cell is missing', () => {
      const graph = { getCellById: vi.fn().mockReturnValue(null) } as unknown as Graph;

      expect(executor.pubGetEdge(graph, 'missing')).toBeNull();
    });
  });

  describe('validateGraph', () => {
    it('emits the graph when it is available', () =>
      new Promise<void>((resolve, reject) => {
        const graph = { getCellById: vi.fn() } as unknown as Graph;

        executor.pubValidateGraph(graph, operation).subscribe({
          next: g => {
            try {
              expect(g).toBe(graph);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('errors and logs when the graph is null', () =>
      new Promise<void>((resolve, reject) => {
        executor.pubValidateGraph(null, operation).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toContain('Graph not available');
              expect(mockLogger.error).toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });

  describe('generateCellId', () => {
    it('produces a prefixed id', () => {
      expect(executor.pubGenerateCellId()).toMatch(/^cell_\d+_[a-z0-9]+$/);
    });

    it('produces distinct ids across calls', () => {
      const a = executor.pubGenerateCellId();
      const b = executor.pubGenerateCellId();

      expect(a).not.toBe(b);
    });
  });

  describe('operation logging', () => {
    it('logOperationStart logs through debugComponent', () => {
      executor.pubLogStart(operation);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'BaseOperationExecutor',
        expect.stringContaining('create-node'),
        expect.objectContaining({ operationId: 'op-1' }),
      );
    });

    it('logOperationComplete logs the result summary', () => {
      const result = executor.pubCreateSuccess(operation, ['c1']);

      executor.pubLogComplete(operation, result);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'BaseOperationExecutor',
        expect.stringContaining('create-node'),
        expect.objectContaining({ operationId: 'op-1', success: true, affectedCells: 1 }),
      );
    });
  });
});
