# Admin Teams Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-featured admin page for managing teams — list, create, edit, delete, plus dialogs for members, responsible parties, related teams, and metadata.

**Architecture:** New admin page at `/admin/teams` following the established admin groups pattern. Dialog-based CRUD with kebab menu actions for sub-entity management. Extends existing `TeamService` with get/update/patch/delete. Modifies existing `UserPickerDialog` with optional role selector. Reuses existing `MetadataDialog`.

**Tech Stack:** Angular, Angular Material (table, paginator, sort, dialogs, autocomplete, menus), Transloco i18n, RxJS

---

## Chunk 1: Foundation — Types, Service, i18n

### Task 1: Extend team types

**Files:**
- Modify: `src/app/types/team.types.ts`
- Create: `src/app/types/metadata.types.ts`

- [ ] **Step 1: Move Metadata type to shared location**

The `Metadata` interface currently lives in `src/app/pages/tm/models/threat-model.model.ts`. Create a shared type file and re-export from the original location to avoid breaking existing imports.

Create `src/app/types/metadata.types.ts`:

```typescript
/**
 * Generic key-value metadata pair, used by teams, projects, threat models, etc.
 */
export interface Metadata {
  key: string;
  value: string;
}
```

Update `src/app/pages/tm/models/threat-model.model.ts` to import and re-export from the shared location:

```typescript
// Re-export Metadata from shared types for backward compatibility
export { Metadata } from '@app/types/metadata.types';
```

Remove the original `Metadata` interface definition from `threat-model.model.ts` (lines 1-4).

- [ ] **Step 2: Add team sub-entity types and enums**

Add to `src/app/types/team.types.ts`:

```typescript
import { User } from '@app/pages/tm/models/threat-model.model';
import { Metadata } from '@app/types/metadata.types';

/** Team member roles */
export type TeamMemberRole =
  | 'engineering_lead'
  | 'engineer'
  | 'product_manager'
  | 'business_leader'
  | 'security_specialist'
  | 'other';

/** All valid TeamMemberRole values, for use in dropdowns */
export const TEAM_MEMBER_ROLES: TeamMemberRole[] = [
  'engineering_lead',
  'engineer',
  'product_manager',
  'business_leader',
  'security_specialist',
  'other',
];

/** Relationship types between teams or projects */
export type RelationshipType =
  | 'parent'
  | 'child'
  | 'dependency'
  | 'dependent'
  | 'supersedes'
  | 'superseded_by'
  | 'related'
  | 'other';

/** All valid RelationshipType values, for use in dropdowns */
export const RELATIONSHIP_TYPES: RelationshipType[] = [
  'parent',
  'child',
  'dependency',
  'dependent',
  'supersedes',
  'superseded_by',
  'related',
  'other',
];

/** Team lifecycle statuses */
export type TeamStatus =
  | 'active'
  | 'on_hold'
  | 'winding_down'
  | 'archived'
  | 'forming'
  | 'merging'
  | 'splitting';

/** All valid TeamStatus values, for use in dropdowns */
export const TEAM_STATUSES: TeamStatus[] = [
  'active',
  'on_hold',
  'winding_down',
  'archived',
  'forming',
  'merging',
  'splitting',
];

/** A member of a team with their role */
export interface TeamMember {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

/** A responsible party for a team or project */
export interface ResponsibleParty {
  user_id: string;
  readonly user?: User | null;
  role?: TeamMemberRole;
  custom_role?: string;
}

/** A relationship to another team */
export interface RelatedTeam {
  related_team_id: string;
  relationship: RelationshipType;
  custom_relationship?: string;
}

/** Patch input for partial team updates */
export interface TeamPatch {
  name?: string;
  description?: string;
  uri?: string;
  email_address?: string;
  status?: TeamStatus;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
  metadata?: Metadata[];
}
```

- [ ] **Step 3: Update the Team interface**

Replace the existing `Team` interface in `src/app/types/team.types.ts`:

```typescript
/**
 * Full team object returned from API (GET /teams/{id})
 */
export interface Team extends TeamInput {
  readonly id: string;
  readonly created_at: string;
  readonly modified_at?: string;
  readonly created_by?: User | null;
  readonly modified_by?: User | null;
  members?: TeamMember[];
  responsible_parties?: ResponsibleParty[];
  related_teams?: RelatedTeam[];
  metadata?: Metadata[];
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build succeeds. The Metadata re-export should maintain backward compatibility.

- [ ] **Step 5: Commit**

```bash
git add src/app/types/team.types.ts src/app/types/metadata.types.ts src/app/pages/tm/models/threat-model.model.ts
git commit -m "refactor: extend team types with sub-entities and move Metadata to shared types (#479)"
```

---

### Task 2: Extend TeamService with CRUD methods

**Files:**
- Modify: `src/app/core/services/team.service.ts`

- [ ] **Step 1: Add get, update, patch, and delete methods**

Read the existing `team.service.ts` first. It currently has `list()` and `create()` using `ApiService`. Add these methods following the same pattern:

```typescript
get(id: string): Observable<Team> {
  return this.apiService.get<Team>(`teams/${id}`).pipe(
    tap(team => this.logger.debug('Team loaded', { id: team.id })),
    catchError(error => {
      this.logger.error('Failed to load team', error);
      throw error;
    }),
  );
}

