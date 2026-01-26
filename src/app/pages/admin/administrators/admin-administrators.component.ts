import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AdministratorService } from '@app/core/services/administrator.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { Administrator } from '@app/types/administrator.types';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
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
    ProviderDisplayComponent,
  ],
  templateUrl: './admin-administrators.component.html',
  styleUrl: './admin-administrators.component.scss',
})
export class AdminAdministratorsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  administrators: Administrator[] = [];
  filteredAdministrators: Administrator[] = [];
  totalAdministrators: number | null = null;
  availableProviders: OAuthProviderInfo[] = [];

  filterText = '';
  loading = false;

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

    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applyFilter();
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
          this.logger.debug('Providers loaded for administrators list', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  loadAdministrators(): void {
    this.loading = true;
    this.administratorService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.administrators = response.administrators;
          this.totalAdministrators = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.info('Administrators loaded', {
            count: response.administrators.length,
            total: response.total,
          });
        },
        error: error => {
          this.logger.error('Failed to load administrators', error);
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
        admin.group_name?.toLowerCase().includes(filter) ||
        admin.provider.toLowerCase().includes(filter),
    );
  }

  onAddAdministrator(): void {
    const dialogRef = this.dialog.open(AddAdministratorDialogComponent, {
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          this.loadAdministrators();
        }
      });
  }

  onDeleteAdministrator(admin: Administrator): void {
    const subject = admin.user_email || admin.group_name || admin.user_name || 'this administrator';
    const confirmed = confirm(
      `Are you sure you want to remove administrator privileges for ${subject}?`,
    );

    if (confirmed) {
      this.administratorService
        .delete(admin.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Administrator deleted', { id: admin.id });
            this.loadAdministrators();
          },
          error: error => {
            this.logger.error('Failed to delete administrator', error);
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

  getSubjectName(admin: Administrator): string {
    return admin.user_name || admin.group_name || '';
  }

  getSubjectIdentifier(admin: Administrator): string {
    return admin.user_email || admin.group_name || '';
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
