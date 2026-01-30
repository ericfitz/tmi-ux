// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { DeleteConfirmationDialogComponent } from './delete-confirmation-dialog.component';
import { DeleteConfirmationDialogData, DeleteObjectType } from './delete-confirmation-dialog.types';

// Mock interfaces
interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

describe('DeleteConfirmationDialogComponent', () => {
  let component: DeleteConfirmationDialogComponent;
  let dialogRef: MockDialogRef;

  const createComponent = (
    data: DeleteConfirmationDialogData,
  ): DeleteConfirmationDialogComponent => {
    dialogRef = {
      close: vi.fn(),
    };
    return new DeleteConfirmationDialogComponent(dialogRef as any, data);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Creation and Basic Properties', () => {
    it('should create', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      expect(component).toBeTruthy();
    });

    it('should initialize with empty confirmation input', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      expect(component.confirmationInput).toBe('');
    });

    it('should have correct confirmation value', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      expect(component.confirmationValue).toBe('gone forever');
    });
  });

  describe('Object Type Icons', () => {
    const iconTests: { type: DeleteObjectType; expectedIcon: string }[] = [
      { type: 'threatModel', expectedIcon: 'security' },
      { type: 'diagram', expectedIcon: 'graph_3' },
      { type: 'asset', expectedIcon: 'diamond' },
      { type: 'threat', expectedIcon: 'skull' },
      { type: 'note', expectedIcon: 'article' },
      { type: 'document', expectedIcon: 'description' },
      { type: 'repository', expectedIcon: 'code' },
    ];

    iconTests.forEach(({ type, expectedIcon }) => {
      it(`should return "${expectedIcon}" icon for ${type}`, () => {
        component = createComponent({
          id: 'test-id',
          name: 'Test Object',
          objectType: type,
        });
        expect(component.objectTypeIcon).toBe(expectedIcon);
      });
    });
  });

  describe('Object Type Translation Keys', () => {
    const translationTests: { type: DeleteObjectType; expectedKey: string }[] = [
      { type: 'threatModel', expectedKey: 'common.objectTypes.threatModel' },
      { type: 'diagram', expectedKey: 'common.objectTypes.diagram' },
      { type: 'asset', expectedKey: 'common.objectTypes.asset' },
      { type: 'threat', expectedKey: 'common.objectTypes.threat' },
      { type: 'note', expectedKey: 'common.objectTypes.note' },
      { type: 'document', expectedKey: 'common.objectTypes.document' },
      { type: 'repository', expectedKey: 'common.objectTypes.repository' },
    ];

    translationTests.forEach(({ type, expectedKey }) => {
      it(`should return "${expectedKey}" translation key for ${type}`, () => {
        component = createComponent({
          id: 'test-id',
          name: 'Test Object',
          objectType: type,
        });
        expect(component.objectTypeTranslationKey).toBe(expectedKey);
      });
    });
  });

  describe('Typed Confirmation Requirements', () => {
    const confirmationRequirementTests: {
      type: DeleteObjectType;
      requiresConfirmation: boolean;
    }[] = [
      { type: 'threatModel', requiresConfirmation: true },
      { type: 'diagram', requiresConfirmation: true },
      { type: 'asset', requiresConfirmation: true },
      { type: 'threat', requiresConfirmation: true },
      { type: 'note', requiresConfirmation: true },
      { type: 'document', requiresConfirmation: false },
      { type: 'repository', requiresConfirmation: false },
    ];

    confirmationRequirementTests.forEach(({ type, requiresConfirmation }) => {
      it(`should ${requiresConfirmation ? 'require' : 'not require'} confirmation for ${type}`, () => {
        component = createComponent({
          id: 'test-id',
          name: 'Test Object',
          objectType: type,
        });
        expect(component.requiresTypedConfirmation).toBe(requiresConfirmation);
      });
    });

    it('should allow overriding confirmation requirement to false', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
        requireTypedConfirmation: false,
      });
      expect(component.requiresTypedConfirmation).toBe(false);
    });

    it('should allow overriding confirmation requirement to true', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'document',
        requireTypedConfirmation: true,
      });
      expect(component.requiresTypedConfirmation).toBe(true);
    });
  });

  describe('Sub-Entities Warning', () => {
    it('should show sub-entities warning for threatModel by default', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      expect(component.showSubEntitiesWarning).toBe(true);
    });

    it('should not show sub-entities warning for other types', () => {
      const otherTypes: DeleteObjectType[] = [
        'diagram',
        'asset',
        'threat',
        'note',
        'document',
        'repository',
      ];
      otherTypes.forEach(type => {
        component = createComponent({
          id: 'test-id',
          name: 'Test Object',
          objectType: type,
        });
        expect(component.showSubEntitiesWarning).toBe(false);
      });
    });

    it('should allow hiding sub-entities warning for threatModel', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
        showSubEntitiesWarning: false,
      });
      expect(component.showSubEntitiesWarning).toBe(false);
    });
  });

  describe('Reference-Only Warning', () => {
    it('should show reference-only warning for document by default', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'document',
      });
      expect(component.showReferenceOnlyWarning).toBe(true);
    });

    it('should show reference-only warning for repository by default', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'repository',
      });
      expect(component.showReferenceOnlyWarning).toBe(true);
    });

    it('should not show reference-only warning for other types', () => {
      const otherTypes: DeleteObjectType[] = ['threatModel', 'diagram', 'asset', 'threat', 'note'];
      otherTypes.forEach(type => {
        component = createComponent({
          id: 'test-id',
          name: 'Test Object',
          objectType: type,
        });
        expect(component.showReferenceOnlyWarning).toBe(false);
      });
    });

    it('should allow hiding reference-only warning for document', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'document',
        showReferenceOnlyWarning: false,
      });
      expect(component.showReferenceOnlyWarning).toBe(false);
    });
  });

  describe('Confirmation Validation', () => {
    beforeEach(() => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
    });

    it('should return false for empty input', () => {
      component.confirmationInput = '';
      expect(component.isConfirmationValid).toBe(false);
    });

    it('should return false for incorrect input', () => {
      component.confirmationInput = 'wrong text';
      expect(component.isConfirmationValid).toBe(false);
    });

    it('should return true for exact match', () => {
      component.confirmationInput = 'gone forever';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should be case-insensitive', () => {
      component.confirmationInput = 'GONE FOREVER';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should handle mixed case', () => {
      component.confirmationInput = 'Gone Forever';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should trim whitespace', () => {
      component.confirmationInput = '  gone forever  ';
      expect(component.isConfirmationValid).toBe(true);
    });
  });

  describe('Can Delete', () => {
    it('should allow delete when confirmation not required', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'document',
      });
      expect(component.canDelete).toBe(true);
    });

    it('should not allow delete when confirmation required but input is empty', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      component.confirmationInput = '';
      expect(component.canDelete).toBe(false);
    });

    it('should not allow delete when confirmation required but input is incorrect', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      component.confirmationInput = 'wrong text';
      expect(component.canDelete).toBe(false);
    });

    it('should allow delete when confirmation required and input is correct', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
      component.confirmationInput = 'gone forever';
      expect(component.canDelete).toBe(true);
    });
  });

  describe('Dialog Actions', () => {
    beforeEach(() => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'threatModel',
      });
    });

    it('should close dialog with confirmed: false when cancel is clicked', () => {
      component.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
    });

    it('should close dialog with confirmed: true when confirm delete is clicked and valid', () => {
      component.confirmationInput = 'gone forever';
      component.onConfirmDelete();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });

    it('should not close dialog when confirm delete is clicked but invalid', () => {
      component.confirmationInput = 'wrong text';
      component.onConfirmDelete();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close dialog with confirmed: true for document without confirmation', () => {
      component = createComponent({
        id: 'test-id',
        name: 'Test Object',
        objectType: 'document',
      });
      component.onConfirmDelete();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });
  });
});
