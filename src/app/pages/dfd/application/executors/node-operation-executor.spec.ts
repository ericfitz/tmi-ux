/**
 * Test suite for NodeOperationExecutor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { NodeOperationExecutor } from './node-operation-executor';
import {
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  OperationContext,
} from '../../types/graph-operation.types';

describe('NodeOperationExecutor', () => {
  let executor: NodeOperationExecutor;
  let mockLogger: any;
  let mockGraph: any;
  let operationContext: OperationContext;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockGraph = {
      addNode: vi.fn(),
      getCellById: vi.fn(),
      removeNode: vi.fn(),
      getConnectedEdges: vi.fn(),
    };

    // Create executor directly without TestBed
    executor = new NodeOperationExecutor(mockLogger);

    operationContext = {
      graph: mockGraph,
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
      userId: 'test-user',
      isCollaborating: false,
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false,
    };
  });

  describe('Executor Capabilities', () => {
    it('should handle node operations', () => {
      expect(executor.canExecute({ type: 'create-node' } as any)).toBe(true);
      expect(executor.canExecute({ type: 'update-node' } as any)).toBe(true);
      expect(executor.canExecute({ type: 'delete-node' } as any)).toBe(true);
      expect(executor.canExecute({ type: 'create-edge' } as any)).toBe(false);
    });

    it('should have correct priority', () => {
      expect(executor.priority).toBe(100);
    });
  });

  describe('Create Node Operations', () => {
    let createNodeOperation: CreateNodeOperation;

    beforeEach(() => {
      createNodeOperation = {
        id: 'create-node-123',
        type: 'create-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          nodeType: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          label: 'Test Node',
          style: {
            fill: '#ffffff',
            stroke: '#000000',
            strokeWidth: 1,
          },
          properties: {
            description: 'Test node description',
          },
        },
      };
    });

    it('should create node successfully', () => {
      const mockNode = {
        id: 'generated-node-id',
        addCssClass: vi.fn(),
      };
      mockGraph.addNode.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(createNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.operationType).toBe('create-node');
              expect(result.affectedCellIds).toContain('generated-node-id');
              expect(mockGraph.addNode).toHaveBeenCalled();

              const nodeConfig = mockGraph.addNode.mock.calls[0][0];
              expect(nodeConfig.x).toBe(100);
              expect(nodeConfig.y).toBe(100);
              expect(nodeConfig.width).toBe(120);
              expect(nodeConfig.height).toBe(60);
              expect(nodeConfig.attrs.label.text).toBe('Test Node');

              resolve();
            } catch (error) {
              reject(new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should generate ID when not provided', () => {
      createNodeOperation.nodeData.id = undefined;

      const mockNode = { id: 'auto-generated-id' };
      mockGraph.addNode.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(createNodeOperation, operationContext).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(result.affectedCellIds).toContain('auto-generated-id');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should apply custom styling', () => {
      createNodeOperation.nodeData.style = {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3,
        fontSize: 16,
        textColor: '#0000ff',
        cssClass: 'custom-node-class',
      };

      const mockNode = {
        id: 'styled-node',
        addCssClass: vi.fn(),
      };
      mockGraph.addNode.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(createNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);

              const nodeConfig = mockGraph.addNode.mock.calls[0][0];
              expect(nodeConfig.attrs.body.fill).toBe('#ff0000');
              expect(nodeConfig.attrs.body.stroke).toBe('#00ff00');
              expect(nodeConfig.attrs.body.strokeWidth).toBe(3);
              expect(nodeConfig.attrs.label.fontSize).toBe(16);
              expect(nodeConfig.attrs.label.fill).toBe('#0000ff');

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle creation errors', () => {
      mockGraph.addNode.mockImplementation(() => {
        throw new Error('Node creation failed');
      });

      return new Promise<void>((resolve, reject) => {
        executor.execute(createNodeOperation, operationContext).subscribe({
          next: result => {
            expect(result.success).toBe(false);
            expect(result.error).toContain('Failed to create node');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should use default values for missing properties', () => {
      createNodeOperation.nodeData = {
        nodeType: 'process',
        // Missing position, size, label, style, properties
      };

      const mockNode = { id: 'default-node' };
      mockGraph.addNode.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(createNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);

              const nodeConfig = mockGraph.addNode.mock.calls[0][0];
              expect(nodeConfig.x).toBe(100); // Default position
              expect(nodeConfig.y).toBe(100);
              expect(nodeConfig.width).toBe(140); // Default size for process nodes
              expect(nodeConfig.height).toBe(60); // Default height for process nodes
              expect(nodeConfig.attrs.label.text).toBe('Process'); // Default label for process nodes

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });
  });

  describe('Update Node Operations', () => {
    let updateNodeOperation: UpdateNodeOperation;
    let mockNode: any;

    beforeEach(() => {
      updateNodeOperation = {
        id: 'update-node-123',
        type: 'update-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeId: 'existing-node-id',
        updates: {
          label: 'Updated Label',
          position: { x: 200, y: 200 },
          size: { width: 150, height: 80 },
          style: {
            fill: '#ffff00',
          },
          properties: {
            updated: true,
          },
        },
      };

      mockNode = {
        isNode: vi.fn().mockReturnValue(true),
        setPosition: vi.fn(),
        setSize: vi.fn(),
        setAttrByPath: vi.fn(),
        getData: vi.fn().mockReturnValue({ existing: 'data' }),
        setData: vi.fn(),
      };
    });

    it('should update node successfully', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(updateNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.operationType).toBe('update-node');
              expect(result.affectedCellIds).toContain('existing-node-id');

              expect(mockNode.setPosition).toHaveBeenCalledWith(200, 200);
              expect(mockNode.setSize).toHaveBeenCalledWith(150, 80);
              expect(mockNode.setAttrByPath).toHaveBeenCalledWith('label/text', 'Updated Label');
              expect(mockNode.setAttrByPath).toHaveBeenCalledWith('body/fill', '#ffff00');
              expect(mockNode.setData).toHaveBeenCalledWith({ existing: 'data', updated: true });

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle node not found', () => {
      mockGraph.getCellById.mockReturnValue(null);

      return new Promise<void>((resolve, reject) => {
        executor.execute(updateNodeOperation, operationContext).subscribe({
          next: result => {
            expect(result.success).toBe(false);
            expect(result.error).toContain('Node not found');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle partial updates', () => {
      updateNodeOperation.updates = {
        label: 'Only Label Update',
      };

      mockGraph.getCellById.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(updateNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);

              expect(mockNode.setAttrByPath).toHaveBeenCalledWith(
                'label/text',
                'Only Label Update',
              );
              expect(mockNode.setPosition).not.toHaveBeenCalled();
              expect(mockNode.setSize).not.toHaveBeenCalled();

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle update errors', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);
      mockNode.setPosition.mockImplementation(() => {
        throw new Error('Update failed');
      });

      return new Promise<void>((resolve, reject) => {
        executor.execute(updateNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Failed to update node');
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should track which properties were changed', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);

      return new Promise<void>((resolve, reject) => {
        executor.execute(updateNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.metadata?.changedProperties).toContain('position');
              expect(result.metadata?.changedProperties).toContain('size');
              expect(result.metadata?.changedProperties).toContain('label');
              expect(result.metadata?.changedProperties).toContain('fill');
              expect(result.metadata?.changedProperties).toContain('properties');
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });
  });

  describe('Delete Node Operations', () => {
    let deleteNodeOperation: DeleteNodeOperation;
    let mockNode: any;
    let mockConnectedEdges: any[];

    beforeEach(() => {
      deleteNodeOperation = {
        id: 'delete-node-123',
        type: 'delete-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeId: 'node-to-delete',
      };

      mockNode = {
        isNode: vi.fn().mockReturnValue(true),
        getPosition: vi.fn().mockReturnValue({ x: 100, y: 100 }),
        getSize: vi.fn().mockReturnValue({ width: 120, height: 60 }),
        getAttrs: vi.fn().mockReturnValue({ label: { text: 'Test Node' } }),
        getData: vi.fn().mockReturnValue({ nodeType: 'process' }),
        id: 'node-to-delete',
        shape: 'rect',
      };

      mockConnectedEdges = [{ id: 'edge-1' }, { id: 'edge-2' }];
    });

    it('should delete node successfully', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);
      mockGraph.getConnectedEdges.mockReturnValue(mockConnectedEdges);

      return new Promise<void>((resolve, reject) => {
        executor.execute(deleteNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.operationType).toBe('delete-node');
              expect(result.affectedCellIds).toContain('node-to-delete');
              expect(result.affectedCellIds).toContain('edge-1');
              expect(result.affectedCellIds).toContain('edge-2');

              expect(mockGraph.removeNode).toHaveBeenCalledWith('node-to-delete');
              expect(result.metadata?.connectedEdgesCount).toBe(2);

              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle node not found gracefully', () => {
      mockGraph.getCellById.mockReturnValue(null);

      return new Promise<void>((resolve, reject) => {
        executor.execute(deleteNodeOperation, operationContext).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(result.affectedCellIds).toHaveLength(0);
            expect(mockGraph.removeNode).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle deletion errors', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);
      mockGraph.getConnectedEdges.mockReturnValue([]);
      mockGraph.removeNode.mockImplementation(() => {
        throw new Error('Deletion failed');
      });

      return new Promise<void>((resolve, reject) => {
        executor.execute(deleteNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toContain('Failed to delete node');
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should store node data for undo functionality', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);
      mockGraph.getConnectedEdges.mockReturnValue(mockConnectedEdges);

      return new Promise<void>((resolve, reject) => {
        executor.execute(deleteNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.metadata?.deletedNodeData).toBeDefined();
              expect(result.metadata?.deletedNodeData.id).toBe('node-to-delete');
              expect(result.metadata?.deletedNodeData.shape).toBe('rect');
              expect(result.metadata?.deletedEdgeIds).toEqual(['edge-1', 'edge-2']);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle nodes with no connected edges', () => {
      mockGraph.getCellById.mockReturnValue(mockNode);
      mockGraph.getConnectedEdges.mockReturnValue([]);

      return new Promise<void>((resolve, reject) => {
        executor.execute(deleteNodeOperation, operationContext).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(true);
              expect(result.affectedCellIds).toEqual(['node-to-delete']);
              expect(result.metadata?.connectedEdgesCount).toBe(0);
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });
  });

  describe('Operation Validation', () => {
    it('should handle missing graph gracefully', () => {
      const operation: CreateNodeOperation = {
        id: 'test-op',
        type: 'create-node',
        source: 'test',
        priority: 'normal',
        timestamp: Date.now(),
        nodeData: {
          nodeType: 'process',
          position: { x: 100, y: 100 },
          size: { width: 120, height: 60 },
          label: 'Test',
          style: {},
          properties: {},
        },
      };

      const contextWithoutGraph = { ...operationContext, graph: null };

      return new Promise<void>((resolve, reject) => {
        executor.execute(operation, contextWithoutGraph).subscribe({
          next: result => {
            try {
              expect(result.success).toBe(false);
              expect(result.error).toBeDefined();
              resolve();
            } catch (error) {
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          },
          error: reject,
        });
      });
    });

    it('should handle unsupported operation types', () => {
      const unsupportedOperation = {
        id: 'unsupported',
        type: 'unsupported-type',
        source: 'test',
        priority: 'normal',
        timestamp: Date.now(),
      } as any;

      return new Promise<void>((resolve, reject) => {
        executor.execute(unsupportedOperation, operationContext).subscribe({
          next: result => {
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unsupported operation type');
            resolve();
          },
          error: reject,
        });
      });
    });
  });
});
