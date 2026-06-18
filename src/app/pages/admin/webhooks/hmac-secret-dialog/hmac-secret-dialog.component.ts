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

export interface HmacSecretDialogData {
  secret: string;
}

/**
 * Dialog for displaying HMAC secret after webhook creation
 * Shows the secret once with copy functionality
 */
@Component({
  selector: 'app-hmac-secret-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './hmac-secret-dialog.component.html',
  styleUrl: './hmac-secret-dialog.component.scss',
})
// SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: display the one-time HMAC secret after webhook creation with copy support
export class HmacSecretDialogComponent {
  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: inject dialog reference, HMAC secret data, clipboard service, and logger
  constructor(
    public dialogRef: MatDialogRef<HmacSecretDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HmacSecretDialogData,
    private clipboard: Clipboard,
    private logger: LoggerService,
  ) {}

  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: copy the HMAC secret to the clipboard, logging success or failure
  onCopySecret(): void {
    const success = this.clipboard.copy(this.data.secret);
    if (success) {
      this.logger.info('HMAC secret copied to clipboard');
    } else {
      this.logger.error('Failed to copy HMAC secret to clipboard');
    }
  }

  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: close the HMAC secret dialog
  onClose(): void {
    this.dialogRef.close();
  }
}
