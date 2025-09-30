import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
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
  styleUrls: ['./session-expiry-dialog.component.scss'],
})
export class SessionExpiryDialogComponent implements OnInit, OnDestroy {
  timeRemaining = '';
  private countdownSubscription: Subscription | null = null;

  constructor(
    private dialogRef: MatDialogRef<SessionExpiryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SessionExpiryDialogData,
    private transloco: TranslocoService,
  ) {
    // Disable closing the dialog by clicking outside or pressing escape
    this.dialogRef.disableClose = true;
  }

  ngOnInit(): void {
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  onExtendSession(): void {
    this.stopCountdown();
    this.data.onExtendSession();
    this.dialogRef.close('extend');
  }

  onLogout(): void {
    this.stopCountdown();
    this.data.onLogout();
    this.dialogRef.close('logout');
  }

  private startCountdown(): void {
    // Update immediately
    this.updateTimeRemaining();

    // Update every second
    this.countdownSubscription = interval(1000).subscribe(() => {
      this.updateTimeRemaining();

      // Auto-close if time has expired
      if (this.getRemainingTimeInSeconds() <= 0) {
        this.stopCountdown();
        this.dialogRef.close('expired');
      }
    });
  }

  private stopCountdown(): void {
    if (this.countdownSubscription) {
      this.countdownSubscription.unsubscribe();
      this.countdownSubscription = null;
    }
  }

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

  private getRemainingTimeInSeconds(): number {
    const now = new Date();
    const timeDiff = this.data.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(timeDiff / 1000));
  }
}
