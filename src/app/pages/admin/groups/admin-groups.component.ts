import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AdminGroup } from '@app/types/group.types';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
import { AddGroupDialogComponent } from './add-group-dialog/add-group-dialog.component';
import { GroupMembersDialogComponent } from './group-members-dialog/group-members-dialog.component';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
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

/**
 * Groups Management Component
 *
 * Displays and manages system groups.
 * Allows adding groups, viewing group details, and managing group membership.
 */
@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ProviderDisplayComponent,
  ],
  templateUrl: './admin-groups.component.html',
  styleUrl: './admin-groups.component.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminGroupsComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  groups: AdminGroup[] = [];
  dataSource = new MatTableDataSource<AdminGroup>([]);
  totalGroups = 0;
  availableProviders: OAuthProviderInfo[] = [];

  // Pagination state
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;

  constructor(
    private groupAdminService: GroupAdminService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item: AdminGroup, property: string): string | number => {
      switch (property) {
        case 'provider':
          return item.provider.toLowerCase();
        case 'group':
          return (item.name || item.group_name).toLowerCase();
        case 'usage':
          return item.usage_count ?? 0;
        default:
          return '';
      }
    };
  }

  ngOnInit(): void {
    this.loadProviders();

    // Initialize pagination state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadGroups();
    });

    // Set up debounced filter changes
    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.pageIndex = 0;
        this.loadGroups();
        this.updateUrl();
      });
  }

  loadProviders(): void {
    this.authService
      .getAvailableProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: providers => {
          // Add hardcoded TMI provider at the beginning
          const tmiProvider: OAuthProviderInfo = {
            id: 'tmi',
            name: 'TMI',
            icon: 'TMI-Logo.svg',
            auth_url: '',
            redirect_uri: '',
            client_id: '',
          };
          this.availableProviders = [tmiProvider, ...providers];
          this.logger.debug('Providers loaded for group list', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  loadGroups(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.groupAdminService
      .list({ limit: this.pageSize, offset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.groups = response.groups;
          this.totalGroups = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.info('Groups loaded', {
            count: response.groups.length,
            total: response.total,
            page: this.pageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load groups', error);
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadGroups();
    this.updateUrl();
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      { pageIndex: this.pageIndex, pageSize: this.pageSize, total: this.totalGroups },
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

  applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) {
      this.dataSource.data = [...this.groups];
      return;
    }

    this.dataSource.data = this.groups.filter(
      group =>
        group.group_name?.toLowerCase().includes(filter) ||
        group.name?.toLowerCase().includes(filter) ||
        group.provider.toLowerCase().includes(filter),
    );
  }

  onAddGroup(): void {
    const dialogRef = this.dialog.open(AddGroupDialogComponent, {
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          this.loadGroups();
        }
      });
  }

  onViewMembers(group: AdminGroup): void {
    const dialogRef = this.dialog.open(GroupMembersDialogComponent, {
      width: '1100px',
      maxWidth: '90vw',
      disableClose: false,
      data: { group },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        // Reload groups in case member count changed
        this.loadGroups();
      });
  }

  onDeleteGroup(group: AdminGroup): void {
    const groupName = this.getGroupDisplayName(group);
    const confirmed = confirm(`Are you sure you want to delete the group "${groupName}"?

This action cannot be undone.`);

    if (confirmed) {
      this.groupAdminService
        .delete(group.internal_uuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Group deleted', { group_name: group.group_name });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.groups.length - 1;
            const newTotal = this.totalGroups - 1;
            this.pageIndex = adjustPageAfterDeletion(
              this.pageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadGroups();
            this.updateUrl();
          },
          error: (error: { status?: number; error?: { message?: string } }) => {
            if (error.status === 501) {
              alert('Group deletion is not currently supported by the API.');
            } else {
              this.logger.error('Failed to delete group', error);
              alert(
                error.error?.message ||
                  'Failed to delete group. Please check the logs for details.',
              );
            }
          },
        });
    }
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate([this.authService.getLandingPage()]);
    }
  }

  getGroupDisplayName(group: AdminGroup): string {
    return group.name || group.group_name;
  }

  getGroupIdentifier(group: AdminGroup): string {
    return group.group_name;
  }

  isEveryoneGroup(group: AdminGroup): boolean {
    return group.provider === '*' && group.group_name.toLowerCase() === 'everyone';
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