update(id: string, team: TeamInput): Observable<Team> {
  return this.apiService.put<Team>(`teams/${id}`, team as unknown as Record<string, unknown>).pipe(
    tap(result => this.logger.info('Team updated', { id: result.id })),
    catchError(error => {
      this.logger.error('Failed to update team', error);
      throw error;
    }),
  );
}

patch(id: string, changes: TeamPatch): Observable<Team> {
  return this.apiService.patch<Team>(`teams/${id}`, changes as unknown as Record<string, unknown>).pipe(
    tap(result => this.logger.info('Team patched', { id: result.id })),
    catchError(error => {
      this.logger.error('Failed to patch team', error);
      throw error;
    }),
  );
}

delete(id: string): Observable<void> {
  return this.apiService.delete<void>(`teams/${id}`).pipe(
    tap(() => this.logger.info('Team deleted', { id })),
    catchError(error => {
      this.logger.error('Failed to delete team', error);
      throw error;
    }),
  );
}
```

Add the necessary imports for `Team`, `TeamInput`, `TeamPatch` from `@app/types/team.types`.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/team.service.ts
git commit -m "feat: extend TeamService with get, update, patch, delete methods (#479)"
```

---

### Task 3: Add i18n keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: All 16 locale files via `/localization-backfill`

- [ ] **Step 1: Add English i18n keys**

Add these keys to `src/assets/i18n/en-US.json`:

Under `admin.sections`, add:

```json
"teams": {
  "description": "Manage teams and team membership",
  "title": "Teams"
}
```

Add a new top-level `teams` object (sibling to `admin`, `common`, `threatModels`, etc.):

```json
"teams": {
  "title": "Manage Teams",
  "subtitle": "Create, edit, and manage teams, members, and relationships",
  "filterLabel": "Filter Teams",
  "listTitle": "Teams",
  "addButton": "Add Team",
  "noTeams": "No teams found",
  "columns": {
    "name": "Name",
    "status": "Status",
    "members": "Members",
    "projects": "Projects",
    "modified": "Modified"
  },
  "status": {
    "active": "Active",
    "on_hold": "On Hold",
    "winding_down": "Winding Down",
    "archived": "Archived",
    "forming": "Forming",
    "merging": "Merging",
    "splitting": "Splitting"
  },
  "roles": {
    "engineering_lead": "Engineering Lead",
    "engineer": "Engineer",
    "product_manager": "Product Manager",
    "business_leader": "Business Leader",
    "security_specialist": "Security Specialist",
    "other": "Other"
  },
  "relationships": {
    "parent": "Parent",
    "child": "Child",
    "dependency": "Dependency",
    "dependent": "Dependent",
    "supersedes": "Supersedes",
    "superseded_by": "Superseded By",
    "related": "Related",
    "other": "Other"
  },
  "editDialog": {
    "title": "Edit Team",
    "save": "Save"
  },
  "membersDialog": {
    "title": "Team Members",
    "addMember": "Add Member",
    "noMembers": "No members",
    "role": "Role",
    "customRole": "Custom Role",
    "removeMember": "Remove Member"
  },
  "responsiblePartiesDialog": {
    "title": "Responsible Parties",
    "addParty": "Add Responsible Party",
    "noParties": "No responsible parties",
    "removeParty": "Remove Responsible Party"
  },
  "relatedTeamsDialog": {
    "title": "Related Teams",
    "addRelated": "Add Related Team",
    "noRelated": "No related teams",
    "relationship": "Relationship",
    "customRelationship": "Custom Relationship",
    "removeRelated": "Remove Related Team",
    "selectTeam": "Select Team"
  },
  "deleteDialog": {
    "title": "Delete Team",
    "message": "Are you sure you want to delete team \"{{name}}\"?",
    "projectWarning": "This team has {{count}} project(s). Deleting the team may affect these projects.",
    "confirm": "Delete"
  },
  "kebab": {
    "editDetails": "Edit Details",
    "members": "Members",
    "responsibleParties": "Responsible Parties",
    "relatedTeams": "Related Teams",
    "metadata": "Metadata",
    "delete": "Delete"
  }
}
```

