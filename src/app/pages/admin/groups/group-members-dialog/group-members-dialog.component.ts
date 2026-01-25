import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, startWith } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AdminGroup, GroupMember, AddGroupMemberRequest } from '@app/types/group.types';
import { AdminUser } from '@app/types/user.types';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';

/**
 * Group Members Dialog Component
 *
 * Dialog for viewing and managing group membership.
 * Displays current members and allows adding/removing members.
 */
@Component({
  selector: 'app-group-members-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
    ProviderDisplayComponent,
  ],
  templateUrl: './group-members-dialog.component.html',
  styleUrl: './group-members-dialog.component.scss',
})
export class GroupMembersDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  members: GroupMember[] = [];
  totalMembers: number | null = null;
  availableProviders: OAuthProviderInfo[] = [];
  loading = false;
  addingMember = false;
  errorMessage = '';

  // Autocomplete for adding members
  userSearchControl = new FormControl('');
  filteredUsers$!: Observable<AdminUser[]>;

  constructor(
    private dialogRef: MatDialogRef<GroupMembersDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { group: AdminGroup },
    private groupAdminService: GroupAdminService,
    private userAdminService: UserAdminService,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProviders();
    this.loadMembers();
    this.setupUserAutocomplete();
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
          this.logger.debug('Providers loaded for group members dialog', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  loadMembers(): void {
    this.loading = true;
    this.groupAdminService
      .listMembers(this.data.group.internal_uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.members = response.members;
          this.totalMembers = response.total;
          this.loading = false;
          this.logger.debug('Group members loaded', {
            count: response.members.length,
            total: response.total,
          });
        },
        error: error => {
          this.logger.error('Failed to load group members', error);
          this.loading = false;
        },
      });
  }

  setupUserAutocomplete(): void {
    this.filteredUsers$ = this.userSearchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(value => {
        if (typeof value === 'string' && value.length >= 2) {
          return this.userAdminService.list({ email: value, limit: 10 }).pipe(
            takeUntilDestroyed(this.destroyRef),
            switchMap(response => [response.users]),
          );
        }
        return [[]];
      }),
    );
  }

  displayUser(user: AdminUser | null): string {
    if (!user) {
      return '';
    }
    return `${user.name} (${user.email})`;
  }

  onUserSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedUser = event.option.value as AdminUser;
    this.addMember(selectedUser);
    this.userSearchControl.setValue('');
  }

  addMember(user: AdminUser): void {
    this.addingMember = true;
    this.errorMessage = '';

    const request: AddGroupMemberRequest = {
      provider: user.provider,
      provider_user_id: user.provider_user_id,
    };

    this.groupAdminService
      .addMember(this.data.group.internal_uuid, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logger.info('Member added to group', { email: user.email });
          this.loadMembers();
          this.addingMember = false;
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to add member to group', error);
          this.errorMessage = error.error?.message || 'Failed to add member. Please try again.';
          this.addingMember = false;
        },
      });
  }

  onRemoveMember(member: GroupMember): void {
    const confirmed = confirm(`Are you sure you want to remove ${member.email} from this group?`);

    if (confirmed) {
      this.groupAdminService
        .removeMember(this.data.group.internal_uuid, member.internal_uuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Member removed from group', { email: member.email });
            this.loadMembers();
          },
          error: error => {
            this.logger.error('Failed to remove member from group', error);
          },
        });
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }

  getGroupDisplayName(): string {
    return this.data.group.name || this.data.group.group_name;
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
