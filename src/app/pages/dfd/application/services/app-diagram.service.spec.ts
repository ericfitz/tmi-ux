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
          shape: 'flow',
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

  describe('server data corruption resilience', () => {
    const NIL_UUID = '00000000-0000-0000-0000-000000000000';
    const mockNodeConfigService = {
      getNodePorts: vi.fn(() => ({ items: [] })),
    };

    it('should strip nil-UUID source/target from node cells and load them as nodes', () => {
      const corruptedNode = {
        id: 'node-1',
        shape: 'actor',
        attrs: {},
        data: { _metadata: [] },
        source: { cell: NIL_UUID, port: null },
        target: { cell: NIL_UUID, port: null },
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);

      service.loadDiagramCellsBatch([corruptedNode], mockGraph, 'diagram-1', mockNodeConfigService);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stripping nil-UUID source/target'),
        expect.objectContaining({ cellId: 'node-1', shape: 'actor' }),
      );
      expect(mockInfraNodeService.createNodeFromInfo).toHaveBeenCalled();
      expect(mockInfraEdgeService.createEdge).not.toHaveBeenCalled();
    });

    it('should reconstruct default attrs when node has empty attrs', () => {
      const nodeWithEmptyAttrs = {
        id: 'node-1',
        shape: 'process',
        x: 100,
        y: 200,
        width: 80,
        height: 60,
        attrs: {},
        data: { _metadata: [] },
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);

      service.loadDiagramCellsBatch(
        [nodeWithEmptyAttrs],
        mockGraph,
        'diagram-1',
        mockNodeConfigService,
      );

      expect(mockInfraNodeService.createNodeFromInfo).toHaveBeenCalled();
      const nodeInfoArg = mockInfraNodeService.createNodeFromInfo.mock.calls[0][1];
      // NodeInfo should have default attrs with a label
      expect(nodeInfoArg.attrs.text.text).toBe('Process');
      expect(nodeInfoArg.attrs.body.fill).toBeDefined();
    });

    it('should classify cells with non-nil source/target as edges regardless of shape', () => {
      const mislabeledEdge = {
        id: 'edge-1',
        shape: 'actor',
        source: { cell: 'node-a', port: 'right' },
        target: { cell: 'node-b', port: 'left' },
        attrs: { line: { stroke: '#000' } },
        data: { _metadata: [] },
      };

      const mockEdgeCell = { id: 'edge-1', setZIndex: vi.fn() };
      mockInfraEdgeService.createEdge.mockReturnValue(mockEdgeCell);

      service.loadDiagramCellsBatch(
        [mislabeledEdge],
        mockGraph,
        'diagram-1',
        mockNodeConfigService,
      );

      expect(mockInfraEdgeService.createEdge).toHaveBeenCalled();
      expect(mockInfraNodeService.createNodeFromInfo).not.toHaveBeenCalled();
    });

    it('should preserve valid attrs when present', () => {
      const nodeWithValidAttrs = {
        id: 'node-1',
        shape: 'actor',
        x: 100,
        y: 200,
        width: 120,
        height: 60,
        attrs: {
          body: { fill: '#e8f4fd', stroke: '#1f77b4' },
          text: { text: 'My Actor', fontSize: 12 },
        },
        data: { _metadata: [] },
      };

      const mockNodeCell = { id: 'node-1', setZIndex: vi.fn() };
      mockInfraNodeService.createNodeFromInfo.mockReturnValue(mockNodeCell);

      service.loadDiagramCellsBatch(
        [nodeWithValidAttrs],
        mockGraph,
        'diagram-1',
        mockNodeConfigService,
      );

      const nodeInfoArg = mockInfraNodeService.createNodeFromInfo.mock.calls[0][1];
      expect(nodeInfoArg.attrs.text.text).toBe('My Actor');
      expect(nodeInfoArg.attrs.body.fill).toBe('#e8f4fd');
    });
  });
});
