// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';

import { RollbackConfirmationDialogComponent } from './rollback-confirmation-dialog.component';
import {
  RollbackConfirmationDialogData,
  ROLLBACK_TYPES_REQUIRING_CONFIRMATION,
  AUDIT_OBJECT_TYPE_TRANSLATION_KEY,
} from './rollback-confirmation-dialog.types';
import { AuditObjectType } from '@app/pages/tm/models/audit-trail.model';

// Mock interfaces
interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

describe('RollbackConfirmationDialogComponent', () => {
  let component: RollbackConfirmationDialogComponent;
  let dialogRef: MockDialogRef;
  let translocoService: MockTranslocoService;

  const defaultData: RollbackConfirmationDialogData = {
    entityName: 'Test Threat',
    objectType: 'threat',
    version: 3,
    changeSummary: 'Updated threat name',
    timestamp: '2024-06-01T10:00:00Z',
  };

  const createComponent = (
    data: RollbackConfirmationDialogData = defaultData,
  ): RollbackConfirmationDialogComponent => {
    dialogRef = {
      close: vi.fn(),
    };
    translocoService = {
      translate: vi.fn((key: string) => {
        if (key === 'auditTrail.rollback.confirmationValue') return 'rollback';
        return key;
      }),
    };
    return new RollbackConfirmationDialogComponent(dialogRef as any, data, translocoService as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Creation and Basic Properties', () => {
    it('should create', () => {
      component = createComponent();
      expect(component).toBeTruthy();
    });

    it('should initialize with empty confirmation input', () => {
      component = createComponent();
      expect(component.confirmationInput).toBe('');
    });

    it('should expose injected data', () => {
      component = createComponent();
      expect(component.data).toEqual(defaultData);
    });
  });

  describe('Object Type Translation Keys', () => {
    const allObjectTypes: AuditObjectType[] = [
      'threat_model',
      'diagram',
      'threat',
      'asset',
      'document',
      'note',
      'repository',
    ];

    allObjectTypes.forEach(type => {
      it(`should return correct translation key for ${type}`, () => {
        component = createComponent({ ...defaultData, objectType: type });
        expect(component.objectTypeTranslationKey).toBe(AUDIT_OBJECT_TYPE_TRANSLATION_KEY[type]);
      });
    });
  });

  describe('Typed Confirmation Requirements', () => {
    const requiresConfirmationTypes = ROLLBACK_TYPES_REQUIRING_CONFIRMATION;

    const allObjectTypes: AuditObjectType[] = [
      'threat_model',
      'diagram',
      'threat',
      'asset',
      'document',
      'note',
      'repository',
    ];

    allObjectTypes.forEach(type => {
      const shouldRequire = requiresConfirmationTypes.includes(type);
      it(`should ${shouldRequire ? 'require' : 'not require'} typed confirmation for ${type}`, () => {
        component = createComponent({ ...defaultData, objectType: type });
        expect(component.requiresTypedConfirmation).toBe(shouldRequire);
      });
    });
  });

  describe('Confirmation Value', () => {
    it('should return translated confirmation value', () => {
      component = createComponent();
      expect(component.confirmationValue).toBe('rollback');
      expect(translocoService.translate).toHaveBeenCalledWith(
        'auditTrail.rollback.confirmationValue',
      );
    });
  });

  describe('Confirmation Validation', () => {
    beforeEach(() => {
      component = createComponent({ ...defaultData, objectType: 'threat' });
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
      component.confirmationInput = 'rollback';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should be case-insensitive', () => {
      component.confirmationInput = 'ROLLBACK';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should handle mixed case', () => {
      component.confirmationInput = 'Rollback';
      expect(component.isConfirmationValid).toBe(true);
    });

    it('should trim whitespace', () => {
      component.confirmationInput = '  rollback  ';
      expect(component.isConfirmationValid).toBe(true);
    });
  });

  describe('canRollback', () => {
    it('should allow rollback when confirmation not required', () => {
      component = createComponent({ ...defaultData, objectType: 'asset' });
      expect(component.canRollback).toBe(true);
    });

    it('should not allow rollback when confirmation required but input is empty', () => {
      component = createComponent({ ...defaultData, objectType: 'threat' });
      component.confirmationInput = '';
      expect(component.canRollback).toBe(false);
    });

    it('should not allow rollback when confirmation required but input is incorrect', () => {
      component = createComponent({ ...defaultData, objectType: 'threat' });
      component.confirmationInput = 'wrong';
      expect(component.canRollback).toBe(false);
    });

    it('should allow rollback when confirmation required and input is correct', () => {
      component = createComponent({ ...defaultData, objectType: 'threat' });
      component.confirmationInput = 'rollback';
      expect(component.canRollback).toBe(true);
    });
  });

  describe('Dialog Actions', () => {
    beforeEach(() => {
      component = createComponent({ ...defaultData, objectType: 'threat' });
    });

    it('should close dialog with confirmed: false when cancel is clicked', () => {
      component.onCancel();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: false });
    });

    it('should close dialog with confirmed: true when confirm rollback is clicked and valid', () => {
      component.confirmationInput = 'rollback';
      component.onConfirmRollback();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });

    it('should not close dialog when confirm rollback is clicked but invalid', () => {
      component.confirmationInput = 'wrong text';
      component.onConfirmRollback();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close dialog with confirmed: true for type not requiring confirmation', () => {
      component = createComponent({ ...defaultData, objectType: 'asset' });
      component.onConfirmRollback();
      expect(dialogRef.close).toHaveBeenCalledWith({ confirmed: true });
    });
  });
});
