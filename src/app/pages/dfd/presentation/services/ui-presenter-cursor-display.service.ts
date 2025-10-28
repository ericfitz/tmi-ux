import { Injectable, OnDestroy } from '@angular/core';
import { Subscription, fromEvent, merge } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
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
 * Monitors viewport changes to recalculate cursor position when container moves
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

  // Viewport change tracking
  private _lastGraphPosition: CursorPosition | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _isGraphVisible = true;

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

    // Setup viewport change monitoring
    this._setupViewportChangeHandling();
    this._setupResizeObserver();
    this._setupIntersectionObserver();

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

    // Don't process updates if graph is not visible
    if (!this._isGraphVisible) {
      this.logger.debug('Skipping presenter cursor update - graph not visible');
      return;
    }

    // Store the graph position for viewport change recalculation
    this._lastGraphPosition = { ...position };

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
   * Convert X6 graph coordinates to participant client coordinates
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

      // Then convert from local coordinates to client coordinates
      // Client coordinates are relative to the viewport (same as MouseEvent.clientX/Y)
      const clientCoords = this._graph.localToClient(localCoords.x, localCoords.y);

      this.logger.debug('Converting participant cursor coordinates', {
        graphPosition: { x: graphPosition.x, y: graphPosition.y },
        localPosition: { x: localCoords.x, y: localCoords.y },
        clientPosition: { x: clientCoords.x, y: clientCoords.y },
      });

      // Check if the resulting client coordinates are within the participant's viewport
      const isWithinViewport =
        clientCoords.x >= 0 &&
        clientCoords.x <= window.innerWidth &&
        clientCoords.y >= 0 &&
        clientCoords.y <= window.innerHeight;

      if (!isWithinViewport) {
        this.logger.debug('Presenter cursor position outside participant viewport', {
          clientPosition: { x: clientCoords.x, y: clientCoords.y },
          viewportSize: { width: window.innerWidth, height: window.innerHeight },
        });
        return null; // Return null to indicate cursor should be hidden
      }

      return {
        x: clientCoords.x,
        y: clientCoords.y,
      };
    } catch (error) {
      this.logger.error('Error converting graph coordinates to client coordinates', error);
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
      // Position is already in client coordinates from the conversion
      const clientX = position.x;
      const clientY = position.y;

      this.logger.debug('Generating synthetic mouse event', {
        clientPosition: { x: clientX, y: clientY },
        viewportSize: { width: window.innerWidth, height: window.innerHeight },
      });

      // Create synthetic mousemove event with client coordinates
      const syntheticEvent = new MouseEvent('mousemove', {
        clientX: clientX,
        clientY: clientY,
        bubbles: true,
        cancelable: true,
        view: window,
      });

      // Find the element at the cursor position
      const elementAtPosition = document.elementFromPoint(clientX, clientY);
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
          clientX: clientX,
          clientY: clientY,
          bubbles: true,
          cancelable: true,
          view: window,
          relatedTarget: validElement,
        });

        const mouseLeaveEvent = new MouseEvent('mouseleave', {
          clientX: clientX,
          clientY: clientY,
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
            clientX: clientX,
            clientY: clientY,
            bubbles: true,
            cancelable: true,
            view: window,
            relatedTarget: this._lastHoveredElement,
          });

          const mouseEnterEvent = new MouseEvent('mouseenter', {
            clientX: clientX,
            clientY: clientY,
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
        clientPosition: { x: clientX, y: clientY },
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
   * Setup window resize and scroll event handlers
   * Monitors viewport changes to recalculate cursor position
   */
  private _setupViewportChangeHandling(): void {
    if (typeof window === 'undefined') {
      this.logger.warn('Window not available - skipping viewport change handling');
      return;
    }

    // Listen for window resize events
    const resize$ = fromEvent(window, 'resize');

    // Listen for scroll events (capture phase to catch all scrolls)
    const scroll$ = fromEvent(window, 'scroll', { capture: true, passive: true });

    // Combine and debounce viewport change events
    const viewportChange$ = merge(resize$, scroll$).pipe(
      debounceTime(150), // Responsive updates while avoiding excessive recalculation
      filter(() => this._isShowingPresenterCursor && this._lastGraphPosition !== null),
    );

    this._subscriptions.add(
      viewportChange$.subscribe(() => {
        this._handleViewportChange();
      }),
    );

    this.logger.debug('Viewport change handling initialized');
  }

  /**
   * Setup ResizeObserver to monitor graph container size changes
   * Detects layout shifts, sidebar collapses, etc.
   */
  private _setupResizeObserver(): void {
    if (!this._graphContainer) {
      this.logger.warn('Cannot setup ResizeObserver - no graph container');
      return;
    }

    if (typeof ResizeObserver === 'undefined') {
      this.logger.warn('ResizeObserver not available in this browser');
      return;
    }

    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this._graphContainer) {
          this.logger.debug('Graph container resized', {
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });

          // Only recalculate if cursor is currently showing
          if (this._isShowingPresenterCursor && this._lastGraphPosition) {
            this._handleViewportChange();
          }
        }
      }
    });

    this._resizeObserver.observe(this._graphContainer);
    this.logger.debug('ResizeObserver initialized for graph container');
  }

  /**
   * Setup IntersectionObserver to detect when graph is visible
   * Pauses cursor updates when graph is not in viewport
   */
  private _setupIntersectionObserver(): void {
    if (!this._graphContainer) {
      this.logger.warn('Cannot setup IntersectionObserver - no graph container');
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      this.logger.warn('IntersectionObserver not available in this browser');
      return;
    }

    this._intersectionObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.target === this._graphContainer) {
            const wasVisible = this._isGraphVisible;
            this._isGraphVisible = entry.isIntersecting;

            this.logger.debug('Graph visibility changed', {
              isVisible: this._isGraphVisible,
              intersectionRatio: entry.intersectionRatio,
            });

            // If graph became invisible, hide cursor
            if (wasVisible && !this._isGraphVisible) {
              this._removePresenterCursor();
            }
            // If graph became visible and we have a stored position, recalculate
            else if (!wasVisible && this._isGraphVisible && this._lastGraphPosition) {
              this._handleViewportChange();
            }
          }
        }
      },
      {
        threshold: 0.1, // Trigger when at least 10% of graph is visible
      },
    );

    this._intersectionObserver.observe(this._graphContainer);
    this.logger.debug('IntersectionObserver initialized for graph container');
  }

  /**
   * Handle viewport changes by recalculating cursor position
   * Called when window resizes, scrolls, or container size changes
   */
  private _handleViewportChange(): void {
    if (!this._lastGraphPosition) {
      return;
    }

    this.logger.debug('Handling viewport change - recalculating cursor position', {
      lastGraphPosition: this._lastGraphPosition,
      isShowingCursor: this._isShowingPresenterCursor,
    });

    try {
      // Recalculate viewport position from stored graph coordinates
      const newViewportPosition = this._convertToViewportCoordinates(this._lastGraphPosition);

      if (!newViewportPosition) {
        // Cursor is now outside viewport - hide it
        this.logger.debug('Cursor outside viewport after viewport change - hiding');
        this._removePresenterCursor();
      } else {
        // Update cursor position with new coordinates
        this._generateSyntheticMouseEvent(newViewportPosition);

        this.logger.debug('Cursor position recalculated after viewport change', {
          newViewportPosition,
        });
      }
    } catch (error) {
      this.logger.error('Error handling viewport change', error);
    }
  }

  /**
   * Cleanup resources
   */
  ngOnDestroy(): void {
    if (this._cursorTimeout) {
      window.clearTimeout(this._cursorTimeout);
      this._cursorTimeout = null;
    }

    // Cleanup observers
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }

    this._removePresenterCursor();
    this._clearLastHoveredElement();
    this._subscriptions.unsubscribe();
    this._graphContainer = null;
    this._graph = null;
    this._lastGraphPosition = null;

    this.logger.info('UiPresenterCursorDisplayService destroyed');
  }

  /**
   * Check if currently showing presenter cursor
   */
  get isShowingPresenterCursor(): boolean {
    return this._isShowingPresenterCursor;
  }
}
