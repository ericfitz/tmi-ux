import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
import {
  calculateOffset,
  parsePaginationFromUrl,
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  CreateProjectDialogComponent,
  CreateProjectDialogResult,
} from '@app/shared/components/create-project-dialog/create-project-dialog.component';
import { EditProjectDialogComponent } from '@app/shared/components/edit-project-dialog/edit-project-dialog.component';
import {
  ResponsiblePartiesDialogComponent,
} from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedProjectsDialogComponent } from '@app/shared/components/related-projects-dialog/related-projects-dialog.component';
import {
  MetadataDialogComponent,
} from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * Admin Projects Component
 *
 * Displays and manages projects. Supports listing, filtering by name/team/status,
 * pagination, and actions for editing details, responsible parties,
 * related projects, metadata, and deletion.
 */
@Component({
  selector: 'app-admin-projects',
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
  templateUrl: './admin-projects.component.html',
  styleUrl: './admin-projects.component.scss',
})
export class AdminProjectsComponent implements OnInit, AfterViewInit {
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
    private dialog: MatDialog,
    private logger: LoggerService,
    private translocoService: TranslocoService,
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

  /** Navigate back to admin landing page. */
  onClose(): void {
    void this.router.navigate(['/admin']);
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

  /** Confirm and delete the given project. */
  onDelete(project: ProjectListItem): void {
    const message = this.translocoService.translate('projects.deleteDialog.message', {
      name: project.name,
    });
    if (!confirm(message)) return;

    this.projectService
      .delete(project.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const adjusted = adjustPageAfterDeletion(
            this.pageIndex,
            this.dataSource.data.length - 1,
            this.totalProjects - 1,
          );
          this.pageIndex = adjusted;
          this.loadProjects();
        },
        error: error => {
          this.logger.error('Failed to delete project', error);
        },
      });
  }

  /**
   * Returns the i18n key for a project status label.
   * @param status - The project status value
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '\u2014';
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
