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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
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
// SEM@3b9fbbc9940aca7e6a4ff80594014408ee0b6582: dialog for viewing and managing members of an admin group (mutates shared state)
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

  // SEM@3b9fbbc9940aca7e6a4ff80594014408ee0b6582: inject dependencies required to manage group members in the dialog (pure)
  constructor(
    private dialogRef: MatDialogRef<GroupMembersDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { group: AdminGroup },
    private groupAdminService: GroupAdminService,
    private userAdminService: UserAdminService,
    private logger: LoggerService,
    private authService: AuthService,
    private translocoService: TranslocoService,
  ) {}

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: fetch providers and members, wire user autocomplete on dialog init (mutates shared state)
  ngOnInit(): void {
    this.loadProviders();
    this.loadMembers();
    this.setupUserAutocomplete();
  }

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch available OAuth providers and store them for display (mutates shared state)
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch group members from the API and store them for display (mutates shared state)
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: wire a debounced user-search autocomplete stream from the user admin API (mutates shared state)
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

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: format a user as a display string for the autocomplete field (pure)
  displayUser(user: AdminUser | null): string {
    if (!user) {
      return '';
    }
    return `${user.name} (${user.email})`;
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: handle autocomplete selection by adding the user as a group member (mutates shared state)
  onUserSelected(event: MatAutocompleteSelectedEvent): void {
    const selectedUser = event.option.value as AdminUser;
    this.addMember(selectedUser);
    this.userSearchControl.setValue('');
  }

  // SEM@3b9fbbc9940aca7e6a4ff80594014408ee0b6582: add a user to the group via the API, blocking automation users from administrators (mutates shared state)
  addMember(user: AdminUser): void {
    this.addingMember = true;
    this.errorMessage = '';

    if (this.data.group.group_name === 'administrators' && user.automation) {
      this.errorMessage = this.translocoService.translate(
        'admin.groups.membersDialog.automationAdminBlocked',
      );
      this.addingMember = false;
      return;
    }

    const request: AddGroupMemberRequest = {
      user_internal_uuid: user.internal_uuid,
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

  // SEM@3909264b66e2522d047d4a908c09e2a1d7a3afb8: return the display name for a group member, handling user and group subjects (pure)
  getMemberDisplayName(member: GroupMember): string {
    if (member.subject_type === 'group') {
      return member.member_group_name || '';
    }
    return member.user_name || member.user_email || '';
  }

  // SEM@42b37b76c1bd3acbcdef0b5996b338e0c647783a: remove a group member after confirmation and reload the member list (mutates shared state)
  onRemoveMember(member: GroupMember): void {
    const displayName = this.getMemberDisplayName(member);
    const confirmed = confirm(`Are you sure you want to remove ${displayName} from this group?`);

    if (confirmed) {
      const memberUuid =
        member.subject_type === 'group'
          ? member.member_group_internal_uuid!
          : member.user_internal_uuid!;

      this.groupAdminService
        .removeMember(this.data.group.internal_uuid, memberUuid, member.subject_type)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Member removed from group', {
              member_uuid: memberUuid,
              subject_type: member.subject_type,
            });
            this.loadMembers();
          },
          error: error => {
            this.logger.error('Failed to remove member from group', error);
          },
        });
    }
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: close the group members dialog
  onClose(): void {
    this.dialogRef.close();
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: return the human-readable display name for the dialog's group (pure)
  getGroupDisplayName(): string {
    return this.data.group.name || this.data.group.group_name;
  }

  // SEM@b06ef0d1274dc7d9b45479c9be451a0c1ad7bbd1: return the OAuth provider info for a given provider ID (pure)
  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }
}
