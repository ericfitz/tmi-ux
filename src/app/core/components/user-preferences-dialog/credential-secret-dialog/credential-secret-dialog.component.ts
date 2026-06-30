import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { environment } from '../../../../../environments/environment';

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
    <mat-dialog-content data-testid="credential-secret-dialog">
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
      <button mat-button (click)="onDownload()" [transloco]="'common.download'">Download</button>
      <button
        mat-flat-button
        color="primary"
        cdkFocusInitial
        (click)="onClose()"
        [transloco]="'common.done'"
        data-testid="credential-secret-done"
      >
        Done
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
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
        padding: 16px 24px 16px 0;
        margin: 0;
      }
    `,
  ],
})
// SEM@0e8a2c3202f571b575f8e65a19a5a5837acf95d8: display newly created client credential secret and allow copy or download
export class CredentialSecretDialogComponent {
  // SEM@e78c11b8340cb7b602f0e3b20931ef81c1f65216: inject dialog ref, credential data, clipboard, and logger (pure)
  constructor(
    public dialogRef: MatDialogRef<CredentialSecretDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CredentialSecretDialogData,
    private clipboard: Clipboard,
    private logger: LoggerService,
  ) {}

  // SEM@e78c11b8340cb7b602f0e3b20931ef81c1f65216: copy the client ID to the clipboard (mutates shared state)
  onCopyClientId(): void {
    const success = this.clipboard.copy(this.data.clientId);
    if (success) {
      this.logger.info('Client ID copied to clipboard');
    } else {
      this.logger.error('Failed to copy client ID to clipboard');
    }
  }

  // SEM@e78c11b8340cb7b602f0e3b20931ef81c1f65216: copy the client secret to the clipboard (mutates shared state)
  onCopyClientSecret(): void {
    const success = this.clipboard.copy(this.data.clientSecret);
    if (success) {
      this.logger.info('Client secret copied to clipboard');
    } else {
      this.logger.error('Failed to copy client secret to clipboard');
    }
  }

  // SEM@0e8a2c3202f571b575f8e65a19a5a5837acf95d8: download client credentials as a shell env-var script file
  onDownload(): void {
    const content =
      [
        `export TMI_CLIENT_ID=${this.data.clientId}`,
        `export TMI_CLIENT_SECRET=${this.data.clientSecret}`,
        `export TMI_SERVER=${environment.apiUrl}`,
      ].join('\n') + '\n';

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'client-credentials.txt';
    a.click();
    URL.revokeObjectURL(url);
    this.logger.info('Client credentials downloaded');
  }

  // SEM@e78c11b8340cb7b602f0e3b20931ef81c1f65216: close the credential secret dialog (pure)
  onClose(): void {
    this.dialogRef.close();
  }
}
