import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../../shared/imports';

export interface TmiLoginDialogData {
  providerName: string;
}

export interface TmiLoginDialogResult {
  loginHint: string;
}

@Component({
  selector: 'app-tmi-login-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ 'login.tmiDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ 'login.tmiDialog.usernameLabel' | transloco }}</mat-label>
        <input
          matInput
          [formControl]="usernameControl"
          [placeholder]="'login.tmiDialog.usernamePlaceholder' | transloco"
          autocomplete="username"
          cdkFocusInitial
        />
        @if (usernameControl.hasError('pattern')) {
          <mat-error>{{ 'login.tmiDialog.errorPattern' | transloco }}</mat-error>
        } @else if (usernameControl.hasError('minlength')) {
          <mat-error>{{ 'login.tmiDialog.errorMinLength' | transloco }}</mat-error>
        } @else if (usernameControl.hasError('maxlength')) {
          <mat-error>{{ 'login.tmiDialog.errorMaxLength' | transloco }}</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button mat-flat-button color="primary" (click)="onSignIn()">
        {{ 'login.tmiDialog.signIn' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host ::ng-deep .mat-mdc-dialog-content {
        padding-top: 12px;
        overflow: visible;
      }

      .full-width {
        width: 100%;
      }
    `,
  ],
})
// SEM@bcddd7c6d5d4c21a9077a0ffaff1a9272515d19d: dialog that collects a login hint before initiating tmi OAuth flow
export class TmiLoginDialogComponent {
  usernameControl = new FormControl('', [
    Validators.pattern(/^[a-zA-Z0-9._%+-]*$/),
    Validators.minLength(3),
    Validators.maxLength(20),
  ]);

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: inject dialog ref and provider name data (pure)
  constructor(
    private _dialogRef: MatDialogRef<TmiLoginDialogComponent, TmiLoginDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: TmiLoginDialogData,
  ) {}

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: validate username and close dialog with login hint result
  onSignIn(): void {
    if (this.usernameControl.invalid) {
      this.usernameControl.markAsTouched();
      return;
    }
    this._dialogRef.close({ loginHint: this.usernameControl.value || '' });
  }

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: dismiss the dialog without a result
  onCancel(): void {
    this._dialogRef.close(undefined);
  }
}
