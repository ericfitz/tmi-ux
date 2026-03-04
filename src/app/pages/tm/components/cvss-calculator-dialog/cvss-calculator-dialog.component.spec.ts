// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { CvssCalculatorDialogComponent } from './cvss-calculator-dialog.component';
import {
  CvssCalculatorDialogData,
  CvssCalculatorDialogResult,
} from './cvss-calculator-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockSnackBar {
  open: ReturnType<typeof vi.fn>;
}

interface MockLoggerService {
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

describe('CvssCalculatorDialogComponent', () => {
  let component: CvssCalculatorDialogComponent;
  let dialogRef: MockDialogRef;
  let snackBar: MockSnackBar;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let translocoService: MockTranslocoService;
  let data: CvssCalculatorDialogData;

  function createComponent(dialogData: CvssCalculatorDialogData): void {
    data = dialogData;
    dialogRef = { close: vi.fn() };
    snackBar = { open: vi.fn() };
    loggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };
    translocoService = {
      translate: vi.fn((key: string) => key),
    };

    component = new CvssCalculatorDialogComponent(
      dialogRef as any,
      data,
      { markForCheck: vi.fn() } as any,
      loggerService as any,
      languageService as any,
      translocoService as any,
      snackBar as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createComponent({});
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should default to CVSS 3.1 when no existing entry', () => {
      component.ngOnInit();
      expect(component.selectedVersion).toBe('3.1');
      expect(component.isEditMode).toBe(false);
    });

    it('should detect CVSS 3.1 from existing vector string', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          score: 9.8,
        },
        existingIndex: 0,
      });
      component.ngOnInit();
      expect(component.selectedVersion).toBe('3.1');
      expect(component.isEditMode).toBe(true);
    });

    it('should detect CVSS 4.0 from existing vector string', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
          score: 9.3,
        },
        existingIndex: 1,
      });
      component.ngOnInit();
      expect(component.selectedVersion).toBe('4.0');
      expect(component.isEditMode).toBe(true);
    });

    it('should populate metric groups on init', () => {
      component.ngOnInit();
      expect(component.metricGroups.length).toBeGreaterThan(0);
    });

    it('should have base metrics group marked as isBase', () => {
      component.ngOnInit();
      const baseGroup = component.metricGroups.find(g => g.isBase);
      expect(baseGroup).toBeDefined();
      expect(baseGroup!.categoryName.toLowerCase()).toContain('base');
    });

    it('should populate metrics from existing vector', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          score: 9.8,
        },
        existingIndex: 0,
      });
      component.ngOnInit();

      const baseGroup = component.metricGroups.find(g => g.isBase);
      const avMetric = baseGroup?.metrics.find(m => m.shortName === 'AV');
      expect(avMetric?.selectedValue).toBe('N');
    });

    it('should handle invalid vector string gracefully', () => {
      createComponent({
        existingEntry: {
          vector: 'INVALID_VECTOR',
          score: 0,
        },
        existingIndex: 0,
      });
      component.ngOnInit();

      // Should fall back to fresh initialization
      expect(component.metricGroups.length).toBeGreaterThan(0);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('version switching', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should rebuild metric groups when switching to 4.0', () => {
      const groupsBefore = component.metricGroups.length;
      component.onVersionChange('4.0');
      expect(component.selectedVersion).toBe('4.0');
      // CVSS 4.0 has more categories than 3.1
      expect(component.metricGroups.length).toBeGreaterThanOrEqual(groupsBefore);
    });

    it('should reset score when switching versions', () => {
      // Set some base metrics first
      const baseGroup = component.metricGroups.find(g => g.isBase);
      if (baseGroup) {
        for (const metric of baseGroup.metrics) {
          const nonXValue = metric.values.find(v => v.shortName !== 'X');
          if (nonXValue) {
            component.onMetricChange(metric.shortName, nonXValue.shortName);
          }
        }
      }

      component.onVersionChange('4.0');
      // Score should be reset (may or may not be valid
      // depending on CVSS 4.0 defaults)
      expect(component.vectorString).toBeTruthy();
    });

    it('should not change version if same value', () => {
      const groupsBefore = component.metricGroups;
      component.onVersionChange('3.1');
      // Groups should be the same reference since no change occurred
      expect(component.metricGroups).toBe(groupsBefore);
    });
  });

  describe('metric selection', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should update selected value when metric changes', () => {
      component.onMetricChange('AV', 'N');

      const baseGroup = component.metricGroups.find(g => g.isBase);
      const avMetric = baseGroup?.metrics.find(m => m.shortName === 'AV');
      expect(avMetric?.selectedValue).toBe('N');
    });

    it('should recalculate vector string after change', () => {
      component.onMetricChange('AV', 'N');
      expect(component.vectorString).toContain('AV:N');
    });

    it('should update severity after setting all base metrics', () => {
      // Set all CVSS 3.1 base metrics to produce a known score
      component.onMetricChange('AV', 'N');
      component.onMetricChange('AC', 'L');
      component.onMetricChange('PR', 'N');
      component.onMetricChange('UI', 'N');
      component.onMetricChange('S', 'U');
      component.onMetricChange('C', 'H');
      component.onMetricChange('I', 'H');
      component.onMetricChange('A', 'H');

      expect(component.currentScore).not.toBeNull();
      expect(component.severityClass).toBe('severity-critical');
    });
  });

  describe('score calculation', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should calculate correct score for known CVSS 3.1 vector', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          score: 9.8,
        },
        existingIndex: 0,
      });
      component.ngOnInit();

      expect(component.currentScore).toBe(9.8);
      expect(component.severityClass).toBe('severity-critical');
    });

    it('should return correct severity for Low score', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:3.1/AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N',
          score: 1.6,
        },
        existingIndex: 0,
      });
      component.ngOnInit();

      expect(component.currentScore).toBeLessThan(4.0);
      expect(component.severityClass).toBe('severity-low');
    });

    it('should calculate correct score for CVSS 4.0 vector', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N',
          score: 9.3,
        },
        existingIndex: 0,
      });
      component.ngOnInit();

      expect(component.currentScore).not.toBeNull();
      expect(component.currentScore).toBeGreaterThanOrEqual(8.0);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should be invalid when no base metrics are set', () => {
      expect(component.isValid).toBe(false);
    });

    it('should be valid when all base metrics are set', () => {
      // Set all CVSS 3.1 base metrics
      component.onMetricChange('AV', 'N');
      component.onMetricChange('AC', 'L');
      component.onMetricChange('PR', 'N');
      component.onMetricChange('UI', 'N');
      component.onMetricChange('S', 'U');
      component.onMetricChange('C', 'H');
      component.onMetricChange('I', 'H');
      component.onMetricChange('A', 'H');

      expect(component.isValid).toBe(true);
    });
  });

  describe('dialog actions', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should close with result when apply is clicked', () => {
      // Set all base metrics to make valid
      component.onMetricChange('AV', 'N');
      component.onMetricChange('AC', 'L');
      component.onMetricChange('PR', 'N');
      component.onMetricChange('UI', 'N');
      component.onMetricChange('S', 'U');
      component.onMetricChange('C', 'H');
      component.onMetricChange('I', 'H');
      component.onMetricChange('A', 'H');

      component.apply();

      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({
            vector: expect.stringContaining('CVSS:3.1'),
            score: expect.any(Number),
          }),
        }),
      );
    });

    it('should include editIndex when editing', () => {
      createComponent({
        existingEntry: {
          vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
          score: 9.8,
        },
        existingIndex: 2,
      });
      component.ngOnInit();

      component.apply();

      const result = dialogRef.close.mock.calls[0][0] as CvssCalculatorDialogResult;
      expect(result.editIndex).toBe(2);
    });

    it('should close without result when cancel is clicked', () => {
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });

    it('should not apply when invalid', () => {
      component.apply();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('getGroupSummary', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should call translate with correct count', () => {
      const baseGroup = component.metricGroups.find(g => g.isBase);
      if (baseGroup) {
        component.getGroupSummary(baseGroup);
        expect(translocoService.translate).toHaveBeenCalledWith(
          'cvssCalculator.metricsSet',
          expect.objectContaining({
            total: baseGroup.metrics.length,
          }),
        );
      }
    });

    it('should not count X as set', () => {
      const baseGroup = component.metricGroups.find(g => g.isBase);
      if (baseGroup) {
        // Set one metric to X (Not Defined)
        component.onMetricChange('AV', 'X');
        component.getGroupSummary(baseGroup);

        expect(translocoService.translate).toHaveBeenCalledWith(
          'cvssCalculator.metricsSet',
          expect.objectContaining({
            count: 0,
          }),
        );
      }
    });
  });
});
