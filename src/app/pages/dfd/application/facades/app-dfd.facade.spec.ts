/**
 * Test suite for AppDfdFacade.
 *
 * AppDfdFacade is a coordinator that delegates to 13 injected services. This
 * suite covers the delegation and predicate surface — infrastructure setup,
 * connection/embedding validation, clipboard, selection, z-order, and the
 * cell-type predicates — by asserting the facade forwards to the right
 * collaborator. The X6-heavy drag/reconnection/label-change handlers are out
 * of scope, as is cell deletion beyond the empty-selection early return.
 */

import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import { AppDfdFacade } from './app-dfd.facade';

// SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: type alias for a vitest mock function used in facade test stubs (pure)
type Mock = ReturnType<typeof vi.fn>;

/** Build a mock X6 graph with the methods the facade calls. */
// SEM@6c7c587ae74d8557ebdb352ebc28243df819dc5a: build a mock X6 graph stub with selection and clipboard methods for tests (pure)
function createMockGraph(selectedCells: unknown[] = []): Record<string, Mock> {
  return {
    getSelectedCells: vi.fn(() => selectedCells),
    getCellById: vi.fn(),
    copy: vi.fn(),
    paste: vi.fn(),
    isClipboardEmpty: vi.fn(() => true),
  };
}

describe('AppDfdFacade', () => {
  let facade: AppDfdFacade;
  let logger: Record<string, Mock>;
  let infraX6GraphAdapter: Record<string, Mock>;
  let infraX6ZOrderAdapter: Record<string, Mock>;
  let infraNodeService: Record<string, Mock>;
  let appEdgeService: Record<string, Mock>;
  let appExportService: Record<string, Mock>;
  let infraNodeConfigurationService: Record<string, Mock>;
  let infraVisualEffectsService: Record<string, Mock>;
  let infraX6CoreOperationsService: Record<string, Mock>;
  let historyCoordinator: Record<string, Mock>;
  let infraEmbeddingService: Record<string, Mock>;
  let graphOperationManager: Record<string, Mock>;
  let appStateService: Record<string, Mock>;
  let mockGraph: Record<string, Mock>;

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockGraph = createMockGraph();

    infraX6GraphAdapter = {
      initialize: vi.fn(),
      injectNodeService: vi.fn(),
      setGraph: vi.fn(),
      getGraph: vi.fn(() => mockGraph),
      executeCellDeletion: vi.fn(),
      setReadOnlyMode: vi.fn(),
    };
    infraX6ZOrderAdapter = {
      moveSelectedCellsForward: vi.fn(),
      moveSelectedCellsBackward: vi.fn(),
      moveSelectedCellsToFront: vi.fn(),
      moveSelectedCellsToBack: vi.fn(),
    };
    infraNodeService = {
      addGraphNode: vi.fn(() => of({ nodeId: 'n1', node: {} })),
      createNode: vi.fn(() => of(undefined)),
    };
    appEdgeService = {
      validateConnection: vi.fn(() => true),
      isMagnetValid: vi.fn(() => true),
      isConnectionValid: vi.fn(() => true),
      isNodeConnectionValid: vi.fn(() => true),
      updateEdgeLabel: vi.fn(),
      removeEdgeLabel: vi.fn(),
      isEdgeConnectedToNode: vi.fn(() => false),
      removeNodeEdges: vi.fn(),
    };
    appExportService = {};
    infraNodeConfigurationService = {};
    infraVisualEffectsService = {};
    infraX6CoreOperationsService = {};
    historyCoordinator = {};
    infraEmbeddingService = {
      validateEmbedding: vi.fn(() => ({ isValid: true })),
      calculateEmbeddingDepth: vi.fn(() => 0),
    };
    graphOperationManager = { execute: vi.fn(() => of({ success: true })) };
    appStateService = {};

    facade = new AppDfdFacade(
      logger as never,
      infraX6GraphAdapter as never,
      infraX6ZOrderAdapter as never,
      infraNodeService as never,
      appEdgeService as never,
      appExportService as never,
      infraNodeConfigurationService as never,
      infraVisualEffectsService as never,
      infraX6CoreOperationsService as never,
      historyCoordinator as never,
      infraEmbeddingService as never,
      graphOperationManager as never,
      appStateService as never,
    );
  });

  // -------------------------------------------------------------------------
  // Infrastructure management
  // -------------------------------------------------------------------------
  describe('infrastructure management', () => {
    it('initializeGraphAdapter initializes the adapter and injects the node service', () => {
      const container = {} as HTMLElement;

      facade.initializeGraphAdapter(container);

      expect(infraX6GraphAdapter['initialize']).toHaveBeenCalledWith(container);
      expect(infraX6GraphAdapter['injectNodeService']).toHaveBeenCalledWith(infraNodeService);
    });

    it('setGraphOnAdapter forwards the graph to the adapter', () => {
      const graph = { id: 'g' };

      facade.setGraphOnAdapter(graph);

      expect(infraX6GraphAdapter['setGraph']).toHaveBeenCalledWith(graph);
    });

    it('initializeGraph forwards the container to the adapter', () => {
      const container = {} as HTMLElement;

      facade.initializeGraph(container);

      expect(infraX6GraphAdapter['initialize']).toHaveBeenCalledWith(container);
    });

    it('setReadOnlyMode forwards the flag to the adapter', () => {
      facade.setReadOnlyMode(true);

      expect(infraX6GraphAdapter['setReadOnlyMode']).toHaveBeenCalledWith(true);
    });

    it('getGraph returns the adapter graph', () => {
      expect(facade.getGraph()).toBe(mockGraph);
    });
  });

  // -------------------------------------------------------------------------
  // Node creation delegation
  // -------------------------------------------------------------------------
  describe('node creation', () => {
    it('createNodeWithIntelligentPositioning delegates to the node service', () =>
      new Promise<void>((resolve, reject) => {
        facade.createNodeWithIntelligentPositioning('process', true).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ nodeId: 'n1', node: {} });
              expect(infraNodeService['addGraphNode']).toHaveBeenCalledWith('process', true);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: err => reject(err instanceof Error ? err : new Error(String(err))),
        });
      }));

    it('createNodeAtPosition delegates to the node service createNode', () =>
      new Promise<void>((resolve, reject) => {
        facade.createNodeAtPosition('store', { x: 10, y: 20 }).subscribe({
          next: () => {
            try {
              expect(infraNodeService['createNode']).toHaveBeenCalledWith('store', {
                x: 10,
                y: 20,
              });
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
  // Connection / embedding validation
  // -------------------------------------------------------------------------
  describe('validation delegation', () => {
    it('validateConnection delegates to the edge service', () => {
      appEdgeService['validateConnection'].mockReturnValue(false);

      expect(facade.validateConnection({ id: 's' }, { id: 't' })).toBe(false);
      expect(appEdgeService['validateConnection']).toHaveBeenCalledWith({ id: 's' }, { id: 't' });
    });

    it('isMagnetValid wraps the magnet and delegates to the edge service', () => {
      const magnet = {} as Element;

      expect(facade.isMagnetValid(magnet)).toBe(true);
      expect(appEdgeService['isMagnetValid']).toHaveBeenCalledWith({ magnet });
    });

    it('isConnectionValid forwards the views and magnets to the edge service', () => {
      const sourceMagnet = {} as Element;
      const targetMagnet = {} as Element;

      facade.isConnectionValid({ v: 's' }, { v: 't' }, sourceMagnet, targetMagnet);

      expect(appEdgeService['isConnectionValid']).toHaveBeenCalledWith({
        sourceView: { v: 's' },
        targetView: { v: 't' },
        sourceMagnet,
        targetMagnet,
      });
    });

    it('isNodeConnectionValid delegates to the edge service', () => {
      facade.isNodeConnectionValid({ id: 's' }, { id: 't' });

      expect(appEdgeService['isNodeConnectionValid']).toHaveBeenCalledWith(
        { id: 's' },
        { id: 't' },
      );
    });

    it('validateEmbedding returns the isValid flag from the embedding service', () => {
      infraEmbeddingService['validateEmbedding'].mockReturnValue({ isValid: false });

      expect(facade.validateEmbedding({ id: 'p' }, { id: 'c' })).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge label / connection helpers
  // -------------------------------------------------------------------------
  describe('edge helpers', () => {
    it('updateEdgeLabel delegates to the edge service', () => {
      const edge = { id: 'e' };

      facade.updateEdgeLabel(edge, 'label');

      expect(appEdgeService['updateEdgeLabel']).toHaveBeenCalledWith(edge, 'label');
    });

    it('removeEdgeLabel delegates to the edge service', () => {
      const edge = { id: 'e' };

      facade.removeEdgeLabel(edge);

      expect(appEdgeService['removeEdgeLabel']).toHaveBeenCalledWith(edge);
    });

    it('isEdgeConnectedToNode delegates to the edge service', () => {
      appEdgeService['isEdgeConnectedToNode'].mockReturnValue(true);

      expect(facade.isEdgeConnectedToNode({ id: 'e' }, 'n1')).toBe(true);
    });

    it('removeNodeEdges passes the graph and node id to the edge service', () => {
      facade.removeNodeEdges('n1');

      expect(appEdgeService['removeNodeEdges']).toHaveBeenCalledWith(mockGraph, 'n1');
    });
  });

  // -------------------------------------------------------------------------
  // Clipboard
  // -------------------------------------------------------------------------
  describe('clipboard', () => {
    it('copy copies the selected cells to the graph clipboard', () => {
      const cells = [{ id: 'c1' }];
      mockGraph['getSelectedCells'].mockReturnValue(cells);

      facade.copy();

      expect(mockGraph['copy']).toHaveBeenCalledWith(cells);
    });

    it('copy does nothing when no cells are selected', () => {
      mockGraph['getSelectedCells'].mockReturnValue([]);

      facade.copy();

      expect(mockGraph['copy']).not.toHaveBeenCalled();
    });

    it('paste pastes when the clipboard is not empty', () => {
      mockGraph['isClipboardEmpty'].mockReturnValue(false);

      facade.paste();

      expect(mockGraph['paste']).toHaveBeenCalled();
    });

    it('paste does nothing when the clipboard is empty', () => {
      mockGraph['isClipboardEmpty'].mockReturnValue(true);

      facade.paste();

      expect(mockGraph['paste']).not.toHaveBeenCalled();
    });

    it('isClipboardEmpty reflects the graph clipboard state', () => {
      mockGraph['isClipboardEmpty'].mockReturnValue(false);

      expect(facade.isClipboardEmpty()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Selection state
  // -------------------------------------------------------------------------
  describe('selection state', () => {
    it('getSelectedCells returns the graph selection', () => {
      const cells = [{ id: 'a' }, { id: 'b' }];
      mockGraph['getSelectedCells'].mockReturnValue(cells);

      expect(facade.getSelectedCells()).toBe(cells);
    });

    it('hasSelectedCells is true when the selection is non-empty', () => {
      mockGraph['getSelectedCells'].mockReturnValue([{ id: 'a' }]);

      expect(facade.hasSelectedCells()).toBe(true);
    });

    it('hasSelectedCells is false when nothing is selected', () => {
      mockGraph['getSelectedCells'].mockReturnValue([]);

      expect(facade.hasSelectedCells()).toBe(false);
    });

    it('hasExactlyOneSelectedCell is true only for a single selection', () => {
      mockGraph['getSelectedCells'].mockReturnValue([{ id: 'a' }]);
      expect(facade.hasExactlyOneSelectedCell()).toBe(true);

      mockGraph['getSelectedCells'].mockReturnValue([{ id: 'a' }, { id: 'b' }]);
      expect(facade.hasExactlyOneSelectedCell()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Z-order
  // -------------------------------------------------------------------------
  describe('z-order', () => {
    it('moveSelectedForward delegates to the z-order adapter', () => {
      facade.moveSelectedForward();
      expect(infraX6ZOrderAdapter['moveSelectedCellsForward']).toHaveBeenCalledWith(mockGraph);
    });

    it('moveSelectedBackward delegates to the z-order adapter', () => {
      facade.moveSelectedBackward();
      expect(infraX6ZOrderAdapter['moveSelectedCellsBackward']).toHaveBeenCalledWith(mockGraph);
    });

    it('moveSelectedToFront delegates to the z-order adapter', () => {
      facade.moveSelectedToFront();
      expect(infraX6ZOrderAdapter['moveSelectedCellsToFront']).toHaveBeenCalledWith(mockGraph);
    });

    it('moveSelectedToBack delegates to the z-order adapter', () => {
      facade.moveSelectedToBack();
      expect(infraX6ZOrderAdapter['moveSelectedCellsToBack']).toHaveBeenCalledWith(mockGraph);
    });
  });

  // -------------------------------------------------------------------------
  // Cell deletion
  // -------------------------------------------------------------------------
  describe('cell deletion', () => {
    it('executeDirectCellDeletion delegates to the graph adapter', () => {
      const cell = { id: 'c1' } as never;

      facade.executeDirectCellDeletion(cell);

      expect(infraX6GraphAdapter['executeCellDeletion']).toHaveBeenCalledWith(cell);
    });

    it('deleteSelectedCells succeeds with zero deletions when nothing is selected', () =>
      new Promise<void>((resolve, reject) => {
        mockGraph['getSelectedCells'].mockReturnValue([]);

        facade.deleteSelectedCells().subscribe({
          next: result => {
            try {
              expect(result).toEqual({ success: true, deletedCount: 0 });
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
  // Cell-type predicates
  // -------------------------------------------------------------------------
  describe('cell-type predicates', () => {
    it('isSelectedCellTextBox is true for a single text-box node', () => {
      mockGraph['getSelectedCells'].mockReturnValue([
        { isNode: () => true, shape: 'text-box', getData: () => ({}) },
      ]);

      expect(facade.isSelectedCellTextBox()).toBe(true);
    });

    it('isSelectedCellTextBox is false when more than one cell is selected', () => {
      mockGraph['getSelectedCells'].mockReturnValue([
        { isNode: () => true, shape: 'text-box', getData: () => ({}) },
        { isNode: () => true, shape: 'text-box', getData: () => ({}) },
      ]);

      expect(facade.isSelectedCellTextBox()).toBe(false);
    });

    it('isSelectedCellTextBox detects the type via node data when shape differs', () => {
      mockGraph['getSelectedCells'].mockReturnValue([
        { isNode: () => true, shape: 'rect', getData: () => ({ nodeType: 'text-box' }) },
      ]);

      expect(facade.isSelectedCellTextBox()).toBe(true);
    });

    it('isSelectedCellSecurityBoundary is true for a single security-boundary node', () => {
      mockGraph['getSelectedCells'].mockReturnValue([
        { isNode: () => true, shape: 'security-boundary', getData: () => ({}) },
      ]);

      expect(facade.isSelectedCellSecurityBoundary()).toBe(true);
    });

    it('isSelectedCellSecurityBoundary is false for a plain node', () => {
      mockGraph['getSelectedCells'].mockReturnValue([
        { isNode: () => true, shape: 'process', getData: () => ({}) },
      ]);

      expect(facade.isSelectedCellSecurityBoundary()).toBe(false);
    });

    it('isRightClickedCellEdge is true for an edge cell', () => {
      expect(facade.isRightClickedCellEdge({ isEdge: () => true })).toBe(true);
    });

    it('isRightClickedCellEdge is false for a node cell', () => {
      expect(facade.isRightClickedCellEdge({ isEdge: () => false })).toBe(false);
    });

    it('isRightClickedCellEdge is false when no cell is provided', () => {
      expect(facade.isRightClickedCellEdge(undefined)).toBe(false);
    });
  });

  describe('dispose', () => {
    it('does not throw', () => {
      expect(() => facade.dispose()).not.toThrow();
    });
  });
});
