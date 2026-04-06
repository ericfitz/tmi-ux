# Team & Project Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add note management (list, create, edit, delete) to team and project edit dialogs, with a shared note editor dialog refactored from the TM-specific version.

**Architecture:** Refactor the existing `NoteEditorDialogComponent` to be entity-agnostic (controlled by a `NoteEntityType` discriminator) and move it to `shared/components/`. Add note CRUD methods to `TeamService` and `ProjectService`. Convert the edit team/project dialogs to tabbed layouts with Details and Notes tabs.

**Tech Stack:** Angular 19, Angular Material (tabs, table, dialog, paginator), Vitest, RxJS, Transloco i18n

**Spec:** `docs/superpowers/specs/2026-04-05-team-project-notes-design.md`

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src/app/types/team.types.ts` | Add `TeamProjectNoteInput`, `TeamNote`, `TeamNoteListItem`, `ListTeamNotesResponse` |
| Modify | `src/app/types/project.types.ts` | Add `ProjectNote`, `ProjectNoteListItem`, `ListProjectNotesResponse` |
| Modify | `src/app/core/services/team.service.ts` | Add note CRUD methods |
| Modify | `src/app/core/services/team.service.spec.ts` | Add tests for note CRUD methods |
| Modify | `src/app/core/services/project.service.ts` | Add note CRUD methods |
| Create | `src/app/core/services/project.service.spec.ts` | Add tests for note CRUD methods |
| Move | `src/app/pages/tm/components/note-editor-dialog/` → `src/app/shared/components/note-editor-dialog/` | Make note editor shared |
| Modify | `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.ts` | Add `NoteEntityType`, `NoteEditorNote`, conditional checkboxes |
| Modify | `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.html` | Conditional `include_in_report` / `sharable` rendering |
| Modify | `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.scss` | Update SCSS import path |
| Modify | `src/app/pages/tm/tm-edit.component.ts` | Update import path, pass `entityType: 'threat_model'` |
| Modify | `src/app/pages/tm/components/note-page/note-page.component.scss` | No change needed (doesn't import note-editor-dialog) |
| Modify | `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts` | Add tabbed layout with Notes tab |
| Modify | `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts` | Add tabbed layout with Notes tab |
| Modify | `src/assets/i18n/en-US.json` | Add `notes.*` and `noteEditor.sharable*` i18n keys |
| Modify | `src/assets/i18n/*.json` (15 locales) | Backfill translations |

---

### Task 1: Add type definitions for team and project notes

**Files:**
- Modify: `src/app/types/team.types.ts`
- Modify: `src/app/types/project.types.ts`

- [ ] **Step 1: Add team note types to `team.types.ts`**

Add the following after the `ListTeamsResponse` interface (around line 173):

```typescript
/** Base fields for team/project notes (user-writable) */
export interface TeamProjectNoteInput {
  /** Note name (required) */
  name: string;
  /** Note content in markdown format (required) */
  content: string;
  /** Description of note purpose or context */
  description?: string;
  /** Whether the Timmy AI assistant is enabled for this note */
  timmy_enabled?: boolean;
  /** Controls note visibility — true = all members, false = admins/security reviewers only */
  sharable?: boolean;
}

/** Summary for list views (no content) */
export interface TeamNoteListItem {
  /** Note identifier (UUID) */
  id: string;
  /** Note name */
  name: string;
  /** Note description */
  description?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
}

/** Full team note with content */
export interface TeamNote extends TeamProjectNoteInput {
  /** Note identifier (UUID, readonly) */
  readonly id: string;
  /** Creation timestamp (readonly) */
  readonly created_at: string;
  /** Last modification timestamp (readonly) */
  readonly modified_at: string;
}

