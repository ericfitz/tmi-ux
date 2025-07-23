import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthError } from '../../models/auth.models';

@Component({
  selector: 'app-reauth-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reauth-dialog.component.html',
  styleUrls: ['./reauth-dialog.component.scss'],
})
export class ReauthDialogComponent implements OnInit {
  isLoading = false;
  error: string | null = null;

  constructor(
    private authService: AuthService,
    public dialogRef: MatDialogRef<ReauthDialogComponent>,
    private logger: LoggerService,
    @Inject(MAT_DIALOG_DATA) public data: { reason: string },
  ) {}

  ngOnInit(): void {
    this.logger.debug('ReauthDialogComponent initialized', this.data);
  }

  reauthenticate(): void {
    this.isLoading = true;
    this.error = null;

    // Check if this is a test user
    if (this.authService.isTestUser) {
      this.logger.info('Test user detected - extending session silently');

      // For test users, extend the session silently
      this.authService.extendTestUserSession().subscribe({
        next: success => {
          this.isLoading = false;
          if (success) {
            this.logger.info('Test user session extended successfully');
            this.dialogRef.close(true);
          } else {
            this.error = 'Failed to extend session. Please try again.';
            this.logger.error('Failed to extend test user session');
          }
        },
        error: error => {
          this.isLoading = false;
          this.error = 'An error occurred while extending your session.';
          this.logger.error('Error extending test user session', error);
        },
      });
    } else {
      // For OAuth users, redirect to default OAuth login page
      this.logger.info('Attempting re-authentication via OAuth');
      this.authService.initiateLogin();

      // Note: The dialog will be closed by the OAuth callback handler
      // once the authentication flow completes.
    }
  }

  cancel(): void {
    this.logger.debug('Re-authentication cancelled');
    this.dialogRef.close(false);
  }

  handleAuthError(authError: AuthError): void {
    this.isLoading = false;
    this.error = authError.message;
    this.logger.error('Re-authentication error', authError);
  }
}
