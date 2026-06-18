// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from './threat-editor-dialog.component';
import type { Threat } from '../../models/threat-model.model';

describe('ThreatEditorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn>; updateSize: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockLanguageService: {
    currentLanguage$: ReturnType<typeof of>;
    direction$: ReturnType<typeof of>;
  };
  let mockTransloco: TranslocoService;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: construct a ThreatEditorDialogComponent with mock dependencies for testing (pure)
  function build(data: ThreatEditorDialogData): ThreatEditorDialogComponent {
    return new ThreatEditorDialogComponent(
      mockDialogRef as never,
      new FormBuilder(),
      mockLogger as never,
      mockLanguageService as never,
      mockTransloco,
      data,
      mockDialog as never,
    );
  }

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: build a minimal test threat with optional field overrides (pure)
  function makeThreat(overrides: Partial<Threat> = {}): Threat {
    return {
      id: 't1',
      threat_model_id: 'tm-1',
      name: 'SQL Injection',
      description: 'Untrusted input',
      threat_type: ['Tampering'],
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn(), updateSize: vi.fn() };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockLanguageService = {
      currentLanguage$: of({ code: 'en-US', rtl: false }),
      direction$: of('ltr'),
    };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
      getActiveLang: vi.fn(() => 'en-US'),
      getAvailableLangs: vi.fn(() => ['en-US']),
      getTranslation: vi.fn(() => ({})),
      load: vi.fn(() => of({})),
      setActiveLang: vi.fn(),
    } as unknown as TranslocoService;
    mockDialog = { open: vi.fn() };
  });

  describe('construction', () => {
    it('should create with a fully-built threat form', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });

      expect(component).toBeTruthy();
      expect(component.threatForm.contains('name')).toBe(true);
      expect(component.threatForm.contains('severity')).toBe(true);
      expect(component.threatForm.contains('threat_type')).toBe(true);
    });

    it('defaults include_in_report and timmy_enabled to true', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });

      expect(component.threatForm.get('include_in_report')?.value).toBe(true);
      expect(component.threatForm.get('timmy_enabled')?.value).toBe(true);
    });

    it('requires a name and caps it at 100 characters', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      const name = component.threatForm.get('name');

      expect(name?.hasError('required')).toBe(true);
      name?.setValue('a'.repeat(101));
      expect(name?.hasError('maxlength')).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    // ngOnInit schedules setTimeout-driven dialog-resize/translation refreshes
    // that the component's ngOnDestroy does not clear. Fake timers keep those
    // callbacks from firing after the test against a torn-down component.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('sets view-only mode from the isReadOnly flag and disables the form', () => {
      const component = build({
        threatModelId: 'tm-1',
        mode: 'edit',
        isReadOnly: true,
        threat: makeThreat(),
      });

      component.ngOnInit();

      expect(component.isViewOnly).toBe(true);
      expect(component.threatForm.disabled).toBe(true);
      component.ngOnDestroy();
    });

    it('sets the create-mode dialog title', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });

      component.ngOnInit();

      expect(component.dialogTitle).toBe('threatEditor.createNewThreat');
      component.ngOnDestroy();
    });

    it('populates the form from an existing threat in edit mode', () => {
      const threat = makeThreat({ name: 'XSS', description: 'reflected', score: 7 });
      const component = build({ threatModelId: 'tm-1', mode: 'edit', threat });

      component.ngOnInit();

      expect(component.threatForm.get('name')?.value).toBe('XSS');
      expect(component.threatForm.get('description')?.value).toBe('reflected');
      expect(component.threatForm.get('score')?.value).toBe(7);
      component.ngOnDestroy();
    });

    it('falls back to default STRIDE threat types when no framework is given', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });

      component.ngOnInit();

      expect(component.threatTypeOptions).toContain('Spoofing');
      expect(component.threatTypeOptions).toContain('Elevation of Privilege');
      component.ngOnDestroy();
    });
  });

  describe('onSubmit', () => {
    it('does not close the dialog when the form is invalid', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      // name is required and empty.
      component.onSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('closes the dialog with the threat form values', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      component.threatForm.patchValue({
        name: 'New Threat',
        description: 'desc',
        severity: 'high',
        threat_type: ['Spoofing'],
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.name).toBe('New Threat');
      expect(result.severity).toBe('high');
      expect(result.threat_type).toEqual(['Spoofing']);
    });

    it('maps the NOT_ASSOCIATED sentinel to null for asset/diagram/cell ids', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      component.threatForm.patchValue({
        name: 'New Threat',
        asset_id: component.NOT_ASSOCIATED_VALUE,
        diagram_id: component.NOT_ASSOCIATED_VALUE,
        cell_id: component.NOT_ASSOCIATED_VALUE,
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.asset_id).toBeNull();
      expect(result.diagram_id).toBeNull();
      expect(result.cell_id).toBeNull();
    });

    it('passes through real asset/diagram/cell ids', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      component.threatForm.patchValue({
        name: 'New Threat',
        asset_id: 'a1',
        diagram_id: 'd1',
        cell_id: 'c1',
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.asset_id).toBe('a1');
      expect(result.diagram_id).toBe('d1');
      expect(result.cell_id).toBe('c1');
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('isAutoGenerated', () => {
    it('is true only when the threat is server-attributed to automation', () => {
      const autoThreat = build({
        threatModelId: 'tm-1',
        mode: 'edit',
        threat: makeThreat({ auto_generated: true }),
      });
      const manualThreat = build({
        threatModelId: 'tm-1',
        mode: 'edit',
        threat: makeThreat({ auto_generated: false }),
      });
      const noThreat = build({ threatModelId: 'tm-1', mode: 'create' });

      expect(autoThreat.isAutoGenerated).toBe(true);
      expect(manualThreat.isAutoGenerated).toBe(false);
      expect(noThreat.isAutoGenerated).toBe(false);
    });
  });

  describe('openFeedback', () => {
    it('opens the AI feedback dialog seeded with the sentiment and threat target', () => {
      const component = build({
        threatModelId: 'tm-1',
        mode: 'edit',
        threat: makeThreat({ id: 'threat-9' }),
      });

      component.openFeedback('positive');

      expect(mockDialog.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            threatModelId: 'tm-1',
            targetType: 'threat',
            targetId: 'threat-9',
            initialSentiment: 'positive',
          }),
        }),
      );
    });

    it('does nothing when there is no threat', () => {
      const component = build({ threatModelId: 'tm-1', mode: 'create' });
      // No threat assigned (ngOnInit not run, so create-mode default not set).
      component.openFeedback('negative');

      expect(mockDialog.open).not.toHaveBeenCalled();
    });
  });
});
