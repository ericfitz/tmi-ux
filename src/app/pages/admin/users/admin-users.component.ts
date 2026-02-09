import { AfterViewInit, Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AdminUser } from '@app/types/user.types';
import {
  UserPickerDialogComponent,
  UserPickerDialogData,
} from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { LanguageService } from '@app/i18n/language.service';
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
 * Users Management Component
 *
 * Displays and manages system users.
 * Allows viewing user details and deleting users.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ProviderDisplayComponent,
    UserDisplayComponent,
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminUsersComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  users: AdminUser[] = [];
  dataSource = new MatTableDataSource<AdminUser>([]);
  totalUsers = 0;
  availableProviders: OAuthProviderInfo[] = [];

  // Pagination state
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;
  currentLocale = 'en-US';

  constructor(
    private userAdminService: UserAdminService,
    private router: Router,
    private route: ActivatedRoute,
    private logger: LoggerService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private languageService: LanguageService,
  ) {}

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (item: AdminUser, property: string): string | number => {
      switch (property) {
        case 'provider':
          return item.provider.toLowerCase();
        case 'subject':
          return (item.name || item.email || '').toLowerCase();
        case 'lastLogin':
          return item.last_login ? new Date(item.last_login).getTime() : 0;
        case 'groups':
          return (item.groups ?? []).join(', ').toLowerCase();
        case 'threatModels':
          return item.active_threat_models ?? 0;
        default:
          return '';
      }
    };
  }

  ngOnInit(): void {
    this.languageService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(language => {
        this.currentLocale = language.code;
      });

    this.loadProviders();

    // Initialize pagination state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadUsers();
    });

    // Set up debounced filter changes
    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.pageIndex = 0; // Reset to first page on filter change
        this.loadUsers();
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
          this.logger.debug('Providers loaded for user list', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  loadUsers(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.userAdminService
      .list({ limit: this.pageSize, offset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.users = response.users;
          this.totalUsers = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.debugComponent('AdminUsers', 'Users loaded', {
            count: response.users.length,
            total: response.total,
            page: this.pageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load users', error);
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
    this.loadUsers();
    this.updateUrl();
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      { pageIndex: this.pageIndex, pageSize: this.pageSize, total: this.totalUsers },
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
      this.dataSource.data = [...this.users];
      return;
    }

    this.dataSource.data = this.users.filter(
      user =>
        user.email?.toLowerCase().includes(filter) ||
        user.name?.toLowerCase().includes(filter) ||
        user.provider.toLowerCase().includes(filter) ||
        user.groups?.some(group => group.toLowerCase().includes(filter)),
    );
  }

  onDeleteUser(user: AdminUser): void {
    const warningMessage = `Are you sure you want to delete user ${user.email}?

This will permanently delete:
• User identity data (provider ID, name, email)
• User permissions from all threat models they do not own
• For threat models owned by this user:
  - If other owners exist, ownership will transfer to them
  - If no other owners exist, the threat model and all associated data will be irrevocably deleted

This action cannot be undone.`;

    const confirmed = confirm(warningMessage);

    if (confirmed) {
      this.userAdminService
        .delete(user.internal_uuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('User deleted', { email: user.email });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.users.length - 1;
            const newTotal = this.totalUsers - 1;
            this.pageIndex = adjustPageAfterDeletion(
              this.pageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadUsers();
            this.updateUrl();
          },
          error: error => {
            this.logger.error('Failed to delete user', error);
          },
        });
    }
  }

  onTransferOwnership(user: AdminUser): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      data: {
        title: this.transloco.translate('admin.users.transferOwnership.dialogTitle'),
        excludeUserId: user.internal_uuid,
      } as UserPickerDialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((targetUser: AdminUser | undefined) => {
        if (!targetUser) return;

        const confirmed = confirm(
          this.transloco.translate('admin.users.transferOwnership.confirm', {
            source: user.email,
            target: targetUser.email,
          }),
        );

        if (!confirmed) return;

        this.userAdminService
          .transferOwnership(user.internal_uuid, targetUser.internal_uuid)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: result => {
              const message = this.transloco.translate('admin.users.transferOwnership.success', {
                tmCount: result.threat_models_transferred.count,
                responseCount: result.survey_responses_transferred.count,
              });
              this.snackBar.open(message, this.transloco.translate('common.dismiss'), {
                duration: 5000,
              });
              this.loadUsers();
            },
            error: err => {
              this.logger.error('Failed to transfer ownership', err);
              this.snackBar.open(
                this.transloco.translate('admin.users.transferOwnership.error'),
                this.transloco.translate('common.dismiss'),
                { duration: 5000 },
              );
            },
          });
      });
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate([this.authService.getLandingPage()]);
    }
  }

  formatGroups(groups: string[] | undefined): string {
    if (!groups || groups.length === 0) {
      return 'None';
    }
    return groups.join(', ');
  }

  formatLastLogin(lastLogin: string | null | undefined): string {
    if (!lastLogin) {
      return 'Never';
    }
    return lastLogin;
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
