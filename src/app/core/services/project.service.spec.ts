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
import {
  ListProjectsResponse,
  ListProjectNotesResponse,
  Project,
  ProjectInput,
  ProjectNote,
} from '@app/types/project.types';

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

  const mockNote: ProjectNote = {
    id: 'note-1',
    name: 'Test Note',
    content: '# Test\n\nThis is a test note.',
    description: 'A test note',
    timmy_enabled: false,
    sharable: true,
    created_at: '2024-04-01T00:00:00Z',
    modified_at: '2024-04-01T00:00:00Z',
  };

  const mockNoteListResponse: ListProjectNotesResponse = {
    notes: [
      {
        id: 'note-1',
        name: 'Test Note',
        description: 'A test note',
        created_at: '2024-04-01T00:00:00Z',
        modified_at: '2024-04-01T00:00:00Z',
      },
      {
        id: 'note-2',
        name: 'Another Note',
        created_at: '2024-04-02T00:00:00Z',
        modified_at: '2024-04-02T00:00:00Z',
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
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

  describe('listNotes()', () => {
    const projectId = 'proj-1';

    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes(projectId).subscribe(response => {
        expect(response).toEqual(mockNoteListResponse);
      });

      expect(mockApiService.get).toHaveBeenCalledWith(`projects/${projectId}/notes`, undefined);
    });

    it('should pass limit and offset parameters', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes(projectId, 50, 10).subscribe();

      const params = mockApiService.get.mock.calls[0][1] as Record<string, unknown>;
      expect(params['limit']).toBe(50);
      expect(params['offset']).toBe(10);
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes(projectId).subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Project notes loaded', {
          projectId,
          count: 2,
          total: 2,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('List notes failed');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listNotes(projectId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to list project notes',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getNoteById()', () => {
    const projectId = 'proj-1';
    const noteId = 'note-1';

    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockNote));

      service.getNoteById(projectId, noteId).subscribe(note => {
        expect(note).toEqual(mockNote);
      });

      expect(mockApiService.get).toHaveBeenCalledWith(`projects/${projectId}/notes/${noteId}`);
    });

    it('should return undefined on error', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getNoteById(projectId, noteId).subscribe(note => {
        expect(note).toBeUndefined();
      });
    });

    it('should log error on API failure', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getNoteById(projectId, noteId).subscribe(() => {
        expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to load project note', error);
      });
    });
  });

  describe('createNote()', () => {
    const projectId = 'proj-1';
    const noteInput = {
      name: 'Test Note',
      content: '# Test\n\nThis is a test note.',
      description: 'A test note',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.post.mockReturnValue(of(mockNote));

      service.createNote(projectId, noteInput).subscribe(note => {
        expect(note).toEqual(mockNote);
      });

      expect(mockApiService.post).toHaveBeenCalledWith(`projects/${projectId}/notes`, noteInput);
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockNote));

      service.createNote(projectId, noteInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project note created', {
          projectId,
          id: 'note-1',
          name: 'Test Note',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Create note failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createNote(projectId, noteInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to create project note',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('updateNote()', () => {
    const projectId = 'proj-1';
    const noteId = 'note-1';
    const noteUpdate = {
      name: 'Updated Note',
      content: '# Updated\n\nThis is updated.',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.put.mockReturnValue(of(mockNote));

      service.updateNote(projectId, noteId, noteUpdate).subscribe(note => {
        expect(note).toEqual(mockNote);
      });

      expect(mockApiService.put).toHaveBeenCalledWith(
        `projects/${projectId}/notes/${noteId}`,
        noteUpdate,
      );
    });

    it('should log info message on success', () => {
      mockApiService.put.mockReturnValue(of(mockNote));

      service.updateNote(projectId, noteId, noteUpdate).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project note updated', {
          projectId,
          id: 'note-1',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update note failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.updateNote(projectId, noteId, noteUpdate).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to update project note',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('deleteNote()', () => {
    const projectId = 'proj-1';
    const noteId = 'note-1';

    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(null));

      service.deleteNote(projectId, noteId).subscribe(result => {
        expect(result).toBe(true);
      });

      expect(mockApiService.delete).toHaveBeenCalledWith(`projects/${projectId}/notes/${noteId}`);
    });

    it('should map response to true on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteNote(projectId, noteId).subscribe(result => {
        expect(result).toBe(true);
      });
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(null));

      service.deleteNote(projectId, noteId).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Project note deleted', {
          projectId,
          noteId,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete note failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteNote(projectId, noteId).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith(
            'Failed to delete project note',
            error,
          );
          expect(err).toBe(error);
        },
      });
    });
  });
});
