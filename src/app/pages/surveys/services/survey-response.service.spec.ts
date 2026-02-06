// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SurveyResponseService } from './survey-response.service';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  SurveyResponse,
  ListSurveyResponsesResponse,
  CreateSurveyResponseRequest,
  CreateThreatModelFromResponseResult,
} from '@app/types/survey.types';

describe('SurveyResponseService', () => {
  let service: SurveyResponseService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
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
    ui_state: { currentPageNo: 0, isCompleted: false },
    owner: { id: 'user-1', name: 'Test User' },
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-15T00:00:00Z',
  };

  const mockListResponse: ListSurveyResponsesResponse = {
    survey_responses: [
      {
        id: 'response-123',
        template_id: 'template-456',
        template_name: 'Security Review Intake',
        template_version: '2024-Q1',
        status: 'draft',
        is_confidential: false,
        owner: { id: 'user-1', name: 'Test User' },
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-15T00:00:00Z',
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
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    };

    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    service = new SurveyResponseService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty myResponses observable', () => {
      service.myResponses$.subscribe(responses => {
        expect(responses).toEqual([]);
      });
    });

    it('should initialize with empty allResponses observable', () => {
      service.allResponses$.subscribe(responses => {
        expect(responses).toEqual([]);
      });
    });
  });

  describe('listMine()', () => {
    it('should call API with correct endpoint and no params when no filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listMine().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should build query params from filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listMine({ template_id: 'template-456', status: 'draft' }).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', {
          template_id: 'template-456',
          status: 'draft',
        });
      });
    });

    it('should update myResponses$ observable', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listMine().subscribe(() => {
        service.myResponses$.subscribe(responses => {
          expect(responses).toEqual(mockListResponse.survey_responses);
        });
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listMine().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('My responses loaded', {
          count: 1,
          total: 1,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listMine().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list my responses',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listAll()', () => {
    it('should call API with correct triage endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAll().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should build query params from filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAll({ status: 'submitted', limit: 25 }).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses', {
          status: 'submitted',
          limit: 25,
        });
      });
    });

    it('should update allResponses$ observable', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAll().subscribe(() => {
        service.allResponses$.subscribe(responses => {
          expect(responses).toEqual(mockListResponse.survey_responses);
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listAll().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list all responses',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getById()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockResponse));

      service.getById('response-123').subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses/response-123');
        expect(response).toEqual(mockResponse);
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockResponse));

      service.getById('response-123').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Response loaded', {
          id: 'response-123',
          status: 'draft',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getById('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get response', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getByIdTriage()', () => {
    it('should call API with triage endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockResponse));

      service.getByIdTriage('response-123').subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses/response-123');
        expect(response).toEqual(mockResponse);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Forbidden');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getByIdTriage('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get response (triage)',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('createDraft()', () => {
    const createRequest: CreateSurveyResponseRequest = {
      template_id: 'template-456',
      answers: { question1: 'initial' },
    };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.post.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.createDraft(createRequest).subscribe(response => {
        expect(mockApiService.post).toHaveBeenCalledWith('intake/responses', createRequest);
        expect(response).toEqual(mockResponse);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.createDraft(createRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Draft response created', {
          id: 'response-123',
          templateId: 'template-456',
        });
      });
    });

    it('should refresh response list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.createDraft(createRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createDraft(createRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create draft response',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if creation fails', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createDraft(createRequest).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('updateDraft()', () => {
    const answers = { question1: 'updated answer' };
    const uiState = { currentPageNo: 2, isCompleted: false };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.put.mockReturnValue(of(mockResponse));

      service.updateDraft('response-123', answers, uiState).subscribe(response => {
        expect(mockApiService.put).toHaveBeenCalledWith('intake/responses/response-123', {
          answers,
          ui_state: uiState,
        });
        expect(response).toEqual(mockResponse);
      });
    });

    it('should handle undefined uiState', () => {
      mockApiService.put.mockReturnValue(of(mockResponse));

      service.updateDraft('response-123', answers).subscribe(() => {
        expect(mockApiService.put).toHaveBeenCalledWith('intake/responses/response-123', {
          answers,
          ui_state: undefined,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.updateDraft('response-123', answers, uiState).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update draft', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('submit()', () => {
    it('should call API with correct PATCH payload', () => {
      const submittedResponse = { ...mockResponse, status: 'submitted' as const };
      mockApiService.patch.mockReturnValue(of(submittedResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.submit('response-123').subscribe(response => {
        expect(mockApiService.patch).toHaveBeenCalledWith('intake/responses/response-123', [
          { op: 'replace', path: '/status', value: 'submitted' },
        ]);
        expect(response.status).toBe('submitted');
      });
    });

    it('should refresh response list after submission', () => {
      mockApiService.patch.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.submit('response-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Submit failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.submit('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to submit response', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('deleteDraft()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteDraft('response-123').subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('intake/responses/response-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteDraft('response-123').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Draft deleted', {
          id: 'response-123',
        });
      });
    });

    it('should refresh response list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteDraft('response-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteDraft('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete draft', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteDraft('response-123').subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('getDraftsForTemplate()', () => {
    it('should call listMine with template_id and draft status filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.getDraftsForTemplate('template-456').subscribe(drafts => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/responses', {
          template_id: 'template-456',
          status: 'draft',
        });
        expect(drafts).toEqual(mockListResponse.survey_responses);
      });
    });
  });

  describe('approve()', () => {
    it('should call API with correct triage PATCH payload', () => {
      const approvedResponse = { ...mockResponse, status: 'ready_for_review' as const };
      mockApiService.patch.mockReturnValue(of(approvedResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.approve('response-123').subscribe(response => {
        expect(mockApiService.patch).toHaveBeenCalledWith('triage/surveys/responses/response-123', [
          { op: 'replace', path: '/status', value: 'ready_for_review' },
        ]);
        expect(response.status).toBe('ready_for_review');
      });
    });

    it('should refresh all responses list after approval', () => {
      mockApiService.patch.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.approve('response-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Approve failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.approve('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to approve response', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('returnForRevision()', () => {
    it('should call API with status and revision_notes patches', () => {
      const revisedResponse = { ...mockResponse, status: 'needs_revision' as const };
      mockApiService.patch.mockReturnValue(of(revisedResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.returnForRevision('response-123', 'Please fix section 3').subscribe(response => {
        expect(mockApiService.patch).toHaveBeenCalledWith('triage/surveys/responses/response-123', [
          { op: 'replace', path: '/status', value: 'needs_revision' },
          { op: 'replace', path: '/revision_notes', value: 'Please fix section 3' },
        ]);
        expect(response.status).toBe('needs_revision');
      });
    });

    it('should refresh all responses list after returning for revision', () => {
      mockApiService.patch.mockReturnValue(of(mockResponse));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.returnForRevision('response-123', 'Needs work').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Return failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.returnForRevision('response-123', 'Needs work').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to return response for revision',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('createThreatModel()', () => {
    const mockTmResult: CreateThreatModelFromResponseResult = {
      threat_model_id: 'tm-789',
      survey_response_id: 'response-123',
    };

    it('should call API with correct endpoint and empty body', () => {
      mockApiService.post.mockReturnValue(of(mockTmResult));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.createThreatModel('response-123').subscribe(result => {
        expect(mockApiService.post).toHaveBeenCalledWith(
          'triage/surveys/responses/response-123/create_threat_model',
          {},
        );
        expect(result).toEqual(mockTmResult);
      });
    });

    it('should refresh all responses list after creating threat model', () => {
      mockApiService.post.mockReturnValue(of(mockTmResult));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.createThreatModel('response-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('triage/surveys/responses', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('TM creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createThreatModel('response-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create threat model from response',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('linkToThreatModel()', () => {
    it('should call API with correct PATCH payload', () => {
      mockApiService.patch.mockReturnValue(of(mockResponse));

      service.linkToThreatModel('response-123', 'tm-789').subscribe(response => {
        expect(mockApiService.patch).toHaveBeenCalledWith('intake/responses/response-123', [
          { op: 'replace', path: '/linked_threat_model_id', value: 'tm-789' },
        ]);
        expect(response).toEqual(mockResponse);
      });
    });

    it('should log info message on success', () => {
      mockApiService.patch.mockReturnValue(of(mockResponse));

      service.linkToThreatModel('response-123', 'tm-789').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Response linked to threat model', {
          responseId: 'response-123',
          threatModelId: 'tm-789',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Link failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.linkToThreatModel('response-123', 'tm-789').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to link response to threat model',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });
});
