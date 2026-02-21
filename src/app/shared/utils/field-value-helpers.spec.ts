// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  migrateFieldValue,
  getFieldOptions,
  getFieldLabel,
  getFieldTooltip,
  getFieldKeysForFieldType,
  type FieldType,
} from './field-value-helpers';

describe('field-value-helpers', () => {
  let mockTranslocoService: {
    getAvailableLangs: ReturnType<typeof vi.fn>;
    getTranslation: ReturnType<typeof vi.fn>;
    translate: ReturnType<typeof vi.fn>;
  };

  const enTranslations = {
    threatEditor: {
      threatSeverity: {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        informational: 'Informational',
        unknown: 'Unknown',
      },
      threatStatus: {
        open: 'Open',
        confirmed: 'Confirmed',
        mitigationPlanned: 'Mitigation Planned',
        mitigationInProgress: 'Mitigation In Progress',
        verificationPending: 'Verification Pending',
        resolved: 'Resolved',
        accepted: 'Accepted',
        falsePositive: 'False Positive',
        deferred: 'Deferred',
        closed: 'Closed',
      },
      threatPriority: {
        immediate: 'Immediate (P0)',
        high: 'High (P1)',
        medium: 'Medium (P2)',
        low: 'Low (P3)',
        deferred: 'Deferred (P4)',
      },
    },
    threatModels: {
      status: {
        notStarted: 'Not Started',
        inProgress: 'In Progress',
        pendingReview: 'Pending Review',
        remediationRequired: 'Remediation Required',
        remediationInProgress: 'Remediation In Progress',
        verificationPending: 'Verification Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        deferred: 'Deferred',
        closed: 'Closed',
      },
    },
  };

  const deTranslations = {
    threatEditor: {
      threatSeverity: {
        critical: 'Kritisch',
        high: 'Hoch',
        medium: 'Mittel',
        low: 'Niedrig',
        informational: 'Informativ',
        unknown: 'Unbekannt',
      },
    },
  };

  // Helper to get a nested value from translations object
  function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((current: unknown, prop) => {
      if (current && typeof current === 'object' && prop in current) {
        return (current as Record<string, unknown>)[prop];
      }
      return undefined;
    }, obj);
  }

  beforeEach(() => {
    mockTranslocoService = {
      getAvailableLangs: vi.fn().mockReturnValue(['en-US', 'de']),
      getTranslation: vi.fn().mockImplementation((lang: string) => {
        if (lang === 'en-US') return enTranslations;
        if (lang === 'de') return deTranslations;
        return {};
      }),
      translate: vi.fn().mockImplementation((key: string) => {
        return getNestedValue(enTranslations, key) ?? key;
      }),
    };
  });

  describe('getFieldKeysForFieldType', () => {
    it('should return 6 keys for threatSeverity', () => {
      expect(getFieldKeysForFieldType('threatEditor.threatSeverity')).toHaveLength(6);
    });

    it('should return 10 keys for threatStatus', () => {
      expect(getFieldKeysForFieldType('threatEditor.threatStatus')).toHaveLength(10);
    });

    it('should return 5 keys for threatPriority', () => {
      expect(getFieldKeysForFieldType('threatEditor.threatPriority')).toHaveLength(5);
    });

    it('should return 10 keys for threatModels.status', () => {
      expect(getFieldKeysForFieldType('threatModels.status')).toHaveLength(10);
    });

    it('should return empty array for unknown field type', () => {
      expect(getFieldKeysForFieldType('unknown.field' as FieldType)).toHaveLength(0);
    });

    it('should return camelCase keys in order', () => {
      const keys = getFieldKeysForFieldType('threatEditor.threatSeverity');
      expect(keys).toEqual(['critical', 'high', 'medium', 'low', 'informational', 'unknown']);
    });
  });

  describe('migrateFieldValue', () => {
    it('should return null for null value', () => {
      expect(
        migrateFieldValue(null, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBeNull();
    });

    it('should return null for undefined value', () => {
      expect(
        migrateFieldValue(undefined, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(
        migrateFieldValue('', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBeNull();
    });

    it('should pass through already-valid camelCase keys', () => {
      expect(
        migrateFieldValue('high', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('high');
      expect(
        migrateFieldValue(
          'mitigationPlanned',
          'threatEditor.threatStatus',
          mockTranslocoService as never,
        ),
      ).toBe('mitigationPlanned');
    });

    it('should migrate numeric key to camelCase by index position', () => {
      expect(
        migrateFieldValue('0', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('critical');
      expect(
        migrateFieldValue('1', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('high');
      expect(
        migrateFieldValue('5', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('unknown');
    });

    it('should return null for out-of-range numeric key', () => {
      expect(
        migrateFieldValue('99', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBeNull();
    });

    it('should migrate English string value to camelCase key', () => {
      expect(
        migrateFieldValue('High', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('high');
      expect(
        migrateFieldValue('Critical', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('critical');
    });

    it('should perform case-insensitive matching', () => {
      expect(
        migrateFieldValue('HIGH', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('high');
      expect(
        migrateFieldValue('critical', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('critical');
    });

    it('should match value from non-English language', () => {
      expect(
        migrateFieldValue('Hoch', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('high');
      expect(
        migrateFieldValue('Kritisch', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('critical');
    });

    it('should return null for unrecognized value', () => {
      expect(
        migrateFieldValue(
          'NonexistentSeverity',
          'threatEditor.threatSeverity',
          mockTranslocoService as never,
        ),
      ).toBeNull();
    });

    it('should handle threat model status field type', () => {
      expect(
        migrateFieldValue('Not Started', 'threatModels.status', mockTranslocoService as never),
      ).toBe('notStarted');
      expect(migrateFieldValue('0', 'threatModels.status', mockTranslocoService as never)).toBe(
        'notStarted',
      );
    });

    it('should migrate numeric threat status keys', () => {
      expect(
        migrateFieldValue('0', 'threatEditor.threatStatus', mockTranslocoService as never),
      ).toBe('open');
      expect(
        migrateFieldValue('7', 'threatEditor.threatStatus', mockTranslocoService as never),
      ).toBe('falsePositive');
    });

    it('should migrate numeric priority keys', () => {
      expect(
        migrateFieldValue('0', 'threatEditor.threatPriority', mockTranslocoService as never),
      ).toBe('immediate');
      expect(
        migrateFieldValue('4', 'threatEditor.threatPriority', mockTranslocoService as never),
      ).toBe('deferred');
    });
  });

  describe('getFieldOptions', () => {
    it('should return 6 options for threatSeverity', () => {
      const options = getFieldOptions('threatEditor.threatSeverity', mockTranslocoService as never);
      expect(options).toHaveLength(6);
    });

    it('should return 10 options for threatStatus', () => {
      const options = getFieldOptions('threatEditor.threatStatus', mockTranslocoService as never);
      expect(options).toHaveLength(10);
    });

    it('should return 5 options for threatPriority', () => {
      const options = getFieldOptions('threatEditor.threatPriority', mockTranslocoService as never);
      expect(options).toHaveLength(5);
    });

    it('should return 10 options for threatModels.status', () => {
      const options = getFieldOptions('threatModels.status', mockTranslocoService as never);
      expect(options).toHaveLength(10);
    });

    it('should return options with camelCase keys, labels, and tooltips', () => {
      const options = getFieldOptions('threatEditor.threatSeverity', mockTranslocoService as never);
      expect(options[0]).toHaveProperty('key');
      expect(options[0]).toHaveProperty('label');
      expect(options[0]).toHaveProperty('tooltip');
      expect(options[0].key).toBe('critical');
      expect(options[1].key).toBe('high');
    });

    it('should return 0 options for unknown field type', () => {
      const options = getFieldOptions('unknown.field' as FieldType, mockTranslocoService as never);
      expect(options).toHaveLength(0);
    });
  });

  describe('getFieldLabel', () => {
    it('should return empty string for null value', () => {
      expect(
        getFieldLabel(null, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('');
    });

    it('should return empty string for undefined value', () => {
      expect(
        getFieldLabel(undefined, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('');
    });

    it('should return translated label for valid camelCase key', () => {
      expect(
        getFieldLabel('high', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('High');
      expect(mockTranslocoService.translate).toHaveBeenCalledWith(
        'threatEditor.threatSeverity.high',
      );
    });
  });

  describe('getFieldTooltip', () => {
    it('should return empty string for null value', () => {
      expect(
        getFieldTooltip(null, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('');
    });

    it('should use "tooltip" suffix for threatModels.status', () => {
      getFieldTooltip('notStarted', 'threatModels.status', mockTranslocoService as never);
      expect(mockTranslocoService.translate).toHaveBeenCalledWith(
        'threatModels.status.notStarted.tooltip',
      );
    });

    it('should use "description" suffix for threat fields', () => {
      getFieldTooltip('high', 'threatEditor.threatSeverity', mockTranslocoService as never);
      expect(mockTranslocoService.translate).toHaveBeenCalledWith(
        'threatEditor.threatSeverity.high.description',
      );
    });
  });
});
