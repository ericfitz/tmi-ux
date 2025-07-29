/**
 * User Presence List Component
 *
 * This component manages and displays a list of user presence indicators for all users
 * currently participating in a collaborative DFD editing session.
 *
 * Key functionality:
 * - Displays multiple user presence indicators in a organized list
 * - Shows real-time updates of all active collaborators
 * - Provides configurable display modes (horizontal, vertical, grid)
 * - Supports different sizing options (small, medium, large)
 * - Shows user count and session statistics
 * - Handles user joining and leaving events
 * - Provides filtering and sorting capabilities for user lists
 * - Tracks user presence changes with reactive observables
 * - Supports both detailed and compact view modes
 * - Integrates with collaboration application service
 * - Provides keyboard navigation and accessibility features
 * - Handles empty states and loading indicators
 */

import { Component, Input, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, Subject } from 'rxjs';

import { UserPresence } from '../../domain/collaboration/user-presence';
import { DfdCollaborationService } from '../../services/dfd-collaboration.service';
import { UserPresenceIndicatorComponent } from './user-presence-indicator.component';

/**
 * Component for displaying a list of user presence indicators
 */
@Component({
  selector: 'app-user-presence-list',
  standalone: true,
  imports: [CommonModule, UserPresenceIndicatorComponent],
  template: `
    <div class="user-presence-list" [class]="getListClass()">
      <div class="presence-header" *ngIf="showHeader">
        <h3 class="header-title">{{ title }}</h3>
        <span class="user-count">{{ (presences$ | async)?.length || 0 }} users</span>
      </div>

      <div class="presence-items" [class]="getItemsClass()">
        <app-user-presence-indicator
          *ngFor="let presence of presences$ | async; trackBy: trackByUserId"
          [presence]="presence"
          [showDetails]="showDetails"
          [showCursor]="showCursor"
          [size]="size"
          class="presence-item"
        ></app-user-presence-indicator>

        <div class="empty-state" *ngIf="(presences$ | async)?.length === 0">
          <div class="empty-icon">👥</div>
          <div class="empty-text">{{ emptyMessage }}</div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./user-presence-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserPresenceListComponent implements OnInit, OnDestroy {
  @Input() title = 'Active Users';
  @Input() showHeader = true;
  @Input() showDetails = true;
  @Input() showCursor = false;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() layout: 'vertical' | 'horizontal' | 'grid' = 'vertical';
  @Input() maxItems?: number;
  @Input() emptyMessage = 'No users online';
  @Input() filterOnline = true;

  public presences$!: Observable<UserPresence[]>;
  private readonly _destroy$ = new Subject<void>();

  constructor(private readonly _collaborationService: DfdCollaborationService) {}

  ngOnInit(): void {
    // Get active participants from collaboration service
    this.presences$ = this.filterOnline
      ? this._collaborationService.collaborationUsers$
      : this._collaborationService.collaborationUsers$;
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Track function for ngFor
   */
  trackByUserId(index: number, presence: UserPresence): string {
    return presence.user.id;
  }

  /**
   * Get CSS class for the list container
   */
  getListClass(): string {
    const classes = ['presence-list'];

    if (this.layout) {
      classes.push(`layout-${this.layout}`);
    }

    if (this.size) {
      classes.push(`size-${this.size}`);
    }

    return classes.join(' ');
  }

  /**
   * Get CSS class for the items container
   */
  getItemsClass(): string {
    const classes = ['items'];

    if (this.layout === 'grid') {
      classes.push('grid-layout');
    } else if (this.layout === 'horizontal') {
      classes.push('horizontal-layout');
    } else {
      classes.push('vertical-layout');
    }

    return classes.join(' ');
  }
}
