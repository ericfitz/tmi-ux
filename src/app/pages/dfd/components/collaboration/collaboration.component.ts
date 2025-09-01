/**
 * DFD Collaboration Component
 *
 * This component provides real-time collaboration features for the Data Flow Diagram editor.
 * It manages user presence, session sharing, and collaborative editing capabilities.
 *
 * Key functionality:
 * - Displays real-time user presence indicators showing who is currently editing
 * - Manages collaboration sessions with session creation and joining capabilities
 * - Provides user avatars and status indicators for active collaborators
 * - Handles session invitations via shareable links and session codes
 * - Shows real-time cursor positions and user actions
 * - Manages user permissions and collaboration roles
 * - Provides session management (start, stop, leave session)
 * - Integrates with WebSocket service for real-time communication
 * - Handles collaboration conflicts and synchronization
 * - Supports session notifications and status updates
 * - Provides collaborative awareness features for enhanced teamwork
 */

import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  DfdCollaborationService,
  CollaborationUser,
  CollaborationSession,
} from '../../services/dfd-collaboration.service';
import { DfdNotificationService } from '../../services/dfd-notification.service';
import { WebSocketAdapter } from '../../infrastructure/adapters/websocket.adapter';

/**
 * Component for managing collaboration in the DFD editor
 */
