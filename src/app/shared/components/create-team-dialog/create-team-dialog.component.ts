import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { TEAM_STATUSES, TeamStatus } from '@app/types/team.types';

export interface CreateTeamDialogResult {
  name: string;
  description?: string;
  uri?: string;
  email_address?: string;
  status?: string;
}

@Component({
  selector: 'app-create-team-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'teams.createDialog.title'">Create Team</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="create-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'teams.createDialog.namePlaceholder' | transloco"
            maxlength="256"
            cdkFocusInitial
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error [transloco]="'teams.createDialog.nameRequired'">
              Team name is required
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.description'">Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            [placeholder]="'teams.createDialog.descriptionPlaceholder' | transloco"
            maxlength="2048"
            rows="3"
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'teams.createDialog.emailAddress'">Email Address</mat-label>
          <input
            matInput
            formControlName="email_address"
            type="email"
            [placeholder]="'teams.createDialog.emailPlaceholder' | transloco"
          />
          @if (form.get('email_address')?.hasError('email')) {
            <mat-error [transloco]="'common.validation.email'">
              Please enter a valid email address
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.uri'">URI</mat-label>
          <input
            matInput
            formControlName="uri"
            type="url"
            [placeholder]="'teams.createDialog.uriPlaceholder' | transloco"
          />
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
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onCreate()"
        [disabled]="form.invalid || !form.dirty"
      >
        <span [transloco]="'common.create'">Create</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
        padding: 8px 0;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class CreateTeamDialogComponent {
  teamStatuses: TeamStatus[] = TEAM_STATUSES;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<CreateTeamDialogComponent>,
    private fb: FormBuilder,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(256)]],
      description: ['', [Validators.maxLength(2048)]],
      email_address: ['', [Validators.email]],
      uri: [''],
      status: [null],
    });
  }

  onCreate(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.value as {
      name: string;
      description: string;
      email_address: string;
      uri: string;
      status: TeamStatus | null;
    };
    const result: CreateTeamDialogResult = {
      name: value.name.trim(),
    };

    if (value.description?.trim()) {
      result.description = value.description.trim();
    }
    if (value.email_address?.trim()) {
      result.email_address = value.email_address.trim();
    }
    if (value.uri?.trim()) {
      result.uri = value.uri.trim();
    }
    if (value.status != null) {
      result.status = value.status;
    }

    this.dialogRef.close(result);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
