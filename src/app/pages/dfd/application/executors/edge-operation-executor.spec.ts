/**
 * Test suite for EdgeOperationExecutor.
 *
 * The X6 graph and cells are mocked. createMockNode/createMockEdge build
 * objects with the methods the executor calls; the graph's getCellById
 * resolves from a registry the tests populate. Tests cover create / update /
 * delete edge happy paths plus the validation and edge-case branches.
 */

import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { EdgeOperationExecutor } from './edge-operation-executor';
import {
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation,
  GraphOperation,
  OperationContext,
} from '../../types/graph-operation.types';

/** A mock X6 node — only isNode/isEdge are needed by the executor. */
function createMockNode(id: string): Record<string, unknown> {
  return { id, isNode: () => true, isEdge: () => false };
}

/** A mock X6 edge exposing the getters/setters the executor touches. */
function createMockEdge(id: string): Record<string, unknown> {
  let source: unknown = { cell: 'n1' };
  let target: unknown = { cell: 'n2' };
  let data: Record<string, unknown> = {};
  let labels: unknown[] = [];
  return {
    id,
    shape: 'flow',
    isNode: () => false,
    isEdge: () => true,
    getSource: vi.fn(() => source),
    getTarget: vi.fn(() => target),
    setSource: vi.fn((s: unknown) => {
      source = s;
    }),
    setTarget: vi.fn((t: unknown) => {
      target = t;
    }),
    getData: vi.fn(() => data),
    setData: vi.fn((d: Record<string, unknown>) => {
      data = d;
    }),
    getAttrs: vi.fn(() => ({})),
    setAttrByPath: vi.fn(),
    getLabels: vi.fn(() => labels),
    setLabels: vi.fn((l: unknown[]) => {
      labels = l;
    }),
    getVertices: vi.fn(() => []),
    getZIndex: vi.fn(() => 1),
  };
}

