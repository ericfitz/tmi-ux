import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TeamService } from '@app/core/services/team.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Team, TEAM_STATUSES } from '@app/types/team.types';

export interface EditTeamDialogData {
  team: Team;
}

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'teams.editDialog.title'">Edit Team</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="admin-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.name'">Name</mat-label>
          <input matInput formControlName="name" />
          @if (form.get('name')?.hasError('required')) {
            <mat-error>{{ 'common.validation.required' | transloco }}</mat-error>
          }
          @if (form.get('name')?.hasError('maxlength')) {
            <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 256 } }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.description'">Description</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
          @if (form.get('description')?.hasError('maxlength')) {
            <mat-error>{{ 'common.validation.maxLength' | transloco: { max: 2048 } }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email_address" type="email" />
          @if (form.get('email_address')?.hasError('email')) {
            <mat-error>{{ 'common.validation.invalidEmail' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>URI</mat-label>
          <input matInput formControlName="uri" type="url" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.status'">Status</mat-label>
          <mat-select formControlName="status">
            <mat-option [value]="null">{{ 'common.none' | transloco }}</mat-option>
            @for (status of teamStatuses; track status) {
              <mat-option [value]="status">
                {{ 'teams.status.' + status | transloco }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (errorMessage) {
          <div class="form-error">{{ errorMessage }}</div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!form.valid || !form.dirty || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'teams.editDialog.save'">Save</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .admin-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
        padding: 8px 0;
      }
      .full-width {
        width: 100%;
      }
      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        padding: 0 16px;
      }
      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }
    `,
  ],
})
export class EditTeamDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  form!: FormGroup;
  saving = false;
  errorMessage = '';
  teamStatuses = TEAM_STATUSES;

  constructor(
    private dialogRef: MatDialogRef<EditTeamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditTeamDialogData,
    private teamService: TeamService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const team = this.data.team;
    this.form = this.fb.group({
      name: [team.name, [Validators.required, Validators.maxLength(256)]],
      description: [team.description || '', [Validators.maxLength(2048)]],
      email_address: [team.email_address || '', [Validators.email]],
      uri: [team.uri || ''],
      status: [team.status || null],
    });
  }

  onSave(): void {
    if (!this.form.valid || this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const input = {
      ...this.form.value,
      name: this.form.value.name?.trim(),
      description: this.form.value.description?.trim(),
      email_address: this.form.value.email_address?.trim() || undefined,
      uri: this.form.value.uri?.trim() || undefined,
    };

    this.teamService
      .update(this.data.team.id, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.dialogRef.close(true);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to update team', error);
          this.errorMessage = error.error?.message || 'Failed to update team. Please try again.';
          this.saving = false;
        },
      });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
