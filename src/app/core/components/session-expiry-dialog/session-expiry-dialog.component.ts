import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription, interval } from 'rxjs';

export interface SessionExpiryDialogData {
  expiresAt: Date;
  onExtendSession: () => void;
  onLogout: () => void;
}

@Component({
  selector: 'app-session-expiry-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslocoModule],
  templateUrl: './session-expiry-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./session-expiry-dialog.component.scss'],
})
// SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: display session expiry countdown and let the user extend or logout (mutates shared state)
export class SessionExpiryDialogComponent implements OnInit, OnDestroy {
  timeRemaining = '';
  isExtending = false;
  private countdownSubscription: Subscription | null = null;
  private userTookAction = false;

  // SEM@1dca05095f1e2fded0fbb8aab5061c3c1e6cc6f6: initialize session-expiry dialog and disable backdrop close (mutates shared state)
  constructor(
    private dialogRef: MatDialogRef<SessionExpiryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SessionExpiryDialogData,
    private transloco: TranslocoService,
  ) {
    // Disable closing the dialog by clicking outside or pressing escape
    this.dialogRef.disableClose = true;
  }

  // SEM@1dca05095f1e2fded0fbb8aab5061c3c1e6cc6f6: start the session-expiry countdown on component init (mutates shared state)
  ngOnInit(): void {
    this.startCountdown();
  }

  // SEM@1dca05095f1e2fded0fbb8aab5061c3c1e6cc6f6: stop the session-expiry countdown on component destroy (mutates shared state)
  ngOnDestroy(): void {
    this.stopCountdown();
  }

  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: handle user request to extend the session before it expires (mutates shared state)
  onExtendSession(): void {
    this.isExtending = true;
    this.userTookAction = true;
    this.stopCountdown();
    this.data.onExtendSession();
    // Note: Dialog will be closed by SessionManager when extension completes
  }

  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: handle user logout action and close the session-expiry dialog (mutates shared state)
  onLogout(): void {
    this.userTookAction = true;
    this.stopCountdown();
    this.data.onLogout();
    this.dialogRef.close('logout');
  }

  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: schedule per-second session-expiry countdown, auto-close on timeout (mutates shared state)
  private startCountdown(): void {
    // Update immediately
    this.updateTimeRemaining();

    // Update every second
    this.countdownSubscription = interval(1000).subscribe(() => {
      this.updateTimeRemaining();

      // Auto-close if time has expired and user hasn't taken action
      if (this.getRemainingTimeInSeconds() <= 0 && !this.userTookAction) {
        this.stopCountdown();
        this.dialogRef.close('expired');
      }
    });
  }

  // SEM@1dca05095f1e2fded0fbb8aab5061c3c1e6cc6f6: cancel the active session-expiry countdown subscription (mutates shared state)
  private stopCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
  }

  // SEM@d247550be065200bace8975b8e1d1f084df59773: format and update the localized time-remaining display string (mutates shared state)
  private updateTimeRemaining(): void {
    const remainingSeconds = this.getRemainingTimeInSeconds();

    if (remainingSeconds <= 0) {
      this.timeRemaining = this.transloco.translate('sessionExpiry.timeFormat.seconds', {
        seconds: '0',
      });
      return;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;

    if (minutes > 0) {
      // Format as MM:SS
      const formattedSeconds = seconds.toString().padStart(2, '0');
      this.timeRemaining = this.transloco.translate('sessionExpiry.timeFormat.minutesSeconds', {
        minutes: minutes.toString(),
        seconds: formattedSeconds,
      });
    } else {
      // Less than a minute, show seconds only
      this.timeRemaining = this.transloco.translate('sessionExpiry.timeFormat.seconds', {
        seconds: remainingSeconds.toString(),
      });
    }
  }

  // SEM@1dca05095f1e2fded0fbb8aab5061c3c1e6cc6f6: compute seconds remaining until session expiry (pure)
  private getRemainingTimeInSeconds(): number {
    const now = new Date();
    const timeDiff = this.data.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(timeDiff / 1000));
  }
}
