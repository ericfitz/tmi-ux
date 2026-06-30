import {
  AfterViewInit,
  Component,
  DestroyRef,
  inject,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
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
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@913973c2390b7180140950023b498e5c44ca2678: page component listing, filtering, and managing authorization groups
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: inject group admin service, router, dialog, logger, and auth service
  constructor(
    private groupAdminService: GroupAdminService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  // SEM@5285fcec42154b0b377e4669a8dac28afa2f2f9f: attach the sort view child and configure column sort accessors (mutates shared state)
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

  // SEM@bfb60b51b1f44fb69eb7f7fbac7656849e9750be: initialize pagination from URL params, load providers and groups, wire debounced filter
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch available OAuth providers and prepend the built-in TMI provider (reads DB)
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

  // SEM@36deac569487dc1c7d2b80d0fb7d384276099fb7: fetch a page of authorization groups with optional filter and update list (reads DB)
  loadGroups(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);
    const filter = this.filterText.trim();

    this.groupAdminService
      .list({ limit: this.pageSize, offset, ...(filter ? { group_name: filter } : {}) })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.groups = response.groups;
          this.totalGroups = response.total;
          this.dataSource.data = [...this.groups];
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

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: emit a filter value to the debounced filter subject (mutates shared state)
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: update page index and size then reload the group list (mutates shared state)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadGroups();
    this.updateUrl();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: sync current pagination and filter state to the URL query params without reload
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: open the add-group dialog and reload the group list on success
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: open group members dialog and reload group list on close (mutates shared state)
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: delete a group after confirmation, adjusting pagination and reloading (mutates shared state)
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

  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the admin groups page to the appropriate landing page
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: return the human-readable display name for a group (pure)
  getGroupDisplayName(group: AdminGroup): string {
    return group.name || group.group_name;
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: return the canonical identifier for a group (pure)
  getGroupIdentifier(group: AdminGroup): string {
    return group.group_name;
  }

  // SEM@76be7d92d38b9a859024414252c3c16bca0b7f9c: check whether a group is the built-in everyone group (pure)
  isEveryoneGroup(group: AdminGroup): boolean {
    return group.provider === 'tmi' && group.group_name.toLowerCase() === 'everyone';
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: return the OAuth provider info for a given provider ID (pure)
  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
