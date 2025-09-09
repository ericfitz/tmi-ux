import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../core/services/dfd-collaboration.service';
import { PRESENTER_CURSOR_CONFIG, PRESENTER_CURSOR_STYLES } from '../constants/presenter-constants';

export interface CursorPosition {
  x: number;
  y: number;
}

/**
 * Service responsible for displaying presenter cursor from received events
 * Handles incoming presenter cursor messages and applies custom cursor styling
 * Generates synthetic mouse events to trigger X6 hover effects
 */
@Injectable({
  providedIn: 'root',
})
export class PresenterCursorDisplayService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _graphContainer: HTMLElement | null = null;
  private _graph: Graph | null = null;
  private _cursorTimeout: number | null = null;
  private _isShowingPresenterCursor = false;

  constructor(
    private logger: LoggerService,
    private collaborationService: DfdCollaborationService,
  ) {}

  /**
   * Initialize cursor display for the given graph container
   * @param graphContainer The HTML element containing the graph
   * @param graph The X6 graph instance
   */
  initialize(graphContainer: HTMLElement, graph: Graph): void {
    this._graphContainer = graphContainer;
    this._graph = graph;

    this.logger.info('PresenterCursorDisplayService initialized');
  }

  /**
   * Handle incoming presenter cursor position
   * Called when a PresenterCursorMessage is received
   * @param position The cursor position in graph content-relative coordinates
   */
  handlePresenterCursorUpdate(position: CursorPosition): void {
    // Only apply cursor if current user is not the presenter
    if (this.collaborationService.isCurrentUserPresenter()) {
      return;
    }

    try {
      // Apply presenter cursor styling
      this._applyPresenterCursor();

      // Convert graph coordinates back to viewport coordinates
      const viewportPosition = this._convertToViewportCoordinates(position);

      // Generate synthetic mouse event for hover effects
      this._generateSyntheticMouseEvent(viewportPosition);

      // Reset timeout for reverting to normal cursor
      this._resetCursorTimeout();

      this.logger.debug('Applied presenter cursor position', {
        graphPosition: position,
        viewportPosition,
      });
    } catch (error) {
      this.logger.error('Error handling presenter cursor update', error);
    }
  }

  /**
   * Handle incoming presenter selection update
   * Called when a PresenterSelectionMessage is received
   * Also resets the cursor timeout to keep presenter cursor active
   */
  handlePresenterSelectionUpdate(): void {
    // Only apply if current user is not the presenter
    if (this.collaborationService.isCurrentUserPresenter()) {
      return;
    }

    try {
      // Apply presenter cursor styling (in case it wasn't already applied)
      this._applyPresenterCursor();

      // Reset timeout for reverting to normal cursor
      this._resetCursorTimeout();

      this.logger.debug('Reset cursor timeout on presenter selection update');
    } catch (error) {
      this.logger.error('Error handling presenter selection update', error);
    }
  }

  /**
   * Convert graph content-relative coordinates to viewport coordinates
   */
  private _convertToViewportCoordinates(graphPosition: CursorPosition): CursorPosition {
    if (!this._graph || !this._graphContainer) {
      return graphPosition;
    }

    try {
      // Get the graph's content bounding box
      const contentBBox = this._graph.getContentBBox();

      // Calculate absolute graph coordinates
      const absoluteX = contentBBox.x + graphPosition.x;
      const absoluteY = contentBBox.y + graphPosition.y;

      // Convert graph coordinates to client coordinates
      const clientPoint = this._graph.localToClient(absoluteX, absoluteY);

      // Get container bounds to make coordinates relative to container
      const containerRect = this._graphContainer.getBoundingClientRect();

      return {
        x: clientPoint.x - containerRect.left,
        y: clientPoint.y - containerRect.top,
      };
    } catch (error) {
      this.logger.error('Error converting coordinates', error);
      return graphPosition;
    }
  }

  /**
   * Apply presenter cursor styling to the graph container
   */
  private _applyPresenterCursor(): void {
    if (!this._graphContainer) {
      return;
    }

    // Add presenter cursor class for styling
    this._graphContainer.classList.add(PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_CLASS);

    // Apply custom cursor via CSS
    this._graphContainer.style.cursor = PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_URL;

    this._isShowingPresenterCursor = true;
  }

  /**
   * Remove presenter cursor styling and revert to normal cursor
   */
  private _removePresenterCursor(): void {
    if (!this._graphContainer) {
      return;
    }

    // Remove presenter cursor class
    this._graphContainer.classList.remove(PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_CLASS);

    // Revert to normal cursor
    this._graphContainer.style.cursor = '';

    this._isShowingPresenterCursor = false;

    this.logger.debug('Reverted to normal cursor');
  }

  /**
   * Generate synthetic mouse event to trigger X6 hover effects
   */
  private _generateSyntheticMouseEvent(position: CursorPosition): void {
    if (!this._graphContainer) {
      return;
    }

    try {
      // Create synthetic mousemove event
      const syntheticEvent = new MouseEvent('mousemove', {
        clientX: position.x,
        clientY: position.y,
        bubbles: true,
        cancelable: true,
      });

      // Find the element at the cursor position
      const elementAtPosition = document.elementFromPoint(position.x, position.y);

      // Dispatch the event to trigger hover effects
      if (elementAtPosition && this._graphContainer.contains(elementAtPosition)) {
        elementAtPosition.dispatchEvent(syntheticEvent);
      } else {
        // Fallback: dispatch to container
        this._graphContainer.dispatchEvent(syntheticEvent);
      }

      this.logger.debug('Generated synthetic mouse event', { position });
    } catch (error) {
      this.logger.error('Error generating synthetic mouse event', error);
    }
  }

  /**
   * Reset the timeout for reverting to normal cursor
   */
  private _resetCursorTimeout(): void {
    // Clear existing timeout
    if (this._cursorTimeout) {
      window.clearTimeout(this._cursorTimeout);
      this._cursorTimeout = null;
    }

    // Set new timeout
    this._cursorTimeout = window.setTimeout(() => {
      this._removePresenterCursor();
      this._cursorTimeout = null;
    }, PRESENTER_CURSOR_CONFIG.TIMEOUT_DURATION);
  }

  /**
   * Force removal of presenter cursor (e.g., when presenter mode is disabled)
   */
  forceRemovePresenterCursor(): void {
    if (this._cursorTimeout) {
      window.clearTimeout(this._cursorTimeout);
      this._cursorTimeout = null;
    }

    this._removePresenterCursor();
  }

  /**
   * Cleanup resources
   */
  ngOnDestroy(): void {
    if (this._cursorTimeout) {
      window.clearTimeout(this._cursorTimeout);
      this._cursorTimeout = null;
    }

    this._removePresenterCursor();
    this._subscriptions.unsubscribe();
    this._graphContainer = null;
    this._graph = null;

    this.logger.info('PresenterCursorDisplayService destroyed');
  }

  /**
   * Check if currently showing presenter cursor
   */
  get isShowingPresenterCursor(): boolean {
    return this._isShowingPresenterCursor;
  }
}
