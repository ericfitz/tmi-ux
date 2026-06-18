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
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { DOCUMENT } from '@angular/common';

import { LoggerService } from '../../../../../core/services/logger.service';
import {
  DfdCollaborationService,
  CollaborationUser,
  CollaborationSession,
} from '../../../../../core/services/dfd-collaboration.service';
import { AppNotificationService } from '../../../application/services/app-notification.service';
import { WebSocketAdapter } from '../../../../../core/services/websocket.adapter';
import { ScrollIndicatorDirective } from '../../../../../shared/directives/scroll-indicator.directive';

// SEM@88d717bf273cf5a28cf136002cb7e9bb24b8285f: type alias for the data payload passed to the collaboration dialog (pure)
export type CollaborationDialogData = object;

@Component({
  selector: 'app-collaboration-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TooltipAriaLabelDirective,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatMenuModule,
    TranslocoModule,
    ScrollIndicatorDirective,
  ],
  templateUrl: './collaboration-dialog.component.html',
  styleUrls: ['./collaboration-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@d4322784af04c286c6dd06c07662e27950dae791: manage real-time collaboration session users and permissions for a DFD diagram
export class CollaborationDialogComponent implements OnInit, OnDestroy {
  // Collaboration state
  isCollaborating = false;
  collaborationUsers: CollaborationUser[] = [];
  currentPresenterEmail: string | null = null;
  pendingPresenterRequests: string[] = [];
  isCurrentUserHostFlag = false;
  existingSessionAvailable: CollaborationSession | null = null;
  isDiagramContextReady = false;

  // Subscription management
  private _subscriptions = new Subscription();

  // Periodic refresh timer
  private _refreshInterval: any = null;

  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: inject collaboration, notification, and WebSocket services into the dialog (mutates shared state)
  constructor(
    private _dialogRef: MatDialogRef<CollaborationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CollaborationDialogData,
    private _logger: LoggerService,
    private _cdr: ChangeDetectorRef,
    private _collaborationService: DfdCollaborationService,
    private _notificationService: AppNotificationService,
    private _webSocketAdapter: WebSocketAdapter,
    private _translocoService: TranslocoService,
    @Inject(DOCUMENT) private _document: Document,
  ) {}

  // SEM@8ad43e58ae86a57581df9b84b3533a52b4228ae8: subscribe to collaboration state and schedule periodic sync on WebSocket connect (mutates shared state)
  ngOnInit(): void {
    this._logger.info('CollaborationDialogComponent initialized');

    // Check if diagram context is set
    const contextSet = this._collaborationService.isDiagramContextSet();
    const context = this._collaborationService.getDiagramContext();
    const stateContextReady = this._collaborationService.getCurrentState().isDiagramContextReady;

    this._logger.info('Diagram context status', {
      contextSet,
      context,
      stateContextReady,
      mismatch: stateContextReady !== contextSet,
    });

    // If there's a mismatch, log a warning
    if (stateContextReady !== contextSet) {
      this._logger.warn('Context ready state mismatch detected', {
        stateContextReady,
        actualContextSet: contextSet,
        context,
      });
    }

    // Subscribe to the unified collaboration state
    this._subscriptions.add(
      this._collaborationService.collaborationState$.subscribe(state => {
        this._logger.info('[CollaborationDialog] State subscription fired', {
          timestamp: new Date().toISOString(),
          isActive: state.isActive,
          userCount: state.users.length,
          previousUserCount: this.collaborationUsers.length,
          hasSession: !!state.sessionInfo,
        });

        // Update all component properties from the unified state
        const previousIsCollaborating = this.isCollaborating;
        const previousUserCount = this.collaborationUsers.length;
        this.isCollaborating = state.isActive;
        this.collaborationUsers = [...state.users]; // Create new array reference
        this.currentPresenterEmail = state.currentPresenterEmail;
        this.pendingPresenterRequests = [...state.pendingPresenterRequests];
        this.existingSessionAvailable = state.existingSessionAvailable;
        this.isDiagramContextReady = state.isDiagramContextReady;

        // Update host flag
        this.isCurrentUserHostFlag = this._collaborationService.isCurrentUserHost();

        // Log significant state changes
        if (previousIsCollaborating !== state.isActive) {
          this._logger.info('[CollaborationDialog] Collaboration status changed', {
            previous: previousIsCollaborating,
            new: state.isActive,
          });
        }

        if (previousUserCount !== state.users.length) {
          this._logger.info('[CollaborationDialog] User count changed', {
            previous: previousUserCount,
            new: state.users.length,
            users: state.users.map(u => ({ email: u.email, name: u.name })),
          });
        }

        this._logger.info('[CollaborationDialog] Component state updated', {
          isCollaborating: this.isCollaborating,
          userCount: this.collaborationUsers.length,
          users: this.collaborationUsers,
          isCurrentUserHost: this.isCurrentUserHostFlag,
          presenter: this.currentPresenterEmail,
          pendingRequests: this.pendingPresenterRequests.length,
        });

        // Force immediate change detection
        this._logger.info('[CollaborationDialog] Triggering change detection', {
          timestamp: new Date().toISOString(),
        });
        this._cdr.detectChanges();
      }),
    );

    // Subscribe to WebSocket connection state changes
    this._subscriptions.add(
      this._webSocketAdapter.connectionState$.subscribe(() => {
        this._cdr.markForCheck();
        this._setupPeriodicRefresh();
      }),
    );

    // Initial setup of periodic refresh
    this._setupPeriodicRefresh();

    // Perform initial state sync to ensure we have the latest state
    this._syncWithServiceState();
  }

  // SEM@b0c4b820c2575334e437219701331f3b664358de: cancel the refresh interval and unsubscribe all subscriptions on destroy (mutates shared state)
  ngOnDestroy(): void {
    // Clear any running refresh interval
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }

    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();
  }

  /**
   * Close the dialog
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: close the collaboration dialog (mutates shared state)
  closeDialog(): void {
    this._dialogRef.close();
  }

  /**
   * Sync component state with service state
   */
  // SEM@0db4bd6c8ebf3dc2d21d1b513db497ac9278af18: pull current collaboration state from the service into component fields (mutates shared state)
  private _syncWithServiceState(): void {
    this._logger.info('[CollaborationDialog] Performing initial state sync');

    const currentState = this._collaborationService.getCurrentState();

    // Update all component properties from the current state
    this.isCollaborating = currentState.isActive;
    this.collaborationUsers = [...currentState.users];
    this.currentPresenterEmail = currentState.currentPresenterEmail;
    this.pendingPresenterRequests = [...currentState.pendingPresenterRequests];
    this.existingSessionAvailable = currentState.existingSessionAvailable;
    this.isDiagramContextReady = currentState.isDiagramContextReady;
    this.isCurrentUserHostFlag = this._collaborationService.isCurrentUserHost();

    this._logger.info('[CollaborationDialog] Initial state sync complete', {
      isCollaborating: this.isCollaborating,
      userCount: this.collaborationUsers.length,
      isCurrentUserHost: this.isCurrentUserHostFlag,
    });

    // Force change detection
    this._cdr.detectChanges();
  }

  /**
   * Set up or clear periodic refresh based on WebSocket connection state
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: schedule or cancel periodic state-verification ticks based on WebSocket connectivity (mutates shared state)
  private _setupPeriodicRefresh(): void {
    // Clear existing interval if any
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }

    // Set up new interval if WebSocket is connected
    if (this._webSocketAdapter.isConnected) {
      this._logger.info('[CollaborationDialog] Setting up periodic refresh', {
        interval: '5 seconds',
        isConnected: true,
      });

      this._refreshInterval = setInterval(() => {
        this._logger.debugComponent('CollaborationDialog', 'Periodic refresh tick', {
          timestamp: new Date().toISOString(),
          userCount: this.collaborationUsers.length,
        });

        // Verify state synchronization
        this._verifyStateSync();

        // Force change detection
        this._cdr.detectChanges();
      }, 5000); // Refresh every 5 seconds
    } else {
      this._logger.info('[CollaborationDialog] WebSocket not connected, no periodic refresh', {
        isConnected: false,
      });
    }
  }

  /**
   * Verify that component state is synchronized with service state
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: detect component-to-service state mismatches and trigger recovery sync (mutates shared state)
  private _verifyStateSync(): void {
    const serviceState = this._collaborationService.getCurrentState();

    // Check for state mismatches
    const mismatches: string[] = [];

    if (this.isCollaborating !== serviceState.isActive) {
      mismatches.push(
        `isCollaborating: component=${this.isCollaborating}, service=${serviceState.isActive}`,
      );
    }

    if (this.collaborationUsers.length !== serviceState.users.length) {
      mismatches.push(
        `userCount: component=${this.collaborationUsers.length}, service=${serviceState.users.length}`,
      );
    }

    if (this.currentPresenterEmail !== serviceState.currentPresenterEmail) {
      mismatches.push(
        `presenter: component=${this.currentPresenterEmail}, service=${serviceState.currentPresenterEmail}`,
      );
    }

    if (mismatches.length > 0) {
      this._logger.warn('[CollaborationDialog] State mismatch detected!', {
        mismatches,
        componentState: {
          isCollaborating: this.isCollaborating,
          userCount: this.collaborationUsers.length,
          users: this.collaborationUsers,
          presenter: this.currentPresenterEmail,
          isHost: this.isCurrentUserHostFlag,
        },
        serviceState: {
          isActive: serviceState.isActive,
          userCount: serviceState.users.length,
          users: serviceState.users,
          presenter: serviceState.currentPresenterEmail,
        },
      });

      // If mismatch detected, perform recovery sync
      this._logger.warn('[CollaborationDialog] Performing recovery sync due to state mismatch');
      this._syncWithServiceState();
    } else {
      this._logger.debugComponent('CollaborationDialog', 'State verified - in sync', {
        userCount: this.collaborationUsers.length,
        isActive: this.isCollaborating,
      });
    }
  }

  /**
   * Toggle collaboration on/off
   */
  // SEM@d4322784af04c286c6dd06c07662e27950dae791: start or stop the active collaboration session for the diagram (mutates shared state)
  toggleCollaboration(): void {
    this._logger.info('toggleCollaboration called', {
      isCollaborating: this.isCollaborating,
      existingSessionAvailable: !!this.existingSessionAvailable,
    });

    this._collaborationService
      .toggleCollaboration()
      .pipe(take(1))
      .subscribe({
        next: success => {
          if (success) {
            this._logger.info('Collaboration toggled successfully');
          } else {
            this._logger.info('Collaboration toggle cancelled or unsuccessful');
          }
        },
        error: error => {
          this._logger.error('Error toggling collaboration', error);
          // Show user-facing error when context is not ready
          if (error?.message?.includes('context not ready')) {
            this._notificationService
              .showError('Unable to start collaboration. Please refresh the page and try again.')
              .subscribe();
          }
        },
      });
  }

  /**
   * Copy the current URL to clipboard with collaboration join parameters
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: copy a collaboration join URL for the current diagram to the system clipboard (mutates shared state)
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
   */
  // SEM@977419d6107921dd60430d6cecd8cb872c9ed1c2: remove a collaborator from the active session (mutates shared state)
  removeUser(user: CollaborationUser): void {
    this._collaborationService
      .removeUser({
        provider_id: user.provider_id,
        email: user.email,
        name: user.name,
        provider: user.provider,
      })
      .pipe(take(1))
      .subscribe(success => {
        if (success) {
          this._logger.info('User removed successfully', {
            provider_id: user.provider_id,
            email: user.email,
          });
        } else {
          this._logger.error('Failed to remove user', {
            provider_id: user.provider_id,
            email: user.email,
          });
        }
      });
  }

  /**
   * Update a user's permission in the collaboration session
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: update a collaborator's read/write permission in the session (mutates shared state)
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
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: check whether the current user holds a named collaboration permission (pure)
  hasPermission(permission: 'edit' | 'manageSession'): boolean {
    return this._collaborationService.hasPermission(permission);
  }

  /**
   * Check if the current user is the host of the collaboration session
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: return whether the current user is the collaboration session host (pure)
  isCurrentUserHost(): boolean {
    return this.isCurrentUserHostFlag;
  }

  /**
   * Get the color for the collaboration button based on current state
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: map collaboration session state to a button color string (pure)
  getCollaborationButtonColor(): string {
    if (this.isCollaborating) {
      return 'primary';
    }
    if (this.existingSessionAvailable) {
      return 'accent';
    }
    return 'primary';
  }

  /**
   * Check if a specific user is the current user
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: validate whether a given email matches the authenticated user (pure)
  isCurrentUser(userEmail: string): boolean {
    return this._collaborationService.isCurrentUser(userEmail);
  }

  /**
   * Check if current user is the presenter
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: validate whether the authenticated user holds presenter privileges (pure)
  isCurrentUserPresenter(): boolean {
    return this._collaborationService.isCurrentUserPresenter();
  }

  /**
   * Request presenter privileges
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: dispatch a presenter-privilege request for the current user to the collaboration service
  requestPresenterPrivileges(): void {
    this._collaborationService
      .requestPresenterPrivileges()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request sent successfully');
        },
        error: error => {
          this._logger.error('Failed to request presenter privileges', error);
        },
      });
  }

  /**
   * Approve presenter request (host only)
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: approve a pending presenter-privilege request for a given user (host only)
  approvePresenterRequest(userEmail: string): void {
    this._collaborationService
      .approvePresenterRequest(userEmail)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request approved', { userEmail });
        },
        error: error => {
          this._logger.error('Failed to approve presenter request', error);
        },
      });
  }

  /**
   * Deny presenter request (host only)
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: deny a pending presenter-privilege request for a given user (host only)
  denyPresenterRequest(userEmail: string): void {
    this._collaborationService
      .denyPresenterRequest(userEmail)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter request denied', { userEmail });
        },
        error: error => {
          this._logger.error('Failed to deny presenter request', error);
        },
      });
  }

  /**
   * Take back presenter privileges (host only)
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: revoke presenter privileges from the current presenter (host only)
  takeBackPresenterPrivileges(): void {
    this._collaborationService
      .takeBackPresenterPrivileges()
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter privileges taken back');
        },
        error: error => {
          this._logger.error('Failed to take back presenter privileges', error);
        },
      });
  }

  /**
   * Clear presenter (host only)
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: unset the active presenter, clearing presenter role from the session (host only)
  clearPresenter(): void {
    this._collaborationService
      .setPresenter(null)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this._logger.info('Presenter cleared');
        },
        error: error => {
          this._logger.error('Failed to clear presenter', error);
        },
      });
  }

  /**
   * Get the status color for a user
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: map a collaboration user's connection status to a CSS class name (pure)
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
  // SEM@b0c4b820c2575334e437219701331f3b664358de: map WebSocket connection state to a Material icon name (pure)
  getWebSocketStatusIcon(): string {
    if (!this.isCollaborating) {
      return 'sensors';
    }

    if (this._webSocketAdapter.isConnected) {
      return 'sensors';
    } else {
      return 'sensors_off';
    }
  }

  /**
   * Get the appropriate CSS class for the WebSocket connection status icon
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: map WebSocket connection state to a CSS class for icon styling (pure)
  getWebSocketStatusIconClass(): string {
    if (!this.isCollaborating) {
      return 'websocket-status-not-configured';
    }

    if (this._webSocketAdapter.isConnected) {
      return 'websocket-status-connected';
    } else {
      return 'websocket-status-error';
    }
  }

  /**
   * Get the name of the current presenter
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: resolve the current presenter's display name from the collaborator list (pure)
  getPresenterName(): string {
    if (!this.currentPresenterEmail) {
      return '';
    }
    const presenter = this.collaborationUsers.find(
      user => user.email === this.currentPresenterEmail,
    );
    return presenter?.name || this.currentPresenterEmail;
  }

  /**
   * Get the name of a user by their email
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: resolve a collaborator's display name from their email address (pure)
  getRequestUserName(userEmail: string): string {
    const user = this.collaborationUsers.find(u => u.email === userEmail);
    return user?.name || userEmail;
  }

  /**
   * Get the appropriate tooltip text for the WebSocket connection status
   */
  // SEM@b0c4b820c2575334e437219701331f3b664358de: build a localized tooltip describing the current WebSocket connection status (pure)
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
   * Track users by composite key for efficient rendering
   * This ensures proper deduplication using the principal-based composite key (provider:provider_id)
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: compute a stable track-by key for a collaborator using provider identity (pure)
  trackByPrincipalKey(_index: number, user: CollaborationUser): string {
    return `${user.provider}:${user.provider_id}`;
  }

  /**
   * Check if a user has a pending presenter request
   */
  // SEM@ed548734af3b22d467a74b7d53111db845c0379e: validate whether a user has a pending presenter-privilege request (pure)
  hasPresenterRequest(userEmail: string): boolean {
    return this.pendingPresenterRequests.includes(userEmail);
  }
}
