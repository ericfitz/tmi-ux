// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { SsvcCalculatorDialogComponent } from './ssvc-calculator-dialog.component';
import { SsvcCalculatorDialogData } from './ssvc-calculator-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
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

interface MockDestroyRef {
  onDestroy: ReturnType<typeof vi.fn>;
}

describe('SsvcCalculatorDialogComponent', () => {
  let component: SsvcCalculatorDialogComponent;
  let dialogRef: MockDialogRef;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let destroyRef: MockDestroyRef;

  function createComponent(dialogData: SsvcCalculatorDialogData = {}): void {
    dialogRef = { close: vi.fn() };
    loggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };
    destroyRef = {
      onDestroy: vi.fn(),
    };

    component = new SsvcCalculatorDialogComponent(
      dialogRef as any,
      dialogData,
      { markForCheck: vi.fn() } as any,
      loggerService as any,
      languageService as any,
      destroyRef as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should start at step 0 with no selections', () => {
      component.ngOnInit();
      expect(component.currentStep).toBe(0);
      expect(component.selections).toEqual([null, null, null, null]);
      expect(component.isEditMode).toBe(false);
      expect(component.decision).toBeNull();
    });

    it('should initialize from existing entry in edit mode', () => {
      createComponent({
        existingEntry: {
          vector: 'SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/',
          decision: 'Immediate',
          methodology: 'Supplier',
        },
      });
      component.ngOnInit();
      expect(component.isEditMode).toBe(true);
      expect(component.selections).toEqual(['A', 'S', 'T', 'S']);
      expect(component.currentStep).toBe(4); // summary step
      expect(component.decision).toBe('Immediate');
    });

    it('should handle invalid existing vector gracefully', () => {
      createComponent({
        existingEntry: {
          vector: 'invalid-vector',
          decision: 'Defer',
          methodology: 'Supplier',
        },
      });
      component.ngOnInit();
      expect(component.isEditMode).toBe(false);
      expect(component.selections).toEqual([null, null, null, null]);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('stepper navigation', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should advance to next step', () => {
      component.selections[0] = 'N';
      component.next();
      expect(component.currentStep).toBe(1);
    });

    it('should go back to previous step', () => {
      component.currentStep = 2;
      component.back();
      expect(component.currentStep).toBe(1);
    });

    it('should not go back from step 0', () => {
      component.back();
      expect(component.currentStep).toBe(0);
    });

    it('should not advance past summary step', () => {
      component.currentStep = 4;
      component.next();
      expect(component.currentStep).toBe(4);
    });
  });

  describe('value selection', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should set the selection for the current step', () => {
      component.onValueSelect('N');
      expect(component.selections[0]).toBe('N');
    });

    it('should invalidate downstream steps when changing a selection', () => {
      // Fill in all steps
      component.selections = ['N', 'L', 'P', 'M'];
      component.currentStep = 0;

      // Change step 0
      component.onValueSelect('A');
      expect(component.selections[0]).toBe('A');
      expect(component.selections[1]).toBeNull();
      expect(component.selections[2]).toBeNull();
      expect(component.selections[3]).toBeNull();
    });

    it('should not invalidate downstream when selecting the same value', () => {
      component.selections = ['N', 'L', 'P', 'M'];
      component.currentStep = 0;

      component.onValueSelect('N');
      expect(component.selections).toEqual(['N', 'L', 'P', 'M']);
    });

    it('should calculate decision when all steps are complete', () => {
      component.currentStep = 0;
      component.onValueSelect('N');
      component.currentStep = 1;
      component.onValueSelect('L');
      component.currentStep = 2;
      component.onValueSelect('P');
      component.currentStep = 3;
      component.onValueSelect('M');
      expect(component.decision).toBe('Defer');
    });
  });

  describe('decision class mapping', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should set decision-defer class', () => {
      component.currentStep = 3;
      component.selections = ['N', 'L', 'P', null];
      component.onValueSelect('M');
      expect(component.decisionClass).toBe('decision-defer');
    });

    it('should set decision-immediate class', () => {
      component.currentStep = 3;
      component.selections = ['A', 'S', 'T', null];
      component.onValueSelect('S');
      expect(component.decisionClass).toBe('decision-immediate');
    });
  });

  describe('dialog actions', () => {
    it('should close with result on apply', () => {
      createComponent();
      component.ngOnInit();
      // Set all selections and trigger recalculation
      component.currentStep = 0;
      component.onValueSelect('A');
      component.currentStep = 1;
      component.onValueSelect('S');
      component.currentStep = 2;
      component.onValueSelect('T');
      component.currentStep = 3;
      component.onValueSelect('S');
      component.currentStep = 4;

      component.apply();

      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({
            decision: 'Immediate',
            methodology: 'Supplier',
            vector: expect.stringMatching(/^SSVCv2\/E:A\/U:S\/T:T\/P:S\//),
          }),
        }),
      );
    });

    it('should not apply when incomplete', () => {
      createComponent();
      component.ngOnInit();
      component.selections = ['A', null, null, null];
      component.apply();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close without result on cancel', () => {
      createComponent();
      component.ngOnInit();
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('computed properties', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('isCurrentStepComplete should be false when no selection', () => {
      expect(component.isCurrentStepComplete).toBe(false);
    });

    it('isCurrentStepComplete should be true when step has selection', () => {
      component.selections[0] = 'N';
      expect(component.isCurrentStepComplete).toBe(true);
    });

    it('isAllComplete should be false when any step is null', () => {
      component.selections = ['N', 'L', null, 'M'];
      expect(component.isAllComplete).toBe(false);
    });

    it('isAllComplete should be true when all steps have values', () => {
      component.selections = ['N', 'L', 'P', 'M'];
      expect(component.isAllComplete).toBe(true);
    });
  });
});
