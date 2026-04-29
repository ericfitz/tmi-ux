# Response Detail Read-Only Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the response detail page (`/intake/response/:responseId`) fully read-only by replacing the editable project picker with a static project name display.

**Architecture:** Remove `ProjectPickerComponent` and `onProjectChange()` from `ResponseDetailComponent`. Inject `ProjectService` to resolve the project name from ID. Display project as a static info item in the existing info grid.

**Tech Stack:** Angular 19, Vitest, Transloco (i18n), Angular Material

---

### Task 1: Write the spec file with failing tests

**Files:**
- Create: `src/app/pages/surveys/components/response-detail/response-detail.component.spec.ts`

- [ ] **Step 1: Create the spec file with tests for read-only behavior**

```typescript
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
import {
  createTypedMockLoggerService,
  type MockLoggerService,
} from '../../../../../testing/mocks';
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
      mockResponseService.getById.mockReturnValue(
        of(createMockResponse({ project_id: null })),
      );

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/app/pages/surveys/components/response-detail/response-detail.component.spec.ts`

Expected: FAIL — `ResponseDetailComponent` constructor does not accept `ProjectService`, `projectName` property does not exist, `onProjectChange` still exists.

---

### Task 2: Update the component TypeScript

**Files:**
- Modify: `src/app/pages/surveys/components/response-detail/response-detail.component.ts`

- [ ] **Step 1: Remove ProjectPickerComponent import and add ProjectService**

Replace the import line:

```typescript
import { ProjectPickerComponent } from '@app/shared/components/project-picker/project-picker.component';
```

with:

```typescript
import { ProjectService } from '@app/core/services/project.service';
```

- [ ] **Step 2: Remove ProjectPickerComponent from the imports array**

In the `@Component` decorator `imports` array, remove `ProjectPickerComponent`.

- [ ] **Step 3: Add projectName property and ProjectService injection**

Add the `projectName` property alongside the other component state:

```typescript
projectName: string | null = null;
```

Update the constructor to inject `ProjectService` (insert between `SurveyResponseService` and `LoggerService`):

```typescript
constructor(
  private route: ActivatedRoute,
  private router: Router,
  private surveyService: SurveyService,
  private responseService: SurveyResponseService,
  private projectService: ProjectService,
  private logger: LoggerService,
  private cdr: ChangeDetectorRef,
) {}
```

- [ ] **Step 4: Add project name resolution in loadResponse**

In the `loadResponse()` method's `next` callback, after the existing survey initialization logic and before `this.cdr.markForCheck()`, add the project name resolution. The updated `next` callback for the primary path (when `response.survey_json` exists) should be:

```typescript
next: response => {
  this.response = response;

  // Resolve project name
  if (response.project_id) {
    this.loadProjectName(response.project_id);
  }

  // Use the survey_json snapshot from the response if available
  if (response.survey_json) {
    this.surveyJson = response.survey_json;
    this.initializeSurvey();
    this.loading = false;
    this.cdr.markForCheck();
  } else {
    // Fallback: fetch from template service
    this.loadSurveyJson(response.survey_id);
  }
},
```

- [ ] **Step 5: Add the loadProjectName method**

Add this private method after `loadSurveyJson`:

```typescript
/**
 * Resolve project name from project ID
 */
private loadProjectName(projectId: string): void {
  this.projectService
    .get(projectId)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: project => {
        this.projectName = project.name;
        this.cdr.markForCheck();
      },
      error: error => {
        this.logger.error('Failed to load project', error);
        this.projectName = null;
        this.cdr.markForCheck();
      },
    });
}
```

- [ ] **Step 6: Remove the onProjectChange method**

Delete the entire `onProjectChange` method (lines 210-234 in the current file).

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run src/app/pages/surveys/components/response-detail/response-detail.component.spec.ts`

Expected: PASS — all tests should pass now.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/surveys/components/response-detail/response-detail.component.ts src/app/pages/surveys/components/response-detail/response-detail.component.spec.ts
git commit -m "fix: replace editable project picker with static display in response detail (#550)"
```

---

### Task 3: Update the template and styles

**Files:**
- Modify: `src/app/pages/surveys/components/response-detail/response-detail.component.html`
- Modify: `src/app/pages/surveys/components/response-detail/response-detail.component.scss`

- [ ] **Step 1: Replace the project picker section in the template**

Replace lines 77-83 (the `<div class="project-picker-section">` block):

```html
        <div class="project-picker-section">
          <app-project-picker
            [projectId]="response.project_id ?? null"
            (projectChange)="onProjectChange($event)"
          />
        </div>
```

with a static info item inside the `info-grid` div, after the last `@if` block (after the threat model link) and before the closing `</div>` of `info-grid`:

```html
          @if (response.project_id) {
            <div class="info-item">
              <span class="info-label">{{ 'common.project' | transloco }}</span>
              <span class="info-value">{{ projectName ?? ('common.loading' | transloco) }}</span>
            </div>
          }
```

This means moving the project display from below the info grid into the grid itself, as a peer of the other info items.

- [ ] **Step 2: Remove the project-picker-section styles**

In `response-detail.component.scss`, delete the `.project-picker-section` block (lines 112-115):

```scss
  .project-picker-section {
    padding-top: 16px;
    max-width: 400px;
  }
```

- [ ] **Step 3: Add the i18n key if missing**

Check if `common.project` exists in `src/assets/i18n/en-US.json`. The key `"project": "Project"` exists at line 692 under the `common` section — verify its path is `common.project`. If it's nested differently, use the correct key path in the template.

Run: `grep -n '"project"' src/assets/i18n/en-US.json` to confirm.

- [ ] **Step 4: Run the full test suite for surveys**

Run: `pnpm vitest run src/app/pages/surveys/`

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/surveys/components/response-detail/response-detail.component.html src/app/pages/surveys/components/response-detail/response-detail.component.scss
git commit -m "fix: replace project picker with static text in response detail template (#550)"
```

---

### Task 4: Lint, build, and final verification

**Files:** None (verification only)

- [ ] **Step 1: Run linter**

Run: `pnpm run lint:all`

Expected: No errors. Fix any that appear.

- [ ] **Step 2: Run build**

Run: `pnpm run build`

Expected: Clean build with no errors. In particular, verify no references to `ProjectPickerComponent` or `onProjectChange` remain in the response detail files.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`

Expected: All tests pass, including the new spec.

- [ ] **Step 4: Commit any lint/build fixes if needed**

Only if Steps 1-3 required changes:

```bash
git add -A
git commit -m "fix: address lint and build issues for response detail readonly fix (#550)"
```
