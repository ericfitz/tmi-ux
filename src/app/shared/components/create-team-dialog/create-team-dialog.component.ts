import { Component, ChangeDetectionStrategy } from '@angular/core';
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
            data-testid="create-team-name-input"
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
            data-testid="create-team-description-input"
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'teams.createDialog.emailAddress'">Email Address</mat-label>
          <input
            matInput
            formControlName="email_address"
            type="email"
            [placeholder]="'teams.createDialog.emailPlaceholder' | transloco"
            data-testid="create-team-email-input"
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
            data-testid="create-team-uri-input"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.status'">Status</mat-label>
          <mat-select formControlName="status" data-testid="create-team-status-select">
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
      <button mat-button (click)="onCancel()" data-testid="create-team-cancel-button">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="onCreate()"
        [disabled]="form.invalid || !form.dirty"
        data-testid="create-team-submit-button"
      >
        <span [transloco]="'common.create'">Create</span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
// SEM@53b5c954f863d742e2565068126182c97eb91b44: dialog component to collect and submit new team details (mutates shared state)
export class CreateTeamDialogComponent {
  teamStatuses: TeamStatus[] = TEAM_STATUSES;
  form: FormGroup;

  // SEM@53b5c954f863d742e2565068126182c97eb91b44: initialize team creation form with validation rules (mutates shared state)
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

  // SEM@f9af8c3f614051967898c1616392abde0638b600: validate form and close dialog with new team data (mutates shared state)
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

  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: close dialog without submitting team creation (mutates shared state)
  onCancel(): void {
    this.dialogRef.close();
  }
}
