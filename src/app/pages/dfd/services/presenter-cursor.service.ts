import { Injectable, OnDestroy } from '@angular/core';
import { fromEvent, interval, Subscription, combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../core/services/dfd-collaboration.service';
import { CollaborativeOperationService } from './collaborative-operation.service';
import { PRESENTER_CURSOR_CONFIG } from '../constants/presenter-constants';

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
export class PresenterCursorService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _isTracking = false;
  private _graphContainer: HTMLElement | null = null;
  private _graph: Graph | null = null;
  private _lastCursorPosition: CursorPosition | null = null;

  constructor(
    private logger: LoggerService,
    private collaborationService: DfdCollaborationService,
    private collaborativeOperationService: CollaborativeOperationService,
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

    this.logger.info('PresenterCursorService initialized');
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

    // Create interval observable for throttling
    const throttleInterval$ = interval(PRESENTER_CURSOR_CONFIG.UPDATE_INTERVAL);

    // Combine mouse movements with throttling interval
    // Only emit when presenter mode is active
    const throttledMouseMove$ = combineLatest([mouseMove$, throttleInterval$]).pipe(
      filter(() => this._isTracking),
      map(([event]) => event),
      filter(event => this._isValidMouseEvent(event)),
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

    try {
      // Get mouse position relative to graph container
      const containerRect = this._graphContainer.getBoundingClientRect();
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;

      // Convert to graph content-relative coordinates
      const cursorPosition = this._convertToGraphCoordinates(mouseX, mouseY);

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
   * Convert viewport coordinates to graph content-relative coordinates
   */
  private _convertToGraphCoordinates(viewportX: number, viewportY: number): CursorPosition {
    if (!this._graph) {
      return { x: viewportX, y: viewportY };
    }

    try {
      // Get the graph's content bounding box
      const contentBBox = this._graph.getContentBBox();

      // Convert viewport coordinates to graph coordinates
      const graphPoint = this._graph.clientToLocal(viewportX, viewportY);

      // Express coordinates relative to content bounds
      const relativeX = graphPoint.x - contentBBox.x;
      const relativeY = graphPoint.y - contentBBox.y;

      return {
        x: relativeX,
        y: relativeY,
      };
    } catch (error) {
      this.logger.error('Error converting coordinates', error);
      return { x: viewportX, y: viewportY };
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
      this.collaborativeOperationService.sendPresenterCursor(position);

      this.logger.debug('Broadcast presenter cursor position', {
        x: position.x,
        y: position.y,
      });
    } catch (error) {
      this.logger.error('Error broadcasting cursor position', error);
    }
  }

  /**
   * Validate mouse event is within graph bounds
   */
  private _isValidMouseEvent(event: MouseEvent): boolean {
    if (!this._graphContainer) {
      return false;
    }

    const containerRect = this._graphContainer.getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left;
    const mouseY = event.clientY - containerRect.top;

    // Check if mouse is within container bounds
    return (
      mouseX >= 0 && mouseX <= containerRect.width && mouseY >= 0 && mouseY <= containerRect.height
    );
  }

  /**
   * Cleanup resources and stop tracking
   */
  ngOnDestroy(): void {
    this._stopTracking();
    this._subscriptions.unsubscribe();
    this._graphContainer = null;
    this._graph = null;
    this.logger.info('PresenterCursorService destroyed');
  }

  /**
   * Check if currently tracking cursor movements
   */
  get isTracking(): boolean {
    return this._isTracking;
  }
}
