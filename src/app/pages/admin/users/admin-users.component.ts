import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
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
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';

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
  ],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  totalUsers: number | null = null;
  availableProviders: OAuthProviderInfo[] = [];

  filterText = '';
  loading = false;

  constructor(
    private userAdminService: UserAdminService,
    private router: Router,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProviders();
    this.loadUsers();

    this.filterSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });
  }

  loadProviders(): void {
    this.authService
      .getAvailableProviders()
      .pipe(takeUntil(this.destroy$))
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadUsers(): void {
    this.loading = true;
    this.userAdminService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.users = response.users;
          this.totalUsers = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.debugComponent('AdminUsers', 'Users loaded', {
            count: response.users.length,
            total: response.total,
          });
        },
        error: error => {
          this.logger.error('Failed to load users', error);
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterText = value;
    this.filterSubject$.next(value);
  }

  applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) {
      this.filteredUsers = [...this.users];
      return;
    }

    this.filteredUsers = this.users.filter(
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
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('User deleted', { email: user.email });
            this.loadUsers();
          },
          error: error => {
            this.logger.error('Failed to delete user', error);
          },
        });
    }
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/dashboard']);
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
