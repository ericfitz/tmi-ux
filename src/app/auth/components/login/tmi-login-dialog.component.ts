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
      .full-width {
        width: 100%;
      }
    `,
  ],
})
export class TmiLoginDialogComponent {
  usernameControl = new FormControl('', [
    Validators.pattern(/^[a-zA-Z0-9]*$/),
    Validators.minLength(3),
    Validators.maxLength(20),
  ]);

  constructor(
    private _dialogRef: MatDialogRef<TmiLoginDialogComponent, TmiLoginDialogResult | undefined>,
    @Inject(MAT_DIALOG_DATA) public data: TmiLoginDialogData,
  ) {}

  onSignIn(): void {
    if (this.usernameControl.invalid) {
      this.usernameControl.markAsTouched();
      return;
    }
    this._dialogRef.close({ loginHint: this.usernameControl.value || '' });
  }

  onCancel(): void {
    this._dialogRef.close(undefined);
  }
}
