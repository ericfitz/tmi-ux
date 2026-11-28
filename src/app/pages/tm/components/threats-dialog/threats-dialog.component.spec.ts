// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { ThreatsDialogComponent, ThreatsDialogData } from './threats-dialog.component';
import type { Threat } from '../../models/threat-model.model';

describe('ThreatsDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockThreatModelService: Record<string, ReturnType<typeof vi.fn>>;
  let mockFrameworkService: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: build a minimal Threat fixture with optional field overrides (pure)
  function makeThreat(id: string, overrides: Partial<Threat> = {}): Threat {
    return {
      id,
      threat_model_id: 'tm-1',
      name: `Threat ${id}`,
      description: 'A threat',
      threat_type: [],
      created_at: '2024-01-01',
      modified_at: '2024-01-01',
      ...overrides,
    };
  }

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: instantiate and initialize ThreatsDialogComponent with mocked dependencies for testing (pure)
  function build(data: ThreatsDialogData): ThreatsDialogComponent {
    const component = new ThreatsDialogComponent(
      mockDialogRef as never,
      data,
      mockLogger as never,
      mockDialog as never,
      mockThreatModelService as never,
      mockFrameworkService as never,
      mockTransloco,
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockDialog = { open: vi.fn() };
    mockThreatModelService = { getThreatModelById: vi.fn(), updateThreat: vi.fn() };
    mockFrameworkService = { loadAllFrameworks: vi.fn() };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
      getActiveLang: vi.fn(() => 'en-US'),
      getAvailableLangs: vi.fn(() => ['en-US']),
      getTranslation: vi.fn(() => ({})),
    } as unknown as TranslocoService;
  });

  describe('initialization', () => {
    it('should create', () => {
      expect(build({ threats: [] })).toBeTruthy();
    });

    it('copies the provided threats into the data source', () => {
      const threats = [makeThreat('t1'), makeThreat('t2')];
      const component = build({ threats });

      expect(component.dataSource.data).toEqual(threats);
      expect(component.dataSource.data).not.toBe(threats);
    });

    it('shows the actions column when editable', () => {
      const component = build({ threats: [] });

      expect(component.displayedColumns).toEqual(['severity', 'description', 'actions']);
    });

    it('hides the actions column in read-only mode', () => {
      const component = build({ threats: [], isReadOnly: true });

      expect(component.displayedColumns).toEqual(['severity', 'description']);
    });
  });

  describe('getSeverityLabel', () => {
    it('returns the "not set" label for a null severity', () => {
      const component = build({ threats: [] });

      expect(component.getSeverityLabel(null)).toBe('common.notSet');
    });

    it('resolves a label for a known severity via the severity translation key', () => {
      const component = build({ threats: [] });

      // 'high' is a valid severity key, so getFieldLabel translates
      // 'threatEditor.threatSeverity.high'; the identity-mock transloco
      // returns that key verbatim.
      expect(component.getSeverityLabel('high')).toBe('threatEditor.threatSeverity.high');
    });
  });

  describe('getSeverityClass', () => {
    it('builds a severity- prefixed class', () => {
      const component = build({ threats: [] });

      expect(component.getSeverityClass('high')).toBe('severity-high');
    });

    it('falls back to "none" for a null severity', () => {
      const component = build({ threats: [] });

      expect(component.getSeverityClass(null)).toBe('severity-none');
    });
  });

  describe('onThreatRowClick', () => {
    it('does nothing in read-only mode', () => {
      const component = build({ threats: [], isReadOnly: true });

      component.onThreatRowClick(makeThreat('t1'));

      expect(mockThreatModelService['getThreatModelById']).not.toHaveBeenCalled();
    });

    it('does not edit when no threat model id is available', () => {
      const component = build({ threats: [] });

      component.onThreatRowClick(makeThreat('t1'));

      // editThreat warns and returns when threatModelId is missing.
      expect(mockLogger['warn']).toHaveBeenCalled();
      expect(mockThreatModelService['getThreatModelById']).not.toHaveBeenCalled();
    });
  });

  describe('editThreat metadata (#1076)', () => {
    const stored = [{ key: 'run_id', value: 'ace18002-3d78-4ffc-804d-0c46f1419ce4' }];

    beforeEach(() => {
      mockThreatModelService['getThreatModelById'].mockReturnValue(
        of({ id: 'tm-1', threat_model_framework: 'STRIDE' }),
      );
      mockFrameworkService['loadAllFrameworks'].mockReturnValue(of([]));
      mockThreatModelService['getThreatMetadata'] = vi.fn().mockReturnValue(of(stored));
      mockThreatModelService['updateThreat'].mockReturnValue(of(makeThreat('t1')));
    });

    it('sends the stored metadata, not the empty list copy, when saving an edit', () => {
      const threat = makeThreat('t1', { metadata: [] });
      mockDialog.open.mockReturnValue({
        afterClosed: vi.fn().mockReturnValue(of({ name: 'Renamed', threat_type: [] })),
      });
      const component = build({ threats: [threat], threatModelId: 'tm-1' });

      component.editThreat(threat);

      expect(mockThreatModelService['getThreatMetadata']).toHaveBeenCalledWith('tm-1', 't1');
      expect(mockThreatModelService['updateThreat']).toHaveBeenCalledWith(
        'tm-1',
        't1',
        expect.objectContaining({ name: 'Renamed', metadata: stored }),
      );
    });

    it('does not open the editor when the stored metadata cannot be loaded', () => {
      mockThreatModelService['getThreatMetadata'].mockReturnValue(
        throwError(() => new Error('boom')),
      );
      const threat = makeThreat('t1', { metadata: [] });
      const component = build({ threats: [threat], threatModelId: 'tm-1' });

      component.editThreat(threat);

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockThreatModelService['updateThreat']).not.toHaveBeenCalled();
    });
  });

  describe('deleteThreat', () => {
    it('removes the threat at the given index', () => {
      const threats = [makeThreat('t1'), makeThreat('t2')];
      const component = build({ threats });

      component.deleteThreat(0);

      expect(component.dataSource.data.map(t => t.id)).toEqual(['t2']);
    });

    it('ignores an out-of-range index', () => {
      const component = build({ threats: [makeThreat('t1')] });

      component.deleteThreat(5);

      expect(component.dataSource.data).toHaveLength(1);
    });
  });

  describe('addThreat', () => {
    it('closes the dialog signalling the threat editor should open', () => {
      const component = build({ threats: [] });

      component.addThreat();

      expect(mockDialogRef.close).toHaveBeenCalledWith({ action: 'openThreatEditor' });
    });
  });

  describe('close', () => {
    it('closes the dialog without a result', () => {
      const component = build({ threats: [] });

      component.close();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('tab index helpers', () => {
    it('computes add/close tab indices from the row count', () => {
      const component = build({ threats: [makeThreat('t1'), makeThreat('t2')] });

      expect(component.getAddButtonTabIndex()).toBe(3);
      expect(component.getCloseButtonTabIndex()).toBe(4);
    });
  });
});
