import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StylePanelComponent, CellStyleInfo } from './style-panel.component';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';

describe('StylePanelComponent - Label Position', () => {
  let component: StylePanelComponent;
  let mockCdr: ChangeDetectorRef;

  beforeEach(() => {
    mockCdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    component = new StylePanelComponent(mockCdr);
  });

  function makeNodeCell(overrides: Partial<CellStyleInfo> = {}): CellStyleInfo {
    return {
      cellId: 'node-1',
      isNode: true,
      isEdge: false,
      nodeType: 'process',
      strokeColor: '#000000',
      fillColor: '#ffffff',
      fillOpacity: 1,
      hasCustomStyles: false,
      labelPosition: { vertical: 'middle', horizontal: 'center' },
      ...overrides,
    };
  }

  function triggerSelectionChange(cells: CellStyleInfo[]): void {
    component.selectedCells = cells;
    component.ngOnChanges({
      selectedCells: new SimpleChange([], cells, false),
    });
  }

  describe('labelPositionEnabled', () => {
    it('should be disabled when no cells selected', () => {
      triggerSelectionChange([]);
      expect(component.labelPositionEnabled).toBe(false);
    });

    it('should be disabled when only edges selected', () => {
      triggerSelectionChange([
        {
          cellId: 'edge-1',
          isNode: false,
          isEdge: true,
          nodeType: null,
          strokeColor: '#000',
          fillColor: null,
          fillOpacity: null,
          hasCustomStyles: false,
          labelPosition: null,
        },
      ]);
      expect(component.labelPositionEnabled).toBe(false);
    });

    it('should be disabled when only text-box nodes selected', () => {
      triggerSelectionChange([makeNodeCell({ nodeType: 'text-box' })]);
      expect(component.labelPositionEnabled).toBe(false);
    });

    it('should be enabled when non-text-box nodes selected', () => {
      triggerSelectionChange([makeNodeCell({ nodeType: 'process' })]);
      expect(component.labelPositionEnabled).toBe(true);
    });

    it('should be enabled when mix includes non-text-box nodes', () => {
      triggerSelectionChange([
        makeNodeCell({ cellId: 'node-1', nodeType: 'process' }),
        makeNodeCell({ cellId: 'node-2', nodeType: 'text-box' }),
        {
          cellId: 'edge-1',
          isNode: false,
          isEdge: true,
          nodeType: null,
          strokeColor: '#000',
          fillColor: null,
          fillOpacity: null,
          hasCustomStyles: false,
          labelPosition: null,
        },
      ]);
      expect(component.labelPositionEnabled).toBe(true);
    });
  });

  describe('currentLabelPosition', () => {
    it('should reflect single node position', () => {
      triggerSelectionChange([
        makeNodeCell({ labelPosition: { vertical: 'top', horizontal: 'left' } }),
      ]);
      expect(component.currentLabelPosition).toEqual({ vertical: 'top', horizontal: 'left' });
    });

    it('should be null when positions differ (indeterminate)', () => {
      triggerSelectionChange([
        makeNodeCell({
          cellId: 'n1',
          labelPosition: { vertical: 'top', horizontal: 'left' },
        }),
        makeNodeCell({
          cellId: 'n2',
          labelPosition: { vertical: 'bottom', horizontal: 'right' },
        }),
      ]);
      expect(component.currentLabelPosition).toBeNull();
    });

    it('should show position when all nodes have the same position', () => {
      triggerSelectionChange([
        makeNodeCell({
          cellId: 'n1',
          labelPosition: { vertical: 'top', horizontal: 'center' },
        }),
        makeNodeCell({
          cellId: 'n2',
          labelPosition: { vertical: 'top', horizontal: 'center' },
        }),
      ]);
      expect(component.currentLabelPosition).toEqual({ vertical: 'top', horizontal: 'center' });
    });
  });

  describe('isActivePosition', () => {
    it('should return true for the current position', () => {
      triggerSelectionChange([
        makeNodeCell({ labelPosition: { vertical: 'top', horizontal: 'left' } }),
      ]);
      expect(component.isActivePosition('top', 'left')).toBe(true);
    });

    it('should return false for other positions', () => {
      triggerSelectionChange([
        makeNodeCell({ labelPosition: { vertical: 'top', horizontal: 'left' } }),
      ]);
      expect(component.isActivePosition('middle', 'center')).toBe(false);
    });

    it('should return false when position is indeterminate', () => {
      triggerSelectionChange([
        makeNodeCell({
          cellId: 'n1',
          labelPosition: { vertical: 'top', horizontal: 'left' },
        }),
        makeNodeCell({
          cellId: 'n2',
          labelPosition: { vertical: 'bottom', horizontal: 'right' },
        }),
      ]);
      expect(component.isActivePosition('top', 'left')).toBe(false);
    });
  });

  describe('onLabelPositionSelected', () => {
    it('should emit styleChange event with correct property and value', () => {
      const emitSpy = vi.spyOn(component.styleChange, 'emit');
      triggerSelectionChange([makeNodeCell({ cellId: 'node-1', nodeType: 'process' })]);

      component.onLabelPositionSelected('top', 'center');

      expect(emitSpy).toHaveBeenCalledWith({
        property: 'labelPosition',
        value: 'top-center',
        applicableCellIds: ['node-1'],
      });
    });

    it('should only include non-text-box nodes in applicableCellIds', () => {
      const emitSpy = vi.spyOn(component.styleChange, 'emit');
      triggerSelectionChange([
        makeNodeCell({ cellId: 'n1', nodeType: 'process' }),
        makeNodeCell({ cellId: 'n2', nodeType: 'text-box' }),
        makeNodeCell({ cellId: 'n3', nodeType: 'actor' }),
      ]);

      component.onLabelPositionSelected('bottom', 'right');

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          applicableCellIds: ['n1', 'n3'],
        }),
      );
    });

    it('should not emit when disabled', () => {
      const emitSpy = vi.spyOn(component.styleChange, 'emit');
      component.disabled = true;
      triggerSelectionChange([makeNodeCell()]);

      component.onLabelPositionSelected('top', 'left');

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit when label position is not enabled', () => {
      const emitSpy = vi.spyOn(component.styleChange, 'emit');
      triggerSelectionChange([makeNodeCell({ nodeType: 'text-box' })]);

      component.onLabelPositionSelected('top', 'left');

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });
});
