import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { SaveStateService, SaveState } from '../../services/save-state.service';

/**
 * Visual indicator component for save state
 * Shows color-coded status with localized tooltips:
 * - Gray dot: Clean (no changes)
 * - Orange dot: Dirty (unsaved changes)
 * - Spinner: Saving (in progress)
 * - Green dot: Saved (success)
 * - Red dot: Error (failed to save)
 */
@Component({
  selector: 'app-save-indicator',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    TranslocoModule
  ],
  template: `
    <div class="save-indicator" 
         [class]="'save-indicator--' + saveState?.status"
         [matTooltip]="getTooltipMessage()"
         [matTooltipPosition]="tooltipPosition">
      
      <!-- Saving spinner -->
      <mat-spinner 
        *ngIf="saveState?.status === 'saving'"
        [diameter]="size"
        [strokeWidth]="2"
        class="save-indicator__spinner">
      </mat-spinner>
      
      <!-- Status dot for other states -->
      <mat-icon 
        *ngIf="saveState?.status !== 'saving'"
        [class]="'save-indicator__icon save-indicator__icon--' + saveState?.status"
        [style.font-size.px]="size">
        {{ getIconName() }}
      </mat-icon>
    </div>
  `,
  styles: [`
    .save-indicator {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: help;
    }

    .save-indicator__spinner {
      --mdc-circular-progress-active-indicator-color: #ff9800; /* Orange */
    }

    .save-indicator__icon {
      transition: color 0.2s ease-in-out;
    }

    .save-indicator__icon--clean {
      color: #9e9e9e; /* Gray */
    }

    .save-indicator__icon--dirty {
      color: #ff9800; /* Orange */
    }

    .save-indicator__icon--saved {
      color: #4caf50; /* Green */
    }

    .save-indicator__icon--error {
      color: #f44336; /* Red */
    }

    /* Hover effects for better UX */
    .save-indicator:hover .save-indicator__icon {
      opacity: 0.8;
    }

    /* Size variants */
    .save-indicator--small {
      width: 16px;
      height: 16px;
    }

    .save-indicator--medium {
      width: 20px;
      height: 20px;
    }

    .save-indicator--large {
      width: 24px;
      height: 24px;
    }
  `]
})
export class SaveIndicatorComponent implements OnInit, OnDestroy {
  /** Form ID to track save state for */
  @Input() formId!: string;

  /** Size of the indicator in pixels */
  @Input() size: number = 20;

  /** Tooltip position */
  @Input() tooltipPosition: 'above' | 'below' | 'left' | 'right' = 'above';

  /** Whether to show additional debug information in tooltip */
  @Input() showDebugInfo: boolean = false;

  saveState: SaveState | undefined;
  private subscription?: Subscription;

  constructor(
    private saveStateService: SaveStateService,
    private transloco: TranslocoService
  ) {}

  ngOnInit(): void {
    if (!this.formId) {
      console.warn('SaveIndicatorComponent: formId is required');
      return;
    }

    // Subscribe to save state changes
    const saveState$ = this.saveStateService.getSaveState(this.formId);
    if (saveState$) {
      this.subscription = saveState$.subscribe(state => {
        this.saveState = state;
      });
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Get the appropriate icon name for the current save state
   */
  getIconName(): string {
    switch (this.saveState?.status) {
      case 'clean':
        return 'radio_button_unchecked'; // Empty circle
      case 'dirty':
        return 'circle'; // Filled circle
      case 'saved':
        return 'check_circle'; // Circle with checkmark
      case 'error':
        return 'error'; // Error icon
      default:
        return 'radio_button_unchecked';
    }
  }

  /**
   * Get localized tooltip message based on save state
   */
  getTooltipMessage(): string {
    if (!this.saveState) {
      return this.transloco.translate('saveIndicator.unknown');
    }

    let baseMessage: string;
    
    switch (this.saveState.status) {
      case 'clean':
        baseMessage = this.transloco.translate('saveIndicator.clean');
        break;
      case 'dirty': {
        const changedCount = this.saveState.changedFields.size;
        if (changedCount === 1) {
          baseMessage = this.transloco.translate('saveIndicator.dirtyOne');
        } else {
          baseMessage = this.transloco.translate('saveIndicator.dirtyMany', { count: changedCount });
        }
        break;
      }
      case 'saving':
        baseMessage = this.transloco.translate('saveIndicator.saving');
        break;
      case 'saved':
        if (this.saveState.lastSaved) {
          const timeAgo = this.getTimeAgoString(this.saveState.lastSaved);
          baseMessage = this.transloco.translate('saveIndicator.savedAt', { time: timeAgo });
        } else {
          baseMessage = this.transloco.translate('saveIndicator.saved');
        }
        break;
      case 'error':
        if (this.saveState.errorMessage) {
          baseMessage = this.transloco.translate('saveIndicator.errorWithMessage', { 
            message: this.saveState.errorMessage 
          });
        } else {
          baseMessage = this.transloco.translate('saveIndicator.error');
        }
        break;
      default:
        baseMessage = this.transloco.translate('saveIndicator.unknown');
    }

    // Add debug information if enabled
    if (this.showDebugInfo && this.saveState.changedFields.size > 0) {
      const changedFields = Array.from(this.saveState.changedFields).join(', ');
      baseMessage += `\n${this.transloco.translate('saveIndicator.debugChangedFields', { fields: changedFields })}`;
    }

    return baseMessage;
  }

  /**
   * Convert a date to a human-readable "time ago" string
   */
  private getTimeAgoString(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffSeconds < 60) {
      return this.transloco.translate('saveIndicator.timeAgo.seconds', { count: diffSeconds });
    } else if (diffMinutes < 60) {
      return this.transloco.translate('saveIndicator.timeAgo.minutes', { count: diffMinutes });
    } else if (diffHours < 24) {
      return this.transloco.translate('saveIndicator.timeAgo.hours', { count: diffHours });
    } else {
      // For longer periods, show the actual time
      return date.toLocaleTimeString();
    }
  }
}