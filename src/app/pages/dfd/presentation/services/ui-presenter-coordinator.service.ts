import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import {
  PresenterCursorMessageWithUser,
  PresenterSelectionMessageWithUser,
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
export class UiPresenterCoordinatorService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _isInitialized = false;

  constructor(
    private logger: LoggerService,
    private webSocketAdapter: WebSocketAdapter,
    private uiPresenterCursorService: UiPresenterCursorService,
    private uiPresenterCursorDisplayService: UiPresenterCursorDisplayService,
    private uiPresenterSelectionService: UiPresenterSelectionService,
  ) {}

  /**
   * Initialize the presenter coordinator with graph and adapters
   * @param graphContainer The HTML element containing the graph
   * @param graph The X6 graph instance
   * @param selectionAdapter The X6 selection adapter instance
   */
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
  private _subscribeToPresenterMessages(): void {
    // Subscribe to presenter cursor messages
    // NOTE: Using extended type with user field that server includes
    this._subscriptions.add(
      this.webSocketAdapter
        .getTMIMessagesOfType<PresenterCursorMessageWithUser>('presenter_cursor')
        .subscribe({
          next: message => this._handlePresenterCursor(message),
          error: error => this.logger.error('Error in presenter cursor subscription', error),
        }),
    );

    // Subscribe to presenter selection messages
    // NOTE: Using extended type with user field that server includes
    this._subscriptions.add(
      this.webSocketAdapter
        .getTMIMessagesOfType<PresenterSelectionMessageWithUser>('presenter_selection')
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
  private _handlePresenterCursor(message: PresenterCursorMessageWithUser): void {
    // Guard against malformed messages that don't conform to AsyncAPI spec
    if (
      !message.user ||
      !message.user.provider ||
      !message.user.provider_id ||
      !message.user.email
    ) {
      this.logger.warn('Received malformed presenter_cursor message - missing user data', {
        messageType: message.message_type,
        user: message.user,
      });
      return;
    }

    // Guard against missing cursor position
    if (!message.cursor_position) {
      this.logger.warn('Received presenter_cursor message without cursor position', {
        messageType: message.message_type,
        user: message.user.email,
      });
      return;
    }

    this.logger.debugComponent('UiPresenterCoordinator', 'Handling presenter cursor update', {
      userCompositeKey: `${message.user.provider}:${message.user.provider_id}`,
      userEmail: message.user.email,
      position: message.cursor_position,
    });

    // Delegate to cursor display service
    this.uiPresenterCursorDisplayService.handlePresenterCursorUpdate(message.cursor_position);
  }

  /**
   * Handle incoming presenter selection messages
   */
  private _handlePresenterSelection(message: PresenterSelectionMessageWithUser): void {
    // Guard against malformed messages that don't conform to AsyncAPI spec
    if (
      !message.user ||
      !message.user.provider ||
      !message.user.provider_id ||
      !message.user.email
    ) {
      this.logger.warn('Received malformed presenter_selection message - missing user data', {
        messageType: message.message_type,
        user: message.user,
      });
      return;
    }

    // Guard against missing selected cells
    if (!message.selected_cells) {
      this.logger.warn('Received presenter_selection message without selected_cells', {
        messageType: message.message_type,
        user: message.user.email,
      });
      return;
    }

    this.logger.debugComponent('UiPresenterCoordinator', 'Handling presenter selection update', {
      userCompositeKey: `${message.user.provider}:${message.user.provider_id}`,
      userEmail: message.user.email,
      cellCount: message.selected_cells.length,
      selectedCells: message.selected_cells,
    });

    // Delegate to selection service
    this.uiPresenterSelectionService.handlePresenterSelectionUpdate(message.selected_cells);
  }

  /**
   * Force cleanup of presenter cursor for non-presenters
   * Called when presenter mode is disabled or presenter changes
   */
  cleanupPresenterDisplay(): void {
    this.uiPresenterCursorDisplayService.forceRemovePresenterCursor();
    this.uiPresenterSelectionService.clearSelectionForNonPresenters();
    this.logger.debugComponent('UiPresenterCoordinator', 'Cleaned up presenter display');
  }

  /**
   * Get status of all presenter services
   */
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
