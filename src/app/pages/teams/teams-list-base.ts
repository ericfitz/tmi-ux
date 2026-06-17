import { AfterViewInit, DestroyRef, Directive, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
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
import {
  CreateTeamDialogComponent,
  CreateTeamDialogResult,
} from '@app/shared/components/create-team-dialog/create-team-dialog.component';
import { EditTeamDialogComponent } from '@app/shared/components/edit-team-dialog/edit-team-dialog.component';
import { TeamMembersDialogComponent } from '@app/shared/components/team-members-dialog/team-members-dialog.component';
import { ResponsiblePartiesDialogComponent } from '@app/shared/components/responsible-parties-dialog/responsible-parties-dialog.component';
import { RelatedTeamsDialogComponent } from '@app/shared/components/related-teams-dialog/related-teams-dialog.component';
import { MetadataDialogComponent } from '@app/pages/tm/components/metadata-dialog/metadata-dialog.component';

/**
 * Abstract base class for team list components.
 *
 * Provides the shared listing, filtering, pagination, and dialog-driven actions
 * (create, edit details, members, responsible parties, related teams, metadata)
 * used by both the user-facing and admin team list components. Subclasses supply
 * their own @Component decorator (selector/template/style) and implement the
 * context-specific {@link onClose} and {@link onDelete} behaviors.
 */
@Directive()
export abstract class TeamsListBase implements OnInit, AfterViewInit {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly teamService = inject(TeamService);
  protected readonly router = inject(Router);
  protected readonly route = inject(ActivatedRoute);
  protected readonly dialog = inject(MatDialog);
  protected readonly logger = inject(LoggerService);

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

  /** Navigate away from the team list. Implemented per-subclass. */
  abstract onClose(): void;

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
            },
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
            },
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

  /** Confirm and delete the given team. Implemented per-subclass. */
  abstract onDelete(team: TeamListItem): void;

  /**
   * Returns the i18n key for a team status label.
   * @param status - The team status value
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    return `teams.status.${status}`;
  }

  protected loadTeams(): void {
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

  protected updateUrl(): void {
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
