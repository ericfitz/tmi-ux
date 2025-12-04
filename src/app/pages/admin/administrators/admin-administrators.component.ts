import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
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
import { Administrator } from '@app/types/administrator.types';
import { AdministratorService } from '@app/core/services/administrator.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { PrincipalTypeIconComponent } from '@app/shared/components/principal-type-icon/principal-type-icon.component';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
import { AddAdministratorDialogComponent } from './add-administrator-dialog/add-administrator-dialog.component';

/**
 * Administrators Management Component
 *
 * Displays and manages system administrator grants.
 * Allows adding and removing administrator privileges for users and groups.
 */
@Component({
  selector: 'app-admin-administrators',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    PrincipalTypeIconComponent,
    ProviderDisplayComponent,
  ],
  templateUrl: './admin-administrators.component.html',
  styleUrl: './admin-administrators.component.scss',
})
export class AdminAdministratorsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  administrators: Administrator[] = [];
  filteredAdministrators: Administrator[] = [];
  filterText = '';
  loading = false;
  availableProviders: OAuthProviderInfo[] = [];

  constructor(
    private administratorService: AdministratorService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProviders();
    this.loadAdministrators();

    this.filterSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });
  }

  private loadProviders(): void {
    this.authService
      .getAvailableProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: providers => {
          const tmiProvider: OAuthProviderInfo = {
            id: 'tmi',
            name: 'TMI',
            icon: 'TMI-Logo.svg',
            auth_url: '',
            redirect_uri: '',
            client_id: '',
          };
          this.availableProviders = [tmiProvider, ...providers];
        },
        error: () => {
          this.availableProviders = [];
        },
      });
  }

  getProviderInfo(provider: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === provider) || null;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAdministrators(): void {
    this.loading = true;
    this.administratorService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: administrators => {
          this.administrators = administrators;
          this.applyFilter();
          this.loading = false;
        },
        error: () => {
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
      this.filteredAdministrators = [...this.administrators];
      return;
    }

    this.filteredAdministrators = this.administrators.filter(
      admin =>
        admin.user_email?.toLowerCase().includes(filter) ||
        admin.user_name?.toLowerCase().includes(filter) ||
        admin.display_name?.toLowerCase().includes(filter) ||
        admin.group_name?.toLowerCase().includes(filter) ||
        admin.provider.toLowerCase().includes(filter) ||
        admin.provider_id?.toLowerCase().includes(filter),
    );
  }

  onAddAdministrator(): void {
    const dialogRef = this.dialog.open(AddAdministratorDialogComponent, {
      width: '600px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.loadAdministrators();
        }
      });
  }

  onRemoveAdministrator(admin: Administrator): void {
    const subject = admin.user_email || admin.group_name || 'this administrator';
    const confirmed = confirm(
      `Are you sure you want to remove administrator permissions for ${subject}?`,
    );

    if (confirmed) {
      this.administratorService
        .delete(admin.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Administrator removed', { id: admin.id });
            this.loadAdministrators();
          },
          error: error => {
            this.logger.error('Failed to remove administrator', error);
          },
        });
    }
  }

  onClose(): void {
    void this.router.navigate(['/admin']);
  }
}
