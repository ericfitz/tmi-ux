# User Teams & Projects Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create user-facing `/teams` and `/projects` pages that mirror the admin equivalents (minus delete), allowing non-admin users to view and edit their teams and projects.

**Architecture:** Clone the admin team/project list components with modifications (no delete, `Location.back()` navigation, user-oriented headers). Relocate five dialog components from `admin/` to `shared/components/` so both admin and user pages can import them. Add i18n keys for user-facing text.

**Tech Stack:** Angular 19, Angular Material, Transloco (i18n), Vitest (tests)

---

## File Structure

### Files to Move (rename/relocate)

| Source | Destination |
|--------|-------------|
| `src/app/pages/admin/teams/edit-team-dialog/edit-team-dialog.component.ts` | `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts` |
| `src/app/pages/admin/teams/team-members-dialog/team-members-dialog.component.ts` | `src/app/shared/components/team-members-dialog/team-members-dialog.component.ts` |
| `src/app/pages/admin/teams/related-teams-dialog/related-teams-dialog.component.ts` | `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts` |
| `src/app/pages/admin/projects/edit-project-dialog/edit-project-dialog.component.ts` | `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts` |
| `src/app/pages/admin/projects/related-projects-dialog/related-projects-dialog.component.ts` | `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts` |

### Files to Create

| File | Purpose |
|------|---------|
| `src/app/pages/teams/teams.component.ts` | User teams list page |
| `src/app/pages/teams/teams.component.html` | User teams template |
| `src/app/pages/teams/teams.component.scss` | User teams styles |
| `src/app/pages/teams/teams.component.spec.ts` | User teams unit tests |
| `src/app/pages/projects/projects.component.ts` | User projects list page |
| `src/app/pages/projects/projects.component.html` | User projects template |
| `src/app/pages/projects/projects.component.scss` | User projects styles |
| `src/app/pages/projects/projects.component.spec.ts` | User projects unit tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/pages/admin/teams/admin-teams.component.ts` | Update dialog import paths |
| `src/app/pages/admin/projects/admin-projects.component.ts` | Update dialog import paths |
| `src/app/app.routes.ts` | Add `/teams` and `/projects` routes |
| `src/assets/i18n/en-US.json` | Add `userTeams.*` and `userProjects.*` keys |

---

### Task 1: Relocate Team Dialog Components to Shared

**Files:**
- Move: `src/app/pages/admin/teams/edit-team-dialog/edit-team-dialog.component.ts` → `src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts`
- Move: `src/app/pages/admin/teams/team-members-dialog/team-members-dialog.component.ts` → `src/app/shared/components/team-members-dialog/team-members-dialog.component.ts`
- Move: `src/app/pages/admin/teams/related-teams-dialog/related-teams-dialog.component.ts` → `src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts`
- Modify: `src/app/pages/admin/teams/admin-teams.component.ts`

- [ ] **Step 1: Move edit-team-dialog**

```bash
mkdir -p src/app/shared/components/edit-team-dialog
git mv src/app/pages/admin/teams/edit-team-dialog/edit-team-dialog.component.ts src/app/shared/components/edit-team-dialog/edit-team-dialog.component.ts
```

- [ ] **Step 2: Move team-members-dialog**

```bash
mkdir -p src/app/shared/components/team-members-dialog
git mv src/app/pages/admin/teams/team-members-dialog/team-members-dialog.component.ts src/app/shared/components/team-members-dialog/team-members-dialog.component.ts
```

- [ ] **Step 3: Move related-teams-dialog**

```bash
mkdir -p src/app/shared/components/related-teams-dialog
git mv src/app/pages/admin/teams/related-teams-dialog/related-teams-dialog.component.ts src/app/shared/components/related-teams-dialog/related-teams-dialog.component.ts
```

- [ ] **Step 4: Update admin-teams.component.ts import paths**

In `src/app/pages/admin/teams/admin-teams.component.ts`, change these three imports:

```typescript
// OLD:
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from './team-members-dialog/team-members-dialog.component';
import { RelatedTeamsDialogComponent } from './related-teams-dialog/related-teams-dialog.component';

// NEW:
import { EditTeamDialogComponent } from '@app/shared/components/edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from '@app/shared/components/team-members-dialog/team-members-dialog.component';
import { RelatedTeamsDialogComponent } from '@app/shared/components/related-teams-dialog/related-teams-dialog.component';
```

- [ ] **Step 5: Remove empty directories**

```bash
rmdir src/app/pages/admin/teams/edit-team-dialog
rmdir src/app/pages/admin/teams/team-members-dialog
rmdir src/app/pages/admin/teams/related-teams-dialog
```

- [ ] **Step 6: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: relocate team dialog components to shared"
```

