/**
 * Tests for AppDiagramService
 *
 * Test framework: Vitest
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-diagram.service.spec.ts
 * IMPORTANT: Do not skip or disable tests. Always troubleshoot to root cause and fix.
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AppDiagramService } from './app-diagram.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppOperationStateManager } from './app-operation-state-manager.service';
import { InfraPortStateService } from '../../infrastructure/services/infra-port-state.service';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { InfraWebsocketCollaborationAdapter } from '../../infrastructure/adapters/infra-websocket-collaboration.adapter';
import { CellOperation } from '../../../../core/types/websocket-message.types';

describe('AppDiagramService', () => {
  let service: AppDiagramService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockThreatModelService: {
    getDiagramById: ReturnType<typeof vi.fn>;
    getThreatModelById: ReturnType<typeof vi.fn>;
    patchDiagramCells: ReturnType<typeof vi.fn>;
    patchDiagramWithImage: ReturnType<typeof vi.fn>;
  };
  let mockHistoryCoordinator: {
    executeRemoteOperation: ReturnType<typeof vi.fn>;
    executeVisualEffect: ReturnType<typeof vi.fn>;
  };
  let mockPortStateManager: {
    hideUnconnectedPorts: ReturnType<typeof vi.fn>;
  };
  let mockInfraNodeService: {
    createNodeFromInfo: ReturnType<typeof vi.fn>;
  };
  let mockInfraEdgeService: {
    createEdge: ReturnType<typeof vi.fn>;
  };
  let mockCollaborationService: {
    isCollaborating: ReturnType<typeof vi.fn>;
  };
  let mockCollaborativeOperationService: {
    sendDiagramOperation: ReturnType<typeof vi.fn>;
  };
  let mockGraph: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    mockThreatModelService = {
      getDiagramById: vi.fn(),
      getThreatModelById: vi.fn(),
      patchDiagramCells: vi.fn(),
      patchDiagramWithImage: vi.fn(),
    };

    mockHistoryCoordinator = {
      executeRemoteOperation: vi.fn((graph: any, callback: () => any) => callback()),
      executeVisualEffect: vi.fn((graph: any, callback: () => void) => callback()),
    };

    mockPortStateManager = {
      hideUnconnectedPorts: vi.fn(),
    };

    mockInfraNodeService = {
      createNodeFromInfo: vi.fn(),
    };

    mockInfraEdgeService = {
      createEdge: vi.fn(),
    };

    mockCollaborationService = {
      isCollaborating: vi.fn(),
    };

    mockCollaborativeOperationService = {
      sendDiagramOperation: vi.fn(),
    };

    mockGraph = {
      clearCells: vi.fn(),
      getCells: vi.fn(() => []),
      getCellById: vi.fn(),
      centerContent: vi.fn(),
      isNode: vi.fn(() => true),
      isEdge: vi.fn(() => false),
      position: vi.fn(() => ({ x: 100, y: 200 })),
      size: vi.fn(() => ({ width: 80, height: 60 })),
      getZIndex: vi.fn(() => 1),
      getAttrs: vi.fn(() => ({ text: { text: 'Test' } })),
      getData: vi.fn(() => ({ _metadata: [] })),
      getSource: vi.fn(() => ({ cell: 'node1', port: 'right' })),
      getTarget: vi.fn(() => ({ cell: 'node2', port: 'left' })),
      getVertices: vi.fn(() => []),
      getParent: vi.fn(() => null),
    };

    service = new AppDiagramService(
      mockLogger as unknown as LoggerService,
      mockThreatModelService as unknown as ThreatModelService,
      mockHistoryCoordinator as unknown as AppOperationStateManager,
      mockPortStateManager as unknown as InfraPortStateService,
      mockInfraNodeService as unknown as InfraNodeService,
      mockInfraEdgeService as unknown as InfraEdgeService,
      mockCollaborationService as unknown as DfdCollaborationService,
      mockCollaborativeOperationService as unknown as InfraWebsocketCollaborationAdapter,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeDefined();
    });
  });

  describe('loadDiagram', () => {
    it('should load diagram successfully with threat model data', () => {
      const diagramId = 'diagram-1';
      const threatModelId = 'tm-1';
      const mockDiagram = {
        name: 'Test Diagram',
        cells: [{ id: 'cell-1' }],
        update_vector: 5,
      };
      const mockThreatModel = {
        name: 'Test Threat Model',
      };

      mockThreatModelService.getDiagramById.mockReturnValue(of(mockDiagram));
      mockThreatModelService.getThreatModelById.mockReturnValue(of(mockThreatModel));

      const results: any[] = [];
      service.loadDiagram(diagramId, threatModelId).subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].diagram).toBeDefined();
      expect(results[0].diagram?.id).toBe(diagramId);
      expect(results[0].diagram?.name).toBe('Test Diagram');
      expect(results[0].diagram?.threatModelId).toBe(threatModelId);
      expect(results[0].diagram?.threatModelName).toBe('Test Threat Model');
      expect(results[0].diagram?.cells).toHaveLength(1);
      expect(results[0].diagram?.update_vector).toBe(5);
    });

    it('should return error when threat model ID is missing', () => {
      const diagramId = 'diagram-1';

      const results: any[] = [];
      service.loadDiagram(diagramId).subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Threat model ID is required');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle diagram not found', () => {
      const diagramId = 'diagram-1';
      const threatModelId = 'tm-1';

      mockThreatModelService.getDiagramById.mockReturnValue(of(null));

      const results: any[] = [];
      service.loadDiagram(diagramId, threatModelId).subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Diagram with ID diagram-1 not found');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle errors during loading', () => {
      const diagramId = 'diagram-1';
      const threatModelId = 'tm-1';

      mockThreatModelService.getDiagramById.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const results: any[] = [];
      service.loadDiagram(diagramId, threatModelId).subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('Failed to load diagram data');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('validateDiagramAccess', () => {
    it('should return true when diagram loads successfully', () => {
      const diagramId = 'diagram-1';
      const threatModelId = 'tm-1';

      mockThreatModelService.getDiagramById.mockReturnValue(
        of({ name: 'Test', cells: [], update_vector: 1 }),
      );
      mockThreatModelService.getThreatModelById.mockReturnValue(of({ name: 'TM' }));

      const results: any[] = [];
      service
        .validateDiagramAccess(diagramId, threatModelId)
        .subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
    });

    it('should return false when diagram load fails', () => {
      const diagramId = 'diagram-1';

      const results: any[] = [];
      service.validateDiagramAccess(diagramId).subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(false);
    });
  });

  describe('getFallbackNavigationPath', () => {
    it('should return threat model path when threat model ID provided', () => {
      const result = service.getFallbackNavigationPath('tm-1');
      expect(result).toBe('/threat-models/tm-1');
    });

    it('should return threat models list path when no threat model ID', () => {
      const result = service.getFallbackNavigationPath(null);
      expect(result).toBe('/threat-models');
    });
  });

  describe('isValidDiagramId', () => {
    it('should return true for valid diagram ID', () => {
      expect(service.isValidDiagramId('diagram-1')).toBe(true);
    });

    it('should return false for null', () => {
      expect(service.isValidDiagramId(null)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isValidDiagramId('')).toBe(false);
    });

    it('should return false for whitespace only', () => {
      expect(service.isValidDiagramId('   ')).toBe(false);
    });
  });

  describe('loadDiagramCellsBatch', () => {
    it('should load cells with normalization and deduplication', () => {
      const mockNode = {
        id: 'node-1',
        shape: 'process',
        x: 100,
        y: 200,
        width: 80,
        height: 60,
        attrs: { text: { text: 'Process 1' } },
      };

      const mockNodeConfigService = {
        getNodePorts: vi.fn(() => ({ items: [] })),
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);

      mockGraph.getCells.mockReturnValue([mockNodeCell]);

      const result = service.loadDiagramCellsBatch(
        [mockNode],
        mockGraph,
        'diagram-1',
        mockNodeConfigService,
      );

      expect(mockHistoryCoordinator.executeRemoteOperation).toHaveBeenCalled();
      expect(mockGraph.clearCells).toHaveBeenCalled();
      expect(mockInfraNodeService.createNodeFromInfo).toHaveBeenCalled();
      expect(mockPortStateManager.hideUnconnectedPorts).toHaveBeenCalled();
      expect(mockGraph.centerContent).toHaveBeenCalled();
      expect(result.relationshipFixesApplied).toBe(false);
    });

    it('should handle duplicate cell IDs', () => {
      const mockCells = [
        { id: 'node-1', shape: 'process', x: 100, y: 200 },
        { id: 'node-1', shape: 'process', x: 150, y: 250 }, // Duplicate
      ];

      const mockNodeConfigService = {
        getNodePorts: vi.fn(() => ({ items: [] })),
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);

      service.loadDiagramCellsBatch(mockCells, mockGraph, 'diagram-1', mockNodeConfigService);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Removed duplicate cells'),
        expect.any(Object),
      );
      // Should only create node once
      expect(mockInfraNodeService.createNodeFromInfo).toHaveBeenCalledTimes(1);
    });

    it('should handle edges after nodes', () => {
      const mockCells = [
        { id: 'node-1', shape: 'process', x: 100, y: 200 },
        {
          id: 'edge-1',
          shape: 'edge',
          source: { cell: 'node-1', port: 'right' },
          target: { cell: 'node-2', port: 'left' },
        },
      ];

      const mockNodeConfigService = {
        getNodePorts: vi.fn(() => ({ items: [] })),
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      const mockEdgeCell = { id: 'edge-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);
      mockInfraEdgeService.createEdge.mockReturnValue(mockEdgeCell);

      service.loadDiagramCellsBatch(mockCells, mockGraph, 'diagram-1', mockNodeConfigService);

      expect(mockInfraNodeService.createNodeFromInfo).toHaveBeenCalled();
      expect(mockInfraEdgeService.createEdge).toHaveBeenCalled();
    });

    it('should establish parent-child relationships', () => {
      const mockCells = [
        { id: 'parent-1', shape: 'security-boundary', x: 100, y: 200 },
        { id: 'child-1', shape: 'process', x: 150, y: 250, parent: 'parent-1' },
      ];

      const mockNodeConfigService = {
        getNodePorts: vi.fn(() => ({ items: [] })),
      };

      const mockParentCell = {
        id: 'parent-1',
        setZIndex: vi.fn(),
        isNode: () => true,
      };
      const mockChildCell = {
        id: 'child-1',
        setZIndex: vi.fn(),
        setParent: vi.fn(),
        isNode: () => true,
      };

      mockInfraNodeService.createNodeFromInfo
        .mockReturnValueOnce(mockParentCell)
        .mockReturnValueOnce(mockChildCell);

      mockGraph.getCellById.mockImplementation((id: string) => {
        if (id === 'parent-1') return mockParentCell;
        if (id === 'child-1') return mockChildCell;
        return null;
      });

      service.loadDiagramCellsBatch(mockCells, mockGraph, 'diagram-1', mockNodeConfigService);

      expect(mockChildCell.setParent).toHaveBeenCalledWith(mockParentCell);
    });

    it('should handle errors during cell conversion', () => {
      const mockCells = [
        { id: 'bad-cell', shape: 'invalid' }, // Will cause error
      ];

      const mockNodeConfigService = {
        getNodePorts: vi.fn(() => {
          throw new Error('Invalid shape');
        }),
      };

      service.loadDiagramCellsBatch(mockCells, mockGraph, 'diagram-1', mockNodeConfigService);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error converting cell to X6 format'),
        expect.any(Object),
      );
    });
  });

  describe('saveDiagramChanges', () => {
    it('should use REST in solo mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);
      mockThreatModelService.patchDiagramCells.mockReturnValue(of({ name: 'Updated' }));

      const cells = [{ id: 'node-1', isNode: () => true, isEdge: () => false }];
      mockGraph.getCells.mockReturnValue(cells);

      const results: any[] = [];
      service
        .saveDiagramChanges(mockGraph, 'diagram-1', 'tm-1')
        .subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
      expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalled();
    });

    it('should handle REST save error in solo mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);
      mockThreatModelService.patchDiagramCells.mockReturnValue(
        throwError(() => new Error('Save failed')),
      );

      mockGraph.getCells.mockReturnValue([]);

      const results: any[] = [];
      service
        .saveDiagramChanges(mockGraph, 'diagram-1', 'tm-1')
        .subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('saveDiagramChangesWithImage', () => {
    it('should save with image data in solo mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);
      mockThreatModelService.patchDiagramWithImage.mockReturnValue(of({ name: 'Updated' }));

      const cells = [{ id: 'node-1', isNode: () => true, isEdge: () => false }];
      mockGraph.getCells.mockReturnValue(cells);

      const imageData = { svg: '<svg></svg>', update_vector: 5 };

      const results: any[] = [];
      service
        .saveDiagramChangesWithImage(mockGraph, 'diagram-1', 'tm-1', imageData)
        .subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(true);
      expect(mockThreatModelService.patchDiagramWithImage).toHaveBeenCalledWith(
        'tm-1',
        'diagram-1',
        expect.any(Array),
        imageData,
      );
    });

    it('should handle save error with image data', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);
      mockThreatModelService.patchDiagramWithImage.mockReturnValue(
        throwError(() => new Error('Save failed')),
      );

      mockGraph.getCells.mockReturnValue([]);
      const imageData = { svg: '<svg></svg>' };

      const results: any[] = [];
      service
        .saveDiagramChangesWithImage(mockGraph, 'diagram-1', 'tm-1', imageData)
        .subscribe(result => results.push(result));

      expect(results).toHaveLength(1);
      expect(results[0]).toBe(false);
    });
  });

  describe('sendCollaborativeOperation', () => {
    it('should send operations in collaborative mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(true);
      mockCollaborativeOperationService.sendDiagramOperation.mockReturnValue(of(undefined));

      const operations: CellOperation[] = [
        { id: 'cell-1', operation: 'add', data: { id: 'cell-1' } },
      ];

      const results: any[] = [];
      service.sendCollaborativeOperation(operations).subscribe(() => results.push(true));

      expect(results).toHaveLength(1);
      expect(mockCollaborativeOperationService.sendDiagramOperation).toHaveBeenCalledWith(
        operations,
      );
    });

    it('should reject when not in collaborative mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);

      const operations: CellOperation[] = [];

      const errors: any[] = [];
      service.sendCollaborativeOperation(operations).subscribe({
        error: error => errors.push(error),
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Not in collaborative mode');
    });

    it('should reject authentication errors without fallback', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(true);
      mockCollaborativeOperationService.sendDiagramOperation.mockReturnValue(
        throwError(() => new Error('401 Unauthorized')),
      );

      const operations: CellOperation[] = [];

      const errors: any[] = [];
      service.sendCollaborativeOperation(operations).subscribe({
        error: error => errors.push(error),
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('401');
    });

    it('should fallback to REST on WebSocket error when parameters provided', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(true);
      mockCollaborativeOperationService.sendDiagramOperation.mockReturnValue(
        throwError(() => new Error('WebSocket error')),
      );
      mockThreatModelService.patchDiagramCells.mockReturnValue(of({ name: 'Updated' }));

      mockGraph.getCells.mockReturnValue([]);

      const operations: CellOperation[] = [];

      const results: any[] = [];
      service
        .sendCollaborativeOperation(operations, mockGraph, 'diagram-1', 'tm-1')
        .subscribe(() => results.push(true));

      expect(results).toHaveLength(1);
      expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('REST fallback successful'),
      );
    });

    it('should reject when WebSocket fails and no fallback parameters', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(true);
      mockCollaborativeOperationService.sendDiagramOperation.mockReturnValue(
        throwError(() => new Error('WebSocket error')),
      );

      const operations: CellOperation[] = [];

      const errors: any[] = [];
      service.sendCollaborativeOperation(operations).subscribe({
        error: error => errors.push(error),
      });

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('REST fallback not available');
    });
  });

  describe('convertGraphToCellsFormat', () => {
    it('should convert graph nodes to cell format', () => {
      const mockNode = {
        id: 'node-1',
        shape: 'process',
        isNode: () => true,
        isEdge: () => false,
        position: () => ({ x: 100, y: 200 }),
        size: () => ({ width: 80, height: 60 }),
        getZIndex: () => 1,
        getAttrs: () => ({ text: { text: 'Test' } }),
        getData: () => ({ _metadata: [] }),
        getParent: () => null,
      };

      mockGraph.getCells.mockReturnValue([mockNode]);

      const result = (service as any).convertGraphToCellsFormat(mockGraph);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('node-1');
      expect(result[0].shape).toBe('process');
      expect(result[0].x).toBe(100);
      expect(result[0].y).toBe(200);
    });

    it('should convert graph edges to cell format', () => {
      const mockEdge = {
        id: 'edge-1',
        shape: 'edge',
        isNode: () => false,
        isEdge: () => true,
        getSource: () => ({ cell: 'node-1', port: 'right' }),
        getTarget: () => ({ cell: 'node-2', port: 'left' }),
        getVertices: () => [],
        getZIndex: () => 1,
        getData: () => ({ _metadata: [] }),
      };

      mockGraph.getCells.mockReturnValue([mockEdge]);

      const result = (service as any).convertGraphToCellsFormat(mockGraph);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('edge-1');
      expect(result[0].shape).toBe('edge');
      expect(result[0].source.cell).toBe('node-1');
      expect(result[0].target.cell).toBe('node-2');
    });

    it('should handle nodes with parent relationships', () => {
      const mockParent = {
        id: 'parent-1',
        isNode: () => true,
      };

      const mockNode = {
        id: 'node-1',
        shape: 'process',
        isNode: () => true,
        isEdge: () => false,
        position: () => ({ x: 100, y: 200 }),
        size: () => ({ width: 80, height: 60 }),
        getZIndex: () => 1,
        getAttrs: () => ({ text: { text: 'Test' } }),
        getData: () => ({ _metadata: [] }),
        getParent: () => mockParent,
      };

      mockGraph.getCells.mockReturnValue([mockNode]);

      const result = (service as any).convertGraphToCellsFormat(mockGraph);

      expect(result[0].parent).toBe('parent-1');
    });

    it('should handle errors during conversion', () => {
      const mockNode = {
        id: 'bad-node',
        isNode: () => true,
        isEdge: () => false,
        position: () => {
          throw new Error('Invalid position');
        },
      };

      mockGraph.getCells.mockReturnValue([mockNode]);

      const result = (service as any).convertGraphToCellsFormat(mockGraph);

      expect(result).toHaveLength(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
