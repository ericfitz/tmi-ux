import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { TeamListItem } from '@app/types/team.types';
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
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { CreateTeamDialogComponent } from '@app/shared/components/create-team-dialog/create-team-dialog.component';
import { EditTeamDialogComponent } from './edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from './team-members-dialog/team-members-dialog.component';
import { ResponsiblePartiesDialogComponent } from './responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedTeamsDialogComponent } from './related-teams-dialog/related-teams-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * Admin Teams Component
 *
 * Displays and manages teams. Supports listing, filtering, pagination,
 * and actions for editing details, members, responsible parties,
 * related teams, metadata, and deletion.
 */
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
    private dialog: MatDialog,
    private logger: LoggerService,
    private translocoService: TranslocoService,
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

  /** Navigate back to admin landing page. */
  onClose(): void {
    void this.router.navigate(['/admin']);
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
      .subscribe(result => {
        if (result) {
          this.loadTeams();
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

  /** Confirm and delete the given team. */
  onDelete(team: TeamListItem): void {
    const message = this.translocoService.translate('teams.deleteDialog.message', {
      name: team.name,
    });
    let fullMessage = message;

    if (team.project_count && team.project_count > 0) {
      const warning = this.translocoService.translate('teams.deleteDialog.projectWarning', {
        count: team.project_count,
      });
      fullMessage = `${message}\n\n${warning}`;
    }

    if (!confirm(fullMessage)) return;

    this.teamService
      .delete(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const adjusted = adjustPageAfterDeletion(
            this.pageIndex,
            this.dataSource.data.length - 1,
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