describe('EdgeOperationExecutor', () => {
  let executor: EdgeOperationExecutor;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let cells: Map<string, Record<string, unknown>>;
  let mockGraph: {
    getCellById: ReturnType<typeof vi.fn>;
    addEdge: ReturnType<typeof vi.fn>;
    removeEdge: ReturnType<typeof vi.fn>;
  };
  let context: OperationContext;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    cells = new Map();
    cells.set('n1', createMockNode('n1'));
    cells.set('n2', createMockNode('n2'));

    mockGraph = {
      getCellById: vi.fn((id: string) => cells.get(id) ?? null),
      addEdge: vi.fn((config: { id: string }) => {
        const edge = createMockEdge(config.id);
        cells.set(config.id, edge);
        return edge;
      }),
      removeEdge: vi.fn(),
    };

    executor = new EdgeOperationExecutor(mockLogger as never);

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
    it('handles edge create/update/delete operations only', () => {
      expect(executor.canExecute({ type: 'create-edge' } as GraphOperation)).toBe(true);
      expect(executor.canExecute({ type: 'update-edge' } as GraphOperation)).toBe(true);
      expect(executor.canExecute({ type: 'delete-edge' } as GraphOperation)).toBe(true);
      expect(executor.canExecute({ type: 'create-node' } as GraphOperation)).toBe(false);
    });

    it('has the standard executor priority', () => {
      expect(executor.priority).toBe(100);
    });
  });

  // -------------------------------------------------------------------------
  // create-edge
  // -------------------------------------------------------------------------
  describe('create-edge', () => {
    function makeCreateOp(overrides: Partial<CreateEdgeOperation> = {}): CreateEdgeOperation {
      return {
        id: 'op-create',
        type: 'create-edge',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        edgeInfo: { id: 'e1' } as CreateEdgeOperation['edgeInfo'],
        sourceNodeId: 'n1',
        targetNodeId: 'n2',
        ...overrides,
      };
    }

    it('creates an edge between two existing nodes', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeCreateOp(), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual(['e1']);
              expect(mockGraph.addEdge).toHaveBeenCalledTimes(1);
              const config = mockGraph.addEdge.mock.calls[0][0];
              expect(config.source).toEqual({ cell: 'n1', port: undefined });
              expect(config.target).toEqual({ cell: 'n2', port: undefined });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('fails when the source node does not exist', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeCreateOp({ sourceNodeId: 'missing' }), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Source node not found');
              expect(mockGraph.addEdge).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('fails when the target node does not exist', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeCreateOp({ targetNodeId: 'missing' }), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Target node not found');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('fails when an edge with the same id already exists', () =>
      new Promise<void>((resolve, reject) => {
        cells.set('e1', createMockEdge('e1'));

        executor.execute(makeCreateOp(), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Edge already exists');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('treats a retroactive create as success without re-adding the edge', () =>
      new Promise<void>((resolve, reject) => {
        cells.set('e1', createMockEdge('e1'));
        const op = makeCreateOp({ metadata: { retroactive: true } });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.metadata?.['retroactive']).toBe(true);
              expect(mockGraph.addEdge).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('builds a label from the legacy label string', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeCreateOp({
          edgeInfo: { id: 'e1', label: 'data flow' } as CreateEdgeOperation['edgeInfo'],
        });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              const config = mockGraph.addEdge.mock.calls[0][0];
              expect(config.labels).toHaveLength(1);
              expect(config.labels[0].attrs.text.text).toBe('data flow');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('generates an edge id when edgeInfo provides none', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeCreateOp({ edgeInfo: {} as CreateEdgeOperation['edgeInfo'] });

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds[0]).toMatch(/^cell_/);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // -------------------------------------------------------------------------
  // update-edge
  // -------------------------------------------------------------------------
  describe('update-edge', () => {
    function makeUpdateOp(
      updates: UpdateEdgeOperation['updates'],
      overrides: Partial<UpdateEdgeOperation> = {},
    ): UpdateEdgeOperation {
      return {
        id: 'op-update',
        type: 'update-edge',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        edgeId: 'e1',
        updates,
        ...overrides,
      };
    }

    beforeEach(() => {
      cells.set('e1', createMockEdge('e1'));
    });

    it('fails when the edge does not exist', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeUpdateOp({}, { edgeId: 'missing' }), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Edge not found');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('updates the edge label and reports it as a changed property', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeUpdateOp({ label: 'new label' }), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              const edge = cells.get('e1') as Record<string, ReturnType<typeof vi.fn>>;
              expect(edge['setLabels']).toHaveBeenCalled();
              expect(result.metadata?.['changedProperties']).toContain('label');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('applies style updates via setAttrByPath', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeUpdateOp({ style: { stroke: '#ff0000', strokeWidth: 3 } } as never);

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              const edge = cells.get('e1') as Record<string, ReturnType<typeof vi.fn>>;
              expect(edge['setAttrByPath']).toHaveBeenCalledWith('line/stroke', '#ff0000');
              expect(edge['setAttrByPath']).toHaveBeenCalledWith('line/strokeWidth', 3);
              expect(result.metadata?.['changedProperties']).toEqual(
                expect.arrayContaining(['stroke', 'strokeWidth']),
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('reassigns the source endpoint to another existing node', () =>
      new Promise<void>((resolve, reject) => {
        cells.set('n3', createMockNode('n3'));
        const op = makeUpdateOp({ sourceNodeId: 'n3' } as never);

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              const edge = cells.get('e1') as Record<string, ReturnType<typeof vi.fn>>;
              expect(edge['setSource']).toHaveBeenCalledWith(
                expect.objectContaining({ cell: 'n3' }),
              );
              expect(result.metadata?.['changedProperties']).toContain('source');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('fails when the new source node does not exist', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeUpdateOp({ sourceNodeId: 'missing' } as never);

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('New source node not found');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('merges data property updates onto the edge', () =>
      new Promise<void>((resolve, reject) => {
        const op = makeUpdateOp({ properties: { edgeType: 'control-flow' } } as never);

        executor.execute(op, context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              const edge = cells.get('e1') as Record<string, ReturnType<typeof vi.fn>>;
              expect(edge['setData']).toHaveBeenCalledWith(
                expect.objectContaining({ edgeType: 'control-flow' }),
              );
              expect(result.metadata?.['changedProperties']).toContain('properties');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  // -------------------------------------------------------------------------
  // delete-edge
  // -------------------------------------------------------------------------
  describe('delete-edge', () => {
    function makeDeleteOp(edgeId = 'e1'): DeleteEdgeOperation {
      return {
        id: 'op-delete',
        type: 'delete-edge',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        edgeId,
      };
    }

    it('removes an existing edge', () =>
      new Promise<void>((resolve, reject) => {
        const edge = createMockEdge('e1');
        cells.set('e1', edge);

        executor.execute(makeDeleteOp(), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual(['e1']);
              expect(mockGraph.removeEdge).toHaveBeenCalledWith(edge);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('treats deleting a non-existent edge as success (idempotent)', () =>
      new Promise<void>((resolve, reject) => {
        executor.execute(makeDeleteOp('missing'), context).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual([]);
              expect(mockGraph.removeEdge).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));
  });

  describe('unsupported operations', () => {
    it('fails the graph validation when the graph is null', () =>
      new Promise<void>((resolve, reject) => {
        const op: DeleteEdgeOperation = {
          id: 'op-delete',
          type: 'delete-edge',
          source: 'user-interaction',
          priority: 'normal',
          timestamp: Date.now(),
          edgeId: 'e1',
        };

        executor.execute(op, { ...context, graph: null as never }).subscribe({
          next: () => reject(new Error('expected an error')),
          error: err => {
            try {
              expect((err as Error).message).toContain('Graph not available');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      }));
  });
});
