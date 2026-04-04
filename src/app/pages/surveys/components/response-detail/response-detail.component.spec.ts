import '@angular/compiler';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Injector, DestroyRef, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ResponseDetailComponent } from './response-detail.component';
import { SurveyService } from '../../services/survey.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyThemeService } from '../../services/survey-theme.service';
import { ThemeService } from '@app/core/services/theme.service';
import { ProjectService } from '@app/core/services/project.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';
import { SurveyResponse, ResponseStatus } from '@app/types/survey.types';
import { Project } from '@app/types/project.types';

interface MockSurveyService {
  getSurveyJson: ReturnType<typeof vi.fn>;
}

interface MockSurveyResponseService {
  getById: ReturnType<typeof vi.fn>;
}

interface MockSurveyThemeService {
  getTheme: ReturnType<typeof vi.fn>;
  theme$: ReturnType<typeof of>;
}

interface MockProjectService {
  get: ReturnType<typeof vi.fn>;
}

function createMockResponse(overrides: Partial<SurveyResponse> = {}): SurveyResponse {
  return {
    id: 'response-1',
    survey_id: 'survey-1',
    survey_version: '1',
    status: 'submitted' as ResponseStatus,
    is_confidential: false,
    answers: {},
    owner: 'user@example.com',
    created_at: '2026-01-01T00:00:00Z',
    project_id: 'project-uuid-123',
    survey_json: { title: 'Test Survey', pages: [] },
    ...overrides,
  } as SurveyResponse;
}

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-uuid-123',
    name: 'My Test Project',
    team_id: 'team-1',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Project;
}

describe('ResponseDetailComponent', () => {
  let component: ResponseDetailComponent;
  let injector: Injector;
  let mockRoute: { snapshot: { paramMap: { get: ReturnType<typeof vi.fn> } } };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockSurveyService: MockSurveyService;
  let mockResponseService: MockSurveyResponseService;
  let mockLogger: MockLoggerService;
  let mockCdr: { markForCheck: ReturnType<typeof vi.fn> };
  let mockThemeService: { getCurrentTheme: ReturnType<typeof vi.fn> };
  let mockSurveyThemeService: MockSurveyThemeService;
  let mockProjectService: MockProjectService;

  beforeEach(() => {
    mockRoute = {
      snapshot: { paramMap: { get: vi.fn().mockReturnValue('response-1') } },
    };
    mockRouter = { navigate: vi.fn() };
    mockSurveyService = { getSurveyJson: vi.fn().mockReturnValue(of({})) };
    mockResponseService = {
      getById: vi.fn().mockReturnValue(of(createMockResponse())),
    };
    mockLogger = createTypedMockLoggerService();
    mockCdr = { markForCheck: vi.fn() };
    mockThemeService = { getCurrentTheme: vi.fn().mockReturnValue('light') };
    mockSurveyThemeService = {
      getTheme: vi.fn().mockReturnValue({}),
      theme$: of({}),
    };
    mockProjectService = {
      get: vi.fn().mockReturnValue(of(createMockProject())),
    };

    injector = Injector.create({
      providers: [
        { provide: DestroyRef, useValue: { onDestroy: vi.fn() } },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: SurveyThemeService, useValue: mockSurveyThemeService },
      ],
    });

    component = runInInjectionContext(injector, () => {
      return new ResponseDetailComponent(
        mockRoute as unknown as ActivatedRoute,
        mockRouter as unknown as Router,
        mockSurveyService as unknown as SurveyService,
        mockResponseService as unknown as SurveyResponseService,
        mockProjectService as unknown as ProjectService,
        mockLogger as any,
        mockCdr as unknown as ChangeDetectorRef,
      );
    });
  });

  describe('project display', () => {
    it('should resolve and store the project name when project_id is set', () => {
      component.ngOnInit();

      expect(mockProjectService.get).toHaveBeenCalledWith('project-uuid-123');
      expect(component.projectName).toBe('My Test Project');
    });

    it('should not call ProjectService when project_id is null', () => {
      mockResponseService.getById.mockReturnValue(of(createMockResponse({ project_id: null })));

      component.ngOnInit();

      expect(mockProjectService.get).not.toHaveBeenCalled();
      expect(component.projectName).toBeNull();
    });

    it('should not call ProjectService when project_id is undefined', () => {
      mockResponseService.getById.mockReturnValue(
        of(createMockResponse({ project_id: undefined })),
      );

      component.ngOnInit();

      expect(mockProjectService.get).not.toHaveBeenCalled();
      expect(component.projectName).toBeNull();
    });

    it('should handle ProjectService error gracefully', () => {
      mockProjectService.get.mockReturnValue(throwError(() => new Error('Not found')));

      component.ngOnInit();

      expect(mockProjectService.get).toHaveBeenCalledWith('project-uuid-123');
      expect(component.projectName).toBeNull();
    });
  });

  describe('read-only enforcement', () => {
    it('should not have an onProjectChange method', () => {
      expect((component as any).onProjectChange).toBeUndefined();
    });
  });
});
