// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import type { TranslocoService } from '@jsverse/transloco';

import { CreateDiagramDialogComponent } from './create-diagram-dialog.component';

describe('CreateDiagramDialogComponent', () => {
  let component: CreateDiagramDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockTransloco: TranslocoService;

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: build a CreateDiagramDialogComponent instance for testing (pure)
  function build(threatModelName = 'My TM'): CreateDiagramDialogComponent {
    return new CreateDiagramDialogComponent(
      mockDialogRef as never,
      new FormBuilder(),
      mockTransloco,
      { threatModelName },
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockTransloco = {
      translate: vi.fn((key: string) =>
        key === 'threatModels.dataFlowDiagram' ? 'Data Flow Diagram' : key,
      ),
    } as unknown as TranslocoService;
    component = build();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('defaults the name to "<threat model> — Data Flow Diagram"', () => {
      expect(component.diagramForm.get('name')?.value).toBe('My TM — Data Flow Diagram');
    });

    it('defaults the type to DFD-1.0.0 and disables it', () => {
      const typeControl = component.diagramForm.get('type');
      expect(typeControl?.value).toBe('DFD-1.0.0');
      expect(typeControl?.disabled).toBe(true);
    });

    it('exposes the available diagram types', () => {
      expect(component.diagramTypes).toEqual([{ value: 'DFD-1.0.0', label: 'DFD-1.0.0' }]);
    });
  });

  describe('form validation', () => {
    it('is valid with the default name', () => {
      expect(component.diagramForm.valid).toBe(true);
    });

    it('is invalid when the name is cleared', () => {
      component.diagramForm.patchValue({ name: '' });
      expect(component.diagramForm.get('name')?.hasError('required')).toBe(true);
    });

    it('is invalid when the name exceeds 100 characters', () => {
      component.diagramForm.patchValue({ name: 'a'.repeat(101) });
      expect(component.diagramForm.get('name')?.hasError('maxlength')).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('closes the dialog with the name and type', () => {
      component.diagramForm.patchValue({ name: 'Custom Diagram' });

      component.onSubmit();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'Custom Diagram',
        type: 'DFD-1.0.0',
      });
    });

    it('does not close the dialog when the form is invalid', () => {
      component.diagramForm.patchValue({ name: '' });

      component.onSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
