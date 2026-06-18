import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { pairwise } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import {
  PresenterCursorMessage,
  PresenterSelectionMessage,
} from '../../../../core/types/websocket-message.types';
import { UiPresenterCursorService } from './ui-presenter-cursor.service';
import { UiPresenterCursorDisplayService } from './ui-presenter-cursor-display.service';
import { UiPresenterSelectionService } from './ui-presenter-selection.service';
import { InfraX6SelectionAdapter } from '../../infrastructure/adapters/infra-x6-selection.adapter';

/**
 * Coordinator service for all presenter mode functionality
 * Manages cursor broadcasting, cursor display, and selection synchronization
 * Subscribes to WebSocket messages and coordinates between presenter services
 */
@Injectable({
  providedIn: 'root',
})
// SEM@c72f61f510fd5a824cc78cb85d5637dd3de2def0: coordinate presenter-mode cursor broadcast, display, and selection sync via WebSocket
export class UiPresenterCoordinatorService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _isInitialized = false;

  // SEM@c72f61f510fd5a824cc78cb85d5637dd3de2def0: register collaboration state listener to clear presenter visuals on session end (mutates shared state)
  constructor(
    private logger: LoggerService,
    private webSocketAdapter: WebSocketAdapter,
    private uiPresenterCursorService: UiPresenterCursorService,
    private uiPresenterCursorDisplayService: UiPresenterCursorDisplayService,
    private uiPresenterSelectionService: UiPresenterSelectionService,
    private collaborationService: DfdCollaborationService,
  ) {
    // The editor stays on the diagram in solo mode when a collaboration session ends (#274),
    // so visuals applied by a remote presenter (mirrored selection, presenter cursor styling)
    // are no longer cleared implicitly by component destruction - clear them here when an
    // active session transitions to inactive while someone else was presenting.
    this._subscriptions.add(
      this.collaborationService.collaborationState$.pipe(pairwise()).subscribe(([prev, curr]) => {
        if (!prev.isActive || curr.isActive) {
          return;
        }
        const currentUserEmail = this.collaborationService.getCurrentUserEmail();
        const hadRemotePresenter =
          !!prev.currentPresenterEmail && prev.currentPresenterEmail !== currentUserEmail;
        if (hadRemotePresenter) {
          this.cleanupPresenterDisplay();
        }
      }),
    );
  }

  /**
   * Initialize the presenter coordinator with graph and adapters
   * @param graphContainer The HTML element containing the graph
   * @param graph The X6 graph instance
   * @param selectionAdapter The X6 selection adapter instance
   */
  // SEM@443bb2baf6804860c314efdbf2540a0fd6dee8f2: initialize all presenter services and subscribe to WebSocket presenter messages (mutates shared state)
  initialize(
    graphContainer: HTMLElement,
    graph: Graph,
    selectionAdapter: InfraX6SelectionAdapter,
  ): void {
    // Initialize all presenter services
    this.uiPresenterCursorService.initialize(graphContainer, graph);
    this.uiPresenterCursorDisplayService.initialize(graphContainer, graph);
    this.uiPresenterSelectionService.initialize(graph, selectionAdapter);

    // Subscribe to WebSocket messages
    this._subscribeToPresenterMessages();

    this._isInitialized = true;
    // this.logger.info('UiPresenterCoordinatorService initialized');
  }

  /**
   * Subscribe to presenter-related WebSocket messages
   */
  // SEM@231f337d5a6dc4b69daf54737065b5732ad91b1b: subscribe to presenter cursor and selection WebSocket messages and dispatch to handlers (mutates shared state)
  private _subscribeToPresenterMessages(): void {
    // Subscribe to presenter cursor messages
    this._subscriptions.add(
      this.webSocketAdapter
        .getTMIMessagesOfType<PresenterCursorMessage>('presenter_cursor')
        .subscribe({
          next: message => this._handlePresenterCursor(message),
          error: error => this.logger.error('Error in presenter cursor subscription', error),
        }),
    );

    // Subscribe to presenter selection messages
    this._subscriptions.add(
      this.webSocketAdapter
        .getTMIMessagesOfType<PresenterSelectionMessage>('presenter_selection')
        .subscribe({
          next: message => this._handlePresenterSelection(message),
          error: error => this.logger.error('Error in presenter selection subscription', error),
        }),
    );

    // this.logger.info('Subscribed to presenter WebSocket messages');
  }

  /**
   * Handle incoming presenter cursor messages
   */
  // SEM@6139f6cfb7b219f0caf748fc0d1464fc55587fd1: dispatch a validated presenter cursor message to the cursor display service (mutates shared state)
  private _handlePresenterCursor(message: PresenterCursorMessage): void {
    // Guard against missing cursor position
    if (!message.cursor_position) {
      this.logger.warn('Received presenter_cursor message without cursor position', {
        messageType: message.message_type,
      });
      return;
    }

    // Per AsyncAPI spec, user field is optional (presenter tracked via current_presenter message)
    const debugInfo: Record<string, unknown> = {
      position: message.cursor_position,
    };

    if (message.user) {
      debugInfo['providerId'] = message.user.provider_id;
      debugInfo['userEmail'] = message.user.email;
      // Create composite key from provider + provider_id
      if (message.user.provider) {
        debugInfo['userCompositeKey'] = `${message.user.provider}:${message.user.provider_id}`;
      }
    }

    this.logger.debugComponent(
      'UiPresenterCoordinator',
      'Handling presenter cursor update',
      debugInfo,
    );

    // Delegate to cursor display service
    this.uiPresenterCursorDisplayService.handlePresenterCursorUpdate(message.cursor_position);
  }

  /**
   * Handle incoming presenter selection messages
   */
  // SEM@6139f6cfb7b219f0caf748fc0d1464fc55587fd1: dispatch a validated presenter selection message to the selection service (mutates shared state)
  private _handlePresenterSelection(message: PresenterSelectionMessage): void {
    // Guard against missing selected cells
    if (!message.selected_cells) {
      this.logger.warn('Received presenter_selection message without selected_cells', {
        messageType: message.message_type,
      });
      return;
    }

    // Per AsyncAPI spec, user field is optional (presenter tracked via current_presenter message)
    const debugInfo: Record<string, unknown> = {
      cellCount: message.selected_cells.length,
      selectedCells: message.selected_cells,
    };

    if (message.user) {
      debugInfo['providerId'] = message.user.provider_id;
      debugInfo['userEmail'] = message.user.email;
      // Create composite key from provider + provider_id
      if (message.user.provider) {
        debugInfo['userCompositeKey'] = `${message.user.provider}:${message.user.provider_id}`;
      }
    }

    this.logger.debugComponent(
      'UiPresenterCoordinator',
      'Handling presenter selection update',
      debugInfo,
    );

    // Delegate to selection service
    this.uiPresenterSelectionService.handlePresenterSelectionUpdate(message.selected_cells);
  }

  /**
   * Force cleanup of presenter cursor for non-presenters
   * Called when presenter mode is disabled or presenter changes
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: remove presenter cursor and clear mirrored selection from all non-presenter views (mutates shared state)
  cleanupPresenterDisplay(): void {
    this.uiPresenterCursorDisplayService.forceRemovePresenterCursor();
    this.uiPresenterSelectionService.clearSelectionForNonPresenters();
    this.logger.debugComponent('UiPresenterCoordinator', 'Cleaned up presenter display');
  }

  /**
   * Get status of all presenter services
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: return initialization and active-display status of all presenter sub-services (pure)
  getStatus(): {
    coordinatorInitialized: boolean;
    cursorTracking: boolean;
    showingPresenterCursor: boolean;
    selectionInitialized: boolean;
  } {
    return {
      coordinatorInitialized: this._isInitialized,
      cursorTracking: this.uiPresenterCursorService.isTracking,
      showingPresenterCursor: this.uiPresenterCursorDisplayService.isShowingPresenterCursor,
      selectionInitialized: this.uiPresenterSelectionService.isInitialized,
    };
  }

  /**
   * Cleanup resources
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: unsubscribe all subscriptions and reset initialization state on destroy (mutates shared state)
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._isInitialized = false;
    this.logger.info('UiPresenterCoordinatorService destroyed');
  }

  /**
   * Check if the coordinator is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }
}
