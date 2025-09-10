/**
 * DFD Collaboration Component
 *
 * This component provides a button to open the collaboration dialog for the Data Flow Diagram editor.
 * It manages the badge showing the number of participants and opens the collaboration dialog.
 */

import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import {
  DfdCollaborationService,
  CollaborationUser,
  CollaborationSession,
} from '../../../../core/services/dfd-collaboration.service';
import { CollaborationDialogComponent } from '../collaboration-dialog/collaboration-dialog.component';

/**
 * Component for managing collaboration in the DFD editor
 */
@Component({
  selector: 'app-dfd-collaboration',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatBadgeModule,
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
  existingSessionAvailable: CollaborationSession | null = null;

  // ViewChild for button
  @ViewChild('collaborationButton', { static: false }) collaborationButton!: ElementRef;

  // This must always reflect the actual context state, not a cached value
  get isContextReady(): boolean {
    return this._collaborationService.isDiagramContextSet();
  }

  // Subscription management
  private _subscriptions = new Subscription();

  constructor(
    private _logger: LoggerService,
    private _cdr: ChangeDetectorRef,
    private _collaborationService: DfdCollaborationService,
    private _dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this._logger.info('DfdCollaborationComponent initialized', {
      initialIsContextReady: this.isContextReady,
      serviceContextSet: this._collaborationService.isDiagramContextSet(),
      serviceContext: this._collaborationService.getDiagramContext(),
    });

    // Subscribe to the unified collaboration state
    // This subscription is only for updating the badge count and button state
    this._subscriptions.add(
      this._collaborationService.collaborationState$.subscribe(state => {
        this._logger.debug('[CollaborationComponent] State subscription fired', {
          timestamp: new Date().toISOString(),
          isActive: state.isActive,
          userCount: state.users.length,
        });

        // Update component properties for badge and button appearance
        this.isCollaborating = state.isActive;
        this.collaborationUsers = [...state.users];
        this.existingSessionAvailable = state.existingSessionAvailable;

        // Log state mismatches for debugging
        const actuallySet = this._collaborationService.isDiagramContextSet();

        if (state.isDiagramContextReady !== actuallySet) {
          this._logger.warn('[CollaborationComponent] State mismatch detected', {
            stateContextReady: state.isDiagramContextReady,
            actuallySet,
            context: this._collaborationService.getDiagramContext(),
          });
        }

        // Force immediate change detection
        this._cdr.detectChanges();
      }),
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();
  }

  /**
   * Handle collaboration button click - performs the appropriate action based on current state
   */
  handleCollaborationAction(): void {
    this._logger.info('[CollaborationComponent] Collaboration button clicked', {
      timestamp: new Date().toISOString(),
      userCount: this.collaborationUsers.length,
      isCollaborating: this.isCollaborating,
      existingSessionAvailable: !!this.existingSessionAvailable,
      isContextReady: this.isContextReady,
      diagramContext: this._collaborationService.getDiagramContext(),
    });

    // Check if diagram context is ready before proceeding
    if (!this.isContextReady) {
      this._logger.error('[CollaborationComponent] Button clicked without context ready', {
        context: this._collaborationService.getDiagramContext(),
      });
      return;
    }

    // Perform the appropriate action based on current state
    if (this.isCollaborating) {
      // Currently in session - either end (host) or leave (participant)
      if (this._collaborationService.isCurrentUserHost()) {
        this._logger.info('[CollaborationComponent] Host ending collaboration');
        this._collaborationService
          .endCollaboration()
          .pipe(take(1))
          .subscribe({
            next: success => {
              if (success) {
                this._logger.info('Collaboration ended successfully');
              } else {
                this._logger.error('Failed to end collaboration');
              }
            },
            error: error => {
              this._logger.error('Error ending collaboration', error);
            },
          });
      } else {
        this._logger.info('[CollaborationComponent] Participant leaving session');
        this._collaborationService
          .leaveSession()
          .pipe(take(1))
          .subscribe({
            next: success => {
              if (success) {
                this._logger.info('Left collaboration session successfully');
              } else {
                this._logger.error('Failed to leave collaboration session');
              }
            },
            error: error => {
              this._logger.error('Error leaving session', error);
            },
          });
      }
    } else {
      // Not in session - either start new or join existing
      if (this.existingSessionAvailable) {
        this._logger.info('[CollaborationComponent] Joining existing session');
      } else {
        this._logger.info('[CollaborationComponent] Starting new collaboration');
      }
      this._collaborationService
        .startOrJoinCollaboration()
        .pipe(take(1))
        .subscribe({
          next: success => {
            if (success) {
              this._logger.info('Collaboration started or joined successfully');
            } else {
              this._logger.error('Failed to start or join collaboration');
            }
          },
          error: error => {
            this._logger.error('Error starting/joining collaboration', error);
          },
        });
    }
  }

  /**
   * Open the collaboration dialog
   */
  private _openDialog(): void {
    const dialogRef = this._dialog.open(CollaborationDialogComponent, {
      width: '600px',
      data: {},
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      this._logger.info('[CollaborationComponent] Collaboration dialog closed');
    });
  }

  /**
   * Get the CSS class for the collaboration icon based on current state
   * @returns The CSS class to apply to the icon for coloring
   */
  getCollaborationIconClass(): string {
    if (this.isCollaborating) {
      return 'icon-active'; // Green - currently participating in session
    }
    if (this.existingSessionAvailable) {
      return 'icon-session-available'; // Blue - session exists but not participating
    }
    return 'icon-default'; // Default state - current color (unchanged)
  }

  /**
   * Get the tooltip text for the collaboration button
   * @returns The tooltip text
   */
  getCollaborationButtonTooltip(): string {
    if (!this.isContextReady) {
      return 'Loading diagram context...';
    }
    if (this.isCollaborating) {
      // Determine if current user is host
      if (this._collaborationService.isCurrentUserHost()) {
        return 'End Collaboration'; // Host can end collaboration
      } else {
        return 'Leave Session'; // Participant can leave session
      }
    }
    if (this.existingSessionAvailable) {
      return 'Join Session'; // Join existing session
    }
    return 'Start Collaboration'; // Start new collaboration
  }

  /**
   * Check if the current user is the host of the collaboration session
   * @returns True if current user is host, false otherwise
   */
  isCurrentUserHost(): boolean {
    return this._collaborationService.isCurrentUserHost();
  }

  /**
   * Copy the collaboration link to clipboard
   */
  copyCollaborationLink(): void {
    this._logger.info('[CollaborationComponent] Copying collaboration link');

    // Get the current URL and clear existing query parameters
    const currentUrl = new URL(window.location.href);
    currentUrl.search = ''; // Clear all existing query parameters
    currentUrl.searchParams.set('joinCollaboration', 'true');
    const collaborationUrl = currentUrl.toString();

    navigator.clipboard
      .writeText(collaborationUrl)
      .then(() => {
        this._logger.info('[CollaborationComponent] Collaboration link copied successfully');
        // You may want to show a notification here
      })
      .catch(error => {
        this._logger.error('[CollaborationComponent] Failed to copy collaboration link', error);
      });
  }

  /**
   * Open the participants dialog (collaboration dialog)
   */
  openParticipantsDialog(): void {
    this._logger.info('[CollaborationComponent] Opening participants dialog');
    this._openDialog();
  }

  /**
   * Request presenter privileges
   */
  requestPresenterPrivileges(): void {
    this._logger.info('[CollaborationComponent] Requesting presenter privileges');
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
   * Check if current user is the presenter
   */
  isCurrentUserPresenter(): boolean {
    return this._collaborationService.isCurrentUserPresenter();
  }

  /**
   * Get the appropriate icon for the collaboration button based on current state
   */
  getCollaborationButtonIcon(): string {
    if (this.isCollaborating) {
      return 'stop_circle'; // End collaboration mode
    }
    return 'play_circle'; // Start collaboration mode
  }
}
