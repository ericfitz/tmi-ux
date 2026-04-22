import { Component, DestroyRef, inject, Inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { ResponsibleParty, TEAM_MEMBER_ROLES, TeamMemberRole } from '@app/types/team.types';
import { User } from '@app/pages/tm/models/threat-model.model';
import {
  UserPickerDialogComponent,
  UserPickerDialogResult,
} from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';

export interface ResponsiblePartiesDialogData {
  entityId: string;
  entityType: 'team' | 'project';
  parties: ResponsibleParty[];
  patchFn: (id: string, parties: ResponsibleParty[]) => Observable<unknown>;
}

@Component({
  selector: 'app-responsible-parties-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="i18nPrefix + '.responsiblePartiesDialog.title'">
      Manage Responsible Parties
    </h2>
    <mat-dialog-content>
      <div class="party-list">
        @if (parties.length === 0) {
          <div class="no-items">
            {{ i18nPrefix + '.responsiblePartiesDialog.noParties' | transloco }}
          </div>
        }
        @for (party of parties; track party.user_id) {
          <div class="party-row" data-testid="responsible-parties-row">
            <div class="party-info">
              <span class="party-name">{{ party.user?.display_name || party.user_id }}</span>
              @if (party.user?.email) {
                <span class="party-email">{{ party.user?.email }}</span>
              }
            </div>
            <div class="party-role">
              @if (party.role) {
                {{ 'teams.roles.' + party.role | transloco }}
              }
              @if (party.custom_role) {
                ({{ party.custom_role }})
              }
            </div>
            <button
              mat-icon-button
              (click)="removeParty(party)"
              [matTooltip]="i18nPrefix + '.responsiblePartiesDialog.removeParty' | transloco"
              data-testid="responsible-parties-remove-button"
            >
              <mat-icon>remove_circle_outline</mat-icon>
            </button>
          </div>
        }
      </div>
      <div class="add-button">
        <button
          mat-stroked-button
          (click)="addParty()"
          data-testid="responsible-parties-add-button"
        >
          <mat-icon>person_add</mat-icon>
          <span [transloco]="i18nPrefix + '.responsiblePartiesDialog.addParty'">
            Add Responsible Party
          </span>
        </button>
      </div>
      @if (errorMessage) {
        <div class="form-error">{{ errorMessage }}</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" data-testid="responsible-parties-cancel-button">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!dirty || saving"
        data-testid="responsible-parties-save-button"
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
      .party-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 400px;
      }
      .party-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 8px;
      }
      .party-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      }
      .party-name {
        font-weight: 500;
      }
      .party-email {
        font-size: 12px;
        color: var(--theme-text-secondary);
      }
      .party-role {
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
export class ResponsiblePartiesDialogComponent {
  private destroyRef = inject(DestroyRef);

  parties: ResponsibleParty[];
  dirty = false;
  saving = false;
  errorMessage = '';
  i18nPrefix: string;

  constructor(
    private dialogRef: MatDialogRef<ResponsiblePartiesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResponsiblePartiesDialogData,
    private dialog: MatDialog,
    private logger: LoggerService,
    private translocoService: TranslocoService,
  ) {
    this.parties = [...(data.parties || [])];
    this.i18nPrefix = data.entityType === 'team' ? 'teams' : 'projects';
  }

  addParty(): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: {
        title: this.translocoService.translate(
          this.i18nPrefix + '.responsiblePartiesDialog.addParty',
        ),
        showRoleSelector: true,
        roles: TEAM_MEMBER_ROLES,
        roleTranslocoPrefix: 'teams.roles.',
      },
    });
    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          const pickerResult = result as UserPickerDialogResult;
          if (this.parties.some(p => p.user_id === pickerResult.user.internal_uuid)) return;
          this.parties.push({
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

  removeParty(party: ResponsibleParty): void {
    this.parties = this.parties.filter(p => p.user_id !== party.user_id);
    this.dirty = true;
  }

  onSave(): void {
    if (!this.dirty || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    this.data
      .patchFn(this.data.entityId, this.parties)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update responsible parties', error);
          this.errorMessage =
            error.error?.message || 'Failed to update responsible parties. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