---

### Task 2: Relocate Project Dialog Components to Shared

**Files:**
- Move: `src/app/pages/admin/projects/edit-project-dialog/edit-project-dialog.component.ts` → `src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts`
- Move: `src/app/pages/admin/projects/related-projects-dialog/related-projects-dialog.component.ts` → `src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts`
- Modify: `src/app/pages/admin/projects/admin-projects.component.ts`

- [ ] **Step 1: Move edit-project-dialog**

```bash
mkdir -p src/app/shared/components/edit-project-dialog
git mv src/app/pages/admin/projects/edit-project-dialog/edit-project-dialog.component.ts src/app/shared/components/edit-project-dialog/edit-project-dialog.component.ts
```

- [ ] **Step 2: Move related-projects-dialog**

```bash
mkdir -p src/app/shared/components/related-projects-dialog
git mv src/app/pages/admin/projects/related-projects-dialog/related-projects-dialog.component.ts src/app/shared/components/related-projects-dialog/related-projects-dialog.component.ts
```

- [ ] **Step 3: Update admin-projects.component.ts import paths**

In `src/app/pages/admin/projects/admin-projects.component.ts`, change these two imports:

```typescript
// OLD:
import { EditProjectDialogComponent } from './edit-project-dialog/edit-project-dialog.component';
import { RelatedProjectsDialogComponent } from './related-projects-dialog/related-projects-dialog.component';

// NEW:
import { EditProjectDialogComponent } from '@app/shared/components/edit-project-dialog/edit-project-dialog.component';
import { RelatedProjectsDialogComponent } from '@app/shared/components/related-projects-dialog/related-projects-dialog.component';
```

- [ ] **Step 4: Remove empty directories**

```bash
rmdir src/app/pages/admin/projects/edit-project-dialog
rmdir src/app/pages/admin/projects/related-projects-dialog
```

- [ ] **Step 5: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: relocate project dialog components to shared"
```

---

### Task 3: Add i18n Keys for User Pages

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add userTeams and userProjects keys to en-US.json**

Add the following keys to the English locale file. Place them alphabetically among the top-level keys (after `userPreferences` if it exists, or at the appropriate alphabetical position):

```json
"userTeams": {
  "title": "My Teams",
  "subtitle": "View and edit your teams, members, and relationships",
  "listTitle": "Teams",
  "noTeams": "{{teams.noTeams}}"
},
"userProjects": {
  "title": "My Projects",
  "subtitle": "View and edit your projects, teams, and relationships",
  "listTitle": "Projects",
  "noProjects": "{{projects.noProjects}}"
}
```

These keys reuse existing `teams.*` and `projects.*` keys for everything except the page header text.

- [ ] **Step 2: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat: add i18n keys for user teams and projects pages"
```

---

### Task 4: Create User Teams Component

**Files:**
- Create: `src/app/pages/teams/teams.component.ts`
- Create: `src/app/pages/teams/teams.component.html`
- Create: `src/app/pages/teams/teams.component.scss`

- [ ] **Step 1: Create teams.component.scss**

Create `src/app/pages/teams/teams.component.scss` — same styles as admin teams but with renamed CSS class prefix `page-container` instead of `admin-page-container`, and `page-header` instead of `admin-header`:

```scss
.page-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-content {
    flex: 1;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 500;
    color: var(--theme-text-primary);
  }

  .subtitle {
    color: var(--theme-text-secondary);
    margin: 0;
    font-size: 14px;
  }
}

.filter-card {
  margin-bottom: 24px;

  mat-card-content {
    padding: 16px;
  }

  .filter-field {
    width: 100%;

    mat-icon {
      display: flex;
      align-items: center;
    }
  }
}

.teams-card {
  margin-bottom: 24px;

  mat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 16px 16px 0;

    mat-card-title {
      flex: 1;
      margin: 0;
    }

    .action-buttons {
      margin-left: auto;

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }

  mat-card-content {
    padding: 0;
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px 0;
}

.teams-table {
  width: 100%;

  .actions-column {
    width: 140px;
    text-align: center;

    .action-buttons {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
}

.no-items-message {
  text-align: center;
  padding: 48px 24px;
  color: var(--theme-text-secondary);

  .no-items-icon {
    font-size: 64px;
    width: 64px;
    height: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  p {
    margin: 0;
    font-style: italic;
    font-size: 14px;
  }
}

@media (width <= 768px) {
  .page-container {
    padding: 16px;
  }

  .page-header {
    h1 {
      font-size: 24px;
    }
  }

  .teams-card {
    mat-card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;

      .action-buttons {
        width: 100%;
        margin-left: 0;

        button {
          width: 100%;
          justify-content: center;
        }
      }
    }
  }
}
```

