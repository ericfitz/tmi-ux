import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  UserPresence,
  PresenceStatus,
  UserActivity,
} from '../../domain/collaboration/user-presence';

/**
 * Component for displaying a single user's presence indicator
 */
@Component({
  selector: 'app-user-presence-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="user-presence-indicator" [class]="getPresenceClass()">
      <div class="user-avatar" [style.background-color]="getUserColor()">
        <span class="user-initials">{{ getUserInitials() }}</span>
      </div>
      <div class="user-info" *ngIf="showDetails">
        <div class="user-name">{{ presence.user.name }}</div>
        <div class="user-status">
          <span class="status-dot" [class]="getStatusClass()"></span>
          <span class="status-text">{{ getStatusText() }}</span>
        </div>
        <div class="user-activity" *ngIf="presence.activity !== 'idle'">
          {{ getActivityText() }}
        </div>
      </div>
      <div class="user-cursor" *ngIf="showCursor && presence.isCursorVisible()">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            d="M0 0L16 6L6 8L4 16L0 0Z"
            [attr.fill]="getUserColor()"
            stroke="white"
            stroke-width="1"
          />
        </svg>
      </div>
    </div>
  `,
  styleUrls: ['./user-presence-indicator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPresenceIndicatorComponent {
  @Input() presence!: UserPresence;
  @Input() showDetails = true;
  @Input() showCursor = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  /**
   * Get user initials for avatar
   */
  getUserInitials(): string {
    const name = this.presence.user.name;
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Get user color based on user ID
   */
  getUserColor(): string {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA0DD', // Plum
      '#98D8C8', // Mint
      '#F7DC6F', // Light Yellow
      '#BB8FCE', // Light Purple
      '#85C1E9', // Light Blue
    ];

    // Generate consistent color based on user ID
    let hash = 0;
    for (let i = 0; i < this.presence.user.id.length; i++) {
      hash = this.presence.user.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Get CSS class for presence status
   */
  getPresenceClass(): string {
    const baseClass = `presence-${this.size}`;
    const statusClass = `status-${this.presence.status}`;
    const activityClass = `activity-${this.presence.activity}`;
    return `${baseClass} ${statusClass} ${activityClass}`;
  }

  /**
   * Get CSS class for status dot
   */
  getStatusClass(): string {
    return `status-${this.presence.status}`;
  }

  /**
   * Get human-readable status text
   */
  getStatusText(): string {
    switch (this.presence.status) {
      case PresenceStatus.ONLINE:
        return 'Online';
      case PresenceStatus.AWAY:
        return 'Away';
      case PresenceStatus.OFFLINE:
        return 'Offline';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get human-readable activity text
   */
  getActivityText(): string {
    switch (this.presence.activity) {
      case UserActivity.VIEWING:
        return 'Viewing';
      case UserActivity.EDITING:
        return this.presence.currentTool ? `Editing with ${this.presence.currentTool}` : 'Editing';
      case UserActivity.SELECTING:
        return 'Selecting';
      case UserActivity.IDLE:
        return 'Idle';
      default:
        return '';
    }
  }
}
