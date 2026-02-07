// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SurveyService } from './survey.service';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  Survey,
  ListSurveysResponse,
  CreateSurveyRequest,
  UpdateSurveyRequest,
  SurveyJsonSchema,
} from '@app/types/survey.types';

describe('SurveyService', () => {
  let service: SurveyService;
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
  const mockSurveyJson: SurveyJsonSchema = {
    title: 'Test Survey',
    pages: [{ name: 'page1', elements: [] }],
  };

  const mockSurvey: Survey = {
    id: 'survey-123',
    name: 'Security Review Intake',
    description: 'Standard security review intake form',
    status: 'active',
    version: '2024-Q1',
    survey_json: mockSurveyJson,
    settings: { allow_threat_model_linking: true },
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-15T00:00:00Z',
    created_by: { id: 'user-1', name: 'Admin User' },
  };

  const mockListResponse: ListSurveysResponse = {
    surveys: [
      {
        id: 'survey-123',
        name: 'Security Review Intake',
        description: 'Standard form',
        version: '2024-Q1',
        status: 'active',
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-15T00:00:00Z',
        created_by: { id: 'user-1', name: 'Admin User' },
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

    service = new SurveyService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty surveys observable', () => {
      service.surveys$.subscribe(surveys => {
        expect(surveys).toEqual([]);
      });
    });
  });

  describe('listAdmin()', () => {
    it('should call API with correct endpoint and no params when no filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should build query params from filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin({ status: 'active', limit: 10 }).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', {
          status: 'active',
          limit: 10,
        });
      });
    });

    it('should update surveys$ observable', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(() => {
        service.surveys$.subscribe(surveys => {
          expect(surveys).toEqual(mockListResponse.surveys);
        });
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Surveys loaded', {
          count: 1,
          total: 1,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listAdmin().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list surveys', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listActive()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listActive().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/surveys');
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listActive().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list active surveys',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getById()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockSurvey));

      service.getById('survey-123').subscribe(survey => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/surveys/survey-123');
        expect(survey).toEqual(mockSurvey);
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockSurvey));

      service.getById('survey-123').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Survey loaded', {
          id: 'survey-123',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getById('survey-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to get survey', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getByIdAdmin()', () => {
    it('should call API with admin endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockSurvey));

      service.getByIdAdmin('survey-123').subscribe(survey => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys/survey-123');
        expect(survey).toEqual(mockSurvey);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Forbidden');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getByIdAdmin('survey-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get survey (admin)',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getSurveyJson()', () => {
    it('should return the survey_json with survey_id embedded', () => {
      mockApiService.get.mockReturnValue(of(mockSurvey));

      service.getSurveyJson('survey-123').subscribe(json => {
        expect(json).toEqual({ ...mockSurveyJson, survey_id: 'survey-123' });
      });
    });
  });

  describe('create()', () => {
    const createRequest: CreateSurveyRequest = {
      name: 'New Survey',
      version: 'v1',
      survey_json: mockSurveyJson,
      description: 'A new survey',
      status: 'inactive',
    };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.post.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(survey => {
        expect(mockApiService.post).toHaveBeenCalledWith('admin/surveys', createRequest);
        expect(survey).toEqual(mockSurvey);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Survey created', {
          id: 'survey-123',
        });
      });
    });

    it('should refresh survey list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(createRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create survey', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if creation fails', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(createRequest).subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('update()', () => {
    const updateRequest: UpdateSurveyRequest = {
      name: 'Updated Survey',
      version: 'v2',
      survey_json: mockSurveyJson,
      description: 'Updated description',
    };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.put.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update('survey-123', updateRequest).subscribe(survey => {
        expect(mockApiService.put).toHaveBeenCalledWith('admin/surveys/survey-123', updateRequest);
        expect(survey).toEqual(mockSurvey);
      });
    });

    it('should refresh survey list after update', () => {
      mockApiService.put.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update('survey-123', updateRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update('survey-123', updateRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update survey', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('setStatus()', () => {
    it('should call API with correct PATCH payload', () => {
      mockApiService.patch.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.setStatus('survey-123', 'active').subscribe(survey => {
        expect(mockApiService.patch).toHaveBeenCalledWith('admin/surveys/survey-123', [
          { op: 'replace', path: '/status', value: 'active' },
        ]);
        expect(survey).toEqual(mockSurvey);
      });
    });

    it('should refresh survey list after status change', () => {
      mockApiService.patch.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.setStatus('survey-123', 'active').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Status update failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.setStatus('survey-123', 'active').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to update survey status',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('archive()', () => {
    it('should delegate to setStatus with archived status', () => {
      mockApiService.patch.mockReturnValue(of(mockSurvey));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.archive('survey-123').subscribe(() => {
        expect(mockApiService.patch).toHaveBeenCalledWith('admin/surveys/survey-123', [
          { op: 'replace', path: '/status', value: 'archived' },
        ]);
      });
    });
  });

  describe('deleteSurvey()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteSurvey('survey-123').subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('admin/surveys/survey-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteSurvey('survey-123').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Survey deleted', {
          id: 'survey-123',
        });
      });
    });

    it('should refresh survey list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteSurvey('survey-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteSurvey('survey-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete survey', error);
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteSurvey('survey-123').subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('clone()', () => {
    it('should fetch original survey and create a new one', () => {
      mockApiService.get.mockImplementation((url: string) => {
        if (url === 'admin/surveys/survey-123') {
          return of(mockSurvey);
        }
        return of(mockListResponse);
      });
      const clonedSurvey = { ...mockSurvey, id: 'survey-456', name: 'Cloned Survey' };
      mockApiService.post.mockReturnValue(of(clonedSurvey));

      service.clone('survey-123', 'Cloned Survey').subscribe(result => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/surveys/survey-123');
        expect(mockApiService.post).toHaveBeenCalledWith('admin/surveys', {
          name: 'Cloned Survey',
          version: mockSurvey.version,
          survey_json: mockSurvey.survey_json,
          description: mockSurvey.description,
          status: 'inactive',
          settings: mockSurvey.settings,
        });
        expect(result).toEqual(clonedSurvey);
      });
    });

    it('should handle errors when fetching original survey fails', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.clone('survey-123', 'Cloned Survey').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalled();
          expect(err).toBe(error);
        },
      });
    });
  });
});
