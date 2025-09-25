import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import {
  PRESENTER_CURSOR_CONFIG,
  PRESENTER_CURSOR_STYLES,
} from '../../constants/presenter-constants';

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
export class UiPresenterCursorDisplayService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _graphContainer: HTMLElement | null = null;
  private _graph: Graph | null = null;
  private _cursorTimeout: number | null = null;
  private _isShowingPresenterCursor = false;
  private _lastHoveredElement: Element | null = null;

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

    this.logger.info('UiPresenterCursorDisplayService initialized');
  }

  /**
   * Handle incoming presenter cursor position
   * Called when a PresenterCursorMessage is received
   * @param position The cursor position in X6 graph coordinates
   */
  handlePresenterCursorUpdate(position: CursorPosition): void {
    // Only apply cursor if current user is not the presenter
    if (this.collaborationService.isCurrentUserPresenter()) {
      this.logger.debug('Skipping presenter cursor update - current user is presenter');
      return;
    }

    this.logger.debug('Handling presenter cursor update', {
      position: { x: position.x, y: position.y },
      isCurrentUserPresenter: this.collaborationService.isCurrentUserPresenter(),
      hasContainer: !!this._graphContainer,
      hasGraph: !!this._graph,
    });

    try {
      // Convert graph coordinates to participant's viewport coordinates
      const viewportPosition = this._convertToViewportCoordinates(position);

      if (!viewportPosition) {
        // Presenter cursor is outside participant's viewport - hide cursor
        this.logger.debug('Presenter cursor outside participant viewport - hiding cursor');
        this._removePresenterCursor();
        return;
      }

      // Apply presenter cursor styling (cursor is visible)
      this._applyPresenterCursor();

      // Generate synthetic mouse event for hover effects
      this._generateSyntheticMouseEvent(viewportPosition);

      // Reset timeout for reverting to normal cursor
      this._resetCursorTimeout();

      this.logger.debug('Applied presenter cursor position', {
        graphPosition: { x: position.x, y: position.y },
        viewportPosition: { x: viewportPosition.x, y: viewportPosition.y },
        isShowingCursor: this._isShowingPresenterCursor,
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
   * Convert X6 graph coordinates to participant page coordinates
   * Uses X6's coordinate transformation to handle participant's pan/zoom state
   */
  private _convertToViewportCoordinates(graphPosition: CursorPosition): CursorPosition | null {
    if (!this._graph) {
      this.logger.warn('Cannot convert coordinates - graph not available');
      return null;
    }

    try {
      // First convert from graph coordinates to local coordinates
      const localCoords = this._graph.graphToLocal(graphPosition.x, graphPosition.y);

      // Then convert from local coordinates to page coordinates
      const pageCoords = this._graph.localToPage(localCoords.x, localCoords.y);

      this.logger.debug('Converting participant cursor coordinates', {
        graphPosition: { x: graphPosition.x, y: graphPosition.y },
        localPosition: { x: localCoords.x, y: localCoords.y },
        pagePosition: { x: pageCoords.x, y: pageCoords.y },
      });

      // Check if the resulting page coordinates are within the participant's viewport
      const isWithinViewport =
        pageCoords.x >= 0 &&
        pageCoords.x <= window.innerWidth &&
        pageCoords.y >= 0 &&
        pageCoords.y <= window.innerHeight;

      if (!isWithinViewport) {
        this.logger.debug('Presenter cursor position outside participant viewport', {
          pagePosition: { x: pageCoords.x, y: pageCoords.y },
          viewportSize: { width: window.innerWidth, height: window.innerHeight },
        });
        return null; // Return null to indicate cursor should be hidden
      }

      return {
        x: pageCoords.x,
        y: pageCoords.y,
      };
    } catch (error) {
      this.logger.error('Error converting graph coordinates to page coordinates', error);
      return null;
    }
  }

  /**
   * Apply presenter cursor styling to the graph container
   */
  private _applyPresenterCursor(): void {
    if (!this._graphContainer) {
      this.logger.warn('Cannot apply presenter cursor - no graph container');
      return;
    }

    this.logger.info('Applying presenter cursor styling', {
      containerTagName: this._graphContainer.tagName,
      containerClasses: this._graphContainer.className,
      containerId: this._graphContainer.id,
      cursorUrl: PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_URL,
    });

    // Add presenter cursor class for styling
    this._graphContainer.classList.add(PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_CLASS);

    // Apply custom cursor via CSS - use inline style for higher specificity
    this._graphContainer.style.setProperty(
      'cursor',
      PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_URL,
      'important',
    );

    // Also apply to all child elements to ensure coverage
    const graphElements = this._graphContainer.querySelectorAll(
      '.x6-graph, .x6-graph-view, .x6-graph-scroller, svg, canvas',
    );
    graphElements.forEach(element => {
      (element as HTMLElement).style.setProperty(
        'cursor',
        PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_URL,
        'important',
      );
    });

    this._isShowingPresenterCursor = true;

    this.logger.info('Presenter cursor applied', {
      hasClass: this._graphContainer.classList.contains(
        PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_CLASS,
      ),
      cursorStyle: this._graphContainer.style.cursor,
      childElementsStyled: graphElements.length,
      isShowing: this._isShowingPresenterCursor,
    });
  }

  /**
   * Remove presenter cursor styling and revert to normal cursor
   */
  private _removePresenterCursor(): void {
    if (!this._graphContainer) {
      return;
    }

    // Clear any lingering hover effects by firing mouseout on last hovered element
    this._clearLastHoveredElement();

    // Remove presenter cursor class
    this._graphContainer.classList.remove(PRESENTER_CURSOR_STYLES.PRESENTER_CURSOR_CLASS);

    // Revert to normal cursor on main container
    this._graphContainer.style.removeProperty('cursor');

    // Also remove cursor from all child elements
    const graphElements = this._graphContainer.querySelectorAll(
      '.x6-graph, .x6-graph-view, .x6-graph-scroller, svg, canvas',
    );
    graphElements.forEach(element => {
      (element as HTMLElement).style.removeProperty('cursor');
    });

    this._isShowingPresenterCursor = false;

    this.logger.debug('Reverted to normal cursor', {
      childElementsCleared: graphElements.length,
    });
  }

  /**
   * Clear last hovered element and generate mouseout event
   */
  private _clearLastHoveredElement(): void {
    if (this._lastHoveredElement && this._graphContainer?.contains(this._lastHoveredElement)) {
      try {
        // Generate mouseout and mouseleave events to clear hover state
        const mouseOutEvent = new MouseEvent('mouseout', {
          bubbles: true,
          cancelable: true,
          view: window,
        });

        const mouseLeaveEvent = new MouseEvent('mouseleave', {
          bubbles: false,
          cancelable: true,
          view: window,
        });

        this._lastHoveredElement.dispatchEvent(mouseOutEvent);
        this._lastHoveredElement.dispatchEvent(mouseLeaveEvent);

        this.logger.debug('Cleared hover effects for element', {
          element: this._lastHoveredElement.tagName,
          className: this._lastHoveredElement.className,
        });
      } catch (error) {
        this.logger.error('Error clearing last hovered element', error);
      }
    }

    // Always clear the reference regardless of containment
    this._lastHoveredElement = null;
  }

  /**
   * Generate synthetic mouse event to trigger X6 hover effects
   */
  private _generateSyntheticMouseEvent(position: CursorPosition): void {
    if (!this._graphContainer) {
      return;
    }

    try {
      // Position is already in page coordinates from the conversion
      const pageX = position.x;
      const pageY = position.y;

      this.logger.debug('Generating synthetic mouse event', {
        pagePosition: { x: pageX, y: pageY },
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
      });

      // Create synthetic mousemove event with page coordinates
      const syntheticEvent = new MouseEvent('mousemove', {
        clientX: pageX,
        clientY: pageY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      // Find the element at the cursor position
      const elementAtPosition = document.elementFromPoint(pageX, pageY);
      const validElement =
        elementAtPosition && this._graphContainer.contains(elementAtPosition)
          ? elementAtPosition
          : null;

      this.logger.debug('Element at position', {
        element: elementAtPosition?.tagName,
        className: elementAtPosition?.className,
        isInContainer: !!validElement,
        lastHoveredElement: this._lastHoveredElement?.tagName,
      });

      // Handle mouseout event for previously hovered element
      // Only dispatch events to elements that were actually in the graph container
      if (
        this._lastHoveredElement &&
        this._lastHoveredElement !== validElement &&
        this._graphContainer?.contains(this._lastHoveredElement)
      ) {
        const mouseOutEvent = new MouseEvent('mouseout', {
          clientX: pageX,
          clientY: pageY,
          bubbles: true,
          cancelable: true,
          view: window,
          relatedTarget: validElement,
        });

        const mouseLeaveEvent = new MouseEvent('mouseleave', {
          clientX: pageX,
          clientY: pageY,
          bubbles: false, // mouseleave doesn't bubble
          cancelable: true,
          view: window,
          relatedTarget: validElement,
        });

        this._lastHoveredElement.dispatchEvent(mouseOutEvent);
        this._lastHoveredElement.dispatchEvent(mouseLeaveEvent);

        this.logger.debug('Generated mouseout/mouseleave events for', {
          element: this._lastHoveredElement.tagName,
          className: this._lastHoveredElement.className,
        });
      }

      // Dispatch mousemove to appropriate element
      if (validElement) {
        // Dispatch to the specific element
        validElement.dispatchEvent(syntheticEvent);

        // Dispatch mouseover event if this is a new element
        if (this._lastHoveredElement !== validElement) {
          const mouseOverEvent = new MouseEvent('mouseover', {
            clientX: pageX,
            clientY: pageY,
            bubbles: true,
            cancelable: true,
            view: window,
            relatedTarget: this._lastHoveredElement,
          });

          const mouseEnterEvent = new MouseEvent('mouseenter', {
            clientX: pageX,
            clientY: pageY,
            bubbles: false, // mouseenter doesn't bubble
            cancelable: true,
            view: window,
            relatedTarget: this._lastHoveredElement,
          });

          validElement.dispatchEvent(mouseOverEvent);
          validElement.dispatchEvent(mouseEnterEvent);

          this.logger.debug('Generated mouseover/mouseenter events for', {
            element: validElement.tagName,
            className: validElement.className,
          });
        }
      } else {
        // Fallback: dispatch to container
        this._graphContainer.dispatchEvent(syntheticEvent);
      }

      // Track if element changed before updating
      const elementChanged = this._lastHoveredElement !== validElement;

      // Update the last hovered element - only track elements within graph container
      this._lastHoveredElement = validElement;

      this.logger.debug('Generated synthetic mouse events', {
        pagePosition: { x: pageX, y: pageY },
        targetElement: validElement?.tagName || 'container',
        hoveredElementChanged: elementChanged,
      });
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
    this._clearLastHoveredElement();
    this._subscriptions.unsubscribe();
    this._graphContainer = null;
    this._graph = null;

    this.logger.info('UiPresenterCursorDisplayService destroyed');
  }

  /**
   * Check if currently showing presenter cursor
   */
  get isShowingPresenterCursor(): boolean {
    return this._isShowingPresenterCursor;
  }
}
