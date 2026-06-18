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
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Observable, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { LoggerService } from '../../../../../core/services/logger.service';
import {
  DfdCollaborationService,
  CollaborationUser,
  CollaborationSession,
} from '../../../../../core/services/dfd-collaboration.service';
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
    TooltipAriaLabelDirective,
    MatBadgeModule,
    TranslocoModule,
  ],
  templateUrl: './collaboration.component.html',
  styleUrls: ['./collaboration.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@d4322784af04c286c6dd06c07662e27950dae791: collaboration toolbar button managing session join, leave, and participant dialog
export class DfdCollaborationComponent implements OnInit, OnDestroy {
  // Collaboration state
  isCollaborating = false;
  collaborationUsers: CollaborationUser[] = [];
  existingSessionAvailable: CollaborationSession | null = null;

  // Presenter mode observable for template binding
  isPresenterModeActive$: Observable<boolean>;

  // ViewChild for buttons
  @ViewChild('collaborationButton', { static: false }) collaborationButton!: ElementRef;
  @ViewChild('manageParticipantsButton', { static: false }) manageParticipantsButton!: ElementRef;

  // This must always reflect the actual context state, not a cached value
  get isContextReady(): boolean {
    return this._collaborationService.isDiagramContextSet();
  }

  // Subscription management
  private _subscriptions = new Subscription();

  // SEM@1ea48eccb10ecbaae0fdd5bf09ebddccc1e9fb72: initialize collaboration state and presenter-mode observable from the collaboration service
  constructor(
    private _logger: LoggerService,
    private _cdr: ChangeDetectorRef,
    private _collaborationService: DfdCollaborationService,
    private _dialog: MatDialog,
    private _transloco: TranslocoService,
  ) {
    // Initialize presenter mode observable
    this.isPresenterModeActive$ = this._collaborationService.collaborationState$.pipe(
      map(state => state.isPresenterModeActive),
    );
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: subscribe to collaboration state and sync user list and session status to the component
  ngOnInit(): void {
    this._logger.debugComponent(
      'DfdCollaborationComponent',
      'DfdCollaborationComponent initialized',
      {
        initialIsContextReady: this.isContextReady,
        serviceContextSet: this._collaborationService.isDiagramContextSet(),
        serviceContext: this._collaborationService.getDiagramContext(),
      },
    );

    // Subscribe to the unified collaboration state
    // This subscription is only for updating the badge count and button state
    this._subscriptions.add(
      this._collaborationService.collaborationState$.subscribe(state => {
        this._logger.debugComponent('CollaborationComponent', 'State subscription fired', {
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

  // SEM@2af7b39f77fe3806eadb73bafca4ce95e37168be: unsubscribe all active subscriptions to prevent memory leaks on destroy
  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();
  }

  /**
   * Handle collaboration button click - performs the appropriate action based on current state
   */
  // SEM@d4322784af04c286c6dd06c07662e27950dae791: toggle the collaboration session on button click, joining or leaving as appropriate
  handleCollaborationAction(): void {
    this._logger.info('[CollaborationComponent] Collaboration button clicked', {
      isCollaborating: this.isCollaborating,
      existingSessionAvailable: !!this.existingSessionAvailable,
      isContextReady: this.isContextReady,
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
        },
      });
  }

  /**
   * Open the collaboration dialog
   */
  // SEM@a4ab59267ee4a9b91ae8ed45c6cd52c615bc5cb1: open the collaboration participant dialog and clear button hover state on close
  private _openDialog(): void {
    const dialogRef = this._dialog.open(CollaborationDialogComponent, {
      width: '600px',
      data: {},
      autoFocus: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      this._logger.info('[CollaborationComponent] Collaboration dialog closed');

      // Find the button that was clicked to clear its visual state
      const button = document.querySelector(
        'app-dfd-collaboration button[matbadge]',
      ) as HTMLButtonElement;

      if (button) {
        // Clear CSS visual state by dispatching synthetic events
        setTimeout(() => {
          const elements = [button, ...Array.from(button.querySelectorAll('*'))];

          elements.forEach(element => {
            // Dispatch mouseup to clear :active state
            const mouseUpEvent = new MouseEvent('mouseup', {
              bubbles: true,
              cancelable: true,
              view: window,
            });

            // Dispatch mouseleave to clear :hover state
            const mouseLeaveEvent = new MouseEvent('mouseleave', {
              bubbles: false,
              cancelable: true,
              view: window,
            });

            element.dispatchEvent(mouseUpEvent);
            element.dispatchEvent(mouseLeaveEvent);
          });

          // Force style recalculation
          void button.offsetHeight;

          // Force classList manipulation to trigger style updates
          const tempClass = 'force-style-update-temp';
          button.classList.add(tempClass);
          void button.offsetHeight;
          button.classList.remove(tempClass);
        }, 50);
      }
    });
  }

  /**
   * Get the CSS class for the collaboration icon based on current state
   * @returns The CSS class to apply to the icon for coloring
   */
  // SEM@3ed96c33670136f56abd692bd9c9510ae0d52edd: map collaboration session state to a CSS icon class for color feedback (pure)
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
  // SEM@1ea48eccb10ecbaae0fdd5bf09ebddccc1e9fb72: build a localized tooltip for the collaboration button based on session state (pure)
  getCollaborationButtonTooltip(): string {
    if (!this.isContextReady) {
      return this._transloco.translate('collaboration.loadingDiagramContext');
    }
    if (this.isCollaborating) {
      if (this._collaborationService.isCurrentUserHost()) {
        return this._transloco.translate('collaboration.endCollaboration');
      } else {
        return this._transloco.translate('collaboration.leaveSession');
      }
    }
    if (this.existingSessionAvailable) {
      return this._transloco.translate('collaboration.joinSession');
    }
    return this._transloco.translate('collaboration.startCollaboration');
  }

  /**
   * Check if the current user is the host of the collaboration session
   * @returns True if current user is host, false otherwise
   */
  // SEM@3ed96c33670136f56abd692bd9c9510ae0d52edd: validate whether the authenticated user is the collaboration session host (pure)
  isCurrentUserHost(): boolean {
    return this._collaborationService.isCurrentUserHost();
  }

  /**
   * Copy the collaboration link to clipboard
   */
  // SEM@812ccfc25aaf928ab97760f41c7b7c7814e36415: build and copy the collaboration invite URL to the clipboard (mutates shared state)
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
  // SEM@234dd7e4268dca49cc0bf7029c2b9a59503d70c5: dispatch the participants dialog, stopping event propagation (mutates shared state)
  openParticipantsDialog(event?: Event): void {
    this._logger.info('[CollaborationComponent] Opening participants dialog');

    // Stop propagation to prevent event bubbling
    if (event) {
      event.stopPropagation();
    }

    this._openDialog();
  }

  /**
   * Request presenter privileges
   */
  // SEM@812ccfc25aaf928ab97760f41c7b7c7814e36415: send a request to the collaboration service for presenter role (mutates shared state)
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
  // SEM@812ccfc25aaf928ab97760f41c7b7c7814e36415: check whether the current user holds the presenter role (pure)
  isCurrentUserPresenter(): boolean {
    return this._collaborationService.isCurrentUserPresenter();
  }

  /**
   * Get the appropriate icon for the collaboration button based on current state
   */
  // SEM@812ccfc25aaf928ab97760f41c7b7c7814e36415: return the icon name for the collaboration toggle button based on active state (pure)
  getCollaborationButtonIcon(): string {
    if (this.isCollaborating) {
      return 'stop_circle'; // End collaboration mode
    }
    return 'play_circle'; // Start collaboration mode
  }

  /**
   * Toggle presenter mode on/off for the current presenter
   */
  // SEM@85fb64fd0796dc749de7b5a0bfd25d0aa102929f: toggle presenter mode on or off via the collaboration service (mutates shared state)
  togglePresenterMode(): void {
    const newState = this._collaborationService.togglePresenterMode();
    this._logger.info('Presenter mode toggled', { isActive: newState });
  }
}
