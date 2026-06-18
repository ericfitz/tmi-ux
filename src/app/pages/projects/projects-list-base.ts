import { AfterViewInit, DestroyRef, Directive, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Observable, of, Subject } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';
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
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '@app/shared/components/create-project-dialog/create-project-dialog.component';
import { EditProjectDialogComponent } from '@app/shared/components/edit-project-dialog/edit-project-dialog.component';
import { ResponsiblePartiesDialogComponent } from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedProjectsDialogComponent } from '@app/shared/components/related-projects-dialog/related-projects-dialog.component';
import { MetadataDialogComponent } from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * Abstract base class for the project list pages (user-facing and admin).
 *
 * Holds the shared list/filter/pagination state and the CRUD and filter handlers
 * that are identical between {@link ProjectsComponent} and the admin variant.
 * Subclasses provide their own `@Component` decorator, template, styles, any
 * page-specific injected dependency, and implementations of {@link onClose} and
 * {@link onDelete}, which differ between the two pages.
 *
 * Common services are obtained via `inject()` so subclasses do not have to thread
 * them through their constructors. The `@Directive()` decorator (no selector) is
 * required so Angular permits the inherited `@ViewChild` queries and lifecycle
 * hooks on the base class.
 */
@Directive()
// SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: abstract base providing shared project list, filter, pagination, and CRUD handlers
export abstract class ProjectsListBase implements OnInit, AfterViewInit {
  protected destroyRef = inject(DestroyRef);
  protected projectService = inject(ProjectService);
  protected teamService = inject(TeamService);
  protected router = inject(Router);
  protected route = inject(ActivatedRoute);
  protected dialog = inject(MatDialog);
  protected logger = inject(LoggerService);

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

  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: restore filter and pagination state from URL, wire debounce streams, and fetch projects (reads DB)
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

  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: bind the MatSort instance to the table data source (mutates shared state)
  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  /** Handle name filter input changes with debounce. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: dispatch a debounced name filter value to trigger project reload (mutates shared state)
  onNameFilterChange(value: string): void {
    this.filterNameSubject$.next(value);
  }

  /** Handle team filter input for autocomplete search. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: update team filter text and dispatch autocomplete search when input is long enough (mutates shared state)
  onTeamFilterInput(value: string): void {
    this.filterTeamName = value;
    if (value.length >= 2) {
      this.teamSearchSubject$.next(value);
    }
  }

  /** Handle team selection from autocomplete. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: apply selected team filter and reload projects from the first page (reads DB)
  onTeamSelected(event: MatAutocompleteSelectedEvent): void {
    const team = event.option.value as TeamListItem;
    this.filterTeamId = team.id;
    this.filterTeamName = team.name;
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Clear the team filter. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: clear the team filter and reload the project list from the first page (reads DB)
  clearTeamFilter(): void {
    this.filterTeamId = null;
    this.filterTeamName = '';
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Handle status filter changes. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: apply a status filter and reload projects from the first page (reads DB)
  onStatusFilterChange(value: string | null): void {
    this.filterStatus = value;
    this.pageIndex = 0;
    this.loadProjects();
    this.updateUrl();
  }

  /** Returns true if any filter is active. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: return true if any project filter is currently active (pure)
  hasActiveFilters(): boolean {
    return !!(this.filterName || this.filterTeamId || this.filterStatus);
  }

  /** Clear all filters and reload. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: reset all project filters and reload the list from the first page (reads DB)
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: update pagination state and reload the project list page (reads DB)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadProjects();
    this.updateUrl();
  }

  /** Open the create project dialog. */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: open create-project dialog and persist a new project on confirmation (reads DB)
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: fetch full project and open edit-details dialog, refreshing list on save (reads DB)
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: open responsible-parties dialog and patch project parties on confirmation (reads DB)
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
            },
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: open related-projects dialog and refresh list on confirmation (reads DB)
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: open metadata dialog and patch project metadata on confirmation (reads DB)
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
            },
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
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: convert a project status value to its i18n key (pure)
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return `projects.status.${status}`;
  }

  /**
   * Navigate away from the list. The destination differs per page
   * (previous page for the user view, admin landing for the admin view).
   */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: navigate away from the project list; destination determined by subclass
  abstract onClose(): void;

  /**
   * Confirm and delete the given project. The confirmation mechanism and
   * post-deletion page handling differ per page, so each subclass implements it.
   * @param project - The project to delete
   */
  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: confirm and delete a project; confirmation and post-deletion handling per subclass (reads DB)
  abstract onDelete(project: ProjectListItem): void;

  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: fetch a paginated, filtered project list and populate the table data source (reads DB)
  protected loadProjects(): void {
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

  // SEM@d1c968115ea613576d4d8fd7aba936afcbcc6d57: sync current pagination and filter state into the URL query params (mutates shared state)
  protected updateUrl(): void {
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
