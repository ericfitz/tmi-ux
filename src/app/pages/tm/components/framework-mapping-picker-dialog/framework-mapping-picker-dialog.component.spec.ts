// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { FrameworkMappingPickerDialogComponent } from './framework-mapping-picker-dialog.component';
import { FrameworkMappingPickerDialogData } from './framework-mapping-picker-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

describe('FrameworkMappingPickerDialogComponent', () => {
  let component: FrameworkMappingPickerDialogComponent;
  let dialogRef: MockDialogRef;
  let languageService: MockLanguageService;

  const strideTypes = [
    { name: 'Spoofing', appliesTo: ['Actor', 'Process'] },
    { name: 'Tampering', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Repudiation', appliesTo: ['Actor', 'Store', 'Flow', 'Process'] },
    { name: 'Information Disclosure', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Denial of Service', appliesTo: ['Store', 'Flow', 'Process'] },
    { name: 'Elevation of Privilege', appliesTo: ['Process'] },
  ];

  function createComponent(data: FrameworkMappingPickerDialogData): void {
    dialogRef = { close: vi.fn() };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };

    component = new FrameworkMappingPickerDialogComponent(
      dialogRef as any,
      data,
      { markForCheck: vi.fn() } as any,
      languageService as any,
      { onDestroy: vi.fn() } as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create', () => {
    createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should show all options enabled when cellType is null', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      expect(component.options).toHaveLength(6);
      expect(component.options.every(o => !o.disabled)).toBe(true);
    });

    it('should disable options that do not apply to the cell type', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: 'store' });
      component.ngOnInit();
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.disabled).toBe(true);
      const tampering = component.options.find(o => o.name === 'Tampering');
      expect(tampering?.disabled).toBe(false);
    });

    it('should check already-selected types', () => {
      createComponent({
        availableTypes: strideTypes,
        selectedTypes: ['Spoofing', 'Tampering'],
        cellType: null,
      });
      component.ngOnInit();
      expect(component.options.find(o => o.name === 'Spoofing')?.checked).toBe(true);
      expect(component.options.find(o => o.name === 'Tampering')?.checked).toBe(true);
      expect(component.options.find(o => o.name === 'Repudiation')?.checked).toBe(false);
    });

    it('should keep selected types checked but disabled when not applicable', () => {
      createComponent({
        availableTypes: strideTypes,
        selectedTypes: ['Spoofing'],
        cellType: 'store',
      });
      component.ngOnInit();
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.checked).toBe(true);
      expect(spoofing?.disabled).toBe(true);
    });

    it('should handle case-insensitive cellType matching', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: 'actor' });
      component.ngOnInit();
      const spoofing = component.options.find(o => o.name === 'Spoofing');
      expect(spoofing?.disabled).toBe(false);
    });
  });

  describe('dialog actions', () => {
    it('should return selected types on apply', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      component.onCheckChange(0, true);
      component.onCheckChange(2, true);
      component.apply();
      expect(dialogRef.close).toHaveBeenCalledWith({
        selectedTypes: ['Spoofing', 'Repudiation'],
      });
    });

    it('should close without result on cancel', () => {
      createComponent({ availableTypes: strideTypes, selectedTypes: [], cellType: null });
      component.ngOnInit();
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });
});
