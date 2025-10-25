import { Component, Inject, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { DIALOG_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../services/logger.service';
import { UserService } from '../../services/user.service';
import { AUTH_SERVICE, IAuthService } from '../../interfaces';

/**
 * Interface for the dialog data
 */
export interface DeleteUserDataDialogData {
  userEmail: string;
}

/**
 * Dialog stages for the deletion process
 */
enum DeleteStage {
  EXPLANATION = 'explanation',
  EMAIL_VERIFICATION = 'email_verification',
  PROCESSING = 'processing',
}

/**
 * Component for confirming user account deletion
 * Implements a three-stage process:
 * 1. Show explanation and get initial confirmation
 * 2. Request challenge and verify email address
 * 3. Process deletion and logout
 */
@Component({
  selector: 'app-delete-user-data-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule, MatProgressSpinnerModule],
  templateUrl: './delete-user-data-dialog.component.html',
  styleUrls: ['./delete-user-data-dialog.component.scss'],
})
export class DeleteUserDataDialogComponent implements OnDestroy {
  currentStage: DeleteStage = DeleteStage.EXPLANATION;
  emailInput = '';
  challengeText = '';
  errorMessage = '';

  private subscription: Subscription | null = null;

  // Expose enum to template
  readonly DeleteStage = DeleteStage;

  constructor(
    private dialogRef: MatDialogRef<DeleteUserDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteUserDataDialogData,
    @Inject(AUTH_SERVICE) private authService: IAuthService,
    private userService: UserService,
    private logger: LoggerService,
  ) {}

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  /**
   * Check if email input matches user's email exactly
   */
  get isEmailValid(): boolean {
    return this.emailInput === this.data.userEmail;
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }

  /**
   * Handle continue button from explanation stage
   */
  onContinue(): void {
    this.errorMessage = '';
    this.currentStage = DeleteStage.EMAIL_VERIFICATION;

    // Request the challenge from the server
    this.subscription = this.userService.requestDeleteChallenge().subscribe({
      next: response => {
        this.challengeText = response.challenge_text;
        this.logger.debugComponent(
          'DeleteUserDataDialog',
          'Received deletion challenge',
          'Challenge expires at: ' + response.expires_at,
        );
      },
      error: error => {
        this.logger.error('Failed to request deletion challenge', error);
        this.errorMessage =
          'Failed to initiate deletion process. Please try again or contact support.';
        this.currentStage = DeleteStage.EXPLANATION;
      },
    });
  }

  /**
   * Handle delete confirmation with email verification
   */
  onConfirmDelete(): void {
    if (!this.isEmailValid) {
      return;
    }

    this.errorMessage = '';
    this.currentStage = DeleteStage.PROCESSING;

    this.subscription = this.userService.confirmDeleteAccount(this.challengeText).subscribe({
      next: () => {
        this.logger.info('Account deletion successful');
        this.dialogRef.close(true);
        // Logout and redirect to home page
        this.authService.logout();
      },
      error: (error: unknown) => {
        this.logger.error('Failed to delete account', error);

        // Check if it's a 400 error (expired or invalid challenge)
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 400
        ) {
          this.errorMessage = 'The deletion request has expired. Please try again.';
        } else {
          this.errorMessage = 'Failed to delete account. Please try again or contact support.';
        }

        // Close the dialog on error as per requirements
        setTimeout(() => {
          this.dialogRef.close(false);
        }, 2000);
      },
    });
  }
}
