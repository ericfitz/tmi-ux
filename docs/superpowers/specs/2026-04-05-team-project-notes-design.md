# Design: Team and Project Notes UI

**Issue:** [#539](https://github.com/ericfitz/tmi-ux/issues/539)
**Date:** 2026-04-05
**Status:** Draft

## Overview

Add note management (list, create, edit, delete) to the team and project edit dialogs. Notes are displayed in a new "Notes" tab alongside the existing "Details" tab. The note editor dialog is refactored from TM-specific to entity-agnostic so it can be reused across threat models, teams, and projects.

## API Foundation

The TMI server (dev/1.4.0 branch) already provides full CRUD endpoints for team and project notes:

- `GET/POST /teams/{team_id}/notes`
- `GET/PUT/PATCH/DELETE /teams/{team_id}/notes/{team_note_id}`
- `GET/POST /projects/{project_id}/notes`
- `GET/PUT/PATCH/DELETE /projects/{project_id}/notes/{project_note_id}`

The `TeamProjectNoteBase` schema defines the writable fields:
- `name` (required, max 256)
- `content` (required, max 262144, markdown)
- `description` (optional, max 2048)
- `timmy_enabled` (boolean, default true)
- `sharable` (boolean — controls visibility; true = all members, false = admins/security reviewers only)

List endpoints return `TeamNoteListItem` / `ProjectNoteListItem` (id, name, description, created_at, modified_at) without content. Individual GET returns full note with content.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where notes appear | Tabbed edit dialog (Details + Notes tabs) | Teams/projects use list pages with dialog-based editing, not dedicated edit pages. Tabs keep related actions grouped without making the dialog unwieldy. |
| Note editing | Stacked dialog (note editor opens on top of edit dialog) | Avoids needing dedicated routes for team/project note pages. Keeps user in dialog flow. |
| Note editor reuse | Refactor existing `NoteEditorDialogComponent` to be entity-agnostic | ~400 lines of markdown editing code (preview, clipboard, mermaid, task lists) would otherwise be duplicated. |
| Note editor location | Move from `src/app/pages/tm/components/` to `src/app/shared/components/` | It's now shared across TM, team, and project contexts. |
| Conditional fields | `NoteEntityType` discriminator controls which checkboxes render | TM notes: `include_in_report` + `timmy_enabled`. Team/project notes: `sharable` + `timmy_enabled`. |

## Component Changes

### 1. NoteEditorDialogComponent (refactored)

**Current location:** `src/app/pages/tm/components/note-editor-dialog/`
**New location:** `src/app/shared/components/note-editor-dialog/`

**Interface changes:**

```typescript
export type NoteEntityType = 'threat_model' | 'team' | 'project';

export interface NoteEditorDialogData {
  mode: 'create' | 'edit';
  entityType: NoteEntityType;        // NEW — controls which checkboxes render
  note?: NoteEditorNote;             // NEW — generic note type instead of TM-specific Note
  isReadOnly?: boolean;
}

/** Minimal note shape the dialog needs for initialization */
export interface NoteEditorNote {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;       // TM notes only
  timmy_enabled?: boolean;
  sharable?: boolean;                // Team/project notes only
}

export interface NoteFormResult {
  name: string;
  content: string;
  description?: string;
  include_in_report?: boolean;       // Present only when entityType === 'threat_model'
  timmy_enabled?: boolean;
  sharable?: boolean;                // Present only when entityType !== 'threat_model'
}
```

**Template changes:**
- The `include_in_report` checkbox renders only when `entityType === 'threat_model'`
- A new `sharable` checkbox renders only when `entityType !== 'threat_model'`
- The `timmy_enabled` checkbox renders for all entity types (unchanged)
- Form initialization sets defaults based on entity type:
  - TM: `include_in_report = true`, `timmy_enabled = true`
  - Team/project: `sharable = true`, `timmy_enabled = true`

**No other behavioral changes.** All markdown editing, preview, clipboard, mermaid, and task list functionality remains identical.

### 2. EditTeamDialogComponent (modified)

**File:** `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts`

**Changes:**
- Add `MatTabsModule` to imports
- Wrap existing form in a `mat-tab-group` with two tabs: "Details" and "Notes"
- Details tab contains the existing form fields and Save/Cancel actions
- Notes tab contains:
  - A notes table with columns: name, description, actions (edit, delete)
  - An "Add" button above the table
  - Pagination when `total > pageSize` (default pageSize: 10)
  - A "Close" button in the dialog actions area (no save needed — notes save independently)
- Notes are loaded lazily on first tab activation via `(selectedTabChange)` event
- The dialog data interface gains the team ID (already present via `data.team.id`)
- Dialog actions area changes with the active tab:
  - **Details tab selected:** Cancel + Save buttons (existing behavior)
  - **Notes tab selected:** Close button only (notes are saved independently via the note editor dialog)

**Notes tab behavior:**
- **Add:** Opens `NoteEditorDialogComponent` with `mode: 'create'`, `entityType: 'team'`. On `saveEvent`, calls `teamService.createNote()`. On dialog close with result, calls `teamService.updateNote()` if there are final changes, then refreshes the notes list.
- **Edit (click row or edit icon):** Fetches full note via `teamService.getNoteById()`, opens `NoteEditorDialogComponent` with `mode: 'edit'`, `entityType: 'team'`. On `saveEvent`, calls `teamService.updateNote()`. On dialog close with result, saves and refreshes.
- **Delete:** Opens `DeleteConfirmationDialogComponent`. On confirm, calls `teamService.deleteNote()` and refreshes.

### 3. EditProjectDialogComponent (modified)

**File:** `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts`

Identical pattern to EditTeamDialogComponent but using `projectService` and `entityType: 'project'`.

### 4. tm-edit and note-page (import path updates)

The existing consumers of `NoteEditorDialogComponent` update their import paths from `@app/pages/tm/components/note-editor-dialog/...` to `@app/shared/components/note-editor-dialog/...`. The TM callers pass `entityType: 'threat_model'` in the dialog data. No behavioral changes.

## Type Definitions

### New types in `src/app/types/team.types.ts`

```typescript
/** Base fields for team/project notes (user-writable) */
export interface TeamProjectNoteInput {
  name: string;
  content: string;
  description?: string;
  timmy_enabled?: boolean;
  sharable?: boolean;
}

/** Summary for list views (no content) */
export interface TeamNoteListItem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
}

/** Full team note with content */
export interface TeamNote extends TeamProjectNoteInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at: string;
}

/** Paginated list response */
export interface ListTeamNotesResponse {
  notes: TeamNoteListItem[];
  total: number;
  limit: number;
  offset: number;
}
```

### New types in `src/app/types/project.types.ts`

```typescript
/** Summary for list views (no content) */
export interface ProjectNoteListItem {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
}

/** Full project note with content */
export interface ProjectNote extends TeamProjectNoteInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at: string;
}

/** Paginated list response */
export interface ListProjectNotesResponse {
  notes: ProjectNoteListItem[];
  total: number;
  limit: number;
  offset: number;
}
```

`ProjectNote` imports `TeamProjectNoteInput` from `team.types.ts` to share the base shape.

## Service Changes

### TeamService — new methods

```typescript
listNotes(teamId: string, limit?: number, offset?: number): Observable<ListTeamNotesResponse>
getNoteById(teamId: string, noteId: string): Observable<TeamNote | undefined>
createNote(teamId: string, note: Partial<TeamProjectNoteInput>): Observable<TeamNote>
updateNote(teamId: string, noteId: string, note: Partial<TeamProjectNoteInput>): Observable<TeamNote>
deleteNote(teamId: string, noteId: string): Observable<boolean>
```

### ProjectService — new methods

```typescript
listNotes(projectId: string, limit?: number, offset?: number): Observable<ListProjectNotesResponse>
getNoteById(projectId: string, noteId: string): Observable<ProjectNote | undefined>
createNote(projectId: string, note: Partial<TeamProjectNoteInput>): Observable<ProjectNote>
updateNote(projectId: string, noteId: string, note: Partial<TeamProjectNoteInput>): Observable<ProjectNote>
deleteNote(projectId: string, noteId: string): Observable<boolean>
```

These follow the same pattern as the existing TM note methods in `ThreatModelService`.

## i18n

New keys under `notes.` namespace (shared across team/project contexts):

```json
{
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
    "sharableTooltip": "When enabled, this note is visible to all team/project members. When disabled, only admins and security reviewers can see it."
  }
}
```

The existing `noteEditor.*` keys remain unchanged. The new `sharable` checkbox label and tooltip are added alongside the existing `includeInReport` and `includeInTimmyChat` keys.

These keys are added to all 15 locale files. Non-English translations are backfilled using the localization skills.

## Coverage: Admin and User Pages

Both admin pages (`AdminTeamsComponent`, `AdminProjectsComponent`) and user pages (`TeamsComponent`, `ProjectsComponent`) open the same `EditTeamDialogComponent` / `EditProjectDialogComponent`. Adding the Notes tab to these shared dialogs automatically covers all four surfaces with no additional work.

## Testing

- **NoteEditorDialogComponent:** Update existing tests to pass `entityType`. Add tests verifying conditional checkbox rendering for each entity type.
- **EditTeamDialogComponent:** Add tests for Notes tab: loading notes on tab switch, add/edit/delete flows, pagination, error handling.
- **EditProjectDialogComponent:** Same test coverage as team.
- **TeamService / ProjectService:** Add tests for new note CRUD methods.

## Out of Scope

- Note metadata management for team/project notes (no metadata endpoints in current API schema for these note types)
- Addon invocation on team/project notes
- Audit trail for team/project notes
- Note download/export
- Full-page note editor for teams/projects (no routes needed — dialog-only flow)
