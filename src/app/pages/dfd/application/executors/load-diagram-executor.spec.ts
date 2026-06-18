/**
 * Test suite for LoadDiagramExecutor.
 *
 * The X6 graph is mocked: addNode/addEdge echo back an object with the
 * configured id, getCellById tracks which node ids have been "added", and
 * clearCells is a spy. Tests cover the load happy path, clear-existing,
 * per-cell load errors, and the empty / missing-endpoint cases.
 */

import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { LoadDiagramExecutor } from './load-diagram-executor';
import {
  LoadDiagramOperation,
  GraphOperation,
  OperationContext,
} from '../../types/graph-operation.types';

interface MockGraph {
  clearCells: ReturnType<typeof vi.fn>;
  addNode: ReturnType<typeof vi.fn>;
  addEdge: ReturnType<typeof vi.fn>;
  getCellById: ReturnType<typeof vi.fn>;
}

// SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: build a LoadDiagramOperation fixture for tests (pure)
function makeLoadOperation(diagramData: unknown, clearExisting = false): LoadDiagramOperation {
  return {
    id: 'load-1',
    type: 'load-diagram',
    source: 'system',
    priority: 'high',
    timestamp: Date.now(),
    diagramId: 'd1',
    diagramData,
    clearExisting,
  };
}

describe('LoadDiagramExecutor', () => {
  let executor: LoadDiagramExecutor;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockGraph: MockGraph;
  let context: OperationContext;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // addNode echoes the config's id; getCellById knows about added nodes.
    const addedIds = new Set<string>();
    mockGraph = {
      clearCells: vi.fn(),
      addNode: vi.fn((config: { id: string }) => {
        addedIds.add(config.id);
        return { id: config.id };
      }),
      addEdge: vi.fn((config: { id: string }) => ({ id: config.id })),
      getCellById: vi.fn((id: string) => (addedIds.has(id) ? { id } : null)),
    };

    executor = new LoadDiagramExecutor(mockLogger as never);

    context = {
      graph: mockGraph as never,
      diagramId: 'd1',
      threatModelId: 'tm1',
      providerId: 'user-1',
      isCollaborating: false,
      permissions: ['read', 'write'],
    };
  });

  describe('capabilities', () => {
    it('only handles load-diagram', () => {
      expect(executor.canExecute({ type: 'load-diagram' } as GraphOperation)).toBe(true);
      expect(executor.canExecute({ type: 'create-node' } as GraphOperation)).toBe(false);
    });

    it('has a high priority', () => {
      expect(executor.priority).toBe(150);
    });
  });

  describe('execute', () => {
    it('fails when the graph is unavailable', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeLoadOperation({ nodes: [], edges: [] });

        executor.execute(op, { ...context, graph: null as never }).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Failed to load diagram');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('loads nodes and edges and reports the affected cells', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeLoadOperation({
          nodes: [
            { id: 'n1', shape: 'rect', x: 0, y: 0 },
            { id: 'n2', shape: 'rect', x: 100, y: 0 },
          ],
          edges: [{ id: 'e1', source: { cell: 'n1' }, target: { cell: 'n2' } }],
        });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds.sort()).toEqual(['e1', 'n1', 'n2']);
              expect(mockGraph.addNode).toHaveBeenCalledTimes(2);
              expect(mockGraph.addEdge).toHaveBeenCalledTimes(1);
              expect(result.metadata?.['loadedCellCount']).toBe(3);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('clears the graph first when clearExisting is true', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeLoadOperation({ nodes: [{ id: 'n1' }], edges: [] }, true);

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(mockGraph.clearCells).toHaveBeenCalledTimes(1);
              expect(result.metadata?.['clearExisting']).toBe(true);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('does not clear the graph when clearExisting is false', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeLoadOperation({ nodes: [], edges: [] }, false);

        executor.execute(op, context).subscribe({
          next: () => {
            try {
              expect(mockGraph.clearCells).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('succeeds with an empty diagram', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeLoadOperation({ nodes: [], edges: [] });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual([]);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('records a load error when an edge endpoint node is missing', () =>
      new Promise<void>((resolve, reject) => {
        // n1 is loaded, n2 is not — the edge references the missing n2.
        const op = makeLoadOperation({
          nodes: [{ id: 'n1' }],
          edges: [{ id: 'e1', source: { cell: 'n1' }, target: { cell: 'n2' } }],
        });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('1 errors');
              const errors = result.metadata?.['loadErrors'] as string[];
              expect(errors[0]).toContain('Target node not found');
              // The valid node still loaded.
              expect(result.affectedCellIds).toEqual(['n1']);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('records a load error when addNode throws', () =>
      new Promise<void>((resolve, reject) => {
        mockGraph.addNode.mockImplementationOnce(() => {
          throw new Error('x6 rejected the node');
        });
        const op = makeLoadOperation({ nodes: [{ id: 'bad' }], edges: [] });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              const errors = result.metadata?.['loadErrors'] as string[];
              expect(errors[0]).toContain('Failed to load node bad');
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
