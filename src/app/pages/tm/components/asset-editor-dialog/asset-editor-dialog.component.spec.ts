// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import type { MatChipInputEvent } from '@angular/material/chips';

import { AssetEditorDialogComponent, AssetEditorDialogData } from './asset-editor-dialog.component';
import type { Asset } from '../../models/threat-model.model';

describe('AssetEditorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  function build(data: AssetEditorDialogData): AssetEditorDialogComponent {
    return new AssetEditorDialogComponent(mockDialogRef as never, new FormBuilder(), data);
  }

  /** Build a MatChipInputEvent stub carrying a value and a clear() spy. */
  function chipEvent(value: string): MatChipInputEvent {
    return { value, chipInput: { clear: vi.fn() } } as unknown as MatChipInputEvent;
  }

  const existingAsset: Asset = {
    id: 'a1',
    name: 'Customer DB',
    description: 'Primary data store',
    type: 'data',
    criticality: 'high',
    classification: ['PII', 'GDPR'],
    sensitivity: 'confidential',
    include_in_report: false,
    timmy_enabled: false,
    created_at: '2024-01-01',
    modified_at: '2024-01-01',
  };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
  });

  describe('create mode', () => {
    let component: AssetEditorDialogComponent;

    beforeEach(() => {
      component = build({ mode: 'create' });
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('starts with an empty form and empty classification list', () => {
      expect(component.assetForm.get('name')?.value).toBe('');
      expect(component.assetForm.get('classification')?.value).toEqual([]);
    });

    it('defaults include_in_report and timmy_enabled to true in create mode', () => {
      expect(component.assetForm.get('include_in_report')?.value).toBe(true);
      expect(component.assetForm.get('timmy_enabled')?.value).toBe(true);
    });

    it('exposes the six asset type options', () => {
      expect(component.assetTypes).toEqual([
        'data',
        'hardware',
        'software',
        'infrastructure',
        'service',
        'personnel',
      ]);
    });

    it('is invalid until a name is provided', () => {
      expect(component.assetForm.invalid).toBe(true);
      component.assetForm.patchValue({ name: 'My Asset' });
      expect(component.assetForm.valid).toBe(true);
    });
  });

  describe('edit mode', () => {
    it('pre-populates the form from the asset', () => {
      const component = build({ mode: 'edit', asset: existingAsset });

      expect(component.assetForm.get('name')?.value).toBe('Customer DB');
      expect(component.assetForm.get('type')?.value).toBe('data');
      expect(component.assetForm.get('classification')?.value).toEqual(['PII', 'GDPR']);
      expect(component.assetForm.get('include_in_report')?.value).toBe(false);
    });
  });

  describe('read-only mode', () => {
    it('disables the form', () => {
      const component = build({ mode: 'edit', asset: existingAsset, isReadOnly: true });

      expect(component.isReadOnly).toBe(true);
      expect(component.assetForm.disabled).toBe(true);
    });
  });

  describe('classification chips', () => {
    let component: AssetEditorDialogComponent;

    beforeEach(() => {
      component = build({ mode: 'create' });
    });

    it('addClassification appends a trimmed value and clears the input', () => {
      const event = chipEvent('  PII  ');

      component.addClassification(event);

      expect(component.assetForm.get('classification')?.value).toEqual(['PII']);
      expect(event.chipInput.clear).toHaveBeenCalled();
    });

    it('addClassification ignores an empty value', () => {
      component.addClassification(chipEvent('   '));

      expect(component.assetForm.get('classification')?.value).toEqual([]);
    });

    it('addClassification does not add a duplicate value', () => {
      component.addClassification(chipEvent('PII'));
      component.addClassification(chipEvent('PII'));

      expect(component.assetForm.get('classification')?.value).toEqual(['PII']);
    });

    it('removeClassification drops the matching value', () => {
      component.addClassification(chipEvent('PII'));
      component.addClassification(chipEvent('GDPR'));

      component.removeClassification('PII');

      expect(component.assetForm.get('classification')?.value).toEqual(['GDPR']);
    });

    it('removeClassification is a no-op for an unknown value', () => {
      component.addClassification(chipEvent('PII'));

      component.removeClassification('unknown');

      expect(component.assetForm.get('classification')?.value).toEqual(['PII']);
    });
  });

  describe('onSubmit', () => {
    it('closes the dialog with the trimmed, cleaned-up asset data', () => {
      const component = build({ mode: 'create' });
      component.assetForm.patchValue({
        name: 'My Asset',
        description: '  a description  ',
        type: 'software',
        criticality: '  high  ',
        sensitivity: '  secret  ',
        classification: ['PII'],
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.name).toBe('My Asset');
      expect(result.description).toBe('a description');
      expect(result.criticality).toBe('high');
      expect(result.sensitivity).toBe('secret');
      expect(result.classification).toEqual(['PII']);
    });

    it('does not trim the name (unlike the optional text fields)', () => {
      const component = build({ mode: 'create' });
      component.assetForm.patchValue({ name: '  Padded Name  ' });

      component.onSubmit();

      // onSubmit copies name verbatim; description/criticality/sensitivity
      // are the only trimmed fields.
      expect(mockDialogRef.close.mock.calls[0][0].name).toBe('  Padded Name  ');
    });

    it('omits empty optional fields from the result', () => {
      const component = build({ mode: 'create' });
      component.assetForm.patchValue({ name: 'Bare Asset' });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.name).toBe('Bare Asset');
      expect(result.description).toBeUndefined();
      expect(result.type).toBeUndefined();
      expect(result.criticality).toBeUndefined();
      expect(result.classification).toBeUndefined();
      // include_in_report / timmy_enabled are always included.
      expect(result.include_in_report).toBe(true);
      expect(result.timmy_enabled).toBe(true);
    });

    it('does not close the dialog when the form is invalid', () => {
      const component = build({ mode: 'create' });
      // name left empty
      component.onSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ mode: 'create' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
