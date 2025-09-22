/**
 * Test suite for NodeOperationExecutor
 */

import { TestBed } from '@angular/core/testing';

import { NodeOperationExecutor } from './node-operation-executor';
import { LoggerService } from '../../../../../core/services/logger.service';
import {
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  OperationContext
} from '../../types/graph-operation.types';

describe('NodeOperationExecutor', () => {
  let executor: NodeOperationExecutor;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockGraph: jasmine.SpyObj<any>;
  let operationContext: OperationContext;

  beforeEach(() => {
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'debug', 'warn', 'error'
    ]);

    mockGraph = jasmine.createSpyObj('Graph', [
      'addNode', 'getCellById', 'removeNode', 'getConnectedEdges'
    ]);

    TestBed.configureTestingModule({
      providers: [
        NodeOperationExecutor,
        { provide: LoggerService, useValue: mockLogger }
      ]
    });

    executor = TestBed.inject(NodeOperationExecutor);

    operationContext = {
      graph: mockGraph,
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
      userId: 'test-user',
      isCollaborating: false,
      permissions: ['read', 'write'],
      suppressValidation: false,
      suppressHistory: false,
      suppressBroadcast: false
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
            strokeWidth: 1
          },
          properties: {
            description: 'Test node description'
          }
        }
      };
    });

    it('should create node successfully', (done) => {
      const mockNode = { 
        id: 'generated-node-id',
        addCssClass: jasmine.createSpy('addCssClass')
      };
      mockGraph.addNode.and.returnValue(mockNode);

      executor.execute(createNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.operationType).toBe('create-node');
          expect(result.affectedCellIds).toContain('generated-node-id');
          expect(mockGraph.addNode).toHaveBeenCalled();
          
          const nodeConfig = mockGraph.addNode.calls.argsFor(0)[0];
          expect(nodeConfig.x).toBe(100);
          expect(nodeConfig.y).toBe(100);
          expect(nodeConfig.width).toBe(120);
          expect(nodeConfig.height).toBe(60);
          expect(nodeConfig.attrs.label.text).toBe('Test Node');
          
          done();
        },
        error: done.fail
      });
    });

    it('should generate ID when not provided', (done) => {
      createNodeOperation.nodeData.id = undefined;
      
      const mockNode = { id: 'auto-generated-id' };
      mockGraph.addNode.and.returnValue(mockNode);

      executor.execute(createNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.affectedCellIds).toContain('auto-generated-id');
          done();
        },
        error: done.fail
      });
    });

    it('should apply custom styling', (done) => {
      createNodeOperation.nodeData.style = {
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 3,
        fontSize: 16,
        textColor: '#0000ff',
        cssClass: 'custom-node-class'
      };

      const mockNode = { 
        id: 'styled-node',
        addCssClass: jasmine.createSpy('addCssClass')
      };
      mockGraph.addNode.and.returnValue(mockNode);

      executor.execute(createNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          
          const nodeConfig = mockGraph.addNode.calls.argsFor(0)[0];
          expect(nodeConfig.attrs.body.fill).toBe('#ff0000');
          expect(nodeConfig.attrs.body.stroke).toBe('#00ff00');
          expect(nodeConfig.attrs.body.strokeWidth).toBe(3);
          expect(nodeConfig.attrs.label.fontSize).toBe(16);
          expect(nodeConfig.attrs.label.fill).toBe('#0000ff');
          
          expect(mockNode.addCssClass).toHaveBeenCalledWith('custom-node-class');
          done();
        },
        error: done.fail
      });
    });

    it('should handle creation errors', (done) => {
      mockGraph.addNode.and.throwError('Node creation failed');

      executor.execute(createNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Failed to create node');
          done();
        },
        error: done.fail
      });
    });

    it('should use default values for missing properties', (done) => {
      createNodeOperation.nodeData = {
        nodeType: 'process'
        // Missing position, size, label, style, properties
      };

      const mockNode = { id: 'default-node' };
      mockGraph.addNode.and.returnValue(mockNode);

      executor.execute(createNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          
          const nodeConfig = mockGraph.addNode.calls.argsFor(0)[0];
          expect(nodeConfig.x).toBe(100); // Default position
          expect(nodeConfig.y).toBe(100);
          expect(nodeConfig.width).toBe(120); // Default size
          expect(nodeConfig.height).toBe(60);
          expect(nodeConfig.attrs.label.text).toBe('New Node'); // Default label
          
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Update Node Operations', () => {
    let updateNodeOperation: UpdateNodeOperation;
    let mockNode: jasmine.SpyObj<any>;

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
            fill: '#ffff00'
          },
          properties: {
            updated: true
          }
        }
      };

      mockNode = jasmine.createSpyObj('Node', [
        'setPosition', 'setSize', 'setAttrByPath', 'getData', 'setData'
      ]);
      mockNode.getData.and.returnValue({ existing: 'data' });
    });

    it('should update node successfully', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);

      executor.execute(updateNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.operationType).toBe('update-node');
          expect(result.affectedCellIds).toContain('existing-node-id');
          
          expect(mockNode.setPosition).toHaveBeenCalledWith(200, 200);
          expect(mockNode.setSize).toHaveBeenCalledWith(150, 80);
          expect(mockNode.setAttrByPath).toHaveBeenCalledWith('label/text', 'Updated Label');
          expect(mockNode.setAttrByPath).toHaveBeenCalledWith('body/fill', '#ffff00');
          expect(mockNode.setData).toHaveBeenCalledWith({ existing: 'data', updated: true });
          
          done();
        },
        error: done.fail
      });
    });

    it('should handle node not found', (done) => {
      mockGraph.getCellById.and.returnValue(null);

      executor.execute(updateNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Node not found');
          done();
        },
        error: done.fail
      });
    });

    it('should handle partial updates', (done) => {
      updateNodeOperation.updates = {
        label: 'Only Label Update'
      };

      mockGraph.getCellById.and.returnValue(mockNode);

      executor.execute(updateNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          
          expect(mockNode.setAttrByPath).toHaveBeenCalledWith('label/text', 'Only Label Update');
          expect(mockNode.setPosition).not.toHaveBeenCalled();
          expect(mockNode.setSize).not.toHaveBeenCalled();
          
          done();
        },
        error: done.fail
      });
    });

    it('should handle update errors', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);
      mockNode.setPosition.and.throwError('Update failed');

      executor.execute(updateNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Failed to update node');
          done();
        },
        error: done.fail
      });
    });

    it('should track which properties were changed', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);

      executor.execute(updateNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.metadata?.changedProperties).toContain('position');
          expect(result.metadata?.changedProperties).toContain('size');
          expect(result.metadata?.changedProperties).toContain('label');
          expect(result.metadata?.changedProperties).toContain('fill');
          expect(result.metadata?.changedProperties).toContain('properties');
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Delete Node Operations', () => {
    let deleteNodeOperation: DeleteNodeOperation;
    let mockNode: jasmine.SpyObj<any>;
    let mockConnectedEdges: any[];

    beforeEach(() => {
      deleteNodeOperation = {
        id: 'delete-node-123',
        type: 'delete-node',
        source: 'user-interaction',
        priority: 'normal',
        timestamp: Date.now(),
        nodeId: 'node-to-delete'
      };

      mockNode = jasmine.createSpyObj('Node', [
        'getPosition', 'getSize', 'getAttrs', 'getData'
      ], {
        id: 'node-to-delete',
        shape: 'rect'
      });

      mockNode.getPosition.and.returnValue({ x: 100, y: 100 });
      mockNode.getSize.and.returnValue({ width: 120, height: 60 });
      mockNode.getAttrs.and.returnValue({ label: { text: 'Test Node' } });
      mockNode.getData.and.returnValue({ nodeType: 'process' });

      mockConnectedEdges = [
        { id: 'edge-1' },
        { id: 'edge-2' }
      ];
    });

    it('should delete node successfully', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);
      mockGraph.getConnectedEdges.and.returnValue(mockConnectedEdges);

      executor.execute(deleteNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.operationType).toBe('delete-node');
          expect(result.affectedCellIds).toContain('node-to-delete');
          expect(result.affectedCellIds).toContain('edge-1');
          expect(result.affectedCellIds).toContain('edge-2');
          
          expect(mockGraph.removeNode).toHaveBeenCalledWith(mockNode);
          expect(result.metadata?.connectedEdgesCount).toBe(2);
          
          done();
        },
        error: done.fail
      });
    });

    it('should handle node not found gracefully', (done) => {
      mockGraph.getCellById.and.returnValue(null);

      executor.execute(deleteNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.affectedCellIds).toHaveSize(0);
          expect(mockGraph.removeNode).not.toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should handle deletion errors', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);
      mockGraph.getConnectedEdges.and.returnValue([]);
      mockGraph.removeNode.and.throwError('Deletion failed');

      executor.execute(deleteNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Failed to delete node');
          done();
        },
        error: done.fail
      });
    });

    it('should store node data for undo functionality', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);
      mockGraph.getConnectedEdges.and.returnValue(mockConnectedEdges);

      executor.execute(deleteNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.metadata?.deletedNodeData).toBeDefined();
          expect(result.metadata?.deletedNodeData.id).toBe('node-to-delete');
          expect(result.metadata?.deletedNodeData.shape).toBe('rect');
          expect(result.metadata?.deletedEdgeIds).toEqual(['edge-1', 'edge-2']);
          done();
        },
        error: done.fail
      });
    });

    it('should handle nodes with no connected edges', (done) => {
      mockGraph.getCellById.and.returnValue(mockNode);
      mockGraph.getConnectedEdges.and.returnValue([]);

      executor.execute(deleteNodeOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(true);
          expect(result.affectedCellIds).toEqual(['node-to-delete']);
          expect(result.metadata?.connectedEdgesCount).toBe(0);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Operation Validation', () => {
    it('should validate graph availability', (done) => {
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
          properties: {}
        }
      };

      const contextWithoutGraph = { ...operationContext, graph: null };

      executor.execute(operation, contextWithoutGraph).subscribe({
        next: () => done.fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Graph not available');
          done();
        }
      });
    });

    it('should handle unsupported operation types', (done) => {
      const unsupportedOperation = {
        id: 'unsupported',
        type: 'unsupported-type',
        source: 'test',
        priority: 'normal',
        timestamp: Date.now()
      } as any;

      executor.execute(unsupportedOperation, operationContext).subscribe({
        next: (result) => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Unsupported operation type');
          done();
        },
        error: done.fail
      });
    });
  });
});