@Component({
  selector: 'app-dfd-collaboration',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslocoModule,
  ],
  templateUrl: './collaboration.component.html',
  styleUrls: ['./collaboration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdCollaborationComponent implements OnInit, OnDestroy {
  // Collaboration state
  isCollaborating = false;
  collaborationUsers: CollaborationUser[] = [];
  currentPresenterEmail: string | null = null;
  pendingPresenterRequests: string[] = [];
  isCurrentUserHostFlag = false;
  existingSessionAvailable: CollaborationSession | null = null;

  // URL copy feedback
  linkCopied = false;

  // Subscription management
  private _subscriptions = new Subscription();
  
  // Track if menu is open for better change detection
  private _menuOpen = false;
  
  // Periodic refresh timer
  private _refreshInterval: any = null;

  constructor(
    private _logger: LoggerService,
    private _cdr: ChangeDetectorRef,
    private _collaborationService: DfdCollaborationService,
    private _dialog: MatDialog,
    private _notificationService: DfdNotificationService,
    private _webSocketAdapter: WebSocketAdapter,
    private _translocoService: TranslocoService,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  ngOnInit(): void {
    this._logger.info('DfdCollaborationComponent initialized');

    // Subscribe to collaboration status changes
    this._subscriptions.add(
      this._collaborationService.isCollaborating$.subscribe(isCollaborating => {
        this._logger.info('[CollaborationComponent] Collaboration status changed', {
          previous: this.isCollaborating,
          new: isCollaborating,
          timestamp: new Date().toISOString(),
        });
        
        this.isCollaborating = isCollaborating;
        // Don't set host flag here - wait for users to be populated
        // Only clear it when collaboration ends
        if (!isCollaborating) {
          this.isCurrentUserHostFlag = false;
        }
        
        // Force immediate change detection
        this._cdr.detectChanges();
      }),
    );

    // Subscribe to collaboration users changes
    this._subscriptions.add(
      this._collaborationService.collaborationUsers$.subscribe(users => {
        this._logger.info('[CollaborationComponent] Users subscription fired', {
          previousUserCount: this.collaborationUsers.length,
          newUserCount: users.length,
          timestamp: new Date().toISOString(),
        });
        
        // Update local state
        this.collaborationUsers = [...users]; // Create new array reference
        this.isCurrentUserHostFlag = this._collaborationService.isCurrentUserHost();
        
        this._logger.info('[CollaborationComponent] Component state updated', {
          userCount: this.collaborationUsers.length,
          users: this.collaborationUsers,
          isCollaborating: this.isCollaborating,
          isCurrentUserHost: this.isCurrentUserHostFlag,
        });
        
        // Force immediate change detection
        this._cdr.detectChanges();
      }),
    );

    // Subscribe to presenter state changes
    this._subscriptions.add(
      this._collaborationService.currentPresenterEmail$.subscribe(presenterEmail => {
        this.currentPresenterEmail = presenterEmail;
        this._cdr.markForCheck();
      }),
    );

    // Subscribe to pending presenter requests
    this._subscriptions.add(
      this._collaborationService.pendingPresenterRequests$.subscribe(requests => {
        this.pendingPresenterRequests = requests;
        this._cdr.markForCheck();
      }),
    );

    // Subscribe to existing session availability
    this._subscriptions.add(
      this._collaborationService.existingSessionAvailable$.subscribe(session => {
        this.existingSessionAvailable = session;
        this._cdr.markForCheck();
      }),
    );

    // Subscribe to WebSocket connection state changes to trigger tooltip updates
    this._subscriptions.add(
      this._webSocketAdapter.connectionState$.subscribe(() => {
        // This subscription triggers change detection when WebSocket state changes
        // The tooltip will be updated automatically through Angular's change detection
        this._cdr.markForCheck();
        
        // Set up or clear periodic refresh based on WebSocket connection state
        this._setupPeriodicRefresh();
      }),
    );
    
    // Initial setup of periodic refresh
    this._setupPeriodicRefresh();
  }

  ngOnDestroy(): void {
    // Clear any running refresh interval
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    
    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();

    // End collaboration if active when component is destroyed
    if (this.isCollaborating) {
      this._collaborationService
        .endCollaboration()
        .pipe(take(1))
        .subscribe({
          next: () => {
            this._logger.debugComponent(
              'Collaboration',
              'Collaboration ended successfully during component destruction',
            );
          },
          error: (error: unknown) => {
            this._logger.error('Failed to end collaboration during component destruction', error);
          },
        });
    }
  }

  /**
   * Set up or clear periodic refresh based on WebSocket connection state
   */
  private _setupPeriodicRefresh(): void {
    // Clear existing interval if any
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    
    // Set up new interval if WebSocket is connected
    if (this._webSocketAdapter.isConnected) {
      this._logger.info('[CollaborationComponent] Setting up periodic refresh', {
        interval: '5 seconds',
        isConnected: true,
      });
      
      this._refreshInterval = setInterval(() => {
        this._logger.debug('[CollaborationComponent] Periodic refresh tick', {
          timestamp: new Date().toISOString(),
          userCount: this.collaborationUsers.length,
          isMenuOpen: this._menuOpen,
        });
        
        // Force change detection
        this._cdr.detectChanges();
      }, 5000); // Refresh every 5 seconds
    } else {
      this._logger.info('[CollaborationComponent] WebSocket not connected, no periodic refresh', {
        isConnected: false,
      });
    }
  }

  /**
   * Toggle collaboration on/off
   */
  toggleCollaboration(): void {
    if (this.isCollaborating) {
      // Check if current user is host to determine which action to take
      if (this._collaborationService.isCurrentUserHost()) {
        this._collaborationService
          .endCollaboration()
          .pipe(take(1))
          .subscribe(success => {
            if (success) {
              this._logger.info('Collaboration ended successfully');
            } else {
              this._logger.error('Failed to end collaboration');
            }
          });
      } else {
        this._collaborationService
          .leaveSession()
          .pipe(take(1))
          .subscribe(success => {
            if (success) {
              this._logger.info('Left collaboration session successfully');
            } else {
              this._logger.error('Failed to leave collaboration session');
            }
          });
      }
    } else {
      this._collaborationService
        .startOrJoinCollaboration()
        .pipe(take(1))
        .subscribe(success => {
          if (success) {
            this._logger.info('Collaboration started or joined successfully');
          } else {
            this._logger.error('Failed to start or join collaboration');
          }
        });
    }
  }

  /**
   * Copy the current URL to clipboard with collaboration join parameters
   */
  copyLinkToClipboard(): void {
    try {
      const currentUrl = new URL(this._document.location.href);

      // Add the joinCollaboration query parameter like the dashboard join button
      currentUrl.searchParams.set('joinCollaboration', 'true');

      const urlWithParams = currentUrl.toString();

      navigator.clipboard.writeText(urlWithParams).then(
        () => {
          this._logger.info('Collaboration URL copied to clipboard', { url: urlWithParams });
          this._notificationService.showSuccess('Link copied to clipboard').subscribe();
        },
        (error: unknown) => {
          this._logger.error('Failed to copy URL to clipboard', { error });
          this._notificationService.showError('Failed to copy link').subscribe();
        },
      );
    } catch (error) {
      this._logger.error('Error copying URL to clipboard', { error });
    }
  }

  /**
   * Remove a user from the collaboration session
   * @param userEmail The email of the user to remove
   */
  removeUser(userEmail: string): void {
    this._collaborationService
      .removeUser(userEmail)
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          this._logger.info('User removed successfully', { userEmail });
        } else {
          this._logger.error('Failed to remove user', { userEmail });
        }
      });
  }

  /**
   * Update a user's permission in the collaboration session
   * @param userEmail The email of the user to update
   * @param permission The new permission to assign
   */
  updateUserPermission(userEmail: string, permission: 'writer' | 'reader'): void {
    this._collaborationService
      .updateUserPermission(userEmail, permission)
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          this._logger.info('User permission updated successfully', { userEmail, permission });
        } else {
          this._logger.error('Failed to update user permission', { userEmail, permission });
        }
      });
  }

  /**
   * Check if the current user has a specific permission
   * @param permission The permission to check
   * @returns boolean indicating if the user has the permission
   */
  hasPermission(permission: 'edit' | 'manageSession'): boolean {
    return this._collaborationService.hasPermission(permission);
  }

  /**
   * Check if the current user is the host of the collaboration session
   * @returns boolean indicating if the current user is the host
   */
  isCurrentUserHost(): boolean {
    return this.isCurrentUserHostFlag;
  }

  /**
   * Get the color for the collaboration button based on current state
   * @returns The Material color to use for the button
   */
  getCollaborationButtonColor(): string {
    if (this.isCollaborating) {
      return 'primary'; // Active session - primary (blue)
    }
    if (this.existingSessionAvailable) {
      return 'accent'; // Existing session available - accent (usually blue/teal)
    }
    return 'primary'; // Default state - primary
  }

  /**
   * Get the tooltip text for the collaboration button
   * @returns The tooltip text
   */
  getCollaborationButtonTooltip(): string {
    if (this.isCollaborating) {
      return 'Manage Collaboration';
    }
    if (this.existingSessionAvailable) {
      return 'Join Existing Collaboration Session';
    }
    return 'Start Collaboration';
  }

  /**
   * Check if a specific user is the current user
   * @param userEmail The user email to check
   * @returns boolean indicating if this is the current user
   */
  isCurrentUser(userEmail: string): boolean {
    return this._collaborationService.isCurrentUser(userEmail);
  }

  /**
   * Check if current user is the presenter
   * @returns boolean indicating if current user is presenter
   */
  isCurrentUserPresenter(): boolean {
    return this._collaborationService.isCurrentUserPresenter();
  }

  /**
   * Request presenter privileges
   */
  requestPresenterPrivileges(): void {
    this._collaborationService
      .requestPresenterPrivileges()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request sent successfully');
          // Note: Notification is handled by the collaboration service
        },
        error: error => {
          this._logger.error('Failed to request presenter privileges', error);
          // Note: Error notification is handled by the collaboration service
        },
      });
  }

  /**
   * Approve presenter request (host only)
   * @param userEmail The user email to approve
   */
  approvePresenterRequest(userEmail: string): void {
    this._collaborationService
      .approvePresenterRequest(userEmail)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request approved', { userEmail });
          // Note: Notification is handled by the collaboration service
        },
        error: error => {
          this._logger.error('Failed to approve presenter request', error);
          // Note: Error notification is handled by the collaboration service
        },
      });
  }

  /**
   * Deny presenter request (host only)
   * @param userEmail The user email to deny
   */
  denyPresenterRequest(userEmail: string): void {
    this._collaborationService
      .denyPresenterRequest(userEmail)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request denied', { userEmail });
          // Note: Notification is handled by the collaboration service
        },
        error: error => {
          this._logger.error('Failed to deny presenter request', error);
          // Note: Error notification is handled by the collaboration service
        },
      });
  }

  /**
   * Take back presenter privileges (host only)
   */
  takeBackPresenterPrivileges(): void {
    this._collaborationService
      .takeBackPresenterPrivileges()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter privileges taken back');
          // Note: Notification is handled by the collaboration service
        },
        error: error => {
          this._logger.error('Failed to take back presenter privileges', error);
          // Note: Error notification is handled by the collaboration service
        },
      });
  }

  /**
   * Clear presenter (host only)
   */
  clearPresenter(): void {
    this._collaborationService
      .setPresenter(null)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter cleared');
          // Note: Notification is handled by the collaboration service
        },
        error: error => {
          this._logger.error('Failed to clear presenter', error);
          // Note: Error notification is handled by the collaboration service
        },
      });
  }

  /**
   * Get the status color for a user
   * @param status The user's status
   * @returns A CSS color class
   */
  getStatusColor(status: 'active' | 'idle' | 'disconnected'): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'idle':
        return 'status-idle';
      case 'disconnected':
        return 'status-disconnected';
      default:
        return '';
    }
  }

  /**
   * Get the appropriate Material icon for the current WebSocket connection status
   */
  getWebSocketStatusIcon(): string {
    if (!this.isCollaborating) {
      return 'sensors'; // No session started - use neutral sensors icon
    }

    // Collaboration session is active
    if (this._webSocketAdapter.isConnected) {
      return 'sensors'; // Connected and healthy
    } else {
      return 'sensors_off'; // Not connected or not healthy
    }
  }

  /**
   * Get the appropriate CSS class for the WebSocket connection status icon
   */
  getWebSocketStatusIconClass(): string {
    if (!this.isCollaborating) {
      return 'websocket-status-not-configured'; // No session - grey color
    }

    // Collaboration session is active
    if (this._webSocketAdapter.isConnected) {
      return 'websocket-status-connected'; // Connected - green color
    } else {
      return 'websocket-status-error'; // Not connected - red color
    }
  }

  /**
   * Get the name of the current presenter
   * @returns The presenter's name or ID
   */
  getPresenterName(): string {
    if (!this.currentPresenterEmail) {
      return '';
    }
    const presenter = this.collaborationUsers.find(user => user.email === this.currentPresenterEmail);
    return presenter?.name || this.currentPresenterEmail;
  }

  /**
   * Get the name of a user by their email
   * @param userEmail The user email
   * @returns The user's name or email
   */
  getRequestUserName(userEmail: string): string {
    const user = this.collaborationUsers.find(u => u.email === userEmail);
    return user?.name || userEmail;
  }

  /**
   * Get the appropriate tooltip text for the WebSocket connection status
   */
  getWebSocketStatusTooltip(): string {
    if (!this.isCollaborating) {
      const notConnectedText = this._translocoService.translate(
        'collaboration.websocketStatus.notConnected',
      );
      return (
        notConnectedText +
        '\n' +
        this._translocoService.translate('collaboration.websocketStatus.noSession')
      );
    }

    // Collaboration session is active
    let statusText: string;
    if (this._webSocketAdapter.isConnected) {
      statusText = this._translocoService.translate('collaboration.websocketStatus.connected');
    } else {
      statusText = this._translocoService.translate('collaboration.websocketStatus.notConnected');
    }

    // Get the actual WebSocket URL from the collaboration service
    const wsUrl = this._collaborationService.currentWebSocketUrl || 'WebSocket URL: (unavailable)';

    return `${statusText}\n${wsUrl}`;
  }
  
  /**
   * Handle menu opened event
   */
  onMenuOpened(): void {
    this._logger.info('[CollaborationComponent] Menu opened', {
      timestamp: new Date().toISOString(),
      userCount: this.collaborationUsers.length,
      isCollaborating: this.isCollaborating,
    });
    
    this._menuOpen = true;
    
    // Force immediate change detection when menu opens
    this._cdr.detectChanges();
  }
  
  /**
   * Handle menu closed event
   */
  onMenuClosed(): void {
    this._logger.info('[CollaborationComponent] Menu closed', {
      timestamp: new Date().toISOString(),
    });
    
    this._menuOpen = false;
  }
}
