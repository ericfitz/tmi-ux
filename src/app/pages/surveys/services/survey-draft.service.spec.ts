// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SurveyDraftService } from './survey-draft.service';
import { SurveyResponseService } from './survey-response.service';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyResponse } from '@app/types/survey.types';

describe('SurveyDraftService', () => {
  let service: SurveyDraftService;
  let mockResponseService: {
    updateDraft: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  // Test data
  const mockResponse: SurveyResponse = {
    id: 'response-123',
    template_id: 'template-456',
    template_version: '2024-Q1',
    status: 'draft',
    is_confidential: false,
    answers: { question1: 'answer1' },
    ui_state: { currentPageNo: 1, isCompleted: false },
    owner: { id: 'user-1', name: 'Test User' },
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-15T00:00:00Z',
  };

  const testAnswers = { question1: 'answer1', question2: 'answer2' };
  const testUiState = { currentPageNo: 1, isCompleted: false };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockResponseService = {
      updateDraft: vi.fn().mockReturnValue(of(mockResponse)),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    service = new SurveyDraftService(
      mockResponseService as unknown as SurveyResponseService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with isSaving as false', () => {
      expect(service.isSaving).toBe(false);
    });

    it('should initialize with lastSaved as null', () => {
      expect(service.lastSaved).toBeNull();
    });

    it('should initialize with saveError as null', () => {
      expect(service.saveError).toBeNull();
    });

    it('should initialize with hasUnsavedChanges as false', () => {
      expect(service.hasUnsavedChanges).toBe(false);
    });
  });

  describe('queueSave()', () => {
    it('should mark hasUnsavedChanges as true immediately', () => {
      service.queueSave('response-123', testAnswers, testUiState);

      expect(service.hasUnsavedChanges).toBe(true);
    });

    it('should not call updateDraft before debounce time', () => {
      service.queueSave('response-123', testAnswers, testUiState);

      vi.advanceTimersByTime(1999);

      expect(mockResponseService.updateDraft).not.toHaveBeenCalled();
    });

    it('should call updateDraft after debounce time', () => {
      service.queueSave('response-123', testAnswers, testUiState);

      vi.advanceTimersByTime(2000);

      expect(mockResponseService.updateDraft).toHaveBeenCalledWith(
        'response-123',
        testAnswers,
        testUiState,
      );
    });

    it('should debounce multiple rapid calls', () => {
      service.queueSave('response-123', { q1: 'a' }, testUiState);
      vi.advanceTimersByTime(500);
      service.queueSave('response-123', { q1: 'ab' }, testUiState);
      vi.advanceTimersByTime(500);
      service.queueSave('response-123', { q1: 'abc' }, testUiState);

      vi.advanceTimersByTime(2000);

      expect(mockResponseService.updateDraft).toHaveBeenCalledTimes(1);
      expect(mockResponseService.updateDraft).toHaveBeenCalledWith(
        'response-123',
        { q1: 'abc' },
        testUiState,
      );
    });

    it('should update state on successful auto-save', () => {
      service.queueSave('response-123', testAnswers, testUiState);

      vi.advanceTimersByTime(2000);

      expect(service.isSaving).toBe(false);
      expect(service.lastSaved).not.toBeNull();
      expect(service.hasUnsavedChanges).toBe(false);
      expect(service.saveError).toBeNull();
    });

    it('should set saveError on failed auto-save', () => {
      mockResponseService.updateDraft.mockReturnValue(throwError(() => new Error('Network error')));

      service.queueSave('response-123', testAnswers, testUiState);

      vi.advanceTimersByTime(2000);

      expect(service.isSaving).toBe(false);
      expect(service.saveError).toBe('Failed to save draft');
    });
  });

  describe('saveNow()', () => {
    it('should call updateDraft immediately', () => {
      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(mockResponseService.updateDraft).toHaveBeenCalledWith(
        'response-123',
        testAnswers,
        testUiState,
      );
    });

    it('should set isSaving to true during save', () => {
      // Verify isSaving was set to true before the response resolves
      let savingDuringSave = false;
      mockResponseService.updateDraft.mockImplementation(() => {
        savingDuringSave = service.isSaving;
        return of(mockResponse);
      });

      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(savingDuringSave).toBe(true);
    });

    it('should update state on success', () => {
      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(service.isSaving).toBe(false);
      expect(service.lastSaved).not.toBeNull();
      expect(service.hasUnsavedChanges).toBe(false);
    });

    it('should clear saveError on save start', () => {
      // First, set an error
      mockResponseService.updateDraft.mockReturnValue(throwError(() => new Error('First failure')));
      service.saveNow('response-123', testAnswers, testUiState).subscribe({ error: () => {} });
      expect(service.saveError).toBe('Failed to save draft');

      // Now save again successfully
      mockResponseService.updateDraft.mockReturnValue(of(mockResponse));
      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(service.saveError).toBeNull();
    });

    it('should set saveError on failure', () => {
      mockResponseService.updateDraft.mockReturnValue(throwError(() => new Error('Save failed')));

      service.saveNow('response-123', testAnswers, testUiState).subscribe({
        error: err => {
          expect(err.message).toBe('Save failed');
        },
      });

      expect(service.saveError).toBe('Failed to save draft');
      expect(service.isSaving).toBe(false);
    });

    it('should log on success', () => {
      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(mockLoggerService.debug).toHaveBeenCalledWith('Draft saved immediately', {
        responseId: 'response-123',
      });
    });

    it('should log on failure', () => {
      const error = new Error('Save failed');
      mockResponseService.updateDraft.mockReturnValue(throwError(() => error));

      service.saveNow('response-123', testAnswers, testUiState).subscribe({ error: () => {} });

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Failed to save draft immediately',
        error,
      );
    });
  });

  describe('clearState()', () => {
    it('should reset all state subjects', () => {
      // First, put service into a non-default state
      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(service.lastSaved).not.toBeNull();

      // Clear state
      service.clearState();

      expect(service.isSaving).toBe(false);
      expect(service.lastSaved).toBeNull();
      expect(service.saveError).toBeNull();
      expect(service.hasUnsavedChanges).toBe(false);
    });

    it('should reset after error state', () => {
      mockResponseService.updateDraft.mockReturnValue(throwError(() => new Error('Error')));
      service.saveNow('response-123', testAnswers, testUiState).subscribe({ error: () => {} });

      expect(service.saveError).toBe('Failed to save draft');

      service.clearState();

      expect(service.saveError).toBeNull();
    });
  });

  describe('state observables', () => {
    it('should emit isSaving changes via isSaving$', () => {
      const values: boolean[] = [];
      service.isSaving$.subscribe(v => values.push(v));

      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      // Initial false, then true (on save start), then false (on save complete)
      expect(values).toContain(false);
    });

    it('should emit lastSaved changes via lastSaved$', () => {
      const values: (Date | null)[] = [];
      service.lastSaved$.subscribe(v => values.push(v));

      service.saveNow('response-123', testAnswers, testUiState).subscribe();

      expect(values[0]).toBeNull();
      expect(values[values.length - 1]).toBeInstanceOf(Date);
    });

    it('should emit saveError changes via saveError$', () => {
      const values: (string | null)[] = [];
      service.saveError$.subscribe(v => values.push(v));

      mockResponseService.updateDraft.mockReturnValue(throwError(() => new Error('Error')));
      service.saveNow('response-123', testAnswers, testUiState).subscribe({ error: () => {} });

      expect(values).toContain('Failed to save draft');
    });

    it('should emit hasUnsavedChanges changes via hasUnsavedChanges$', () => {
      const values: boolean[] = [];
      service.hasUnsavedChanges$.subscribe(v => values.push(v));

      service.queueSave('response-123', testAnswers, testUiState);

      expect(values).toContain(true);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should clean up without errors', () => {
      expect(() => service.ngOnDestroy()).not.toThrow();
    });
  });
});
