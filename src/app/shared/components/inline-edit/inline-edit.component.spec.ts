// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { InlineEditComponent } from './inline-edit.component';
import type { ChangeDetectorRef } from '@angular/core';

describe('InlineEditComponent', () => {
  let component: InlineEditComponent;
  let mockCdr: { detectChanges: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockCdr = { detectChanges: vi.fn() };
    component = new InlineEditComponent(mockCdr as unknown as ChangeDetectorRef);
  });

  describe('startEditing', () => {
    it('should set isEditing to true when not disabled', () => {
      component.disabled = false;
      component.startEditing();
      expect(component.isEditing).toBe(true);
    });

    it('should not start editing when disabled', () => {
      component.disabled = true;
      component.startEditing();
      expect(component.isEditing).toBe(false);
    });

    it('should set editValue from current value', () => {
      component.value = 'hello';
      component.startEditing();
      expect(component.editValue).toBe('hello');
    });

    it('should set editValue to empty string when value is null', () => {
      component.value = null;
      component.startEditing();
      expect(component.editValue).toBe('');
    });

    it('should trigger change detection', () => {
      component.startEditing();
      expect(mockCdr.detectChanges).toHaveBeenCalled();
    });
  });

  describe('cancelEditing', () => {
    it('should set isEditing to false', () => {
      component.isEditing = true;
      component.cancelEditing();
      expect(component.isEditing).toBe(false);
    });

    it('should reset editValue', () => {
      component.editValue = 'something';
      component.cancelEditing();
      expect(component.editValue).toBe('');
    });

    it('should not emit valueChange', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'original';
      component.editValue = 'changed';
      component.cancelEditing();
      expect(emitSpy).not.toHaveBeenCalled();
    });
  });

  describe('saveValue', () => {
    it('should emit valueChange when value changed', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'original';
      component.editValue = 'updated';
      component.saveValue();
      expect(emitSpy).toHaveBeenCalledWith('updated');
    });

    it('should not emit valueChange when value unchanged', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'hello';
      component.editValue = 'hello';
      component.saveValue();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should trim whitespace from editValue', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'hello';
      component.editValue = '  updated  ';
      component.saveValue();
      expect(emitSpy).toHaveBeenCalledWith('updated');
    });

    it('should not emit when trimmed value equals original', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'hello';
      component.editValue = '  hello  ';
      component.saveValue();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should emit empty string when whitespace-only replaces non-empty value', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = 'something';
      component.editValue = '   ';
      component.saveValue();
      expect(emitSpy).toHaveBeenCalledWith('');
    });

    it('should not emit when both original and trimmed are empty', () => {
      const emitSpy = vi.spyOn(component.valueChange, 'emit');
      component.value = null;
      component.editValue = '   ';
      component.saveValue();
      // trimmed ('') === (null ?? '') => '' === '' => no emit
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should set isEditing to false after save', () => {
      component.isEditing = true;
      component.editValue = 'test';
      component.saveValue();
      expect(component.isEditing).toBe(false);
    });

    it('should reset editValue after save', () => {
      component.editValue = 'test';
      component.saveValue();
      expect(component.editValue).toBe('');
    });
  });

  describe('onKeyDown', () => {
    it('should save on Enter key', () => {
      const saveSpy = vi.spyOn(component, 'saveValue');
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onKeyDown(event);

      expect(saveSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should cancel on Escape key', () => {
      const cancelSpy = vi.spyOn(component, 'cancelEditing');
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      component.onKeyDown(event);

      expect(cancelSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not save or cancel on other keys', () => {
      const saveSpy = vi.spyOn(component, 'saveValue');
      const cancelSpy = vi.spyOn(component, 'cancelEditing');
      const event = new KeyboardEvent('keydown', { key: 'a' });

      component.onKeyDown(event);

      expect(saveSpy).not.toHaveBeenCalled();
      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });

  describe('onBlur', () => {
    it('should save value on blur', () => {
      const saveSpy = vi.spyOn(component, 'saveValue');
      component.onBlur();
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});
