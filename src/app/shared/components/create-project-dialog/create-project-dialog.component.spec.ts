// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from './create-project-dialog.component';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';

describe('CreateProjectDialogComponent', () => {
  let component: CreateProjectDialogComponent;
  let envInjector: EnvironmentInjector;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockTeamService: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockTeamService = {
      list: vi.fn().mockReturnValue(
        of({
          teams: [
            { id: 'team-1', name: 'Team A', created_at: '2024-01-01T00:00:00Z' },
            { id: 'team-2', name: 'Team B', created_at: '2024-02-01T00:00:00Z' },
          ],
          total: 2,
          limit: 200,
          offset: 0,
        }),
      ),
      create: vi.fn(),
    };
    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    envInjector = createEnvironmentInjector([], {
      get: (token: unknown) => {
        if (token === EnvironmentInjector) return envInjector;
        return undefined;
      },
    } as EnvironmentInjector);

    runInInjectionContext(envInjector, () => {
      component = new CreateProjectDialogComponent(
        mockDialogRef as any,
        new FormBuilder(),
        mockDialog as any,
        mockTeamService as unknown as TeamService,
        mockLoggerService as unknown as LoggerService,
      );
    });
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('form initialization', () => {
    it('should have empty name by default', () => {
      expect(component.form.get('name')?.value).toBe('');
    });

    it('should have empty description by default', () => {
      expect(component.form.get('description')?.value).toBe('');
    });

    it('should have empty team_id by default', () => {
      expect(component.form.get('team_id')?.value).toBe('');
    });

    it('should have empty uri by default', () => {
      expect(component.form.get('uri')?.value).toBe('');
    });

    it('should have empty status by default', () => {
      expect(component.form.get('status')?.value).toBe('');
    });
  });

  describe('form validation', () => {
    it('should be invalid when name is empty', () => {
      expect(component.form.invalid).toBe(true);
    });

    it('should be invalid when name is provided but team_id is empty', () => {
      component.form.patchValue({ name: 'Test Project' });
      expect(component.form.invalid).toBe(true);
    });

    it('should be valid when name and team_id are provided', () => {
      component.form.patchValue({ name: 'Test Project', team_id: 'team-1' });
      expect(component.form.valid).toBe(true);
    });

    it('should be invalid when name exceeds 256 characters', () => {
      component.form.patchValue({
        name: 'a'.repeat(257),
        team_id: 'team-1',
      });
      expect(component.form.get('name')?.hasError('maxlength')).toBe(true);
    });

    it('should be invalid when description exceeds 1024 characters', () => {
      component.form.patchValue({
        name: 'Valid Name',
        team_id: 'team-1',
        description: 'a'.repeat(1025),
      });
      expect(component.form.get('description')?.hasError('maxlength')).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should load teams on init', () => {
      runInInjectionContext(envInjector, () => {
        component.ngOnInit();
      });

      expect(mockTeamService.list).toHaveBeenCalledWith({ limit: 200 });
      expect(component.teams).toHaveLength(2);
      expect(component.loadingTeams).toBe(false);
    });
  });

  describe('onCreate', () => {
    it('should close dialog with trimmed name and team_id', () => {
      component.form.patchValue({
        name: '  My Project  ',
        team_id: 'team-1',
      });

      component.onCreate();

      const result = mockDialogRef.close.mock.calls[0][0] as CreateProjectDialogResult;
      expect(result.name).toBe('My Project');
      expect(result.team_id).toBe('team-1');
      expect(result.description).toBeUndefined();
      expect(result.uri).toBeUndefined();
      expect(result.status).toBeUndefined();
    });

    it('should include all non-empty fields in result', () => {
      component.form.patchValue({
        name: '  My Project  ',
        description: '  A description  ',
        team_id: 'team-1',
        uri: 'https://example.com',
        status: 'active',
      });

      component.onCreate();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        name: 'My Project',
        description: 'A description',
        team_id: 'team-1',
        uri: 'https://example.com',
        status: 'active',
      } as CreateProjectDialogResult);
    });

    it('should not close dialog when form is invalid', () => {
      component.onCreate();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('should close dialog without result', () => {
      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
