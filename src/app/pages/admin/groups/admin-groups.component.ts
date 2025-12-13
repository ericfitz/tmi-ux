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
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AdminGroup } from '@app/types/group.types';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
import { AddGroupDialogComponent } from './add-group-dialog/add-group-dialog.component';
import { GroupMembersDialogComponent } from './group-members-dialog/group-members-dialog.component';

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
})
export class AdminGroupsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  groups: AdminGroup[] = [];
  filteredGroups: AdminGroup[] = [];
  totalGroups: number | null = null;
  availableProviders: OAuthProviderInfo[] = [];

  filterText = '';
  loading = false;

  constructor(
    private groupAdminService: GroupAdminService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProviders();
    this.loadGroups();

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
          this.logger.debug('Providers loaded for group list', {
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

  loadGroups(): void {
    this.loading = true;
    this.groupAdminService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.groups = response.groups;
          this.totalGroups = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.info('Groups loaded', {
            count: response.groups.length,
            total: response.total,
          });
        },
        error: error => {
          this.logger.error('Failed to load groups', error);
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
      this.filteredGroups = [...this.groups];
      return;
    }

    this.filteredGroups = this.groups.filter(
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
      .pipe(takeUntil(this.destroy$))
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
      .pipe(takeUntil(this.destroy$))
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
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Group deleted', { group_name: group.group_name });
            this.loadGroups();
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
      void this.router.navigate(['/dashboard']);
    }
  }

  getGroupDisplayName(group: AdminGroup): string {
    return group.name || group.group_name;
  }

  getGroupIdentifier(group: AdminGroup): string {
    return group.group_name;
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
