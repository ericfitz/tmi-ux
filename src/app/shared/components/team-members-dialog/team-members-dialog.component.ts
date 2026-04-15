import { Component, DestroyRef, inject, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Team, TeamMember, TEAM_MEMBER_ROLES, TeamMemberRole } from '@app/types/team.types';
import { User } from '@app/pages/tm/models/threat-model.model';
import {
  UserPickerDialogComponent,
  UserPickerDialogData,
  UserPickerDialogResult,
} from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';

export interface TeamMembersDialogData {
  team: Team;
}

@Component({
  selector: 'app-team-members-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'teams.membersDialog.title'">Manage Members</h2>
    <mat-dialog-content>
      <div class="member-list">
        @if (members.length === 0) {
          <div class="no-items">{{ 'teams.membersDialog.noMembers' | transloco }}</div>
        }
        @for (member of members; track member.user_id) {
          <div class="member-row" data-testid="team-members-row">
            <div class="member-info">
              <span class="member-name">{{ member.user?.display_name || member.user_id }}</span>
              @if (member.user?.email) {
                <span class="member-email">{{ member.user?.email }}</span>
              }
            </div>
            <div class="member-role">
              @if (member.role) {
                {{ 'teams.roles.' + member.role | transloco }}
              }
              @if (member.custom_role) {
                ({{ member.custom_role }})
              }
            </div>
            <button
              mat-icon-button
              (click)="removeMember(member)"
              [matTooltip]="'common.remove' | transloco"
              data-testid="team-members-remove-button"
            >
              <mat-icon>remove_circle_outline</mat-icon>
            </button>
          </div>
        }
      </div>
      <div class="add-button">
        <button mat-stroked-button (click)="addMember()" data-testid="team-members-add-button">
          <mat-icon>person_add</mat-icon>
          <span [transloco]="'teams.membersDialog.addMember'">Add Member</span>
        </button>
      </div>
      @if (errorMessage) {
        <div class="form-error">{{ errorMessage }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" data-testid="team-members-cancel-button">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!dirty || saving"
        data-testid="team-members-save-button"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'common.save'">Save</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .member-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 400px;
      }
      .member-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 8px;
      }
      .member-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .member-name {
        font-weight: 500;
      }
      .member-email {
        font-size: 12px;
        color: var(--theme-text-secondary);
      }
      .member-role {
        font-size: 12px;
        color: var(--theme-text-secondary);
        margin-left: 16px;
      }
      .no-items {
        text-align: center;
        padding: 24px;
        color: var(--theme-text-secondary);
        font-style: italic;
      }
      .add-button {
        margin-top: 16px;
      }
      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        padding: 8px 0 0;
      }
      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class TeamMembersDialogComponent {
  private destroyRef = inject(DestroyRef);

  members: TeamMember[];
  dirty = false;
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<TeamMembersDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: TeamMembersDialogData,
    private dialog: MatDialog,
    private teamService: TeamService,
    private logger: LoggerService,
    private translocoService: TranslocoService,
  ) {
    this.members = [...(data.team.members || [])];
  }

  addMember(): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        title: this.translocoService.translate('teams.membersDialog.addMember'),
        showRoleSelector: true,
        roles: TEAM_MEMBER_ROLES,
        roleTranslocoPrefix: 'teams.roles.',
      } as UserPickerDialogData,
    });
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          const pickerResult = result as UserPickerDialogResult;
          if (this.members.some(m => m.user_id === pickerResult.user.internal_uuid)) return;
          this.members.push({
            user_id: pickerResult.user.internal_uuid,
            user: {
              display_name: pickerResult.user.name,
              email: pickerResult.user.email,
            } as unknown as User,
            role: pickerResult.role as TeamMemberRole,
            custom_role: pickerResult.customRole,
          });
          this.dirty = true;
        }
      });
  }

  removeMember(member: TeamMember): void {
    this.members = this.members.filter(m => m.user_id !== member.user_id);
    this.dirty = true;
  }

  onSave(): void {
    if (!this.dirty || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    this.teamService
      .patch(this.data.team.id, { members: this.members })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update team members', error);
          this.errorMessage =
            error.error?.message || 'Failed to update team members. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
