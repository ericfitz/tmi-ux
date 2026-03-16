// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ProjectService } from './project.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { ListProjectsResponse, Project, ProjectInput } from '@app/types/project.types';

describe('ProjectService', () => {
  let service: ProjectService;
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
  };

  const mockListResponse: ListProjectsResponse = {
    projects: [
      {
        id: 'proj-1',
        name: 'Project Alpha',
        description: 'First project',
        status: 'active',
        team_id: 'team-1',
        team_name: 'Team A',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'proj-2',
        name: 'Project Beta',
        description: null,
        status: 'planning',
        team_id: 'team-2',
        created_at: '2024-02-01T00:00:00Z',
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
  };

  const mockProject: Project = {
    id: 'proj-new',
    name: 'New Project',
    description: 'A new project',
    team_id: 'team-1',
    uri: 'https://example.com',
    status: 'active',
    created_at: '2024-03-01T00:00:00Z',
  };

  beforeEach(() => {
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
    };
    service = new ProjectService(
      mockApiService as unknown as ApiService,
      mockLoggerService as unknown as LoggerService,
    );
  });

  describe('list()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(response => {
        expect(response).toEqual(mockListResponse);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('projects', undefined);
    });

    it('should pass filter parameters', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list({ limit: 50, offset: 10, name: 'test' }).subscribe();

      const params = mockApiService.get.mock.calls[0][1] as Record<string, unknown>;
      expect(params['limit']).toBe(50);
      expect(params['offset']).toBe(10);
      expect(params['name']).toBe('test');
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockListResponse));

      service.list().subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Projects loaded', {
          count: 2,
          total: 2,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('List failed');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.list().subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list projects', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    const input = {
      name: 'New Project',
      description: 'A new project',
      team_id: 'team-1',
      uri: 'https://example.com',
      status: 'active',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.post.mockReturnValue(of(mockProject));

      service.create(input).subscribe(response => {
        expect(response).toEqual(mockProject);
      });

      expect(mockApiService.post).toHaveBeenCalledWith('projects', input);
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockProject));

      service.create(input).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project created', {
          id: 'proj-new',
          name: 'New Project',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Create failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(input).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create project', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('get()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockProject));
      service.get('proj-new').subscribe(result => {
        expect(result).toEqual(mockProject);
      });
      expect(mockApiService.get).toHaveBeenCalledWith('projects/proj-new');
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockProject));
      service.get('proj-new').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Project loaded', { id: 'proj-new' });
      });
    });

    it('should handle errors', () => {
      const error = new Error('Failed');
      mockApiService.get.mockReturnValue(throwError(() => error));
      service.get('proj-new').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to load project', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('update()', () => {
    it('should call PUT with correct endpoint and body', () => {
      mockApiService.put.mockReturnValue(of(mockProject));
      const input: ProjectInput = { name: 'Updated', team_id: 'team-1' };
      service.update('proj-new', input).subscribe(result => {
        expect(result).toEqual(mockProject);
      });
      expect(mockApiService.put).toHaveBeenCalledWith('projects/proj-new', input);
    });

    it('should log info message on success', () => {
      mockApiService.put.mockReturnValue(of(mockProject));
      const input: ProjectInput = { name: 'Updated', team_id: 'team-1' };
      service.update('proj-new', input).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project updated', { id: 'proj-new' });
      });
    });

    it('should handle errors', () => {
      const error = new Error('Update failed');
      mockApiService.put.mockReturnValue(throwError(() => error));
      service.update('proj-new', { name: 'Updated', team_id: 'team-1' }).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update project', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('patch()', () => {
    it('should convert changes to JSON Patch operations', () => {
      mockApiService.patch.mockReturnValue(of(mockProject));
      service.patch('proj-new', { name: 'Patched' }).subscribe();
      expect(mockApiService.patch).toHaveBeenCalledWith('projects/proj-new', [
        { op: 'replace', path: '/name', value: 'Patched' },
      ]);
    });

    it('should log info message on success', () => {
      mockApiService.patch.mockReturnValue(of(mockProject));
      service.patch('proj-new', { name: 'Patched' }).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project patched', { id: 'proj-new' });
      });
    });

    it('should handle errors', () => {
      const error = new Error('Patch failed');
      mockApiService.patch.mockReturnValue(throwError(() => error));
      service.patch('proj-new', { name: 'Patched' }).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to patch project', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('delete()', () => {
    it('should call DELETE with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      service.delete('proj-new').subscribe();
      expect(mockApiService.delete).toHaveBeenCalledWith('projects/proj-new');
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      service.delete('proj-new').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project deleted', { id: 'proj-new' });
      });
    });

    it('should handle errors', () => {
      const error = new Error('Delete failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));
      service.delete('proj-new').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete project', error);
          expect(err).toBe(error);
        },
      });
    });
  });
});
