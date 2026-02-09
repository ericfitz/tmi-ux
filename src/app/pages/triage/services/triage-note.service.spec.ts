// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { TriageNoteService } from './triage-note.service';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import { TriageNote, ListTriageNotesResponse } from '@app/types/triage-note.types';

describe('TriageNoteService', () => {
  let service: TriageNoteService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const responseId = 'response-123';

  const mockNote: TriageNote = {
    id: 1,
    name: 'Initial Assessment',
    content: 'Reviewed the response. Looks good overall.',
    created_at: '2026-02-01T10:00:00Z',
    created_by: {
      principal_type: 'user',
      provider: 'google',
      provider_id: '12345',
      display_name: 'Security Reviewer',
      email: 'reviewer@example.com',
    },
    modified_at: '2026-02-01T10:00:00Z',
    modified_by: {
      principal_type: 'user',
      provider: 'google',
      provider_id: '12345',
      display_name: 'Security Reviewer',
      email: 'reviewer@example.com',
    },
  };

  const mockListResponse: ListTriageNotesResponse = {
    triage_notes: [
      {
        id: 1,
        name: 'Initial Assessment',
        created_at: '2026-02-01T10:00:00Z',
        created_by: {
          principal_type: 'user',
          provider: 'google',
          provider_id: '12345',
          display_name: 'Security Reviewer',
          email: 'reviewer@example.com',
        },
      },
    ],
    total: 1,
    limit: 100,
    offset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    service = new TriageNoteService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('list()', () => {
    it('should list triage notes for a response', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list(responseId).subscribe(result => {
        expect(result).toEqual(mockListResponse);
        expect(result.triage_notes).toHaveLength(1);
      });

      expect(mockApiService.get).toHaveBeenCalledWith(
        `triage/survey_responses/${responseId}/triage_notes`,
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Triage notes loaded',
        expect.objectContaining({ responseId, count: 1 }),
      );
    });

    it('should handle error when listing triage notes', () => {
      const error = new Error('Network error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list(responseId).subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list triage notes', error);
    });
  });

  describe('getById()', () => {
    it('should get a specific triage note', () => {
      mockApiService.get.mockReturnValue(of(mockNote));

      service.getById(responseId, 1).subscribe(result => {
        expect(result).toEqual(mockNote);
        expect(result.name).toBe('Initial Assessment');
      });

      expect(mockApiService.get).toHaveBeenCalledWith(
        `triage/survey_responses/${responseId}/triage_notes/1`,
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Triage note loaded',
        expect.objectContaining({ responseId, noteId: 1 }),
      );
    });

    it('should handle error when getting a triage note', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getById(responseId, 99).subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get triage note', error);
    });
  });

  describe('create()', () => {
    const createRequest = {
      name: 'New Note',
      content: 'Some content here',
    };

    it('should create a triage note', () => {
      mockApiService.post.mockReturnValue(of(mockNote));

      service.create(responseId, createRequest).subscribe(result => {
        expect(result).toEqual(mockNote);
      });

      expect(mockApiService.post).toHaveBeenCalledWith(
        `triage/survey_responses/${responseId}/triage_notes`,
        createRequest,
      );
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'Triage note created',
        expect.objectContaining({ responseId, noteId: 1, name: 'Initial Assessment' }),
      );
    });

    it('should handle error when creating a triage note', () => {
      const error = new Error('Validation error');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(responseId, createRequest).subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });

      expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create triage note', error);
    });
  });
});