- [ ] **Step 2: Create teams.component.html**

Create `src/app/pages/teams/teams.component.html` — mirrors admin template but uses `userTeams.*` i18n keys, `page-container`/`page-header` CSS classes, and omits delete from the kebab menu:

```html
<div class="page-container">
  <div class="page-header">
    <div class="header-content">
      <h1 [transloco]="'userTeams.title'">My Teams</h1>
      <p class="subtitle" [transloco]="'userTeams.subtitle'">
        View and edit your teams, members, and relationships
      </p>
    </div>
    <div class="action-buttons">
      <button mat-icon-button (click)="onClose()" [matTooltip]="'common.close' | transloco">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-card class="filter-card">
    <mat-card-content>
      <mat-form-field class="filter-field" appearance="outline">
        <mat-label [transloco]="'teams.filterLabel'">Filter Teams</mat-label>
        <input matInput [value]="filterText" (input)="onFilterChange($any($event.target).value)" />
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
    </mat-card-content>
  </mat-card>

  <mat-card class="teams-card">
    <mat-card-header>
      <mat-card-title [transloco]="'userTeams.listTitle'">Teams</mat-card-title>
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
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.name' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team" [matTooltip]="team.description || ''">
              {{ team.name }}
            </td>
          </ng-container>

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

          <ng-container matColumnDef="members">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.members' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.member_count ?? 0 }}
            </td>
          </ng-container>

          <ng-container matColumnDef="projects">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.projects' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.project_count ?? 0 }}
            </td>
          </ng-container>

          <ng-container matColumnDef="modified">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'teams.columns.modified' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team">
              {{ team.modified_at | date: 'yyyy-MM-dd' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-column">
              {{ 'common.actions' | transloco }}
            </th>
            <td mat-cell *matCellDef="let team" class="actions-column">
              <div class="action-buttons">
                <button
                  mat-icon-button
                  (click)="onEditDetails(team)"
                  [matTooltip]="'common.edit' | transloco"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  (click)="onMembers(team)"
                  [matTooltip]="'teams.kebab.members' | transloco"
                >
                  <mat-icon>group</mat-icon>
                </button>
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="rowKebab"
                  [matTooltip]="'common.moreActions' | transloco"
                  (click)="$event.stopPropagation()"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowKebab="matMenu">
                  <button mat-menu-item (click)="onResponsibleParties(team)">
                    <mat-icon>supervisor_account</mat-icon>
                    <span [transloco]="'teams.kebab.responsibleParties'">
                      Responsible Parties
                    </span>
                  </button>
                  <button mat-menu-item (click)="onRelatedTeams(team)">
                    <mat-icon>link</mat-icon>
                    <span [transloco]="'teams.kebab.relatedTeams'">Related Teams</span>
                  </button>
                  <button mat-menu-item (click)="onMetadata(team)">
                    <mat-icon>list</mat-icon>
                    <span [transloco]="'teams.kebab.metadata'">Metadata</span>
                  </button>
                </mat-menu>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      } @else {
        <div class="no-items-message">
          <mat-icon class="no-items-icon">groups</mat-icon>
          <p [transloco]="'userTeams.noTeams'">No teams found</p>
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

- [ ] **Step 3: Create teams.component.ts**

Create `src/app/pages/teams/teams.component.ts` — clone of `AdminTeamsComponent` with these changes:
- Class name: `TeamsComponent`
- Selector: `app-teams`
- Uses `Location.back()` for close instead of `router.navigate(['/admin'])`
- No `onDelete` method
- No `TranslocoService` injection (only needed for delete confirmation)
- No `adjustPageAfterDeletion` import

```typescript
import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
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
import { TeamListItem, ResponsibleParty } from '@app/types/team.types';
import { Metadata } from '@app/types/metadata.types';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '@app/types/pagination.types';
import {
  calculateOffset,
  parsePaginationFromUrl,
  buildPaginationQueryParams,
} from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  CreateTeamDialogComponent,
  CreateTeamDialogResult,
} from '@app/shared/components/create-team-dialog/create-team-dialog.component';
import { EditTeamDialogComponent } from '@app/shared/components/edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from '@app/shared/components/team-members-dialog/team-members-dialog.component';
import {
  ResponsiblePartiesDialogComponent,
  ResponsiblePartiesDialogData,
} from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedTeamsDialogComponent } from '@app/shared/components/related-teams-dialog/related-teams-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * User Teams Component
 *
 * Displays and manages the current user's teams. Supports listing, filtering,
 * pagination, and actions for editing details, members, responsible parties,
 * related teams, and metadata.
 */
