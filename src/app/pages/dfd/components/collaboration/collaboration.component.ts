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
   * Open the collaboration dialog
   */
  openCollaborationDialog(): void {
    this._logger.info('[CollaborationComponent] Opening collaboration dialog', {
      timestamp: new Date().toISOString(),
      userCount: this.collaborationUsers.length,
      isCollaborating: this.isCollaborating,
      isContextReady: this.isContextReady,
      diagramContext: this._collaborationService.getDiagramContext(),
    });

    // This should not happen since button is disabled, but check anyway
    if (!this.isContextReady) {
      this._logger.error('[CollaborationComponent] Dialog opened without context ready', {
        context: this._collaborationService.getDiagramContext(),
      });
      return;
    }

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
    if (!this.isContextReady) {
      return 'Loading diagram context...';
    }
    if (this.isCollaborating) {
      return 'Manage Collaboration';
    }
    if (this.existingSessionAvailable) {
      return 'Join Existing Collaboration Session';
    }
    return 'Start Collaboration';
  }
}
