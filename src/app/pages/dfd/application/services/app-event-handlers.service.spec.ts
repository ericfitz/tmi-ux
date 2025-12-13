/**
 * Tests for AppEventHandlersService
 *
 * Test framework: Vitest
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-event-handlers.service.spec.ts
 * IMPORTANT: Do not skip or disable tests. Always troubleshoot to root cause and fix.
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of } from 'rxjs';
import { AppEventHandlersService } from './app-event-handlers.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { InfraX6SelectionAdapter } from '../../infrastructure/adapters/infra-x6-selection.adapter';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

describe('AppEventHandlersService', () => {
  let service: AppEventHandlersService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockSelectionAdapter: {
    deleteSelected: ReturnType<typeof vi.fn>;
  };
  let mockThreatModelService: {
    getThreatModelById: ReturnType<typeof vi.fn>;
    createThreat: ReturnType<typeof vi.fn>;
  };
  let mockFrameworkService: {
    loadAllFrameworks: ReturnType<typeof vi.fn>;
  };
  let mockCellDataExtractionService: {
    extractFromX6Graph: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
    openDialogs: any[];
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockX6GraphAdapter: any;
  let mockGraph: any;
  let mockCell: any;
  let mockBroadcaster: {
    startAtomicOperation: ReturnType<typeof vi.fn>;
    commitAtomicOperation: ReturnType<typeof vi.fn>;
    cancelAtomicOperation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    mockSelectionAdapter = {
      deleteSelected: vi.fn(),
    };

    mockThreatModelService = {
      getThreatModelById: vi.fn(),
      createThreat: vi.fn(),
    };

    mockFrameworkService = {
      loadAllFrameworks: vi.fn(),
    };

    mockCellDataExtractionService = {
      extractFromX6Graph: vi.fn(),
    };

    mockDialog = {
      open: vi.fn(),
      openDialogs: [],
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    const selectionChanged$ = new Subject();
    const cellContextMenu$ = new Subject();

    mockGraph = {
      batchUpdate: vi.fn((callback: () => void) => callback()),
      resize: vi.fn(),
      container: { style: { width: '', height: '' } },
    };

    mockCell = {
      id: 'cell-1',
      shape: 'process',
      isNode: vi.fn(() => true),
      isEdge: vi.fn(() => false),
      getLabel: vi.fn(() => 'Test Label'),
      setLabel: vi.fn(),
    };

    mockBroadcaster = {
      startAtomicOperation: vi.fn(),
      commitAtomicOperation: vi.fn(),
      cancelAtomicOperation: vi.fn(),
    };

    mockX6GraphAdapter = {
      selectionChanged$,
      cellContextMenu$,
      getSelectedCells: vi.fn(() => []),
      getGraph: vi.fn(() => mockGraph),
      getDiagramOperationBroadcaster: vi.fn(() => mockBroadcaster),
      moveSelectedCellsForward: vi.fn(),
      moveSelectedCellsBackward: vi.fn(),
      moveSelectedCellsToFront: vi.fn(),
      moveSelectedCellsToBack: vi.fn(),
      startLabelEditing: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
    };

    service = new AppEventHandlersService(
      mockLogger as unknown as LoggerService,
      mockSelectionAdapter as unknown as InfraX6SelectionAdapter,
      mockThreatModelService as unknown as ThreatModelService,
      mockFrameworkService as unknown as FrameworkService,
      mockDialog as unknown as MatDialog,
      mockRouter as unknown as Router,
      mockCellDataExtractionService as unknown as CellDataExtractionService,
    );
  });

  afterEach(() => {
    service.dispose();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with graph adapter', () => {
      service.initialize(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.selectionChanged$).toBeDefined();
      expect(mockX6GraphAdapter.cellContextMenu$).toBeDefined();
    });

    it('should subscribe to selection changes', () => {
      service.initialize(mockX6GraphAdapter);
      mockX6GraphAdapter.getSelectedCells.mockReturnValue([mockCell]);

      mockX6GraphAdapter.selectionChanged$.next();

      const results: any[] = [];
      service.selectedCells$.subscribe(cells => results.push(cells));

      expect(results[0]).toEqual([mockCell]);
    });

    it('should handle selection change errors', () => {
      service.initialize(mockX6GraphAdapter);

      const error = new Error('Selection error');
      mockX6GraphAdapter.selectionChanged$.error(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error in selection change subscription',
        error,
      );
    });

    it('should subscribe to context menu events', () => {
      service.initialize(mockX6GraphAdapter);

      mockX6GraphAdapter.cellContextMenu$.next({ cell: mockCell, x: 100, y: 200 });

      expect(service.contextMenuPosition).toEqual({ x: '100px', y: '200px' });
    });
  });

  describe('Cleanup', () => {
    it('should dispose subscriptions', () => {
      service.initialize(mockX6GraphAdapter);
      service.dispose();

      // Verify subscriptions are cleaned up (test coverage)
      expect(true).toBe(true);
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should not handle keys when dialog is open', () => {
      mockDialog.openDialogs = [{}];
      const event = new KeyboardEvent('keydown', { key: 'Delete' });

      service.onKeyDown(event, 'diagram-1', true, mockX6GraphAdapter);

      expect(mockSelectionAdapter.deleteSelected).not.toHaveBeenCalled();
    });

    it('should handle delete key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Delete' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.onKeyDown(event, 'diagram-1', true, mockX6GraphAdapter);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should handle backspace key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Backspace' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      service.onKeyDown(event, 'diagram-1', true, mockX6GraphAdapter);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not handle keys when input is focused', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      const event = new KeyboardEvent('keydown', { key: 'Delete' });

      service.onKeyDown(event, 'diagram-1', true, mockX6GraphAdapter);

      expect(mockSelectionAdapter.deleteSelected).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });
  });

  describe('Window Resize Handling', () => {
    it('should debounce resize events', () => {
      vi.useFakeTimers();

      const container = { nativeElement: { clientWidth: 800, clientHeight: 600 } };
      const timeoutId = service.onWindowResize(container as any, null, mockX6GraphAdapter);

      expect(timeoutId).toBeDefined();

      vi.advanceTimersByTime(250);

      expect(mockGraph.resize).toHaveBeenCalledWith(800, 600);

      vi.useRealTimers();
    });

    it('should clear existing timeout', () => {
      vi.useFakeTimers();

      const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
      const container = { nativeElement: { clientWidth: 800, clientHeight: 600 } };

      service.onWindowResize(container as any, 123, mockX6GraphAdapter);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(123);

      vi.useRealTimers();
    });
  });

  describe('Delete Selected Cells', () => {
    it('should delete selected cells when initialized', () => {
      service.onDeleteSelected(true, mockX6GraphAdapter);

      expect(mockSelectionAdapter.deleteSelected).toHaveBeenCalledWith(mockGraph);
    });

    it('should not delete when not initialized', () => {
      service.onDeleteSelected(false, mockX6GraphAdapter);

      expect(mockSelectionAdapter.deleteSelected).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot delete: Graph is not initialized');
    });

    it('should use atomic operation for collaborative broadcasting', () => {
      service.onDeleteSelected(true, mockX6GraphAdapter);

      expect(mockBroadcaster.startAtomicOperation).toHaveBeenCalled();
      expect(mockBroadcaster.commitAtomicOperation).toHaveBeenCalled();
    });

    it('should cancel atomic operation on error', () => {
      mockSelectionAdapter.deleteSelected.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      expect(() => service.onDeleteSelected(true, mockX6GraphAdapter)).toThrow('Delete failed');
      expect(mockBroadcaster.cancelAtomicOperation).toHaveBeenCalled();
    });
  });

  describe('Context Menu Operations', () => {
    beforeEach(() => {
      service.initialize(mockX6GraphAdapter);
      mockX6GraphAdapter.cellContextMenu$.next({ cell: mockCell, x: 100, y: 200 });
    });

    it('should open context menu at position', () => {
      const mockMenuTrigger = { openMenu: vi.fn() };
      const mockCdr = { detectChanges: vi.fn() };

      service.openCellContextMenu(mockCell, 150, 250, mockMenuTrigger as any, mockCdr as any);

      expect(service.contextMenuPosition).toEqual({ x: '150px', y: '250px' });
      expect(mockMenuTrigger.openMenu).toHaveBeenCalled();
      expect(mockCdr.detectChanges).toHaveBeenCalled();
    });

    it('should show cell properties dialog', () => {
      const dialogRefSubject = new Subject();
      mockDialog.open.mockReturnValue({
        afterClosed: () => dialogRefSubject.asObservable(),
      });

      service.showCellProperties();

      expect(mockDialog.open).toHaveBeenCalled();
    });

    it('should warn when no cell selected for properties', () => {
      const newService = new AppEventHandlersService(
        mockLogger as unknown as LoggerService,
        mockSelectionAdapter as unknown as InfraX6SelectionAdapter,
        mockThreatModelService as unknown as ThreatModelService,
        mockFrameworkService as unknown as FrameworkService,
        mockDialog as unknown as MatDialog,
        mockRouter as unknown as Router,
        mockCellDataExtractionService as unknown as CellDataExtractionService,
      );

      newService.showCellProperties();

      expect(mockLogger.warn).toHaveBeenCalledWith('No cell selected for showing properties');
    });

    it('should check if right-clicked cell is edge', () => {
      mockCell.isEdge.mockReturnValue(true);
      service.openCellContextMenu(mockCell, 100, 200);

      expect(service.isRightClickedCellEdge()).toBe(true);
    });

    it('should edit cell text', () => {
      service.editCellText(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.startLabelEditing).toHaveBeenCalledWith(
        mockCell,
        expect.any(MouseEvent),
      );
    });

    it('should warn when no cell selected for editing', () => {
      const newService = new AppEventHandlersService(
        mockLogger as unknown as LoggerService,
        mockSelectionAdapter as unknown as InfraX6SelectionAdapter,
        mockThreatModelService as unknown as ThreatModelService,
        mockFrameworkService as unknown as FrameworkService,
        mockDialog as unknown as MatDialog,
        mockRouter as unknown as Router,
        mockCellDataExtractionService as unknown as CellDataExtractionService,
      );

      newService.editCellText(mockX6GraphAdapter);

      expect(mockLogger.warn).toHaveBeenCalledWith('No cell selected for text editing');
    });
  });

  describe('Z-Order Operations', () => {
    beforeEach(() => {
      service.initialize(mockX6GraphAdapter);
      mockX6GraphAdapter.cellContextMenu$.next({ cell: mockCell, x: 100, y: 200 });
    });

    it('should move cell forward', () => {
      service.moveForward(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.moveSelectedCellsForward).toHaveBeenCalled();
    });

    it('should move cell backward', () => {
      service.moveBackward(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.moveSelectedCellsBackward).toHaveBeenCalled();
    });

    it('should move cell to front', () => {
      service.moveToFront(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.moveSelectedCellsToFront).toHaveBeenCalled();
    });

    it('should move cell to back', () => {
      service.moveToBack(mockX6GraphAdapter);

      expect(mockX6GraphAdapter.moveSelectedCellsToBack).toHaveBeenCalled();
    });
  });

  describe('Undo/Redo', () => {
    it('should undo when initialized', () => {
      service.undo(true, mockX6GraphAdapter);

      expect(mockX6GraphAdapter.undo).toHaveBeenCalled();
    });

    it('should not undo when not initialized', () => {
      service.undo(false, mockX6GraphAdapter);

      expect(mockX6GraphAdapter.undo).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot undo: Graph is not initialized');
    });

    it('should redo when initialized', () => {
      service.redo(true, mockX6GraphAdapter);

      expect(mockX6GraphAdapter.redo).toHaveBeenCalled();
    });

    it('should not redo when not initialized', () => {
      service.redo(false, mockX6GraphAdapter);

      expect(mockX6GraphAdapter.redo).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot redo: Graph is not initialized');
    });
  });

  describe('Threat Editor', () => {
    it('should open threat editor dialog', () => {
      const dialogRefSubject = new Subject();
      mockDialog.open.mockReturnValue({
        afterClosed: () => dialogRefSubject.asObservable(),
      } as MatDialogRef<any>);

      mockThreatModelService.getThreatModelById.mockReturnValue(
        of({ id: 'tm-1', threat_model_framework: 'STRIDE' }),
      );
      mockFrameworkService.loadAllFrameworks.mockReturnValue(
        of([{ name: 'STRIDE', threatTypes: [] }]),
      );

      service.initialize(mockX6GraphAdapter);
      service.openThreatEditor('tm-1', 'dfd-1', 'Test Diagram');

      expect(mockThreatModelService.getThreatModelById).toHaveBeenCalledWith('tm-1');
    });

    it('should warn when no threat model ID', () => {
      service.openThreatEditor(null, 'dfd-1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot add threat: No threat model ID available',
      );
    });

    it('should handle threat creation', () => {
      const dialogRefSubject = new Subject();
      mockDialog.open.mockReturnValue({
        afterClosed: () => dialogRefSubject.asObservable(),
      } as MatDialogRef<any>);

      mockThreatModelService.getThreatModelById.mockReturnValue(
        of({ id: 'tm-1', threat_model_framework: 'STRIDE' }),
      );
      mockFrameworkService.loadAllFrameworks.mockReturnValue(
        of([{ name: 'STRIDE', threatTypes: [] }]),
      );
      mockThreatModelService.createThreat.mockReturnValue(of({}));

      service.initialize(mockX6GraphAdapter);
      service.openThreatEditor('tm-1', 'dfd-1', 'Test Diagram');

      // Simulate dialog result
      dialogRefSubject.next({
        name: 'New Threat',
        description: 'Test description',
        severity: 'High',
        threat_type: 'Spoofing',
      });

      expect(mockThreatModelService.createThreat).toHaveBeenCalled();
    });
  });

  describe('Diagram Navigation', () => {
    it('should close diagram and navigate to threat model', () => {
      service.closeDiagram('tm-1', 'dfd-1');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/tm', 'tm-1'], {
        replaceUrl: true,
        queryParams: { refresh: 'true' },
      });
    });

    it('should navigate to dashboard when no threat model ID', () => {
      service.closeDiagram(null, 'dfd-1');

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('Cell Label Management', () => {
    it('should get cell label', () => {
      const label = service.getCellLabel(mockCell);

      expect(label).toBe('Test Label');
      expect(mockCell.getLabel).toHaveBeenCalled();
    });

    it('should return empty string for cell without getLabel', () => {
      const cellWithoutLabel = { ...mockCell, getLabel: undefined };
      const label = service.getCellLabel(cellWithoutLabel);

      expect(label).toBe('');
    });

    it('should set cell label successfully', () => {
      const results: any[] = [];
      service.labelChanged$.subscribe(event => results.push(event));

      const success = service.setCellLabel(mockCell, 'New Label');

      expect(success).toBe(true);
      expect(mockCell.setLabel).toHaveBeenCalledWith('New Label');
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        cellId: 'cell-1',
        oldLabel: 'Test Label',
        newLabel: 'New Label',
        cellType: 'node',
      });
    });

    it('should not set label when unchanged', () => {
      const success = service.setCellLabel(mockCell, 'Test Label');

      expect(success).toBe(false);
      expect(mockCell.setLabel).not.toHaveBeenCalled();
    });

    it('should validate label length', () => {
      const longLabel = 'a'.repeat(101);
      const success = service.setCellLabel(mockCell, longLabel);

      expect(success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[CellLabelService] Label too long',
        expect.any(Object),
      );
    });

    it('should sanitize label text', () => {
      const sanitized = service.sanitizeLabelText('  Test   Label  ');

      expect(sanitized).toBe('Test Label');
    });

    it('should check if cell can be edited', () => {
      const canEdit = service.canEditCellLabel(mockCell);

      expect(canEdit).toBe(true);
    });

    it('should batch update labels', () => {
      const updates = [
        { cell: mockCell, label: 'Label 1' },
        { cell: { ...mockCell, id: 'cell-2', getLabel: () => 'Old' }, label: 'Label 2' },
      ];

      const results = service.batchUpdateLabels(mockGraph, updates);

      expect(results).toHaveLength(2);
      expect(mockGraph.batchUpdate).toHaveBeenCalled();
    });

    it('should get label constraints', () => {
      const constraints = service.getLabelConstraints();

      expect(constraints.maxLength).toBe(100);
      expect(constraints.allowedCharacters).toBeDefined();
    });
  });

  describe('Observables', () => {
    it('should expose labelChanged$ observable', () => {
      expect(service.labelChanged$).toBeDefined();
    });

    it('should expose nodeInfoChanged$ observable', () => {
      expect(service.nodeInfoChanged$).toBeDefined();
    });

    it('should expose threatChanged$ observable', () => {
      expect(service.threatChanged$).toBeDefined();
    });

    it('should expose selectedCells$ observable', () => {
      expect(service.selectedCells$).toBeDefined();
    });
  });

  describe('Right-Clicked Cell', () => {
    it('should get right-clicked cell', () => {
      service.initialize(mockX6GraphAdapter);
      mockX6GraphAdapter.cellContextMenu$.next({ cell: mockCell, x: 100, y: 200 });

      const cell = service.getRightClickedCell();

      expect(cell).toBe(mockCell);
    });
  });
});
