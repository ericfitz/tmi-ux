import { Injectable, OnDestroy } from '@angular/core';
import { fromEvent, Subscription } from 'rxjs';
import { filter, throttleTime } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { InfraWebsocketCollaborationAdapter } from '../../infrastructure/adapters/infra-websocket-collaboration.adapter';
import { PRESENTER_CURSOR_CONFIG } from '../../constants/presenter-constants';

export interface CursorPosition {
  x: number;
  y: number;
}

/**
 * Service responsible for broadcasting presenter cursor position
 * Tracks mouse movements within the graph container and sends cursor updates
 * Only active when the current user is presenter and presenter mode is enabled
 */
@Injectable({
  providedIn: 'root',
})
export class UiPresenterCursorService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _isTracking = false;
  private _graphContainer: HTMLElement | null = null;
  private _graph: Graph | null = null;
  private _lastCursorPosition: CursorPosition | null = null;
  private _intersectionObserver: IntersectionObserver | null = null;
  private _isGraphVisible = true;

  constructor(
    private logger: LoggerService,
    private collaborationService: DfdCollaborationService,
    private collaborativeOperationService: InfraWebsocketCollaborationAdapter,
  ) {}

  /**
   * Initialize cursor tracking for the given graph container
   * @param graphContainer The HTML element containing the graph
   * @param graph The X6 graph instance
   */
  initialize(graphContainer: HTMLElement, graph: Graph): void {
    this._graphContainer = graphContainer;
    this._graph = graph;

    // Set up mouse movement tracking
    this._setupMouseTracking();

    // Setup IntersectionObserver to suppress broadcasts when graph not visible
    this._setupIntersectionObserver();

    // Subscribe to presenter mode changes to start/stop tracking
    this._subscriptions.add(
      this.collaborationService.collaborationState$.subscribe(state => {
        const shouldTrack =
          state.isPresenterModeActive && this.collaborationService.isCurrentUserPresenter();

        if (shouldTrack && !this._isTracking) {
          this._startTracking();
        } else if (!shouldTrack && this._isTracking) {
          this._stopTracking();
        }
      }),
    );

    this.logger.info('UiPresenterCursorService initialized');
  }

  /**
   * Setup mouse movement tracking within the graph container
   */
  private _setupMouseTracking(): void {
    if (!this._graphContainer) {
      this.logger.error('Cannot setup mouse tracking: graph container not available');
      return;
    }

    // Create mouse move observable from the graph container
    const mouseMove$ = fromEvent<MouseEvent>(this._graphContainer, 'mousemove');

    // Throttle mouse movements to avoid excessive broadcasts
    // Only emit when presenter mode is active and mouse event is valid
    const throttledMouseMove$ = mouseMove$.pipe(
      filter(() => this._isTracking),
      filter(event => this._isValidMouseEvent(event)),
      throttleTime(PRESENTER_CURSOR_CONFIG.UPDATE_INTERVAL, undefined, {
        leading: true,
        trailing: true,
      }),
    );

    this._subscriptions.add(
      throttledMouseMove$.subscribe(event => {
        this._handleMouseMove(event);
      }),
    );

    this.logger.info('Mouse tracking setup completed');
  }

  /**
   * Start cursor position tracking and broadcasting
   */
  private _startTracking(): void {
    if (this._isTracking) {
      return;
    }

    this._isTracking = true;
    this.logger.info('Started presenter cursor tracking');
  }

  /**
   * Stop cursor position tracking and broadcasting
   */
  private _stopTracking(): void {
    if (!this._isTracking) {
      return;
    }

    this._isTracking = false;
    this._lastCursorPosition = null;
    this.logger.info('Stopped presenter cursor tracking');
  }

  /**
   * Handle mouse move events and broadcast cursor position
   */
  private _handleMouseMove(event: MouseEvent): void {
    if (!this._graphContainer || !this._graph) {
      return;
    }

    // Don't broadcast if graph is not visible
    if (!this._isGraphVisible) {
      this.logger.debug('Skipping cursor broadcast - graph not visible');
      return;
    }

    try {
      // Convert client coordinates directly to graph coordinates
      // This automatically handles pan/zoom transformations
      const cursorPosition = this._convertToGraphCoordinates(event.clientX, event.clientY);

      // Only proceed if coordinate conversion succeeded
      if (!cursorPosition) {
        this.logger.debug('Skipping cursor broadcast - coordinate conversion failed');
        return;
      }

      // Only send if position has changed significantly (avoid spam)
      if (this._shouldBroadcastPosition(cursorPosition)) {
        this._broadcastCursorPosition(cursorPosition);
        this._lastCursorPosition = cursorPosition;
      }
    } catch (error) {
      this.logger.error('Error handling mouse move event', error);
    }
  }

  /**
   * Convert client coordinates to X6 graph coordinates
   * Uses X6's clientToGraph method to handle all transformations automatically
   */
  private _convertToGraphCoordinates(clientX: number, clientY: number): CursorPosition | null {
    if (!this._graph) {
      this.logger.warn('Cannot convert coordinates - graph not available');
      return null;
    }

    try {
      // Use X6's clientToGraph for direct conversion
      // This properly handles viewport position, pan, zoom, and rotation
      const graphCoords = this._graph.clientToGraph(clientX, clientY);

      return {
        x: graphCoords.x,
        y: graphCoords.y,
      };
    } catch (error) {
      this.logger.error('Error converting client coordinates to graph coordinates', error);
      return null;
    }
  }

  /**
   * Check if cursor position should be broadcast (to avoid excessive messages)
   */
  private _shouldBroadcastPosition(newPosition: CursorPosition): boolean {
    if (!this._lastCursorPosition) {
      return true;
    }

    // Only broadcast if position has changed by at least 5 pixels
    const deltaX = Math.abs(newPosition.x - this._lastCursorPosition.x);
    const deltaY = Math.abs(newPosition.y - this._lastCursorPosition.y);

    return deltaX >= 5 || deltaY >= 5;
  }

  /**
   * Broadcast cursor position via collaborative operation service
   */
  private _broadcastCursorPosition(position: CursorPosition): void {
    try {
      this.collaborativeOperationService.sendPresenterCursor(position).subscribe({
        next: () => {
          this.logger.debug('Broadcast presenter cursor position', {
            x: position.x,
            y: position.y,
          });
        },
        error: error => {
          this.logger.error('Error broadcasting cursor position', error);
        },
      });
    } catch (error) {
      this.logger.error('Error broadcasting cursor position', error);
    }
  }

  /**
   * Validate mouse event is within presenter's viewport
   * Only broadcast cursor position if presenter cursor is within their viewport
   */
  private _isValidMouseEvent(event: MouseEvent): boolean {
    if (!this._graphContainer) {
      return false;
    }

    try {
      // Check if mouse is within the presenter's viewport (browser window)
      const isWithinViewport =
        event.clientX >= 0 &&
        event.clientX <= window.innerWidth &&
        event.clientY >= 0 &&
        event.clientY <= window.innerHeight;

      if (!isWithinViewport) {
        this.logger.debug('Presenter cursor outside viewport - skipping broadcast', {
          cursorPosition: { x: event.clientX, y: event.clientY },
          viewportSize: { width: window.innerWidth, height: window.innerHeight },
        });
        return false;
      }

      // Also check if mouse is within the graph container for additional validation
      const containerRect = this._graphContainer.getBoundingClientRect();
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      const isWithinContainer =
        mouseX >= 0 &&
        mouseX <= containerRect.width &&
        mouseY >= 0 &&
        mouseY <= containerRect.height;

      if (!isWithinContainer) {
        this.logger.debug('Presenter cursor outside graph container - skipping broadcast', {
          cursorPosition: { x: event.clientX, y: event.clientY },
          containerPosition: { x: mouseX, y: mouseY },
          containerSize: { width: containerRect.width, height: containerRect.height },
        });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating mouse event', error);
      return false;
    }
  }

  /**
   * Setup IntersectionObserver to detect when graph is visible
   * Suppresses cursor broadcasts when graph is not in viewport
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
            this._isGraphVisible = entry.isIntersecting;

            this.logger.debug('Presenter graph visibility changed', {
              isVisible: this._isGraphVisible,
              intersectionRatio: entry.intersectionRatio,
            });
          }
        }
      },
      {
        threshold: 0.1, // Trigger when at least 10% of graph is visible
      },
    );

    this._intersectionObserver.observe(this._graphContainer);
    this.logger.debug('IntersectionObserver initialized for presenter cursor tracking');
  }

  /**
   * Cleanup resources and stop tracking
   */
  ngOnDestroy(): void {
    this._stopTracking();

    // Cleanup IntersectionObserver
    if (this._intersectionObserver) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver = null;
    }

    this._subscriptions.unsubscribe();
    this._graphContainer = null;
    this._graph = null;
    this.logger.info('UiPresenterCursorService destroyed');
  }

  /**
   * Check if currently tracking cursor movements
   */
  get isTracking(): boolean {
    return this._isTracking;
  }
}