@Component({
  selector: 'app-teams',
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
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss',
})
export class TeamsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'status', 'members', 'projects', 'modified', 'actions'];
  dataSource = new MatTableDataSource<TeamListItem>([]);

  loading = false;
  filterText = '';
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  totalTeams = 0;

  constructor(
    private teamService: TeamService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private dialog: MatDialog,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const urlState = parsePaginationFromUrl(this.route.snapshot.queryParams, DEFAULT_PAGE_SIZE);
    this.pageIndex = urlState.pageIndex;
    this.pageSize = urlState.pageSize;
    this.filterText =
      (this.route.snapshot.queryParams[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';

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

  /** Handle filter input changes with debounce. */
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  /** Handle paginator page changes. */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTeams();
    this.updateUrl();
  }

  /** Navigate back to the previous page. */
  onClose(): void {
    this.location.back();
  }

  /** Open the create team dialog. */
  onAddTeam(): void {
    const dialogRef = this.dialog.open(CreateTeamDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateTeamDialogResult | undefined) => {
        if (result) {
          this.teamService
            .create(result)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.loadTeams(),
              error: error => this.logger.error('Failed to create team', error),
            });
        }
      });
  }

  /** Open the edit team details dialog for the given row. */
  onEditDetails(team: TeamListItem): void {
    this.teamService
      .get(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullTeam => {
          const dialogRef = this.dialog.open(EditTeamDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            data: { team: fullTeam },
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
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

  /** Open the team members management dialog. */
  onMembers(team: TeamListItem): void {
    this.teamService
      .get(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullTeam => {
          const dialogRef = this.dialog.open(TeamMembersDialogComponent, {
            width: '600px',
            maxWidth: '90vw',
            data: { team: fullTeam },
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
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

  /** Open the responsible parties management dialog. */
  onResponsibleParties(team: TeamListItem): void {
    this.teamService
      .get(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullTeam => {
          const dialogRef = this.dialog.open(ResponsiblePartiesDialogComponent, {
            width: '600px',
            maxWidth: '90vw',
            data: {
              entityId: fullTeam.id,
              entityType: 'team' as const,
              parties: fullTeam.responsible_parties || [],
              patchFn: (id: string, parties: ResponsibleParty[]) =>
                this.teamService.patch(id, { responsible_parties: parties }),
            } as ResponsiblePartiesDialogData,
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
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

  /** Open the related teams management dialog. */
  onRelatedTeams(team: TeamListItem): void {
    this.teamService
      .get(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullTeam => {
          const dialogRef = this.dialog.open(RelatedTeamsDialogComponent, {
            width: '600px',
            maxWidth: '90vw',
            data: { team: fullTeam },
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
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

  /** Open the metadata dialog for the given team. */
  onMetadata(team: TeamListItem): void {
    this.teamService
      .get(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((metadata: Metadata[] | undefined) => {
              if (metadata) {
                this.teamService
                  .patch(fullTeam.id, { metadata })
                  .pipe(takeUntilDestroyed(this.destroyRef))
                  .subscribe({
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

  /**
   * Returns the i18n key for a team status label.
   * @param status - The team status value
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return `teams.status.${status}`;
  }

  private loadTeams(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.teamService
      .list({
        limit: this.pageSize,
        offset,
        name: this.filterText || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
      { pageIndex: this.pageIndex, pageSize: this.pageSize, total: this.totalTeams },
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

- [ ] **Step 4: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/teams/
git commit -m "feat: create user teams page component"
```

---

### Task 5: Create User Projects Component

**Files:**
- Create: `src/app/pages/projects/projects.component.ts`
- Create: `src/app/pages/projects/projects.component.html`
- Create: `src/app/pages/projects/projects.component.scss`

- [ ] **Step 1: Create projects.component.scss**

Create `src/app/pages/projects/projects.component.scss` — same styles as admin projects but with `page-container`/`page-header` CSS class names:

```scss
.page-container {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;

  .header-content {
    flex: 1;
  }

  h1 {
    margin: 0 0 8px;
    font-size: 28px;
    font-weight: 500;
    color: var(--theme-text-primary);
  }

  .subtitle {
    color: var(--theme-text-secondary);
    margin: 0;
    font-size: 14px;
  }
}

.filter-card {
  margin-bottom: 24px;

  mat-card-content {
    padding: 16px;
  }

  .filter-row {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;

    .filter-field {
      flex: 1;
      min-width: 200px;

      mat-icon {
        display: flex;
        align-items: center;
      }
    }

    .clear-filters-btn {
      margin-top: 8px;
      white-space: nowrap;
    }
  }
}

.projects-card {
  margin-bottom: 24px;

  mat-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding: 16px 16px 0;

    mat-card-title {
      flex: 1;
      margin: 0;
    }

    .action-buttons {
      margin-left: auto;

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }

  mat-card-content {
    padding: 0;
  }
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px 0;
}

.projects-table {
  width: 100%;

  .actions-column {
    width: 120px;
    text-align: center;

    .action-buttons {
      display: flex;
      justify-content: center;
      align-items: center;
    }
  }
}

.no-items-message {
  text-align: center;
  padding: 48px 24px;
  color: var(--theme-text-secondary);

  .no-items-icon {
    font-size: 64px;
    width: 64px;
    height: 64px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  p {
    margin: 0;
    font-style: italic;
    font-size: 14px;
  }
}

@media (width <= 768px) {
  .page-container {
    padding: 16px;
  }

  .page-header {
    h1 {
      font-size: 24px;
    }
  }

  .projects-card {
    mat-card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;

      .action-buttons {
        width: 100%;
        margin-left: 0;

        button {
          width: 100%;
          justify-content: center;
        }
      }
    }
  }
}
```

- [ ] **Step 2: Create projects.component.html**

Create `src/app/pages/projects/projects.component.html` — mirrors admin template but uses `userProjects.*` i18n keys, `page-container`/`page-header` CSS classes, and omits delete from the kebab menu:

```html
<div class="page-container">
  <div class="page-header">
    <div class="header-content">
      <h1 [transloco]="'userProjects.title'">My Projects</h1>
      <p class="subtitle" [transloco]="'userProjects.subtitle'">
        View and edit your projects, teams, and relationships
      </p>
    </div>
    <div class="action-buttons">
      <button mat-icon-button (click)="onClose()" [matTooltip]="'common.close' | transloco">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  </div>

  <mat-card class="filter-card">
    <mat-card-content>
      <div class="filter-row">
        <mat-form-field class="filter-field" appearance="outline">
          <mat-label [transloco]="'projects.filterNameLabel'">Filter by Name</mat-label>
          <input
            matInput
            [value]="filterName"
            (input)="onNameFilterChange($any($event.target).value)"
          />
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        <mat-form-field class="filter-field" appearance="outline">
          <mat-label [transloco]="'projects.filterTeamLabel'">Filter by Team</mat-label>
          <input
            matInput
            [value]="filterTeamName"
            (input)="onTeamFilterInput($any($event.target).value)"
            [matAutocomplete]="teamAuto"
          />
          <mat-icon matPrefix>group</mat-icon>
          @if (filterTeamId) {
            <button
              matSuffix
              mat-icon-button
              (click)="clearTeamFilter()"
              [matTooltip]="'common.clear' | transloco"
            >
              <mat-icon>close</mat-icon>
            </button>
          }
          <mat-autocomplete
            #teamAuto="matAutocomplete"
            [displayWith]="displayTeam"
            (optionSelected)="onTeamSelected($event)"
          >
            @for (team of teamSuggestions$ | async; track team.id) {
              <mat-option [value]="team">{{ team.name }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field class="filter-field" appearance="outline">
          <mat-label [transloco]="'projects.filterStatusLabel'">Filter by Status</mat-label>
          <mat-select [value]="filterStatus" (selectionChange)="onStatusFilterChange($event.value)">
            <mat-option [value]="null">
              {{ 'projects.statusAll' | transloco }}
            </mat-option>
            @for (status of projectStatuses; track status) {
              <mat-option [value]="status">
                {{ getStatusLabel(status) | transloco }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (hasActiveFilters()) {
          <button mat-stroked-button class="clear-filters-btn" (click)="clearFilters()">
            <mat-icon>filter_list_off</mat-icon>
            <span [transloco]="'projects.clearFilters'">Clear Filters</span>
          </button>
        }
      </div>
    </mat-card-content>
  </mat-card>

  <mat-card class="projects-card">
    <mat-card-header>
      <mat-card-title [transloco]="'userProjects.listTitle'">Projects</mat-card-title>
      <div class="action-buttons">
        <button mat-raised-button color="primary" (click)="onAddProject()">
          <mat-icon>add</mat-icon>
          <span [transloco]="'projects.addButton'">Add Project</span>
        </button>
      </div>
    </mat-card-header>
    <mat-card-content>
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (dataSource.data.length > 0) {
        <table mat-table [dataSource]="dataSource" matSort class="projects-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'projects.columns.name' | transloco }}
            </th>
            <td mat-cell *matCellDef="let project" [matTooltip]="project.description || ''">
              {{ project.name }}
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'projects.columns.status' | transloco }}
            </th>
            <td mat-cell *matCellDef="let project">
              @if (project.status) {
                {{ getStatusLabel(project.status) | transloco }}
              } @else {
                —
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="team">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'projects.columns.team' | transloco }}
            </th>
            <td mat-cell *matCellDef="let project">
              {{ project.team_name || '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="modified">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>
              {{ 'projects.columns.modified' | transloco }}
            </th>
            <td mat-cell *matCellDef="let project">
              {{ project.modified_at | date: 'yyyy-MM-dd' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-column">
              {{ 'common.actions' | transloco }}
            </th>
            <td mat-cell *matCellDef="let project" class="actions-column">
              <div class="action-buttons">
                <button
                  mat-icon-button
                  (click)="onEditDetails(project)"
                  [matTooltip]="'common.edit' | transloco"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  [matMenuTriggerFor]="rowKebab"
                  [matTooltip]="'common.moreActions' | transloco"
                  (click)="$event.stopPropagation()"
                >
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowKebab="matMenu">
                  <button mat-menu-item (click)="onResponsibleParties(project)">
                    <mat-icon>supervisor_account</mat-icon>
                    <span [transloco]="'projects.kebab.responsibleParties'">
                      Responsible Parties
                    </span>
                  </button>
                  <button mat-menu-item (click)="onRelatedProjects(project)">
                    <mat-icon>link</mat-icon>
                    <span [transloco]="'projects.kebab.relatedProjects'">Related Projects</span>
                  </button>
                  <button mat-menu-item (click)="onMetadata(project)">
                    <mat-icon>list</mat-icon>
                    <span [transloco]="'projects.kebab.metadata'">Metadata</span>
                  </button>
                </mat-menu>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      } @else {
        <div class="no-items-message">
          <mat-icon class="no-items-icon">folder_off</mat-icon>
          <p [transloco]="'userProjects.noProjects'">No projects found</p>
        </div>
      }

      @if (!loading && totalProjects > 0) {
        <mat-paginator
          [length]="totalProjects"
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

- [ ] **Step 3: Create projects.component.ts**

Create `src/app/pages/projects/projects.component.ts` — clone of `AdminProjectsComponent` with these changes:
- Class name: `ProjectsComponent`
- Selector: `app-projects`
- Uses `Location.back()` for close
- No `onDelete` method
- No `TranslocoService` injection
- No `adjustPageAfterDeletion` import

```typescript
import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, of, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ProjectService } from '@app/core/services/project.service';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { ProjectListItem, PROJECT_STATUSES } from '@app/types/project.types';
import { TeamListItem, ResponsibleParty } from '@app/types/team.types';
import { Metadata } from '@app/types/metadata.types';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '@app/types/pagination.types';
import { calculateOffset, parsePaginationFromUrl } from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '@app/shared/components/create-project-dialog/create-project-dialog.component';
import { EditProjectDialogComponent } from '@app/shared/components/edit-project-dialog/edit-project-dialog.component';
import {
  ResponsiblePartiesDialogComponent,
  ResponsiblePartiesDialogData,
} from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedProjectsDialogComponent } from '@app/shared/components/related-projects-dialog/related-projects-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * User Projects Component
 *
 * Displays and manages the current user's projects. Supports listing,
 * filtering by name/team/status, pagination, and actions for editing details,
 * responsible parties, related projects, and metadata.
 */
@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterNameSubject$ = new Subject<string>();
  private teamSearchSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns = ['name', 'status', 'team', 'modified', 'actions'];
  dataSource = new MatTableDataSource<ProjectListItem>([]);

  loading = false;
  filterName = '';
  filterTeamId: string | null = null;
  filterTeamName = '';
  filterStatus: string | null = null;
  projectStatuses = PROJECT_STATUSES;
  teamSuggestions$: Observable<TeamListItem[]> = of([]);
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  totalProjects = 0;

  constructor(
    private projectService: ProjectService,
    private teamService: TeamService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private dialog: MatDialog,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const urlState = parsePaginationFromUrl(this.route.snapshot.queryParams, DEFAULT_PAGE_SIZE);
    this.pageIndex = urlState.pageIndex;
    this.pageSize = urlState.pageSize;
    this.filterName =
      (this.route.snapshot.queryParams[PAGINATION_QUERY_PARAMS.NAME] as string | undefined) || '';
    this.filterStatus =
      (this.route.snapshot.queryParams[PAGINATION_QUERY_PARAMS.STATUS] as string | undefined) ||
      null;
    const teamId = (this.route.snapshot.queryParams['team_id'] as string | undefined) || null;
    if (teamId) {
      this.filterTeamId = teamId;
      this.teamService
        .get(teamId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: team => {
            this.filterTeamName = team.name;
          },
          error: error => {
            this.logger.error('Failed to resolve team name', error);
          },
        });
    }

    this.filterNameSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.filterName = value;
        this.pageIndex = 0;
        this.loadProjects();
        this.updateUrl();
      });

    this.teamSuggestions$ = this.teamSearchSubject$.pipe(
      debounceTime(300),
      switchMap(term =>
        term.length >= 2
          ? this.teamService
              .list({ name: term, limit: 10 })
              .pipe(switchMap(response => of(response.teams)))
          : of([]),
      ),
    );

    this.loadProjects();
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  /** Handle name filter input changes with debounce. */
  onNameFilterChange(value: string): void {
    this.filterNameSubject$.next(value);
  }

  /** Handle team filter input for autocomplete search. */
  onTeamFilterInput(value: string): void {
    this.filterTeamName = value;
    if (value.length >= 2) {
      this.teamSearchSubject$.next(value);
    }
  }

  /** Handle team selection from autocomplete. */
  onTeamSelected(event: MatAutocompleteSelectedEvent): void {
    const team = event.option.value as TeamListItem;
    this.filterTeamId = team.id;
    this.filterTeamName = team.name;
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Clear the team filter. */
  clearTeamFilter(): void {
    this.filterTeamId = null;
    this.filterTeamName = '';
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Handle status filter changes. */
  onStatusFilterChange(value: string | null): void {
    this.filterStatus = value;
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Returns true if any filter is active. */
  hasActiveFilters(): boolean {
    return !!(this.filterName || this.filterTeamId || this.filterStatus);
  }

  /** Clear all filters and reload. */
  clearFilters(): void {
    this.filterName = '';
    this.filterTeamId = null;
    this.filterTeamName = '';
    this.filterStatus = null;
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Display function for team autocomplete. */
  displayTeam = (team: TeamListItem): string => team?.name || '';

  /** Handle paginator page changes. */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadProjects();
    this.updateUrl();
  }

  /** Navigate back to the previous page. */
  onClose(): void {
    this.location.back();
  }

  /** Open the create project dialog. */
  onAddProject(): void {
    const dialogRef = this.dialog.open(CreateProjectDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateProjectDialogResult | undefined) => {
        if (result) {
          this.projectService
            .create(result)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => this.loadProjects(),
              error: error => this.logger.error('Failed to create project', error),
            });
        }
      });
  }

  /** Open the edit project details dialog. */
  onEditDetails(project: ProjectListItem): void {
    this.projectService
      .get(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullProject => {
          const dialogRef = this.dialog.open(EditProjectDialogComponent, {
            width: '500px',
            maxWidth: '90vw',
            data: { project: fullProject },
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
              if (result) {
                this.loadProjects();
              }
            });
        },
        error: error => {
          this.logger.error('Failed to load project details', error);
        },
      });
  }

  /** Open the responsible parties dialog. */
  onResponsibleParties(project: ProjectListItem): void {
    this.projectService
      .get(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullProject => {
          const dialogRef = this.dialog.open(ResponsiblePartiesDialogComponent, {
            width: '600px',
            maxWidth: '90vw',
            data: {
              entityId: fullProject.id,
              entityType: 'project' as const,
              parties: fullProject.responsible_parties || [],
              patchFn: (id: string, parties: ResponsibleParty[]) =>
                this.projectService.patch(id, { responsible_parties: parties }),
            } as ResponsiblePartiesDialogData,
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
              if (result) {
                this.loadProjects();
              }
            });
        },
        error: error => {
          this.logger.error('Failed to load project for responsible parties', error);
        },
      });
  }

  /** Open the related projects dialog. */
  onRelatedProjects(project: ProjectListItem): void {
    this.projectService
      .get(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullProject => {
          const dialogRef = this.dialog.open(RelatedProjectsDialogComponent, {
            width: '600px',
            maxWidth: '90vw',
            data: { project: fullProject },
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(result => {
              if (result) {
                this.loadProjects();
              }
            });
        },
        error: error => {
          this.logger.error('Failed to load project for related projects', error);
        },
      });
  }

  /** Open the metadata dialog. */
  onMetadata(project: ProjectListItem): void {
    this.projectService
      .get(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: fullProject => {
          const dialogRef = this.dialog.open(MetadataDialogComponent, {
            width: '800px',
            maxWidth: '90vw',
            data: {
              metadata: fullProject.metadata || [],
              isReadOnly: false,
              objectType: 'project',
              objectName: fullProject.name,
            } as MetadataDialogData,
          });
          dialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((metadata: Metadata[] | undefined) => {
              if (metadata) {
                this.projectService
                  .patch(fullProject.id, { metadata })
                  .pipe(takeUntilDestroyed(this.destroyRef))
                  .subscribe({
                    next: () => this.loadProjects(),
                    error: error => this.logger.error('Failed to update project metadata', error),
                  });
              }
            });
        },
        error: error => {
          this.logger.error('Failed to load project for metadata', error);
        },
      });
  }

  /**
   * Returns the i18n key for a project status label.
   * @param status - The project status value
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return `projects.status.${status}`;
  }

  private loadProjects(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.projectService
      .list({
        limit: this.pageSize,
        offset,
        name: this.filterName || undefined,
        team_id: this.filterTeamId || undefined,
        status: this.filterStatus || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.dataSource.data = response.projects;
          this.totalProjects = response.total;
          this.loading = false;
        },
        error: error => {
          this.logger.error('Failed to load projects', error);
          this.loading = false;
        },
      });
  }

  private updateUrl(): void {
    const params: Record<string, string> = {};
    if (this.pageIndex > 0) params['page'] = String(this.pageIndex);
    if (this.pageSize !== DEFAULT_PAGE_SIZE) params['size'] = String(this.pageSize);
    if (this.filterName) params['name'] = this.filterName;
    if (this.filterTeamId) params['team_id'] = this.filterTeamId;
    if (this.filterStatus) params['status'] = this.filterStatus;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }
}
```

- [ ] **Step 4: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/projects/
git commit -m "feat: create user projects page component"
```

---

### Task 6: Add Routes

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Add /teams and /projects routes to app.routes.ts**

Add the two new routes after the `dashboard` route and before the `admin` route block:

```typescript
  {
    path: 'teams',
    loadComponent: () =>
      import(/* webpackChunkName: "teams" */ './pages/teams/teams.component').then(
        c => c.TeamsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'projects',
    loadComponent: () =>
      import(/* webpackChunkName: "projects" */ './pages/projects/projects.component').then(
        c => c.ProjectsComponent,
      ),
    canActivate: [authGuard],
  },
```

- [ ] **Step 2: Verify build passes**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: add /teams and /projects routes"
```

---

### Task 7: Unit Tests for TeamsComponent

**Files:**
- Create: `src/app/pages/teams/teams.component.spec.ts`

- [ ] **Step 1: Write unit tests**

Create `src/app/pages/teams/teams.component.spec.ts`. Follow the project's existing test patterns — check `src/testing/` for test utilities and `src/app/mocks/` for mock services. The tests should cover:

- Component creation
- Loading and displaying teams in the table
- Filter input triggers debounced reload
- Pagination page change triggers reload
- Close button calls `Location.back()`
- Add team button opens `CreateTeamDialogComponent`
- Edit button fetches full team then opens `EditTeamDialogComponent`
- Members button fetches full team then opens `TeamMembersDialogComponent`
- Kebab menu items open correct dialogs (responsible parties, related teams, metadata)
- No delete action exists in the template

Look at existing component specs in the project for the exact mocking/testing patterns used. If no component specs exist, follow the Vitest + Angular TestBed patterns from `vitest.config.ts`.

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm test -- --run src/app/pages/teams/teams.component.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/teams/teams.component.spec.ts
git commit -m "test: add unit tests for user teams component"
```

---

### Task 8: Unit Tests for ProjectsComponent

**Files:**
- Create: `src/app/pages/projects/projects.component.spec.ts`

- [ ] **Step 1: Write unit tests**

Create `src/app/pages/projects/projects.component.spec.ts`. Same patterns as Task 7. Tests should cover:

- Component creation
- Loading and displaying projects in the table
- Name filter input triggers debounced reload
- Team filter autocomplete search and selection
- Status filter change triggers reload
- Clear filters resets all filters and reloads
- Pagination page change triggers reload
- Close button calls `Location.back()`
- Add project button opens `CreateProjectDialogComponent`
- Edit button fetches full project then opens `EditProjectDialogComponent`
- Kebab menu items open correct dialogs (responsible parties, related projects, metadata)
- No delete action exists in the template

- [ ] **Step 2: Run tests to verify they pass**

```bash
pnpm test -- --run src/app/pages/projects/projects.component.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/projects/projects.component.spec.ts
git commit -m "test: add unit tests for user projects component"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full lint**

```bash
pnpm run lint:all
```

Expected: No lint errors.

- [ ] **Step 2: Run full build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit any fixes from lint/build/test**

If any fixes were needed, commit them:

```bash
git add -A
git commit -m "fix: address lint and test issues from user teams/projects feature"
```
