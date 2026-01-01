import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';

export interface CredentialSecretDialogData {
  clientId: string;
  clientSecret: string;
}

/**
 * Dialog for displaying client credentials after creation
 * Shows client ID and secret once with copy functionality
 */
@Component({
  selector: 'app-credential-secret-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'userPreferences.credentials.secretDialog.title'">
      Client Credential Created
    </h2>
    <mat-dialog-content>
      <p class="warning-text" [transloco]="'userPreferences.credentials.secretDialog.warning'">
        Save these credentials now. The client secret will not be shown again.
      </p>

      <div class="credential-field">
        <label class="field-label" [transloco]="'userPreferences.credentials.clientId'">
          Client ID
        </label>
        <div class="secret-container">
          <span class="secret-text">{{ data.clientId }}</span>
          <button
            mat-icon-button
            (click)="onCopyClientId()"
            [matTooltip]="'common.copyToClipboard' | transloco"
          >
            <mat-icon>content_copy</mat-icon>
          </button>
        </div>
      </div>

      <div class="credential-field">
        <label class="field-label" [transloco]="'userPreferences.credentials.clientSecret'">
          Client Secret
        </label>
        <div class="secret-container">
          <span class="secret-text">{{ data.clientSecret }}</span>
          <button
            mat-icon-button
            (click)="onCopyClientSecret()"
            [matTooltip]="'common.copyToClipboard' | transloco"
          >
            <mat-icon>content_copy</mat-icon>
          </button>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-raised-button color="primary" (click)="onClose()" [transloco]="'common.done'">
        Done
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .warning-text {
        color: var(--theme-text-secondary);
        margin-bottom: 16px;
        line-height: 1.5;
      }

      .credential-field {
        margin-bottom: 16px;
      }

      .field-label {
        display: block;
        font-weight: 500;
        font-size: 12px;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      .secret-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background-color: var(--theme-surface-variant, rgb(0 0 0 / 5%));
        border-radius: 4px;
        border: 1px solid var(--theme-divider);
      }

      .secret-text {
        font-family: monospace;
        font-size: 14px;
        font-weight: 700;
        color: var(--theme-text-primary);
        flex: 1;
        word-break: break-all;
      }

      mat-dialog-actions {
        padding: 16px 0 0;
        margin: 0;
      }
    `,
  ],
})
export class CredentialSecretDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CredentialSecretDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CredentialSecretDialogData,
    private clipboard: Clipboard,
    private logger: LoggerService,
  ) {}

  onCopyClientId(): void {
    const success = this.clipboard.copy(this.data.clientId);
    if (success) {
      this.logger.info('Client ID copied to clipboard');
    } else {
      this.logger.error('Failed to copy client ID to clipboard');
    }
  }

  onCopyClientSecret(): void {
    const success = this.clipboard.copy(this.data.clientSecret);
    if (success) {
      this.logger.info('Client secret copied to clipboard');
    } else {
      this.logger.error('Failed to copy client secret to clipboard');
    }
  }

  onClose(): void {
    this.dialogRef.close();
  }
}
