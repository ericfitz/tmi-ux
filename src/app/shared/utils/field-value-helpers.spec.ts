// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  migrateFieldValue,
  getFieldOptions,
  getFieldLabel,
  getFieldTooltip,
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
        0: 'Unknown',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Critical',
        5: 'Emergency',
      },
      threatStatus: {
        0: 'Open',
        1: 'In Progress',
        2: 'Mitigated',
        3: 'Accepted',
        4: 'Transferred',
        5: 'Deferred',
        6: 'Monitoring',
        7: 'Rejected',
        8: 'Reopened',
        9: 'Closed',
      },
      threatPriority: {
        0: 'None',
        1: 'Low',
        2: 'Medium',
        3: 'High',
        4: 'Critical',
      },
    },
    threatModels: {
      status: {
        0: 'Draft',
        1: 'In Review',
        2: 'Approved',
        3: 'Rejected',
        4: 'Archived',
        5: 'Deprecated',
        6: 'Active',
        7: 'On Hold',
        8: 'Cancelled',
        9: 'Completed',
      },
    },
  };

  const deTranslations = {
    threatEditor: {
      threatSeverity: {
        0: 'Unbekannt',
        1: 'Niedrig',
        2: 'Mittel',
        3: 'Hoch',
        4: 'Kritisch',
        5: 'Notfall',
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

    it('should pass through already-numeric values', () => {
      expect(
        migrateFieldValue('3', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('3');
    });

    it('should pass through multi-digit numeric values', () => {
      expect(
        migrateFieldValue('99', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('99');
    });

    it('should migrate English string value to numeric key', () => {
      expect(
        migrateFieldValue('High', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('3');
    });

    it('should perform case-insensitive matching', () => {
      expect(
        migrateFieldValue('HIGH', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('3');
      expect(
        migrateFieldValue('high', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('3');
    });

    it('should match value from non-English language', () => {
      expect(
        migrateFieldValue('Hoch', 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('3');
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
      expect(migrateFieldValue('Draft', 'threatModels.status', mockTranslocoService as never)).toBe(
        '0',
      );
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

    it('should return options with key, label, and tooltip', () => {
      const options = getFieldOptions('threatEditor.threatSeverity', mockTranslocoService as never);
      expect(options[0]).toHaveProperty('key');
      expect(options[0]).toHaveProperty('label');
      expect(options[0]).toHaveProperty('tooltip');
      expect(options[0].key).toBe('0');
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

    it('should return translated label for valid numeric key', () => {
      expect(getFieldLabel('3', 'threatEditor.threatSeverity', mockTranslocoService as never)).toBe(
        'High',
      );
      expect(mockTranslocoService.translate).toHaveBeenCalledWith('threatEditor.threatSeverity.3');
    });
  });

  describe('getFieldTooltip', () => {
    it('should return empty string for null value', () => {
      expect(
        getFieldTooltip(null, 'threatEditor.threatSeverity', mockTranslocoService as never),
      ).toBe('');
    });

    it('should use "tooltip" suffix for threatModels.status', () => {
      getFieldTooltip('0', 'threatModels.status', mockTranslocoService as never);
      expect(mockTranslocoService.translate).toHaveBeenCalledWith('threatModels.status.0.tooltip');
    });

    it('should use "description" suffix for threat fields', () => {
      getFieldTooltip('3', 'threatEditor.threatSeverity', mockTranslocoService as never);
      expect(mockTranslocoService.translate).toHaveBeenCalledWith(
        'threatEditor.threatSeverity.3.description',
      );
    });
  });
});
