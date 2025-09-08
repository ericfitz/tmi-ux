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
  openCollaborationDialog(): void {
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
                this._openDialog();
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
                this._openDialog();
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
              this._openDialog();
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
   * Get the color for the collaboration button based on current state
   * @returns The Material color to use for the button
   */
  getCollaborationButtonColor(): string {
    if (this.isCollaborating) {
      return 'accent'; // Green - currently participating in session
    }
    if (this.existingSessionAvailable) {
      return 'primary'; // Blue - session exists but not participating
    }
    return 'primary'; // Default state - current color (unchanged)
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
}
