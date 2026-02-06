// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SurveyTemplateService } from './survey-template.service';
import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  SurveyTemplate,
  ListSurveyTemplatesResponse,
  CreateSurveyTemplateRequest,
  UpdateSurveyTemplateRequest,
  SurveyVersion,
  SurveyJsonSchema,
} from '@app/types/survey.types';

describe('SurveyTemplateService', () => {
  let service: SurveyTemplateService;
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

  const mockTemplate: SurveyTemplate = {
    id: 'template-123',
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

  const mockListResponse: ListSurveyTemplatesResponse = {
    survey_templates: [
      {
        id: 'template-123',
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

  const mockVersion: SurveyVersion = {
    id: 'version-1',
    template_id: 'template-123',
    version: '2024-Q1',
    survey_json: mockSurveyJson,
    created_at: '2024-01-01T00:00:00Z',
    created_by: { id: 'user-1', name: 'Admin User' },
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

    service = new SurveyTemplateService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty templates observable', () => {
      service.templates$.subscribe(templates => {
        expect(templates).toEqual([]);
      });
    });
  });

  describe('listAdmin()', () => {
    it('should call API with correct endpoint and no params when no filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', undefined);
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should build query params from filter', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin({ status: 'active', limit: 10 }).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', {
          status: 'active',
          limit: 10,
        });
      });
    });

    it('should update templates$ observable', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(() => {
        service.templates$.subscribe(templates => {
          expect(templates).toEqual(mockListResponse.survey_templates);
        });
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listAdmin().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Survey templates loaded', {
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
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list survey templates',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listActive()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.listActive().subscribe(response => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/templates');
        expect(response).toEqual(mockListResponse);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listActive().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list active survey templates',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getById()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockTemplate));

      service.getById('template-123').subscribe(template => {
        expect(mockApiService.get).toHaveBeenCalledWith('intake/templates/template-123');
        expect(template).toEqual(mockTemplate);
      });
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockTemplate));

      service.getById('template-123').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Survey template loaded', {
          id: 'template-123',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getById('template-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get survey template',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getByIdAdmin()', () => {
    it('should call API with admin endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockTemplate));

      service.getByIdAdmin('template-123').subscribe(template => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates/template-123');
        expect(template).toEqual(mockTemplate);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Forbidden');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getByIdAdmin('template-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get survey template (admin)',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getSurveyJson()', () => {
    it('should return only the survey_json from template', () => {
      mockApiService.get.mockReturnValue(of(mockTemplate));

      service.getSurveyJson('template-123').subscribe(json => {
        expect(json).toEqual(mockSurveyJson);
      });
    });
  });

  describe('getVersionJson()', () => {
    it('should call API with correct versioned endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockVersion));

      service.getVersionJson('template-123', 'v1').subscribe(json => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          'intake/templates/template-123/versions/v1',
        );
        expect(json).toEqual(mockSurveyJson);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Version not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getVersionJson('template-123', 'v1').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get survey version',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getVersion()', () => {
    it('should call API with admin versioned endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockVersion));

      service.getVersion('template-123', 'v1').subscribe(version => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          'admin/survey_templates/template-123/versions/v1',
        );
        expect(version).toEqual(mockVersion);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Version not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getVersion('template-123', 'v1').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to get survey version',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listVersions()', () => {
    it('should call API with correct endpoint', () => {
      const versions = [mockVersion];
      mockApiService.get.mockReturnValue(of(versions));

      service.listVersions('template-123').subscribe(result => {
        expect(mockApiService.get).toHaveBeenCalledWith(
          'admin/survey_templates/template-123/versions',
        );
        expect(result).toEqual(versions);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('API Error');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listVersions('template-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list survey versions',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    const createRequest: CreateSurveyTemplateRequest = {
      name: 'New Template',
      version: 'v1',
      survey_json: mockSurveyJson,
      description: 'A new template',
      status: 'inactive',
    };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.post.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(template => {
        expect(mockApiService.post).toHaveBeenCalledWith('admin/survey_templates', createRequest);
        expect(template).toEqual(mockTemplate);
      });
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Survey template created', {
          id: 'template-123',
        });
      });
    });

    it('should refresh template list after creation', () => {
      mockApiService.post.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.create(createRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Creation failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(createRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create survey template',
            error,
          );
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
    const updateRequest: UpdateSurveyTemplateRequest = {
      name: 'Updated Template',
      version: 'v2',
      survey_json: mockSurveyJson,
      description: 'Updated description',
    };

    it('should call API with correct endpoint and payload', () => {
      mockApiService.put.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update('template-123', updateRequest).subscribe(template => {
        expect(mockApiService.put).toHaveBeenCalledWith(
          'admin/survey_templates/template-123',
          updateRequest,
        );
        expect(template).toEqual(mockTemplate);
      });
    });

    it('should refresh template list after update', () => {
      mockApiService.put.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.update('template-123', updateRequest).subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.update('template-123', updateRequest).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to update survey template',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('setStatus()', () => {
    it('should call API with correct PATCH payload', () => {
      mockApiService.patch.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.setStatus('template-123', 'active').subscribe(template => {
        expect(mockApiService.patch).toHaveBeenCalledWith('admin/survey_templates/template-123', [
          { op: 'replace', path: '/status', value: 'active' },
        ]);
        expect(template).toEqual(mockTemplate);
      });
    });

    it('should refresh template list after status change', () => {
      mockApiService.patch.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.setStatus('template-123', 'active').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Status update failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));

      service.setStatus('template-123', 'active').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to update survey template status',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('archive()', () => {
    it('should delegate to setStatus with archived status', () => {
      mockApiService.patch.mockReturnValue(of(mockTemplate));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.archive('template-123').subscribe(() => {
        expect(mockApiService.patch).toHaveBeenCalledWith('admin/survey_templates/template-123', [
          { op: 'replace', path: '/status', value: 'archived' },
        ]);
      });
    });
  });

  describe('deleteTemplate()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteTemplate('template-123').subscribe(() => {
        expect(mockApiService.delete).toHaveBeenCalledWith('admin/survey_templates/template-123');
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteTemplate('template-123').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Survey template deleted', {
          id: 'template-123',
        });
      });
    });

    it('should refresh template list after deletion', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.deleteTemplate('template-123').subscribe(() => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates', undefined);
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteTemplate('template-123').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to delete survey template',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });

    it('should not refresh list if deletion fails', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteTemplate('template-123').subscribe({
        error: () => {
          expect(mockApiService.get).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('clone()', () => {
    it('should fetch original template and create a new one', () => {
      mockApiService.get.mockImplementation((url: string) => {
        if (url === 'admin/survey_templates/template-123') {
          return of(mockTemplate);
        }
        return of(mockListResponse);
      });
      const clonedTemplate = { ...mockTemplate, id: 'template-456', name: 'Cloned Template' };
      mockApiService.post.mockReturnValue(of(clonedTemplate));

      service.clone('template-123', 'Cloned Template').subscribe(result => {
        expect(mockApiService.get).toHaveBeenCalledWith('admin/survey_templates/template-123');
        expect(mockApiService.post).toHaveBeenCalledWith('admin/survey_templates', {
          name: 'Cloned Template',
          version: mockTemplate.version,
          survey_json: mockTemplate.survey_json,
          description: mockTemplate.description,
          status: 'inactive',
          settings: mockTemplate.settings,
        });
        expect(result).toEqual(clonedTemplate);
      });
    });

    it('should handle errors when fetching original template fails', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.clone('template-123', 'Cloned Template').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalled();
          expect(err).toBe(error);
        },
      });
    });
  });
});