/** Paginated list of team notes */
export interface ListTeamNotesResponse {
  /** Array of team note summaries */
  notes: TeamNoteListItem[];
  /** Total number of notes */
  total: number;
  /** Maximum number of results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
}
```

- [ ] **Step 2: Add project note types to `project.types.ts`**

Add import of `TeamProjectNoteInput` at the top (update existing import line):

```typescript
import { ResponsibleParty, RelationshipType, Team, TeamProjectNoteInput } from '@app/types/team.types';
```

Add the following after the `ProjectFilter` interface (around line 142):

```typescript
/** Summary for list views (no content) */
export interface ProjectNoteListItem {
  /** Note identifier (UUID) */
  id: string;
  /** Note name */
  name: string;
  /** Note description */
  description?: string;
  /** Creation timestamp */
  created_at: string;
  /** Last modification timestamp */
  modified_at: string;
}

/** Full project note with content */
export interface ProjectNote extends TeamProjectNoteInput {
  /** Note identifier (UUID, readonly) */
  readonly id: string;
  /** Creation timestamp (readonly) */
  readonly created_at: string;
  /** Last modification timestamp (readonly) */
  readonly modified_at: string;
}

/** Paginated list of project notes */
export interface ListProjectNotesResponse {
  /** Array of project note summaries */
  notes: ProjectNoteListItem[];
  /** Total number of notes */
  total: number;
  /** Maximum number of results per page */
  limit: number;
  /** Number of results skipped */
  offset: number;
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds (new types are unused so far, which is fine — they're just declarations).

- [ ] **Step 4: Commit**

```bash
git add src/app/types/team.types.ts src/app/types/project.types.ts
git commit -m "feat(types): add team and project note type definitions (#539)"
```

---

### Task 2: Add note CRUD methods to TeamService

**Files:**
- Modify: `src/app/core/services/team.service.ts`
- Modify: `src/app/core/services/team.service.spec.ts`

- [ ] **Step 1: Write failing tests for team note CRUD**

Add to the top of `team.service.spec.ts`, update the import to include note types:

```typescript
import { ListTeamsResponse, Team, ListTeamNotesResponse, TeamNote, TeamProjectNoteInput } from '@app/types/team.types';
```

Update the `mockApiService` to include all HTTP methods:

```typescript
let mockApiService: {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
```

And in `beforeEach`:

```typescript
mockApiService = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};
```

Add the following test data after the existing `mockTeam` constant:

```typescript
const mockNoteListResponse: ListTeamNotesResponse = {
  notes: [
    {
      id: 'note-1',
      name: 'Security Review Notes',
      description: 'Notes from quarterly review',
      created_at: '2026-01-15T10:30:00Z',
      modified_at: '2026-01-15T10:30:00Z',
    },
  ],
  total: 1,
  limit: 20,
  offset: 0,
};

const mockTeamNote: TeamNote = {
  id: 'note-1',
  name: 'Security Review Notes',
  content: '# Review\n\nFindings from the quarterly review.',
  description: 'Notes from quarterly review',
  timmy_enabled: true,
  sharable: true,
  created_at: '2026-01-15T10:30:00Z',
  modified_at: '2026-01-15T10:30:00Z',
};
```

Add the following describe block at the end (inside the outer `describe`):

```typescript
describe('listNotes()', () => {
  it('should call API with correct endpoint and params', () => {
    mockApiService.get.mockReturnValue(of(mockNoteListResponse));
    service.listNotes('team-1', 20, 0).subscribe();
    expect(mockApiService.get).toHaveBeenCalledWith(
      'teams/team-1/notes',
      expect.anything(),
    );
  });

  it('should return paginated note list', () => {
    mockApiService.get.mockReturnValue(of(mockNoteListResponse));
    service.listNotes('team-1').subscribe(response => {
      expect(response.notes).toHaveLength(1);
      expect(response.total).toBe(1);
    });
  });

  it('should log and rethrow on error', () => {
    mockApiService.get.mockReturnValue(throwError(() => new Error('API error')));
    service.listNotes('team-1').subscribe({
      error: () => {
        expect(mockLoggerService.error).toHaveBeenCalled();
      },
    });
  });
});

describe('getNoteById()', () => {
  it('should call API with correct endpoint', () => {
    mockApiService.get.mockReturnValue(of(mockTeamNote));
    service.getNoteById('team-1', 'note-1').subscribe();
    expect(mockApiService.get).toHaveBeenCalledWith('teams/team-1/notes/note-1');
  });

  it('should return undefined on error', () => {
    mockApiService.get.mockReturnValue(throwError(() => new Error('Not found')));
    service.getNoteById('team-1', 'note-1').subscribe(result => {
      expect(result).toBeUndefined();
    });
  });
});

describe('createNote()', () => {
  it('should POST to correct endpoint', () => {
    mockApiService.post.mockReturnValue(of(mockTeamNote));
    const input: Partial<TeamProjectNoteInput> = {
      name: 'New Note',
      content: '# New',
    };
    service.createNote('team-1', input).subscribe();
    expect(mockApiService.post).toHaveBeenCalledWith(
      'teams/team-1/notes',
      input as Record<string, unknown>,
    );
  });
});

describe('updateNote()', () => {
  it('should PUT to correct endpoint', () => {
    mockApiService.put.mockReturnValue(of(mockTeamNote));
    const input: Partial<TeamProjectNoteInput> = { name: 'Updated' };
    service.updateNote('team-1', 'note-1', input).subscribe();
    expect(mockApiService.put).toHaveBeenCalledWith(
      'teams/team-1/notes/note-1',
      input as Record<string, unknown>,
    );
  });
});

describe('deleteNote()', () => {
  it('should DELETE correct endpoint', () => {
    mockApiService.delete.mockReturnValue(of(undefined));
    service.deleteNote('team-1', 'note-1').subscribe(result => {
      expect(result).toBe(true);
    });
    expect(mockApiService.delete).toHaveBeenCalledWith('teams/team-1/notes/note-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/core/services/team.service.spec.ts`
Expected: FAIL — `listNotes`, `getNoteById`, `createNote`, `updateNote`, `deleteNote` are not functions on TeamService.

- [ ] **Step 3: Implement note CRUD methods in TeamService**

Add imports at the top of `team.service.ts`:

```typescript
import { map } from 'rxjs/operators';
```

Update the type import:

```typescript
import {
  Team,
  TeamInput,
  TeamPatch,
  TeamFilter,
  ListTeamsResponse,
  TeamNote,
  TeamProjectNoteInput,
  ListTeamNotesResponse,
} from '@app/types/team.types';
```

Add the following methods to the `TeamService` class (after the `delete` method):

```typescript
/**
 * List notes for a team
 * @param teamId Team ID
 * @param limit Maximum results per page
 * @param offset Number of results to skip
 */
listNotes(teamId: string, limit?: number, offset?: number): Observable<ListTeamNotesResponse> {
  const params = buildHttpParams({ limit, offset });
  return this.apiService.get<ListTeamNotesResponse>(`teams/${teamId}/notes`, params).pipe(
    tap(response => {
      this.logger.debug('Team notes loaded', {
        teamId,
        count: response.notes.length,
        total: response.total,
      });
    }),
    catchError(error => {
      this.logger.error(`Failed to list notes for team ${teamId}`, error);
      throw error;
    }),
  );
}

/**
 * Get a single team note by ID with full content
 * @param teamId Team ID
 * @param noteId Note ID
 */
getNoteById(teamId: string, noteId: string): Observable<TeamNote | undefined> {
  return this.apiService.get<TeamNote>(`teams/${teamId}/notes/${noteId}`).pipe(
    catchError(error => {
      this.logger.error(`Failed to get note ${noteId} for team ${teamId}`, error);
      return of(undefined);
    }),
  );
}

/**
 * Create a new note for a team
 * @param teamId Team ID
 * @param note Note input data
 */
createNote(teamId: string, note: Partial<TeamProjectNoteInput>): Observable<TeamNote> {
  return this.apiService
    .post<TeamNote>(`teams/${teamId}/notes`, note as Record<string, unknown>)
    .pipe(
      catchError(error => {
        this.logger.error(`Failed to create note for team ${teamId}`, error);
        throw error;
      }),
    );
}

/**
 * Update an existing team note
 * @param teamId Team ID
 * @param noteId Note ID
 * @param note Note input data
 */
updateNote(
  teamId: string,
  noteId: string,
  note: Partial<TeamProjectNoteInput>,
): Observable<TeamNote> {
  return this.apiService
    .put<TeamNote>(`teams/${teamId}/notes/${noteId}`, note as Record<string, unknown>)
    .pipe(
      catchError(error => {
        this.logger.error(`Failed to update note ${noteId} for team ${teamId}`, error);
        throw error;
      }),
    );
}

/**
 * Delete a team note
 * @param teamId Team ID
 * @param noteId Note ID
 */
deleteNote(teamId: string, noteId: string): Observable<boolean> {
  return this.apiService.delete(`teams/${teamId}/notes/${noteId}`).pipe(
    map(() => true),
    catchError(error => {
      this.logger.error(`Failed to delete note ${noteId} for team ${teamId}`, error);
      throw error;
    }),
  );
}
```

Also add `of` to the rxjs import at the top:

```typescript
import { Observable, of } from 'rxjs';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/core/services/team.service.spec.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/team.service.ts src/app/core/services/team.service.spec.ts
git commit -m "feat(teams): add note CRUD methods to TeamService (#539)"
```

---

### Task 3: Add note CRUD methods to ProjectService

**Files:**
- Modify: `src/app/core/services/project.service.ts`
- Create: `src/app/core/services/project.service.spec.ts`

- [ ] **Step 1: Write failing tests for project note CRUD**

Create `src/app/core/services/project.service.spec.ts`:

```typescript
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
  Project,
  ListProjectNotesResponse,
  ProjectNote,
} from '@app/types/project.types';
import { TeamProjectNoteInput } from '@app/types/team.types';

describe('ProjectService', () => {
  let service: ProjectService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    patch: ReturnType<typeof vi.fn>;
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
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 1,
    limit: 200,
    offset: 0,
  };

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Project Alpha',
    description: 'First project',
    team_id: 'team-1',
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockNoteListResponse: ListProjectNotesResponse = {
    notes: [
      {
        id: 'note-1',
        name: 'Architecture Notes',
        description: 'ADR for auth redesign',
        created_at: '2026-02-01T14:00:00Z',
        modified_at: '2026-02-01T14:00:00Z',
      },
    ],
    total: 1,
    limit: 20,
    offset: 0,
  };

  const mockProjectNote: ProjectNote = {
    id: 'note-1',
    name: 'Architecture Notes',
    content: '# ADR\n\nAuthentication redesign.',
    description: 'ADR for auth redesign',
    timmy_enabled: true,
    sharable: true,
    created_at: '2026-02-01T14:00:00Z',
    modified_at: '2026-02-01T14:00:00Z',
  };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn(),
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
      service.list().subscribe();
      expect(mockApiService.get).toHaveBeenCalledWith('projects', expect.anything());
    });
  });

  describe('create()', () => {
    it('should POST to correct endpoint', () => {
      mockApiService.post.mockReturnValue(of(mockProject));
      service.create({ name: 'New', team_id: 'team-1' }).subscribe();
      expect(mockApiService.post).toHaveBeenCalledWith(
        'projects',
        expect.anything(),
      );
    });
  });

  describe('listNotes()', () => {
    it('should call API with correct endpoint and params', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));
      service.listNotes('proj-1', 20, 0).subscribe();
      expect(mockApiService.get).toHaveBeenCalledWith(
        'projects/proj-1/notes',
        expect.anything(),
      );
    });

    it('should return paginated note list', () => {
      mockApiService.get.mockReturnValue(of(mockNoteListResponse));
      service.listNotes('proj-1').subscribe(response => {
        expect(response.notes).toHaveLength(1);
        expect(response.total).toBe(1);
      });
    });

    it('should log and rethrow on error', () => {
      mockApiService.get.mockReturnValue(throwError(() => new Error('API error')));
      service.listNotes('proj-1').subscribe({
        error: () => {
          expect(mockLoggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('getNoteById()', () => {
    it('should call API with correct endpoint', () => {
      mockApiService.get.mockReturnValue(of(mockProjectNote));
      service.getNoteById('proj-1', 'note-1').subscribe();
      expect(mockApiService.get).toHaveBeenCalledWith('projects/proj-1/notes/note-1');
    });

    it('should return undefined on error', () => {
      mockApiService.get.mockReturnValue(throwError(() => new Error('Not found')));
      service.getNoteById('proj-1', 'note-1').subscribe(result => {
        expect(result).toBeUndefined();
      });
    });
  });

  describe('createNote()', () => {
    it('should POST to correct endpoint', () => {
      mockApiService.post.mockReturnValue(of(mockProjectNote));
      const input: Partial<TeamProjectNoteInput> = {
        name: 'New Note',
        content: '# New',
      };
      service.createNote('proj-1', input).subscribe();
      expect(mockApiService.post).toHaveBeenCalledWith(
        'projects/proj-1/notes',
        input as Record<string, unknown>,
      );
    });
  });

  describe('updateNote()', () => {
    it('should PUT to correct endpoint', () => {
      mockApiService.put.mockReturnValue(of(mockProjectNote));
      const input: Partial<TeamProjectNoteInput> = { name: 'Updated' };
      service.updateNote('proj-1', 'note-1', input).subscribe();
      expect(mockApiService.put).toHaveBeenCalledWith(
        'projects/proj-1/notes/note-1',
        input as Record<string, unknown>,
      );
    });
  });

  describe('deleteNote()', () => {
    it('should DELETE correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));
      service.deleteNote('proj-1', 'note-1').subscribe(result => {
        expect(result).toBe(true);
      });
      expect(mockApiService.delete).toHaveBeenCalledWith('projects/proj-1/notes/note-1');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/core/services/project.service.spec.ts`
Expected: FAIL — `listNotes`, `getNoteById`, `createNote`, `updateNote`, `deleteNote` are not functions on ProjectService.

- [ ] **Step 3: Implement note CRUD methods in ProjectService**

Update imports at the top of `project.service.ts`:

```typescript
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
```

Update the type import:

```typescript
import {
  Project,
  ProjectInput,
  ProjectPatch,
  ProjectFilter,
  ListProjectsResponse,
  ProjectNote,
  ListProjectNotesResponse,
} from '@app/types/project.types';
import { TeamProjectNoteInput } from '@app/types/team.types';
```

Add the following methods to the `ProjectService` class (after the `delete` method):

```typescript
/**
 * List notes for a project
 * @param projectId Project ID
 * @param limit Maximum results per page
 * @param offset Number of results to skip
 */
listNotes(
  projectId: string,
  limit?: number,
  offset?: number,
): Observable<ListProjectNotesResponse> {
  const params = buildHttpParams({ limit, offset });
  return this.apiService
    .get<ListProjectNotesResponse>(`projects/${projectId}/notes`, params)
    .pipe(
      tap(response => {
        this.logger.debug('Project notes loaded', {
          projectId,
          count: response.notes.length,
          total: response.total,
        });
      }),
      catchError(error => {
        this.logger.error(`Failed to list notes for project ${projectId}`, error);
        throw error;
      }),
    );
}

/**
 * Get a single project note by ID with full content
 * @param projectId Project ID
 * @param noteId Note ID
 */
getNoteById(projectId: string, noteId: string): Observable<ProjectNote | undefined> {
  return this.apiService.get<ProjectNote>(`projects/${projectId}/notes/${noteId}`).pipe(
    catchError(error => {
      this.logger.error(`Failed to get note ${noteId} for project ${projectId}`, error);
      return of(undefined);
    }),
  );
}

/**
 * Create a new note for a project
 * @param projectId Project ID
 * @param note Note input data
 */
createNote(projectId: string, note: Partial<TeamProjectNoteInput>): Observable<ProjectNote> {
  return this.apiService
    .post<ProjectNote>(`projects/${projectId}/notes`, note as Record<string, unknown>)
    .pipe(
      catchError(error => {
        this.logger.error(`Failed to create note for project ${projectId}`, error);
        throw error;
      }),
    );
}

/**
 * Update an existing project note
 * @param projectId Project ID
 * @param noteId Note ID
 * @param note Note input data
 */
updateNote(
  projectId: string,
  noteId: string,
  note: Partial<TeamProjectNoteInput>,
): Observable<ProjectNote> {
  return this.apiService
    .put<ProjectNote>(
      `projects/${projectId}/notes/${noteId}`,
      note as Record<string, unknown>,
    )
    .pipe(
      catchError(error => {
        this.logger.error(
          `Failed to update note ${noteId} for project ${projectId}`,
          error,
        );
        throw error;
      }),
    );
}

/**
 * Delete a project note
 * @param projectId Project ID
 * @param noteId Note ID
 */
deleteNote(projectId: string, noteId: string): Observable<boolean> {
  return this.apiService.delete(`projects/${projectId}/notes/${noteId}`).pipe(
    map(() => true),
    catchError(error => {
      this.logger.error(
        `Failed to delete note ${noteId} for project ${projectId}`,
        error,
      );
      throw error;
    }),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/core/services/project.service.spec.ts`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/project.service.ts src/app/core/services/project.service.spec.ts
git commit -m "feat(projects): add note CRUD methods to ProjectService (#539)"
```

---

### Task 4: Refactor NoteEditorDialogComponent to be entity-agnostic

**Files:**
- Move: `src/app/pages/tm/components/note-editor-dialog/` → `src/app/shared/components/note-editor-dialog/`
- Modify: `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.ts`
- Modify: `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.html`
- Modify: `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.scss`

- [ ] **Step 1: Move the note-editor-dialog directory**

```bash
git mv src/app/pages/tm/components/note-editor-dialog src/app/shared/components/note-editor-dialog
```

- [ ] **Step 2: Update the SCSS import path**

In `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.scss`, the first line is:

```scss
@use '../../../../../styles/markdown-editor' as md;
```

Update to the new relative path:

```scss
@use '../../../../styles/markdown-editor' as md;
```

(One directory level fewer: `shared/components/note-editor-dialog/` is one level closer to `src/` than `pages/tm/components/note-editor-dialog/` was.)

- [ ] **Step 3: Update the component TypeScript**

In `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.ts`:

Replace the `Note` import:

```typescript
import { Note } from '../../models/threat-model.model';
```

with nothing (remove the line). The component will use the new generic `NoteEditorNote` interface instead.

Update the `MermaidViewerService` import path. The current import is:

```typescript
import { MermaidViewerService } from '../../../../shared/services/mermaid-viewer.service';
```

Replace with (the service lives at `src/app/shared/services/mermaid-viewer.service.ts`):

```typescript
import { MermaidViewerService } from '@app/shared/services/mermaid-viewer.service';
```

Add the new type and update the interfaces. Replace the existing interfaces block:

```typescript
export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  note?: Note;
  isReadOnly?: boolean;
}

export interface NoteEditorResult {
  formValue: NoteFormResult;
  noteId?: string;
  wasCreated?: boolean;
}

export interface NoteFormResult {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
}
```

with:

```typescript
export type NoteEntityType = 'threat_model' | 'team' | 'project';

/** Minimal note shape the dialog needs for initialization */
export interface NoteEditorNote {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  sharable?: boolean;
}

export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  entityType: NoteEntityType;
  note?: NoteEditorNote;
  isReadOnly?: boolean;
}

export interface NoteEditorResult {
  formValue: NoteFormResult;
  noteId?: string;
  wasCreated?: boolean;
}

export interface NoteFormResult {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  sharable?: boolean;
}
```

In the component class, add a property:

```typescript
entityType: NoteEntityType;
```

In the constructor, initialize it:

```typescript
this.entityType = data.entityType;
```

Update `ngOnInit` form initialization — replace the `include_in_report` and `timmy_enabled` lines:

```typescript
include_in_report: [
  this.entityType === 'threat_model'
    ? (this.data.mode === 'create' ? true : this.data.note?.include_in_report)
    : undefined,
],
timmy_enabled: [this.data.note?.timmy_enabled ?? true],
sharable: [
  this.entityType !== 'threat_model'
    ? (this.data.note?.sharable ?? true)
    : undefined,
],
```

Update `originalIncludeInReport` and add `originalSharable`:

```typescript
private originalSharable: boolean | undefined = true;
```

In `ngOnInit`, after the existing `originalTimmyEnabled` line, add:

```typescript
this.originalSharable = this.noteForm.get('sharable')?.value as boolean | undefined;
```

Update `hasUnsavedChanges()` to include `sharable`:

```typescript
const currentSharable = this.noteForm.get('sharable')?.value as boolean | undefined;
```

And add to the return expression:

```typescript
|| currentSharable !== this.originalSharable
```

Update `onSave()` — after `this.originalTimmyEnabled = formValue.timmy_enabled;`, add:

```typescript
this.originalSharable = formValue.sharable;
```

Update `getFormValue()`:

```typescript
private getFormValue(value: NoteFormResult): NoteFormResult {
  const result: NoteFormResult = {
    name: value.name.trim(),
    content: value.content.trim(),
    description: value.description?.trim(),
    timmy_enabled: value.timmy_enabled,
  };
  if (this.entityType === 'threat_model') {
    result.include_in_report = value.include_in_report;
  } else {
    result.sharable = value.sharable;
  }
  return result;
}
```

- [ ] **Step 4: Update the template HTML**

In `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.html`:

Replace the `include_in_report` checkbox block:

```html
<!-- Include in Report -->
<div class="checkbox-field">
  <mat-checkbox formControlName="include_in_report">
    {{ 'common.includeInReport' | transloco }}
  </mat-checkbox>
</div>
```

with:

```html
<!-- Include in Report (TM notes only) -->
@if (entityType === 'threat_model') {
  <div class="checkbox-field">
    <mat-checkbox formControlName="include_in_report">
      {{ 'common.includeInReport' | transloco }}
    </mat-checkbox>
  </div>
}

<!-- Sharable (Team/Project notes only) -->
@if (entityType !== 'threat_model') {
  <div class="checkbox-field">
    <mat-checkbox formControlName="sharable">
      {{ 'notes.sharable' | transloco }}
    </mat-checkbox>
    <mat-icon
      class="info-icon"
      [matTooltip]="'notes.sharableTooltip' | transloco"
      fontSet="material-symbols-outlined"
      >info</mat-icon
    >
  </div>
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm run build`
Expected: FAIL — `tm-edit.component.ts` still imports from the old path. That's expected; we fix it in the next step.

- [ ] **Step 6: Commit the move and refactor**

```bash
git add -A
git commit -m "refactor: make NoteEditorDialogComponent entity-agnostic (#539)"
```

---

### Task 5: Update existing consumers to use new import path

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts`

- [ ] **Step 1: Update tm-edit import path**

In `src/app/pages/tm/tm-edit.component.ts`, replace:

```typescript
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
} from './components/note-editor-dialog/note-editor-dialog.component';
```

with:

```typescript
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
} from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';
```

- [ ] **Step 2: Add `entityType` to dialog data in tm-edit**

Find the `addNote()` method. Update the `dialogData` to include `entityType`:

```typescript
const dialogData: NoteEditorDialogData = {
  mode: 'create',
  entityType: 'threat_model',
  isReadOnly: !this.canEdit,
};
```

Search for any other place in `tm-edit.component.ts` that creates `NoteEditorDialogData` and add `entityType: 'threat_model'` to each one.

- [ ] **Step 3: Check for other consumers**

The grep from exploration found these files reference the note editor dialog:
- `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.ts` — this is a separate component, not importing from note-editor-dialog
- `src/styles/_markdown-editor.scss` — just SCSS, no import to change
- `src/app/pages/tm/components/note-page/note-page.component.scss` — just SCSS, no import to change

No other TypeScript imports need updating.

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 5: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: update tm-edit to use shared note editor dialog path (#539)"
```

---

### Task 6: Add i18n keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: All 15 locale files

- [ ] **Step 1: Add English i18n keys**

Add to `src/assets/i18n/en-US.json` — find an appropriate alphabetical location at the top-level for a new `"notes"` section. Also add `"sharable"` and `"sharableTooltip"` under the existing `"notes"` or `"common"` section. The exact location depends on the file structure — add as a new top-level key:

```json
"notes": {
  "tab": "Notes",
  "tabWithCount": "Notes ({{count}})",
  "addNote": "Add note",
  "noNotes": "No notes yet",
  "columns": {
    "name": "Name",
    "description": "Description",
    "actions": "Actions"
  },
  "sharable": "Visible to all members",
  "sharableTooltip": "When enabled, this note is visible to all team/project members. When disabled, only admins and security reviewers can see it.",
  "deleteConfirmTitle": "Delete Note",
  "deleteConfirmMessage": "Are you sure you want to delete the note \"{{name}}\"? This action cannot be undone."
}
```

- [ ] **Step 2: Backfill translations to all locale files**

Use the localization skills (`/localization-backfill`) to add translations for the new `notes.*` keys to all 15 non-English locale files.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/
git commit -m "feat(i18n): add notes tab and sharable i18n keys (#539)"
```

---

### Task 7: Add Notes tab to EditTeamDialogComponent

**Files:**
- Modify: `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts`

- [ ] **Step 1: Update imports**

Add to the imports at the top of the file:

```typescript
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
  NoteFormResult,
} from '../note-editor-dialog/note-editor-dialog.component';
import {
  DeleteConfirmationDialogComponent,
} from '../delete-confirmation-dialog/delete-confirmation-dialog.component';
import { TeamNoteListItem, ListTeamNotesResponse, TeamNote } from '@app/types/team.types';
```

Add to the component's `imports` array:

```typescript
MatTableModule,
MatPaginatorModule,
MatIconModule,
MatTooltipModule,
```

- [ ] **Step 2: Rewrite the template to tabbed layout**

Replace the entire template with:

```html
<h2 mat-dialog-title [transloco]="'teams.editDialog.title'">Edit Team</h2>
<mat-dialog-content>
  <mat-tab-group
    (selectedTabChange)="onTabChange($event)"
    [selectedIndex]="selectedTabIndex"
  >
    <!-- Details Tab -->
    <mat-tab [label]="'teams.editDialog.detailsTab' | transloco">
      <div class="tab-content">
        <form [formGroup]="form" class="admin-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.name'">Name</mat-label>
            <input matInput formControlName="name" />
            @if (form.get('name')?.hasError('required')) {
              <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
            }
            @if (form.get('name')?.hasError('maxlength')) {
              <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 256 } }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.description'">Description</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
            @if (form.get('description')?.hasError('maxlength')) {
              <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 2048 } }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput formControlName="email_address" type="email" />
            @if (form.get('email_address')?.hasError('email')) {
              <mat-error>{{ 'common.validation.invalidEmail' | transloco }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>URI</mat-label>
            <input matInput formControlName="uri" type="url" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.status'">Status</mat-label>
            <mat-select formControlName="status">
              <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
              @for (status of teamStatuses; track status) {
                <mat-option [value]="status">
                  {{ 'teams.status.' + status | transloco }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (errorMessage) {
            <div class="form-error">{{ errorMessage }}</div>
          }
        </form>
      </div>
    </mat-tab>

    <!-- Notes Tab -->
    <mat-tab>
      <ng-template mat-tab-label>
        {{ (totalNotes > 0 ? 'notes.tabWithCount' : 'notes.tab') | transloco: { count: totalNotes } }}
      </ng-template>
      <div class="tab-content">
        <div class="notes-header">
          <button
            mat-raised-button
            color="primary"
            (click)="addNote()"
          >
            <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
            {{ 'notes.addNote' | transloco }}
          </button>
        </div>

        @if (notesLoading) {
          <div class="notes-loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (notes.length === 0) {
          <div class="notes-empty">
            {{ 'notes.noNotes' | transloco }}
          </div>
        } @else {
          <table mat-table [dataSource]="notes" class="notes-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>{{ 'notes.columns.name' | transloco }}</th>
              <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                {{ note.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>{{ 'notes.columns.description' | transloco }}</th>
              <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                {{ note.description }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let note">
                <button
                  mat-icon-button
                  (click)="editNote(note); $event.stopPropagation()"
                  [matTooltip]="'common.edit' | transloco"
                >
                  <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  (click)="deleteNote(note); $event.stopPropagation()"
                  [matTooltip]="'common.delete' | transloco"
                >
                  <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="notesDisplayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: notesDisplayedColumns"></tr>
          </table>

          @if (totalNotes > notesPageSize) {
            <mat-paginator
              [length]="totalNotes"
              [pageSize]="notesPageSize"
              [pageIndex]="notesPageIndex"
              [pageSizeOptions]="[10, 25, 50]"
              (page)="onNotesPageChange($event)"
            ></mat-paginator>
          }
        }
      </div>
    </mat-tab>
  </mat-tab-group>
</mat-dialog-content>

<mat-dialog-actions align="end">
  @if (selectedTabIndex === 0) {
    <button mat-button (click)="onCancel()">
      <span [transloco]="'common.cancel'">Cancel</span>
    </button>
    <button
      mat-raised-button
      color="primary"
      (click)="onSave()"
      [disabled]="!form.valid || !form.dirty || saving"
    >
      @if (saving) {
        <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
      }
      <span [transloco]="'teams.editDialog.save'">Save</span>
    </button>
  } @else {
    <button mat-button (click)="onCancel()">
      <span [transloco]="'common.close'">Close</span>
    </button>
  }
</mat-dialog-actions>
```

- [ ] **Step 3: Add styles**

Add to the component's `styles` array:

```css
.tab-content {
  padding-top: 16px;
  min-width: 400px;
}
.notes-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.notes-table {
  width: 100%;
}
.notes-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
.notes-empty {
  text-align: center;
  color: var(--theme-text-secondary);
  padding: 32px 0;
}
.clickable {
  cursor: pointer;
}
```

- [ ] **Step 4: Add component logic for Notes tab**

Add the following properties to the class:

```typescript
// Notes tab state
selectedTabIndex = 0;
notes: TeamNoteListItem[] = [];
totalNotes = 0;
notesPageIndex = 0;
notesPageSize = 10;
notesDisplayedColumns = ['name', 'description', 'actions'];
notesLoading = false;
private notesLoaded = false;
```

Inject `MatDialog` in the constructor (rename the existing `dialogRef` injection to avoid conflict — `MatDialog` is for opening child dialogs):

```typescript
constructor(
  private dialogRef: MatDialogRef<EditTeamDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: EditTeamDialogData,
  private teamService: TeamService,
  private fb: FormBuilder,
  private logger: LoggerService,
  private dialog: MatDialog,
) {}
```

Add the following methods:

```typescript
onTabChange(event: { index: number }): void {
  this.selectedTabIndex = event.index;
  if (event.index === 1 && !this.notesLoaded) {
    this.loadNotes();
  }
}

private loadNotes(): void {
  this.notesLoading = true;
  this.teamService
    .listNotes(this.data.team.id, this.notesPageSize, this.notesPageIndex * this.notesPageSize)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (response: ListTeamNotesResponse) => {
        this.notes = response.notes;
        this.totalNotes = response.total;
        this.notesLoading = false;
        this.notesLoaded = true;
      },
      error: (error: unknown) => {
        this.logger.error('Failed to load team notes', error);
        this.notesLoading = false;
      },
    });
}

onNotesPageChange(event: PageEvent): void {
  this.notesPageIndex = event.pageIndex;
  this.notesPageSize = event.pageSize;
  this.loadNotes();
}

addNote(): void {
  const dialogData: NoteEditorDialogData = {
    mode: 'create',
    entityType: 'team',
  };

  const dialogRef = this.dialog.open(NoteEditorDialogComponent, {
    width: '90vw',
    maxWidth: '900px',
    minWidth: '600px',
    maxHeight: '90vh',
    data: dialogData,
  });

  const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(
    (noteResult: NoteFormResult) => {
      this.teamService
        .createNote(this.data.team.id, noteResult)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created: TeamNote) => {
            dialogRef.componentInstance.setCreatedNoteId(created.id);
            this.loadNotes();
          },
          error: (error: unknown) => {
            this.logger.error('Failed to create team note', error);
          },
        });
    },
  );

  dialogRef.afterClosed().subscribe((result?: NoteEditorResult) => {
    saveSubscription.unsubscribe();
    if (result?.formValue && result.noteId) {
      this.teamService
        .updateNote(this.data.team.id, result.noteId, result.formValue)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.loadNotes(),
          error: (error: unknown) => {
            this.logger.error('Failed to update team note on close', error);
          },
        });
    } else {
      this.loadNotes();
    }
  });
}

editNote(noteListItem: TeamNoteListItem): void {
  this.teamService
    .getNoteById(this.data.team.id, noteListItem.id)
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (note: TeamNote | undefined) => {
        if (!note) {
          this.logger.error('Failed to load note for editing');
          return;
        }

        const dialogData: NoteEditorDialogData = {
          mode: 'edit',
          entityType: 'team',
          note,
        };

        const dialogRef = this.dialog.open(NoteEditorDialogComponent, {
          width: '90vw',
          maxWidth: '900px',
          minWidth: '600px',
          maxHeight: '90vh',
          data: dialogData,
        });

        const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(
          (noteResult: NoteFormResult) => {
            this.teamService
              .updateNote(this.data.team.id, noteListItem.id, noteResult)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => this.loadNotes(),
                error: (error: unknown) => {
                  this.logger.error('Failed to update team note', error);
                },
              });
          },
        );

        dialogRef.afterClosed().subscribe((result?: NoteEditorResult) => {
          saveSubscription.unsubscribe();
          if (result?.formValue) {
            this.teamService
              .updateNote(this.data.team.id, noteListItem.id, result.formValue)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: () => this.loadNotes(),
                error: (error: unknown) => {
                  this.logger.error('Failed to update team note on close', error);
                },
              });
          }
        });
      },
    });
}

deleteNote(noteListItem: TeamNoteListItem): void {
  const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
    data: {
      title: 'notes.deleteConfirmTitle',
      message: 'notes.deleteConfirmMessage',
      messageParams: { name: noteListItem.name },
    },
  });

  dialogRef.afterClosed().subscribe((confirmed: boolean) => {
    if (confirmed) {
      this.teamService
        .deleteNote(this.data.team.id, noteListItem.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => this.loadNotes(),
          error: (error: unknown) => {
            this.logger.error('Failed to delete team note', error);
          },
        });
    }
  });
}
```

- [ ] **Step 5: Add missing i18n key for Details tab**

Add to `en-US.json` under the `teams.editDialog` section:

```json
"detailsTab": "Details"
```

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 7: Lint**

Run: `pnpm run lint:all`
Expected: No errors (fix any that arise).

- [ ] **Step 8: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(teams): add Notes tab to edit team dialog (#539)"
```

---

### Task 8: Add Notes tab to EditProjectDialogComponent

**Files:**
- Modify: `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts`

This follows the identical pattern as Task 7, but for projects.

- [ ] **Step 1: Update imports**

Add to the imports at the top of the file:

```typescript
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
  NoteFormResult,
} from '../note-editor-dialog/note-editor-dialog.component';
import {
  DeleteConfirmationDialogComponent,
} from '../delete-confirmation-dialog/delete-confirmation-dialog.component';
import { ProjectNoteListItem, ListProjectNotesResponse, ProjectNote } from '@app/types/project.types';
import { TeamProjectNoteInput } from '@app/types/team.types';
```

Add to the component's `imports` array:

```typescript
MatTableModule,
MatPaginatorModule,
MatIconModule,
MatTooltipModule,
```

- [ ] **Step 2: Rewrite the template to tabbed layout**

Replace the entire template with a tabbed layout identical in structure to the team dialog, but:
- Title: `'projects.editDialog.title'`
- Details tab label: `'projects.editDialog.detailsTab'`
- The form fields match the existing project form (name, description, team dropdown, URI, status)
- Notes tab is identical to the team version
- Save button uses `'projects.editDialog.save'`

```html
<h2 mat-dialog-title [transloco]="'projects.editDialog.title'">Edit Project</h2>
<mat-dialog-content>
  <mat-tab-group
    (selectedTabChange)="onTabChange($event)"
    [selectedIndex]="selectedTabIndex"
  >
    <!-- Details Tab -->
    <mat-tab [label]="'projects.editDialog.detailsTab' | transloco">
      <div class="tab-content">
        <form [formGroup]="form" class="admin-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.name'">Name</mat-label>
            <input matInput formControlName="name" />
            @if (form.get('name')?.hasError('required')) {
              <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
            }
            @if (form.get('name')?.hasError('maxlength')) {
              <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 256 } }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.description'">Description</mat-label>
            <textarea matInput formControlName="description" rows="3"></textarea>
            @if (form.get('description')?.hasError('maxlength')) {
              <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 2048 } }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.team'">Team</mat-label>
            <mat-select formControlName="team_id">
              @if (loadingTeams) {
                <mat-option disabled>{{ 'common.loading' | transloco }}</mat-option>
              }
              @for (team of teams; track team.id) {
                <mat-option [value]="team.id">{{ team.name }}</mat-option>
              }
            </mat-select>
            @if (form.get('team_id')?.hasError('required')) {
              <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.uri'">URI</mat-label>
            <input matInput formControlName="uri" type="url" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'common.status'">Status</mat-label>
            <mat-select formControlName="status">
              <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
              @for (status of projectStatuses; track status) {
                <mat-option [value]="status">
                  {{ 'projects.status.' + status | transloco }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (errorMessage) {
            <div class="form-error">{{ errorMessage }}</div>
          }
        </form>
      </div>
    </mat-tab>

    <!-- Notes Tab -->
    <mat-tab>
      <ng-template mat-tab-label>
        {{ (totalNotes > 0 ? 'notes.tabWithCount' : 'notes.tab') | transloco: { count: totalNotes } }}
      </ng-template>
      <div class="tab-content">
        <div class="notes-header">
          <button
            mat-raised-button
            color="primary"
            (click)="addNote()"
          >
            <mat-icon fontSet="material-symbols-outlined">add</mat-icon>
            {{ 'notes.addNote' | transloco }}
          </button>
        </div>

        @if (notesLoading) {
          <div class="notes-loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (notes.length === 0) {
          <div class="notes-empty">
            {{ 'notes.noNotes' | transloco }}
          </div>
        } @else {
          <table mat-table [dataSource]="notes" class="notes-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>{{ 'notes.columns.name' | transloco }}</th>
              <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                {{ note.name }}
              </td>
            </ng-container>

            <ng-container matColumnDef="description">
              <th mat-header-cell *matHeaderCellDef>{{ 'notes.columns.description' | transloco }}</th>
              <td mat-cell *matCellDef="let note" class="clickable" (click)="editNote(note)">
                {{ note.description }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let note">
                <button
                  mat-icon-button
                  (click)="editNote(note); $event.stopPropagation()"
                  [matTooltip]="'common.edit' | transloco"
                >
                  <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  (click)="deleteNote(note); $event.stopPropagation()"
                  [matTooltip]="'common.delete' | transloco"
                >
                  <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="notesDisplayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: notesDisplayedColumns"></tr>
          </table>

          @if (totalNotes > notesPageSize) {
            <mat-paginator
              [length]="totalNotes"
              [pageSize]="notesPageSize"
              [pageIndex]="notesPageIndex"
              [pageSizeOptions]="[10, 25, 50]"
              (page)="onNotesPageChange($event)"
            ></mat-paginator>
          }
        }
      </div>
    </mat-tab>
  </mat-tab-group>
</mat-dialog-content>

<mat-dialog-actions align="end">
  @if (selectedTabIndex === 0) {
    <button mat-button (click)="onCancel()">
      <span [transloco]="'common.cancel'">Cancel</span>
    </button>
    <button
      mat-raised-button
      color="primary"
      (click)="onSave()"
      [disabled]="!form.valid || !form.dirty || saving"
    >
      @if (saving) {
        <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
      }
      <span [transloco]="'projects.editDialog.save'">Save</span>
    </button>
  } @else {
    <button mat-button (click)="onCancel()">
      <span [transloco]="'common.close'">Close</span>
    </button>
  }
</mat-dialog-actions>
```

- [ ] **Step 3: Add styles**

Same styles as the team dialog:

```css
.tab-content {
  padding-top: 16px;
  min-width: 400px;
}
.notes-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.notes-table {
  width: 100%;
}
.notes-loading {
  display: flex;
  justify-content: center;
  padding: 32px 0;
}
.notes-empty {
  text-align: center;
  color: var(--theme-text-secondary);
  padding: 32px 0;
}
.clickable {
  cursor: pointer;
}
```

- [ ] **Step 4: Add component logic for Notes tab**

Add the following properties:

```typescript
// Notes tab state
selectedTabIndex = 0;
notes: ProjectNoteListItem[] = [];
totalNotes = 0;
notesPageIndex = 0;
notesPageSize = 10;
notesDisplayedColumns = ['name', 'description', 'actions'];
notesLoading = false;
private notesLoaded = false;
```

Inject `MatDialog` in the constructor:

```typescript
constructor(
  private dialogRef: MatDialogRef<EditProjectDialogComponent>,
  @Inject(MAT_DIALOG_DATA) public data: EditProjectDialogData,
  private projectService: ProjectService,
  private teamService: TeamService,
  private fb: FormBuilder,
  private logger: LoggerService,
  private dialog: MatDialog,
) {}
```

Add the same note management methods as in Task 7 but using `projectService` and `entityType: 'project'` instead. The methods are: `onTabChange`, `loadNotes`, `onNotesPageChange`, `addNote`, `editNote`, `deleteNote`. Use `ProjectNoteListItem`, `ProjectNote`, `ListProjectNotesResponse` types and `this.data.project.id` as the entity ID.

- [ ] **Step 5: Add missing i18n key for Details tab**

Add to `en-US.json` under the `projects.editDialog` section:

```json
"detailsTab": "Details"
```

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 7: Lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 8: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(projects): add Notes tab to edit project dialog (#539)"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Full lint**

Run: `pnpm run lint:all`
Expected: No lint errors.

- [ ] **Step 3: Full test suite**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 4: Manual smoke test checklist**

Verify the following in the running app:
1. Open any team from the Teams page → Edit → see Details and Notes tabs
2. Switch to Notes tab → see empty state "No notes yet"
3. Click "Add note" → note editor dialog opens on top
4. Create a note with name, content, description → save → note appears in list
5. Click a note row → note editor opens with content loaded
6. Edit and save → changes persist
7. Delete a note → confirmation → note removed
8. Same flows work from Admin Teams page
9. Same flows work for Projects (both user and admin)
10. TM note editing still works (regression check — entityType: 'threat_model')

- [ ] **Step 5: Commit any final fixes**

If any issues were found during smoke testing, fix and commit.
