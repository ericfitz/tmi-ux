// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { TeamService } from './team.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  ListTeamsResponse,
  ListTeamNotesResponse,
  Team,
  TeamNote,
  TeamProjectNoteInput,
} from '@app/types/team.types';

describe('TeamService', () => {
  let service: TeamService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockListResponse: ListTeamsResponse = {
    teams: [
      {
        id: 'team-1',
        name: 'Team Alpha',
        description: 'First team',
        status: 'active',
        member_count: 5,
        project_count: 3,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'team-2',
        name: 'Team Beta',
        description: null,
        status: 'active',
        created_at: '2024-02-01T00:00:00Z',
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
  };

  const mockTeam: Team = {
    id: 'team-new',
    name: 'New Team',
    description: 'A new team',
    uri: 'https://example.com/teams/new',
    email_address: 'team@example.com',
    status: 'active',
    created_at: '2024-03-01T00:00:00Z',
  };

  const mockNoteListResponse: ListTeamNotesResponse = {
    notes: [
      {
        id: 'note-1',
        name: 'Security Note',
        description: 'A security note',
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-02T00:00:00Z',
      },
      {
        id: 'note-2',
        name: 'Another Note',
        created_at: '2024-02-01T00:00:00Z',
        modified_at: '2024-02-02T00:00:00Z',
      },
    ],
    total: 2,
    limit: 200,
    offset: 0,
  };

  const mockTeamNote: TeamNote = {
    id: 'note-1',
    name: 'Security Note',
    content: '## Security considerations\n\nSome content here.',
    description: 'A security note',
    timmy_enabled: false,
    sharable: true,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-02T00:00:00Z',
  };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };
    mockLoggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
    service = new TeamService(
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

      expect(mockApiService.get).toHaveBeenCalledWith('teams', undefined);
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
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Teams loaded', {
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
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list teams', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('create()', () => {
    const input = {
      name: 'New Team',
      description: 'A new team',
      uri: 'https://example.com/teams/new',
      email_address: 'team@example.com',
      status: 'active',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.post.mockReturnValue(of(mockTeam));

      service.create(input).subscribe(response => {
        expect(response).toEqual(mockTeam);
      });

      expect(mockApiService.post).toHaveBeenCalledWith('teams', input);
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockTeam));

      service.create(input).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Team created', {
          id: 'team-new',
          name: 'New Team',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Create failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.create(input).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create team', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('listNotes()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes('team-1').subscribe(response => {
        expect(response).toEqual(mockNoteListResponse);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('teams/team-1/notes', undefined);
    });

    it('should pass limit and offset parameters', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes('team-1', 50, 10).subscribe();

      const params = mockApiService.get.mock.calls[0][1] as Record<string, unknown>;
      expect(params['limit']).toBe(50);
      expect(params['offset']).toBe(10);
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));

      service.listNotes('team-1').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Team notes loaded', {
          teamId: 'team-1',
          count: 2,
          total: 2,
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('List notes failed');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.listNotes('team-1').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to list team notes', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('getNoteById()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockTeamNote));

      service.getNoteById('team-1', 'note-1').subscribe(response => {
        expect(response).toEqual(mockTeamNote);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('teams/team-1/notes/note-1');
    });

    it('should log debug message on success', () => {
      mockApiService.get.mockReturnValue(of(mockTeamNote));

      service.getNoteById('team-1', 'note-1').subscribe(() => {
        expect(mockLoggerService.debug).toHaveBeenCalledWith('Team note loaded', {
          teamId: 'team-1',
          noteId: 'note-1',
        });
      });
    });

    it('should return undefined on error', () => {
      const error = new Error('Not found');
      mockApiService.get.mockReturnValue(throwError(() => error));

      service.getNoteById('team-1', 'note-1').subscribe(result => {
        expect(result).toBeUndefined();
        expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to load team note', error);
      });
    });
  });

  describe('createNote()', () => {
    const noteInput: Partial<TeamProjectNoteInput> = {
      name: 'New Note',
      content: '## Content\n\nSome text.',
      description: 'A new note',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.post.mockReturnValue(of(mockTeamNote));

      service.createNote('team-1', noteInput).subscribe(response => {
        expect(response).toEqual(mockTeamNote);
      });

      expect(mockApiService.post).toHaveBeenCalledWith('teams/team-1/notes', noteInput);
    });

    it('should log info message on success', () => {
      mockApiService.post.mockReturnValue(of(mockTeamNote));

      service.createNote('team-1', noteInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Team note created', {
          teamId: 'team-1',
          noteId: 'note-1',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Create note failed');
      mockApiService.post.mockReturnValue(throwError(() => error));

      service.createNote('team-1', noteInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to create team note', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('updateNote()', () => {
    const noteInput: Partial<TeamProjectNoteInput> = {
      name: 'Updated Note',
      content: '## Updated Content\n\nUpdated text.',
    };

    it('should call API with correct endpoint and body', () => {
      mockApiService.put.mockReturnValue(of(mockTeamNote));

      service.updateNote('team-1', 'note-1', noteInput).subscribe(response => {
        expect(response).toEqual(mockTeamNote);
      });

      expect(mockApiService.put).toHaveBeenCalledWith('teams/team-1/notes/note-1', noteInput);
    });

    it('should log info message on success', () => {
      mockApiService.put.mockReturnValue(of(mockTeamNote));

      service.updateNote('team-1', 'note-1', noteInput).subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Team note updated', {
          teamId: 'team-1',
          noteId: 'note-1',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Update note failed');
      mockApiService.put.mockReturnValue(throwError(() => error));

      service.updateNote('team-1', 'note-1', noteInput).subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to update team note', error);
          expect(err).toBe(error);
        },
      });
    });
  });

  describe('deleteNote()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteNote('team-1', 'note-1').subscribe(result => {
        expect(result).toBe(true);
      });

      expect(mockApiService.delete).toHaveBeenCalledWith('teams/team-1/notes/note-1');
    });

    it('should log info message on success', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteNote('team-1', 'note-1').subscribe(() => {
        expect(mockLoggerService.info).toHaveBeenCalledWith('Team note deleted', {
          teamId: 'team-1',
          noteId: 'note-1',
        });
      });
    });

    it('should handle API errors and log them', () => {
      const error = new Error('Delete note failed');
      mockApiService.delete.mockReturnValue(throwError(() => error));

      service.deleteNote('team-1', 'note-1').subscribe({
        error: err => {
          expect(mockLoggerService.error).toHaveBeenCalledWith('Failed to delete team note', error);
          expect(err).toBe(error);
        },
      });
    });
  });
});
