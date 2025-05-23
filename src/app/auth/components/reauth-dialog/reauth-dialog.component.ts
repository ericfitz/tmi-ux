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
    this.logger.info('Attempting re-authentication via Google OAuth');

    // Redirect to Google OAuth login page
    this.authService.loginWithGoogle();

    // Note: The dialog will be closed by the OAuth callback handler
    // once the authentication flow completes.
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
