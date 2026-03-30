// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, throwError, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ExportDialogComponent } from './export-dialog.component';
import type { ExportDialogData } from './export-dialog.types';
import type { MatDialogRef } from '@angular/material/dialog';
import type { LoggerService } from '../../../../core/services/logger.service';
import type { ThreatModel } from '../../models/threat-model.model';

const mockThreatModel: ThreatModel = {
  id: 'tm-1',
  name: 'Test TM',
  description: 'A test threat model',
  owner: 'user1',
  status: 'active',
  threat_model_framework: 'stride',
  created_at: '2026-01-01T00:00:00.000Z',
  modified_at: '2026-01-01T00:00:00.000Z',
  authorization: [],
  metadata: [],
  diagrams: [],
  threats: [],
  notes: [],
  assets: [],
  documents: [],
  repositories: [],
};

describe('ExportDialogComponent', () => {
  let component: ExportDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockLogger: {
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let dialogData: ExportDialogData;

  function createComponent(data: ExportDialogData): ExportDialogComponent {
    return new ExportDialogComponent(
      mockDialogRef as unknown as MatDialogRef<ExportDialogComponent>,
      data,
      mockLogger as unknown as LoggerService,
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockLogger = {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debugComponent: vi.fn(),
    };
    dialogData = {
      threatModelName: 'Test TM',
      fetchObservable: of(mockThreatModel),
    };
  });

  describe('initial state', () => {
    it('starts in loading state before ngOnInit', () => {
      component = createComponent(dialogData);
      expect(component.state).toBe('loading');
    });

    it('transitions to ready state on successful fetch', () => {
      component = createComponent(dialogData);
      component.ngOnInit();
      expect(component.state).toBe('ready');
    });
  });

  describe('fetch returns undefined', () => {
    it('transitions to error state when fetch returns undefined', () => {
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: of(undefined),
      };
      component = createComponent(dialogData);
      component.ngOnInit();
      expect(component.state).toBe('error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('fetch observable errors', () => {
    it('transitions to error state when fetch observable errors', () => {
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: throwError(() => new Error('Network error')),
      };
      component = createComponent(dialogData);
      component.ngOnInit();
      expect(component.state).toBe('error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('onSave', () => {
    it('closes dialog with blob and filename on save', () => {
      component = createComponent(dialogData);
      component.ngOnInit();

      expect(component.state).toBe('ready');
      component.onSave();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toMatch(/\.json$/);
    });

    it('does not close dialog when blob is not ready', () => {
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: of(undefined),
      };
      component = createComponent(dialogData);
      component.ngOnInit();

      expect(component.state).toBe('error');
      component.onSave();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes dialog with undefined on cancel', () => {
      component = createComponent(dialogData);
      component.ngOnInit();

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledOnce();
      expect(mockDialogRef.close).toHaveBeenCalledWith(undefined);
    });
  });

  describe('retry', () => {
    it('retry triggers a new fetch and transitions back through loading to ready', () => {
      const subject = new Subject<ThreatModel | undefined>();
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: subject.asObservable(),
      };

      component = createComponent(dialogData);
      component.ngOnInit();

      // First fetch: emit error
      subject.error(new Error('first error'));
      expect(component.state).toBe('error');

      // Create a new subject for the retry (same observable reference won't re-emit after error)
      // Retry resets state to loading and re-subscribes to the same observable
      // Since the original errored, we need to test with a cold observable that can succeed on retry
      const successSubject = new Subject<ThreatModel | undefined>();
      component.data = {
        ...component.data,
        fetchObservable: successSubject.asObservable(),
      };

      component.fetchData();
      expect(component.state).toBe('loading');

      successSubject.next(mockThreatModel);
      expect(component.state).toBe('ready');
    });

    it('fetchData resets state to loading before fetching', () => {
      const subject = new Subject<ThreatModel | undefined>();
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: subject.asObservable(),
      };

      component = createComponent(dialogData);
      component.ngOnInit();
      // ngOnInit calls fetchData which sets state to 'loading' and subscribes
      // state is 'loading' while waiting for observable

      expect(component.state).toBe('loading');
    });
  });

  describe('filename sanitization', () => {
    it('sanitizes filenames with special characters', () => {
      const specialName = 'My <Special> "Project": File/Path\\Name|With?Chars*';
      const modelWithSpecialName: ThreatModel = { ...mockThreatModel, name: specialName };
      dialogData = {
        threatModelName: specialName,
        fetchObservable: of(modelWithSpecialName),
      };
      component = createComponent(dialogData);
      component.ngOnInit();

      expect(component.state).toBe('ready');
      component.onSave();

      const result = mockDialogRef.close.mock.calls[0][0];
      // Filename should not contain any of: < > : " / \ | ? *
      const filename = result.filename as string;
      expect(filename).not.toMatch(/[<>:"/\\|?*]/);
      expect(filename).toMatch(/\.json$/);
    });

    it('sanitizes spaces to hyphens in filename', () => {
      const modelWithSpaces: ThreatModel = { ...mockThreatModel, name: 'My Project Name' };
      dialogData = {
        threatModelName: 'My Project Name',
        fetchObservable: of(modelWithSpaces),
      };
      component = createComponent(dialogData);
      component.ngOnInit();
      component.onSave();

      const result = mockDialogRef.close.mock.calls[0][0];
      const filename = result.filename as string;
      expect(filename).toContain('My-Project-Name');
    });

    it('truncates long filenames to 63 characters before the suffix', () => {
      const longName = 'A'.repeat(100);
      const modelWithLongName: ThreatModel = { ...mockThreatModel, name: longName };
      dialogData = {
        threatModelName: longName,
        fetchObservable: of(modelWithLongName),
      };
      component = createComponent(dialogData);
      component.ngOnInit();
      component.onSave();

      const result = mockDialogRef.close.mock.calls[0][0];
      const filename = result.filename as string;
      const suffix = '-threat-model.json';
      const baseName = filename.replace(suffix, '');
      expect(baseName.length).toBeLessThanOrEqual(63);
    });
  });

  describe('ngOnDestroy', () => {
    it('completes the destroy subject to unsubscribe from fetch', () => {
      const subject = new Subject<ThreatModel | undefined>();
      dialogData = {
        threatModelName: 'Test TM',
        fetchObservable: subject.asObservable(),
      };

      component = createComponent(dialogData);
      component.ngOnInit();
      expect(component.state).toBe('loading');

      // Destroy before observable emits
      component.ngOnDestroy();

      // Emitting after destroy should not change state
      subject.next(mockThreatModel);
      expect(component.state).toBe('loading');
    });
  });
});