- [ ] **Step 2: Backfill translations to all locale files**

Use `/localization-backfill` to add all new keys under `admin.sections.teams` and the top-level `teams` object to all 16 locale files.

- [ ] **Step 3: Verify i18n consistency**

Run: `pnpm run check-i18n`
Expected: No errors for missing keys.

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/*.json
git commit -m "feat: add i18n keys for admin teams management (#479)"
```

---

## Chunk 2: List Page — Component, Routing, Dashboard

### Task 4: Create AdminTeamsComponent

**Files:**
- Create: `src/app/pages/admin/teams/admin-teams.component.ts`
- Create: `src/app/pages/admin/teams/admin-teams.component.html`
- Create: `src/app/pages/admin/teams/admin-teams.component.scss`

- [ ] **Step 1: Create the component TypeScript file**

Create `src/app/pages/admin/teams/admin-teams.component.ts` following the admin groups pattern:

```typescript
import { Component, DestroyRef, inject, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { TeamListItem, Team, TEAM_STATUSES } from '@app/types/team.types';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from '@app/types/pagination.types';
import {
  calculateOffset,
  parsePaginationFromUrl,
  buildPaginationQueryParams,
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/core/services/paginator-intl.service';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { CreateTeamDialogComponent } from '@app/shared/components/create-team-dialog/create-team-dialog.component';
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from './team-members-dialog/team-members-dialog.component';
import { ResponsiblePartiesDialogComponent } from './responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedTeamsDialogComponent } from './related-teams-dialog/related-teams-dialog.component';
import { MetadataDialogComponent, MetadataDialogData } from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

@Component({
  selector: 'app-admin-teams',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
  templateUrl: './admin-teams.component.html',
  styleUrl: './admin-teams.component.scss',
})
export class AdminTeamsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'status', 'members', 'projects', 'modified', 'actions'];
  dataSource = new MatTableDataSource<TeamListItem>([]);

  loading = false;
  filterText = '';
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  pageSizeOptions = PAGE_SIZE_OPTIONS;
  totalTeams = 0;

  private filterSubject$ = new Subject<string>();

  constructor(
    private teamService: TeamService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private translocoService: TranslocoService,
  ) {}

  ngOnInit(): void {
    const urlState = parsePaginationFromUrl(this.route.snapshot.queryParams, DEFAULT_PAGE_SIZE);
    this.pageIndex = urlState.pageIndex;
    this.pageSize = urlState.pageSize;
    this.filterText = urlState.filter || '';

    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.filterText = value;
        this.pageIndex = 0;
        this.loadTeams();
        this.updateUrl();
      });

    this.loadTeams();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTeams();
    this.updateUrl();
  }

  onClose(): void {
    void this.router.navigate(['/admin']);
  }

  onAddTeam(): void {
    const dialogRef = this.dialog.open(CreateTeamDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
      if (result) {
        this.loadTeams();
      }
    });
  }

  onEditDetails(team: TeamListItem): void {
    this.teamService.get(team.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: fullTeam => {
        const dialogRef = this.dialog.open(EditTeamDialogComponent, {
          width: '500px',
          maxWidth: '90vw',
          data: { team: fullTeam },
        });
        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          if (result) {
            this.loadTeams();
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load team details', error);
      },
    });
  }

  onMembers(team: TeamListItem): void {
    this.teamService.get(team.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: fullTeam => {
        const dialogRef = this.dialog.open(TeamMembersDialogComponent, {
          width: '600px',
          maxWidth: '90vw',
          data: { team: fullTeam },
        });
        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          if (result) {
            this.loadTeams();
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load team for members', error);
      },
    });
  }

  onResponsibleParties(team: TeamListItem): void {
    this.teamService.get(team.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: fullTeam => {
        const dialogRef = this.dialog.open(ResponsiblePartiesDialogComponent, {
          width: '600px',
          maxWidth: '90vw',
          data: { team: fullTeam },
        });
        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          if (result) {
            this.loadTeams();
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load team for responsible parties', error);
      },
    });
  }

  onRelatedTeams(team: TeamListItem): void {
    this.teamService.get(team.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: fullTeam => {
        const dialogRef = this.dialog.open(RelatedTeamsDialogComponent, {
          width: '600px',
          maxWidth: '90vw',
          data: { team: fullTeam },
        });
        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
          if (result) {
            this.loadTeams();
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load team for related teams', error);
      },
    });
  }

  onMetadata(team: TeamListItem): void {
    this.teamService.get(team.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: fullTeam => {
        const dialogRef = this.dialog.open(MetadataDialogComponent, {
          width: '800px',
          maxWidth: '90vw',
          data: {
            metadata: fullTeam.metadata || [],
            isReadOnly: false,
            objectType: 'team',
            objectName: fullTeam.name,
          } as MetadataDialogData,
        });
        dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(metadata => {
          if (metadata) {
            this.teamService.patch(fullTeam.id, { metadata }).pipe(
              takeUntilDestroyed(this.destroyRef),
            ).subscribe({
              next: () => this.loadTeams(),
              error: error => this.logger.error('Failed to update team metadata', error),
            });
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load team for metadata', error);
      },
    });
  }

  onDelete(team: TeamListItem): void {
    // Use browser confirm() consistent with admin groups pattern
    const message = this.translocoService.translate('teams.deleteDialog.message', { name: team.name });
    let fullMessage = message;

    if (team.project_count && team.project_count > 0) {
      const warning = this.translocoService.translate('teams.deleteDialog.projectWarning', { count: team.project_count });
      fullMessage = `${message}\n\n${warning}`;
    }

    if (!confirm(fullMessage)) return;

    this.teamService.delete(team.id).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        const adjusted = adjustPageAfterDeletion(
          this.pageIndex,
          this.dataSource.data.length,
          this.totalTeams - 1,
        );
        this.pageIndex = adjusted;
        this.loadTeams();
      },
      error: error => {
        this.logger.error('Failed to delete team', error);
      },
    });
  }

  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return `teams.status.${status}`;
  }

  private loadTeams(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.teamService.list({
      limit: this.pageSize,
      offset,
      name: this.filterText || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.dataSource.data = response.teams;
        this.totalTeams = response.total;
        this.loading = false;
      },
      error: error => {
        this.logger.error('Failed to load teams', error);
        this.loading = false;
      },
    });
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      { pageIndex: this.pageIndex, pageSize: this.pageSize },
      this.filterText,
      DEFAULT_PAGE_SIZE,
    );
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
```

**Note:** The above component references several dialog components that don't exist yet (EditTeamDialog, TeamMembersDialog, etc.). These are created in later tasks. The component should still compile if you create placeholder/stub files for them, or implement them in order. The recommended approach is to implement all dialog components before this component, OR create this component with the dialog imports commented out and uncomment them as each dialog is created. The implementer should use their judgment.

Alternatively, create the component first with only the `onAddTeam` and `onDelete` actions wired up (since `CreateTeamDialogComponent` and `ConfirmDialogComponent` already exist), then add the remaining kebab actions as each dialog is completed.

- [ ] **Step 2: Create the template**

Create `src/app/pages/admin/teams/admin-teams.component.html`:

```html
<div class="admin-page-container">
  <div class="admin-header">
    <div class="header-content">
      <h1 [transloco]="'teams.title'">Manage Teams</h1>
      <p class="subtitle" [transloco]="'teams.subtitle'">
        Create, edit, and manage teams, members, and relationships
      </p>
    </div>
    <div class="action-buttons">
      <button
        mat-icon-button
        (click)="onClose()"
        [matTooltip]="'common.close' | transloco"
        [attr.aria-label]="'common.close' | transloco"
      >
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-card class="filter-card">
    <mat-card-content>
      <mat-form-field class="filter-field" appearance="outline">
        <mat-label [transloco]="'teams.filterLabel'">Filter Teams</mat-label>
        <input
          matInput
          [value]="filterText"
          (input)="onFilterChange($any($event.target).value)"
        />
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
    </mat-card-content>
  </mat-card>

  <mat-card class="teams-card">
    <mat-card-header>
      <mat-card-title [transloco]="'teams.listTitle'">Teams</mat-card-title>
      <div class="action-buttons">
        <button mat-raised-button color="primary" (click)="onAddTeam()">
          <mat-icon>add</mat-icon>
          <span [transloco]="'teams.addButton'">Add Team</span>
        </button>
      </div>
    </mat-card-header>
    <mat-card-content>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (dataSource.data.length > 0) {
        <table mat-table [dataSource]="dataSource" matSort class="teams-table">
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.name' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team" [matTooltip]="team.description || ''">
              {{ team.name }}
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.status' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              @if (team.status) {
                {{ getStatusLabel(team.status) | transloco }}
              } @else {
                —
              }
            </td>
          </ng-container>

          <!-- Members Column -->
          <ng-container matColumnDef="members">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.members' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.member_count ?? 0 }}
            </td>
          </ng-container>

          <!-- Projects Column -->
          <ng-container matColumnDef="projects">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.projects' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.project_count ?? 0 }}
            </td>
          </ng-container>

          <!-- Modified Column -->
          <ng-container matColumnDef="modified">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.modified' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.modified_at | date: 'yyyy-MM-dd' }}
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let team" class="actions-column">
              <button
                mat-icon-button
                [matMenuTriggerFor]="rowKebab"
                [matTooltip]="'common.actions' | transloco"
                [attr.aria-label]="'common.actions' | transloco"
              >
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #rowKebab="matMenu">
                <button mat-menu-item (click)="onEditDetails(team)">
                  <mat-icon>edit</mat-icon>
                  <span [transloco]="'teams.kebab.editDetails'">Edit Details</span>
                </button>
                <button mat-menu-item (click)="onMembers(team)">
                  <mat-icon>group</mat-icon>
                  <span [transloco]="'teams.kebab.members'">Members</span>
                </button>
                <button mat-menu-item (click)="onResponsibleParties(team)">
                  <mat-icon>supervisor_account</mat-icon>
                  <span [transloco]="'teams.kebab.responsibleParties'">Responsible Parties</span>
                </button>
                <button mat-menu-item (click)="onRelatedTeams(team)">
                  <mat-icon>link</mat-icon>
                  <span [transloco]="'teams.kebab.relatedTeams'">Related Teams</span>
                </button>
                <button mat-menu-item (click)="onMetadata(team)">
                  <mat-icon>list</mat-icon>
                  <span [transloco]="'teams.kebab.metadata'">Metadata</span>
                </button>
                <mat-divider></mat-divider>
                <button mat-menu-item (click)="onDelete(team)" class="delete-action">
                  <mat-icon color="warn">delete</mat-icon>
                  <span [transloco]="'teams.kebab.delete'">Delete</span>
                </button>
              </mat-menu>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      } @else {
        <div class="no-items-message">
          <mat-icon class="no-items-icon">groups</mat-icon>
          <p [transloco]="'teams.noTeams'">No teams found</p>
        </div>
      }

      @if (!loading && totalTeams > 0) {
        <mat-paginator
          [length]="totalTeams"
          [pageSize]="pageSize"
          [pageIndex]="pageIndex"
          [pageSizeOptions]="pageSizeOptions"
          (page)="onPageChange($event)"
          showFirstLastButtons
          [attr.aria-label]="'pagination.ariaLabel' | transloco"
        ></mat-paginator>
      }
    </mat-card-content>
  </mat-card>
</div>
```

- [ ] **Step 3: Create the styles**

Create `src/app/pages/admin/teams/admin-teams.component.scss`. Read `src/app/pages/admin/groups/admin-groups.component.scss` and copy its structure, adapting class names (e.g., `.groups-card` → `.teams-card`, `.groups-table` → `.teams-table`). The styles are structurally identical — same admin page container, header, filter card, data card, table, loading/empty states, and responsive breakpoints. The implementer should literally copy the groups SCSS and rename the selectors.

- [ ] **Step 4: Verify build**

Run: `pnpm run build`
Expected: Build will fail because dialog components don't exist yet. This is expected — they are created in Tasks 6-10.

Create empty stub files for the missing dialogs to unblock the build:

```bash
mkdir -p src/app/pages/admin/teams/edit-team-dialog
mkdir -p src/app/pages/admin/teams/team-members-dialog
mkdir -p src/app/pages/admin/teams/responsible-parties-dialog
mkdir -p src/app/pages/admin/teams/related-teams-dialog
```

Create minimal placeholder components in each directory (just empty `@Component` with `selector` and `standalone: true`). These will be replaced in later tasks.

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/teams/
git commit -m "feat: add admin teams list component with stub dialogs (#479)"
```

---

### Task 5: Add routing and dashboard card

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/pages/admin/admin.component.ts`

- [ ] **Step 1: Add admin teams route**

In `src/app/app.routes.ts`, add a new child route under the `admin` path (alongside the existing `users`, `groups`, etc.):

```typescript
{
  path: 'teams',
  loadComponent: () =>
    import('./pages/admin/teams/admin-teams.component').then(c => c.AdminTeamsComponent),
  canActivate: [adminGuard],
},
```

- [ ] **Step 2: Add Teams card to admin dashboard**

In `src/app/pages/admin/admin.component.ts`, add a new entry to the `adminSections` array:

```typescript
{
  title: 'admin.sections.teams.title',
  description: 'admin.sections.teams.description',
  icon: 'groups',
  action: 'teams',
},
```

Place it after the `groups` entry for logical grouping.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/app.routes.ts src/app/pages/admin/admin.component.ts
git commit -m "feat: add admin teams route and dashboard card (#479)"
```

---

## Chunk 3: Create/Edit Dialogs

### Task 6: Update CreateTeamDialog with status dropdown

**Files:**
- Modify: `src/app/shared/components/create-team-dialog/create-team-dialog.component.ts`
- Modify: `src/app/shared/components/create-team-dialog/create-team-dialog.component.html`

- [ ] **Step 1: Update the create dialog**

Read the existing `create-team-dialog.component.ts` and `.html`. Make these changes:

1. Import `TEAM_STATUSES, TeamStatus` from `@app/types/team.types`
2. Add `teamStatuses = TEAM_STATUSES` as a class property
3. Replace the `status` text input with a `<mat-select>` dropdown:

```html
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
```

4. Update description `maxlength` from 1024 to 2048 (in both the validator and the template `maxLength` attribute)

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/components/create-team-dialog/
git commit -m "refactor: update CreateTeamDialog with status dropdown and maxlength (#479)"
```

---

### Task 7: Create EditTeamDialog

**Files:**
- Create: `src/app/pages/admin/teams/edit-team-dialog/edit-team-dialog.component.ts`

- [ ] **Step 1: Create the edit team dialog**

Replace the stub placeholder with the full implementation. This is an inline-template dialog (following the create team dialog pattern) with:

- Pre-populated form fields: name (required, max 256), description (max 2048, textarea), email_address (email validation), uri (URL type), status (dropdown with `TEAM_STATUSES`)
- Injected data: `{ team: Team }`
- Save via `TeamService.update()`
- Same error handling pattern as create dialog

```typescript
import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Team, TEAM_STATUSES } from '@app/types/team.types';

export interface EditTeamDialogData {
  team: Team;
}

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'teams.editDialog.title'">Edit Team</h2>
    <mat-dialog-content>
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
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button mat-raised-button color="primary" (click)="onSave()" [disabled]="!form.valid || !form.dirty || saving">
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'teams.editDialog.save'">Save</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .admin-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 400px;
      padding: 8px 0;
    }
    .full-width { width: 100%; }
    .form-error { color: var(--theme-error); font-size: 12px; padding: 0 16px; }
    .button-spinner { display: inline-block; margin-right: 8px; }
  `],
})
export class EditTeamDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  saving = false;
  errorMessage = '';
  teamStatuses = TEAM_STATUSES;

  constructor(
    private dialogRef: MatDialogRef<EditTeamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTeamDialogData,
    private teamService: TeamService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const team = this.data.team;
    this.form = this.fb.group({
      name: [team.name, [Validators.required, Validators.maxLength(256)]],
      description: [team.description || '', [Validators.maxLength(2048)]],
      email_address: [team.email_address || '', [Validators.email]],
      uri: [team.uri || ''],
      status: [team.status || null],
    });
  }

  onSave(): void {
    if (!this.form.valid || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const input = {
      ...this.form.value,
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim(),
      email_address: this.form.value.email_address?.trim() || undefined,
      uri: this.form.value.uri?.trim() || undefined,
    };

    this.teamService.update(this.data.team.id, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update team', error);
          this.errorMessage = error.error?.message || 'Failed to update team. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/teams/edit-team-dialog/
git commit -m "feat: add edit team dialog (#479)"
```

---

## Chunk 4: Members & Responsible Parties

### Task 8: Extend UserPickerDialog with role selector

**Files:**
- Modify: `src/app/shared/components/user-picker-dialog/user-picker-dialog.component.ts`

- [ ] **Step 1: Add optional role selector to UserPickerDialog**

Read the existing `user-picker-dialog.component.ts`. Add:

1. Extend `UserPickerDialogData` with optional role fields:

```typescript
export interface UserPickerDialogData {
  title: string;
  excludeUserId?: string;
  showRoleSelector?: boolean;
  roles?: string[];
  roleTranslocoPrefix?: string;
}

export interface UserPickerDialogResult {
  user: AdminUser;
  role?: string;
  customRole?: string;
}
```

2. Add `selectedRole` and `customRole` properties to the component
3. Add role selector UI in the template (shown only when `data.showRoleSelector` is true), between the user selection and the action buttons:

```html
@if (data.showRoleSelector && selectedUser) {
  <mat-form-field appearance="outline" class="full-width role-field">
    <mat-label [transloco]="'teams.membersDialog.role'">Role</mat-label>
    <mat-select [(value)]="selectedRole">
      @for (role of data.roles; track role) {
        <mat-option [value]="role">
          {{ data.roleTranslocoPrefix + role | transloco }}
        </mat-option>
      }
    </mat-select>
  </mat-form-field>
  @if (selectedRole === 'other') {
    <mat-form-field appearance="outline" class="full-width">
      <mat-label [transloco]="'teams.membersDialog.customRole'">Custom Role</mat-label>
      <input matInput [(ngModel)]="customRole" />
    </mat-form-field>
  }
}
```

4. Update `onConfirm()` to return `UserPickerDialogResult` instead of just `AdminUser`:

```typescript
onConfirm(): void {
  if (this.selectedUser) {
    if (this.data.showRoleSelector) {
      this.dialogRef.close({
        user: this.selectedUser,
        role: this.selectedRole || undefined,
        customRole: this.customRole || undefined,
      } as UserPickerDialogResult);
    } else {
      this.dialogRef.close(this.selectedUser);
    }
  }
}
```

5. Update the confirm button disabled state: when role selector is shown, require a role to be selected:

```html
<button mat-raised-button color="primary" (click)="onConfirm()"
  [disabled]="!selectedUser || (data.showRoleSelector && !selectedRole)">
```

- [ ] **Step 2: Verify existing usages still work**

The change is backward-compatible: when `showRoleSelector` is not set, the dialog behaves exactly as before (returns `AdminUser`). Verify no existing callers break.

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/shared/components/user-picker-dialog/
git commit -m "feat: add optional role selector to UserPickerDialog (#479)"
```

---

### Task 9: Create TeamMembersDialog

**Files:**
- Create: `src/app/pages/admin/teams/team-members-dialog/team-members-dialog.component.ts`

- [ ] **Step 1: Create the team members dialog**

Replace the stub with a full inline-template dialog. Key implementation details:

**Data flow:**
1. Component receives `{ team: Team }` via `MAT_DIALOG_DATA`
2. On init, creates a local copy: `members = [...(team.members || [])]`
3. `dirty` flag tracks whether changes were made
4. "Add Member" opens `UserPickerDialog` as a nested dialog; on close, if result is returned, pushes a new `TeamMember` onto the local array and sets `dirty = true`
5. "Remove" removes from local array and sets `dirty = true`
6. "Save" calls `TeamService.patch(team.id, { members: this.members })`, then closes dialog with `true`
7. "Cancel" closes with `false`

**Opening the UserPickerDialog:**
```typescript
const dialogRef = this.dialog.open(UserPickerDialogComponent, {
  width: '500px',
  maxWidth: '90vw',
  data: {
    title: this.translocoService.translate('teams.membersDialog.addMember'),
    showRoleSelector: true,
    roles: TEAM_MEMBER_ROLES,
    roleTranslocoPrefix: 'teams.roles.',
  } as UserPickerDialogData,
});
dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(result => {
  if (result) {
    const pickerResult = result as UserPickerDialogResult;
    // Check for duplicate — skip if user already in members list
    if (this.members.some(m => m.user_id === pickerResult.user.internal_uuid)) return;
    this.members.push({
      user_id: pickerResult.user.internal_uuid,
      user: { display_name: pickerResult.user.name, email: pickerResult.user.email } as User,
      role: pickerResult.role as TeamMemberRole,
      custom_role: pickerResult.customRole,
    });
    this.dirty = true;
  }
});
```

**Template structure (inline):**
- Title: `teams.membersDialog.title`
- Dialog content: list of members (or empty message `teams.membersDialog.noMembers`)
- Each member row: `<div class="member-row">` with user name/email on left, role label (localized) in middle, remove button on right
- "Add Member" button below the list
- Dialog actions: Cancel / Save (disabled when `!dirty || saving`)

**Imports needed:** `DIALOG_IMPORTS`, `FORM_MATERIAL_IMPORTS`, `FEEDBACK_MATERIAL_IMPORTS`, `TranslocoModule`, `UserPickerDialogComponent`, `UserPickerDialogData`, `UserPickerDialogResult`, `TeamService`, `LoggerService`, `Team`, `TeamMember`, `TEAM_MEMBER_ROLES`, `TeamMemberRole`

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/teams/team-members-dialog/
git commit -m "feat: add team members dialog (#479)"
```

---

### Task 10: Create ResponsiblePartiesDialog

**Files:**
- Create: `src/app/pages/admin/teams/responsible-parties-dialog/responsible-parties-dialog.component.ts`

- [ ] **Step 1: Create the responsible parties dialog**

Replace the stub. This follows the same pattern as `TeamMembersDialogComponent` (Task 9) with these differences:

**Data flow:**
1. Receives `{ team: Team }` via `MAT_DIALOG_DATA`
2. Local copy: `parties = [...(team.responsible_parties || [])]`
3. "Add" opens `UserPickerDialog` with same config as members (role selector enabled, `TEAM_MEMBER_ROLES`)
4. Duplicate check uses `parties.some(p => p.user_id === pickerResult.user.internal_uuid)`
5. Pushes `ResponsibleParty` (not `TeamMember`) onto array
6. "Save" calls `TeamService.patch(team.id, { responsible_parties: this.parties })`

**i18n keys:** `teams.responsiblePartiesDialog.title`, `teams.responsiblePartiesDialog.addParty`, `teams.responsiblePartiesDialog.noParties`, `teams.responsiblePartiesDialog.removeParty`

**Template:** Same structure as members dialog — list of parties with name/role/remove, add button, save/cancel. Use inline template.

**Imports:** Same as TeamMembersDialog but import `ResponsibleParty` instead of `TeamMember` from `@app/types/team.types`.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/teams/responsible-parties-dialog/
git commit -m "feat: add responsible parties dialog (#479)"
```

---

## Chunk 5: Related Teams, Metadata, and Cleanup

### Task 11: Create RelatedTeamsDialog

**Files:**
- Create: `src/app/pages/admin/teams/related-teams-dialog/related-teams-dialog.component.ts`

- [ ] **Step 1: Create the related teams dialog**

Replace the stub with a full inline-template dialog. Key implementation details:

**Data flow:**
1. Receives `{ team: Team }` via `MAT_DIALOG_DATA`
2. Local copy: `relatedTeams = [...(team.related_teams || [])]`
3. `showAddForm` boolean toggles the inline add form
4. `dirty` flag tracks changes

**Inline add form (shown when `showAddForm` is true):**
- Has its own `FormGroup` with `teamSearch` (FormControl), `relationship` (required), `customRelationship`
- Team search uses `<mat-autocomplete>` with a `filteredTeams$` observable:
  ```typescript
  this.filteredTeams$ = this.addForm.get('teamSearch')!.valueChanges.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(value => {
      if (typeof value === 'string' && value.length >= 2) {
        return this.teamService.list({ name: value, limit: 10 }).pipe(
          map(response => response.teams.filter(t => t.id !== this.data.team.id)),
        );
      }
      return of([]);
    }),
  );
  ```
- `displayTeam(team: TeamListItem): string` returns `team?.name || ''`
- On autocomplete selection, store the selected `TeamListItem`
- Relationship type dropdown with `RELATIONSHIP_TYPES`, localized via `teams.relationships.<type>`
- Custom relationship text input shown when `relationship === 'other'`
- "Add" button: pushes `{ related_team_id: selectedTeam.id, relationship, custom_relationship }` onto `relatedTeams`, resets the form, hides add form, sets `dirty = true`

**List view:**
- Each row shows: related team name (resolved from the `RelatedTeam` entry — note: the server may not return the team name inline, so you may need to display the `related_team_id` or resolve it), relationship type label, remove button
- The related team name can be displayed if the server includes it in the GET response, otherwise show the ID. Check what the API actually returns.

**Template structure (inline):**
- Title: `teams.relatedTeamsDialog.title`
- List of related teams (or empty message)
- Toggle "Add Related Team" button
- Inline add form (when visible)
- Dialog actions: Cancel / Save

**Imports:** `DIALOG_IMPORTS`, `FORM_MATERIAL_IMPORTS`, `FEEDBACK_MATERIAL_IMPORTS`, `MatAutocompleteModule`, `TranslocoModule`, `TeamService`, `LoggerService`, `Team`, `RelatedTeam`, `RELATIONSHIP_TYPES`, `TeamListItem`

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/admin/teams/related-teams-dialog/
git commit -m "feat: add related teams dialog (#479)"
```

---

### Task 12: Wire up all dialogs in AdminTeamsComponent

**Files:**
- Modify: `src/app/pages/admin/teams/admin-teams.component.ts`

- [ ] **Step 1: Remove stubs and verify all dialog imports**

If stub placeholder files were created in Task 4, they should now be replaced by the real dialog implementations from Tasks 7, 9, 10, and 11. Verify that all imports in `admin-teams.component.ts` resolve correctly:

```typescript
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from './team-members-dialog/team-members-dialog.component';
import { ResponsiblePartiesDialogComponent } from './responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedTeamsDialogComponent } from './related-teams-dialog/related-teams-dialog.component';
```

Also verify the `MetadataDialogComponent` import and the `ConfirmDialogComponent` import resolve.

- [ ] **Step 2: Verify build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit (if changes were needed)**

```bash
git add src/app/pages/admin/teams/
git commit -m "refactor: wire up all team dialog imports (#479)"
```

---

### Task 13: Lint, build, and final verification

**Files:**
- All modified files

- [ ] **Step 1: Run linter**

Run: `pnpm run lint:all`
Expected: No lint errors. Fix any that arise.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Clean build with no errors.

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Commit any fixes**

If lint or test fixes were needed:
```bash
git add src/app/pages/admin/teams/ src/app/shared/components/ src/app/core/services/ src/app/types/
git commit -m "style: lint fixes for admin teams (#479)"
```
