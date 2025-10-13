import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Data passed to the presenter request snackbar
 */
export interface PresenterRequestSnackbarData {
  userEmail: string;
  displayName: string;
  message: string;
}

/**
 * Custom snackbar component for presenter requests with approve/deny actions
 */
@Component({
  selector: 'app-presenter-request-snackbar',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
    TranslocoModule,
  ],
  template: `
    <div class="presenter-request-snackbar">
      <span class="message">
        <span class="user-name" [matTooltip]="data.userEmail">
          {{ getUserDisplay() }}
        </span>
        <span class="request-text">{{
          'collaboration.isRequestingPresenterPrivileges' | transloco
        }}</span>
      </span>
      <div class="actions">
        <button
          mat-icon-button
          class="approve-button"
          (click)="approve()"
          [matTooltip]="'collaboration.approvePresenterRequest' | transloco"
        >
          <mat-icon
            fontSet="material-symbols-outlined"
            fontWeight="100"
            style="font-variation-settings: 'FILL' 0"
          >
            check
          </mat-icon>
        </button>
        <button
          mat-icon-button
          class="deny-button"
          (click)="deny()"
          [matTooltip]="'collaboration.denyPresenterRequest' | transloco"
        >
          <mat-icon
            fontSet="material-symbols-outlined"
            fontWeight="100"
            style="font-variation-settings: 'FILL' 0"
          >
            close
          </mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .presenter-request-snackbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-width: 300px;
      }

      .message {
        flex: 1;
        color: white;
      }

      .user-name {
        font-weight: 500;
        cursor: help;
      }

      .request-text {
        margin-left: 4px;
      }

      .actions {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .approve-button {
        color: #4caf50;
      }

      .approve-button:hover {
        background-color: rgba(76, 175, 80, 0.1);
      }

      .approve-button mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .deny-button {
        color: #f44336;
      }

      .deny-button:hover {
        background-color: rgba(244, 67, 54, 0.1);
      }

      .deny-button mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class PresenterRequestSnackbarComponent {
  constructor(
    @Inject(MAT_SNACK_BAR_DATA) public data: PresenterRequestSnackbarData,
    private _snackBarRef: MatSnackBarRef<PresenterRequestSnackbarComponent>,
  ) {}

  /**
   * Get the user display name (uses displayName if available, otherwise email)
   */
  getUserDisplay(): string {
    if (this.data.displayName && this.data.displayName.trim() !== '') {
      return this.data.displayName;
    }
    return this.data.userEmail;
  }

  approve(): void {
    this._snackBarRef.dismissWithAction();
  }

  deny(): void {
    this._snackBarRef.dismiss();
  }
}
