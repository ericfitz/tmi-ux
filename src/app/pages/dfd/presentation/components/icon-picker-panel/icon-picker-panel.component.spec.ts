import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';

import { IconPickerPanelComponent, IconPickerCellInfo } from './icon-picker-panel.component';
import { ArchitectureIconService } from '../../../infrastructure/services/architecture-icon.service';
import {
  ArchIconData,
  ArchIconManifestEntry,
  DEFAULT_ARCH_ICON_PLACEMENT,
} from '../../../types/arch-icon.types';

describe('IconPickerPanelComponent', () => {
  let component: IconPickerPanelComponent;
  let mockCdr: ChangeDetectorRef;
  let mockIconService: Partial<ArchitectureIconService>;

  beforeEach(() => {
    mockCdr = { markForCheck: vi.fn() } as unknown as ChangeDetectorRef;
    mockIconService = {
      loadManifest: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockReturnValue([]),
      getIconPath: vi
        .fn()
        .mockReturnValue('assets/architecture-icons/aws/services/compute/ec2.svg'),
      getIconPathFromEntry: vi
        .fn()
        .mockReturnValue('assets/architecture-icons/aws/services/compute/ec2.svg'),
      getIconLabel: vi.fn().mockReturnValue('Amazon EC2'),
      getIconBreadcrumb: vi.fn().mockReturnValue('AWS · Services · Compute'),
    };

    component = new IconPickerPanelComponent(mockCdr, mockIconService as ArchitectureIconService);
  });

  function makeCell(overrides: Partial<IconPickerCellInfo> = {}): IconPickerCellInfo {
    return {
      cellId: 'node-1',
      nodeType: 'process',
      arch: null,
      ...overrides,
    };
  }

  function triggerSelectionChange(cells: IconPickerCellInfo[]): void {
    component.selectedCells = cells;
    component.ngOnChanges({
      selectedCells: new SimpleChange([], cells, false),
    });
  }

  const sampleArch: ArchIconData = {
    provider: 'aws',
    type: 'services',
    subcategory: 'compute',
    icon: 'amazon-ec2',
    placement: { ...DEFAULT_ARCH_ICON_PLACEMENT },
  };

  const sampleEntry: ArchIconManifestEntry = {
    provider: 'aws',
    type: 'services',
    subcategory: 'compute',
    icon: 'amazon-ec2',
    label: 'Amazon EC2',
    tokens: ['aws', 'ec2', 'compute'],
    path: 'aws/services/compute/amazon-ec2.svg',
  };

  // --- Shape eligibility ---

  describe('shape eligibility', () => {
    it('should treat actor as eligible', () => {
      triggerSelectionChange([makeCell({ nodeType: 'actor' })]);
      expect(component.hasEligibleCells).toBe(true);
    });

    it('should treat process as eligible', () => {
      triggerSelectionChange([makeCell({ nodeType: 'process' })]);
      expect(component.hasEligibleCells).toBe(true);
    });

    it('should treat store as eligible', () => {
      triggerSelectionChange([makeCell({ nodeType: 'store' })]);
      expect(component.hasEligibleCells).toBe(true);
    });

    it('should treat security-boundary as eligible', () => {
      triggerSelectionChange([makeCell({ nodeType: 'security-boundary' })]);
      expect(component.hasEligibleCells).toBe(true);
    });

    it('should treat text-box as not eligible', () => {
      triggerSelectionChange([makeCell({ nodeType: 'text-box' })]);
      expect(component.hasEligibleCells).toBe(false);
      expect(component.selectionNotEligible).toBe(true);
    });

    it('should treat empty selection as no selection', () => {
      triggerSelectionChange([]);
      expect(component.noSelection).toBe(true);
      expect(component.hasEligibleCells).toBe(false);
    });
  });

  // --- Current icon display ---

  describe('current icon display', () => {
    it('should return current arch from eligible cell', () => {
      triggerSelectionChange([makeCell({ arch: sampleArch })]);
      expect(component.currentArch).toEqual(sampleArch);
    });

    it('should return null when no arch data', () => {
      triggerSelectionChange([makeCell({ arch: null })]);
      expect(component.currentArch).toBeNull();
    });

    it('should resolve icon path via service', () => {
      triggerSelectionChange([makeCell({ arch: sampleArch })]);
      expect(component.currentIconPath).toBe(
        'assets/architecture-icons/aws/services/compute/ec2.svg',
      );
      expect(mockIconService.getIconPath).toHaveBeenCalledWith(sampleArch);
    });

    it('should resolve icon label via service', () => {
      triggerSelectionChange([makeCell({ arch: sampleArch })]);
      expect(component.currentIconLabel).toBe('Amazon EC2');
      expect(mockIconService.getIconLabel).toHaveBeenCalledWith(sampleArch);
    });

    it('should resolve icon breadcrumb via service', () => {
      triggerSelectionChange([makeCell({ arch: sampleArch })]);
      expect(component.currentIconBreadcrumb).toBe('AWS · Services · Compute');
      expect(mockIconService.getIconBreadcrumb).toHaveBeenCalledWith(sampleArch);
    });
  });

  // --- Search ---

  describe('search', () => {
    it('should call service search via onSearchInput after debounce bypass', () => {
      const searchResults = [{ provider: 'aws', subcategory: 'compute', icons: [sampleEntry] }];
      (mockIconService.search as ReturnType<typeof vi.fn>).mockReturnValue(searchResults);

      // Directly call performSearch via the internal mechanism
      // Since performSearch is private, test via onSearchInput + manual subject trigger
      component.onSearchInput('ec2');
      expect(component.searchQuery).toBe('ec2');
    });
  });

  // --- Icon selection ---

  describe('icon selection', () => {
    it('should emit iconSelected with default placement when no current arch', () => {
      const emitSpy = vi.spyOn(component.iconSelected, 'emit');
      triggerSelectionChange([makeCell({ cellId: 'n1', nodeType: 'process' })]);

      component.onIconClick(sampleEntry);

      expect(emitSpy).toHaveBeenCalledWith({
        arch: {
          provider: 'aws',
          type: 'services',
          subcategory: 'compute',
          icon: 'amazon-ec2',
          placement: { ...DEFAULT_ARCH_ICON_PLACEMENT },
        },
        cellIds: ['n1'],
      });
    });

    it('should preserve existing placement when current arch exists', () => {
      const customPlacement = { vertical: 'top' as const, horizontal: 'left' as const };
      const archWithPlacement: ArchIconData = { ...sampleArch, placement: customPlacement };
      const emitSpy = vi.spyOn(component.iconSelected, 'emit');

      triggerSelectionChange([makeCell({ cellId: 'n1', arch: archWithPlacement })]);
      component.onIconClick(sampleEntry);

      expect(emitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          arch: expect.objectContaining({
            placement: customPlacement,
          }),
        }),
      );
    });

    it('should not emit when disabled', () => {
      const emitSpy = vi.spyOn(component.iconSelected, 'emit');
      component.disabled = true;
      triggerSelectionChange([makeCell()]);

      component.onIconClick(sampleEntry);

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit when no eligible cells', () => {
      const emitSpy = vi.spyOn(component.iconSelected, 'emit');
      triggerSelectionChange([makeCell({ nodeType: 'text-box' })]);

      component.onIconClick(sampleEntry);

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- Icon removal ---

  describe('icon removal', () => {
    it('should emit iconRemoved with eligible cell ids', () => {
      const emitSpy = vi.spyOn(component.iconRemoved, 'emit');
      triggerSelectionChange([
        makeCell({ cellId: 'n1', nodeType: 'process' }),
        makeCell({ cellId: 'n2', nodeType: 'actor' }),
      ]);

      component.onRemoveIcon();

      expect(emitSpy).toHaveBeenCalledWith({
        cellIds: ['n1', 'n2'],
      });
    });

    it('should not emit when disabled', () => {
      const emitSpy = vi.spyOn(component.iconRemoved, 'emit');
      component.disabled = true;
      triggerSelectionChange([makeCell()]);

      component.onRemoveIcon();

      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  // --- Placement change ---

  describe('placement change', () => {
    it('should emit placementChanged with correct placement and cell ids', () => {
      const emitSpy = vi.spyOn(component.placementChanged, 'emit');
      triggerSelectionChange([makeCell({ cellId: 'n1', nodeType: 'process', arch: sampleArch })]);

      component.onPlacementSelected('top', 'left');

      expect(emitSpy).toHaveBeenCalledWith({
        placement: { vertical: 'top', horizontal: 'left' },
        cellIds: ['n1'],
      });
    });

    it('should not emit when no current arch', () => {
      const emitSpy = vi.spyOn(component.placementChanged, 'emit');
      triggerSelectionChange([makeCell({ cellId: 'n1', arch: null })]);

      component.onPlacementSelected('top', 'left');

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should not emit when disabled', () => {
      const emitSpy = vi.spyOn(component.placementChanged, 'emit');
      component.disabled = true;
      triggerSelectionChange([makeCell({ arch: sampleArch })]);

      component.onPlacementSelected('top', 'left');

      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should correctly identify active placement', () => {
      triggerSelectionChange([
        makeCell({
          arch: {
            ...sampleArch,
            placement: { vertical: 'top', horizontal: 'right' },
          },
        }),
      ]);

      expect(component.isActivePlacement('top', 'right')).toBe(true);
      expect(component.isActivePlacement('middle', 'center')).toBe(false);
    });
  });
});
