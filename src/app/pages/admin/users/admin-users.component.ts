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
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
import { AdminUser, CreateAutomationAccountResponse } from '@app/types/user.types';
import { UserPickerDialogComponent } from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import {
  ManageCredentialsDialogComponent,
  ManageCredentialsDialogData,
} from './manage-credentials-dialog/manage-credentials-dialog.component';
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from '../shared/create-automation-user-dialog/create-automation-user-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@913973c2390b7180140950023b498e5c44ca2678: admin page component for listing, filtering, and managing application users
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
  automationOnly = false;
  loading = false;
  currentLocale = 'en-US';

  // SEM@493ed2f6ef7ce78cf3855ee1434c1a0f649bfe24: inject services required for user admin page (pure)
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

  // SEM@5285fcec42154b0b377e4669a8dac28afa2f2f9f: bind the paginator sort accessor to the user data source (mutates shared state)
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

  // SEM@493ed2f6ef7ce78cf3855ee1434c1a0f649bfe24: initialize locale, providers, pagination from URL, and debounced filter subscription
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
          this.logger.debug('Providers loaded for user list', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  // SEM@128557a704761ac4174b3d237c0a60561acb8119: fetch a paginated, optionally filtered user list from the API (reads DB)
  loadUsers(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.userAdminService
      .list({
        limit: this.pageSize,
        offset,
        ...(this.automationOnly && { automation: true }),
      })
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

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: dispatch a debounced filter value to the user search subject (mutates shared state)
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  // SEM@128557a704761ac4174b3d237c0a60561acb8119: toggle automation-only filter and reload the user list (mutates shared state)
  onAutomationFilterChange(checked: boolean): void {
    this.automationOnly = checked;
    this.pageIndex = 0;
    this.loadUsers();
    this.updateUrl();
  }

  // SEM@6cf31dc241d9ad5d9ddd4021f00dc2f87db833ab: open the credential management dialog for a given user
  onManageCredentials(user: AdminUser): void {
    const dialogData: ManageCredentialsDialogData = {
      internalUuid: user.internal_uuid,
      userName: user.name || user.email,
    };
    this.dialog.open(ManageCredentialsDialogComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: dialogData,
    });
  }

  // SEM@a3fe1642d528f79a9c8370fc884021654b79b431: open dialog to create an automation user, then display the generated credential secret
  onCreateAutomationUser(): void {
    const dialogData: CreateAutomationUserDialogData = {};
    const dialogRef = this.dialog.open(CreateAutomationUserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateAutomationAccountResponse | null) => {
        if (result) {
          const secretData: CredentialSecretDialogData = {
            clientId: result.client_credential.client_id,
            clientSecret: result.client_credential.client_secret,
          };
          const credDialogRef = this.dialog.open(CredentialSecretDialogComponent, {
            width: '600px',
            disableClose: true,
            data: secretData,
          });

          credDialogRef
            .afterClosed()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
              this.loadUsers();
            });
        }
      });
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle paginator page change, reload the user list, and update the URL
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadUsers();
    this.updateUrl();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: sync pagination and filter state into the current URL (mutates shared state)
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

  // SEM@5285fcec42154b0b377e4669a8dac28afa2f2f9f: filter the displayed user list by the current filter text (mutates shared state)
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: delete a user after confirmation, then reload the user list
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

  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: transfer all owned resources from one user to another via picker dialog
  onTransferOwnership(user: AdminUser): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      data: {
        title: this.transloco.translate('admin.users.transferOwnership.dialogTitle'),
        excludeUserId: user.internal_uuid,
      },
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

  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the admin page back to the home route
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: format a user's group list as a comma-separated string (pure)
  formatGroups(groups: string[] | undefined): string {
    if (!groups || groups.length === 0) {
      return 'None';
    }
    return groups.join(', ');
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: format a last-login timestamp, returning 'Never' if absent (pure)
  formatLastLogin(lastLogin: string | null | undefined): string {
    if (!lastLogin) {
      return 'Never';
    }
    return lastLogin;
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: look up OAuth provider metadata by provider ID (pure)
  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
