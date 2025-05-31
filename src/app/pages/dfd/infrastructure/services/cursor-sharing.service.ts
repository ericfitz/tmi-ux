import { Injectable, NgZone, Optional, Inject, InjectionToken } from '@angular/core';
import { Observable, Subject, BehaviorSubject, fromEvent, merge } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { Point } from '../../domain/value-objects/point';
import { CursorState } from '../../domain/collaboration/user-presence';
import { CollaborationApplicationService } from '../../application/collaboration/collaboration-application.service';

/**
 * Configuration for cursor sharing behavior
 */
export interface CursorSharingConfig {
  /** Debounce time for cursor movement in milliseconds */
  cursorDebounceTime: number;
  /** Whether to share cursor movements */
  shareCursorMovement: boolean;
  /** Whether to share selection changes */
  shareSelectionChanges: boolean;
  /** Maximum distance for cursor movement to be considered significant */
  significantMovementThreshold: number;
}

/**
 * Injection token for cursor sharing configuration
 */
export const CURSOR_SHARING_CONFIG = new InjectionToken<CursorSharingConfig>(
  'CURSOR_SHARING_CONFIG',
);

/**
 * Default configuration for cursor sharing
 */
const DEFAULT_CONFIG: CursorSharingConfig = {
  cursorDebounceTime: 100, // 100ms
  shareCursorMovement: true,
  shareSelectionChanges: true,
  significantMovementThreshold: 5, // 5 pixels
};

/**
 * Cursor movement event
 */
export interface CursorMovementEvent {
  position: Point;
  timestamp: number;
  userId: string;
  isVisible: boolean;
}

/**
 * Selection change event
 */
export interface SelectionChangeEvent {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  timestamp: number;
  userId: string;
}

/**
 * Service for managing cursor and selection sharing in collaborative sessions
 */
@Injectable({
  providedIn: 'root',
})
export class CursorSharingService {
  private readonly _config: CursorSharingConfig;
  private readonly _destroy$ = new Subject<void>();
  private readonly _isActive$ = new BehaviorSubject<boolean>(false);
  private readonly _cursorMovements$ = new Subject<CursorMovementEvent>();
  private readonly _selectionChanges$ = new Subject<SelectionChangeEvent>();
  private readonly _remoteCursors$ = new BehaviorSubject<Map<string, CursorState>>(new Map());

  private _lastCursorPosition: Point | null = null;
  private _currentSelection: { nodeIds: string[]; edgeIds: string[] } = {
    nodeIds: [],
    edgeIds: [],
  };
  private _targetElement: Element | null = null;

  // Public observables
  public readonly isActive$ = this._isActive$.asObservable();
  public readonly cursorMovements$ = this._cursorMovements$.asObservable();
  public readonly selectionChanges$ = this._selectionChanges$.asObservable();
  public readonly remoteCursors$ = this._remoteCursors$.asObservable();

  constructor(
    private readonly _ngZone: NgZone,
    private readonly _collaborationService: CollaborationApplicationService,
    @Optional() @Inject(CURSOR_SHARING_CONFIG) config?: Partial<CursorSharingConfig>,
  ) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._setupCollaborationEventHandling();
  }

  /**
   * Start cursor sharing for a specific target element (e.g., SVG canvas)
   */
  startSharing(targetElement: Element): void {
    this._targetElement = targetElement;
    this._isActive$.next(true);
    this._setupCursorTracking();
    this._setupSelectionTracking();
  }

  /**
   * Stop cursor sharing
   */
  stopSharing(): void {
    this._isActive$.next(false);
    this._targetElement = null;
    this._lastCursorPosition = null;
    this._currentSelection = { nodeIds: [], edgeIds: [] };
    this._remoteCursors$.next(new Map());
  }

  /**
   * Update local cursor position
   */
  updateLocalCursor(position: Point, isVisible: boolean = true): void {
    if (!this._isActive$.value) return;

    const currentUser = this._collaborationService.getCurrentUser();
    if (!currentUser) return;

    // Check if movement is significant
    if (this._lastCursorPosition && this._config.significantMovementThreshold > 0) {
      const distance = Math.sqrt(
        Math.pow(position.x - this._lastCursorPosition.x, 2) +
          Math.pow(position.y - this._lastCursorPosition.y, 2),
      );
      if (distance < this._config.significantMovementThreshold) {
        return; // Movement too small, ignore
      }
    }

    this._lastCursorPosition = position;

    const event: CursorMovementEvent = {
      position,
      timestamp: Date.now(),
      userId: currentUser.id,
      isVisible,
    };

    this._cursorMovements$.next(event);

    // Update collaboration service
    this._collaborationService
      .updateUserCursor(currentUser.id, {
        position: { x: position.x, y: position.y },
        selectedNodeIds: this._currentSelection.nodeIds,
        selectedEdgeIds: this._currentSelection.edgeIds,
        isVisible,
      })
      .subscribe();
  }

  /**
   * Update local selection
   */
  updateLocalSelection(selectedNodeIds: string[], selectedEdgeIds: string[]): void {
    if (!this._isActive$.value) return;

    const currentUser = this._collaborationService.getCurrentUser();
    if (!currentUser) return;

    // Check if selection actually changed
    const selectionChanged =
      JSON.stringify(this._currentSelection.nodeIds.sort()) !==
        JSON.stringify(selectedNodeIds.sort()) ||
      JSON.stringify(this._currentSelection.edgeIds.sort()) !==
        JSON.stringify(selectedEdgeIds.sort());

    if (!selectionChanged) return;

    this._currentSelection = { nodeIds: selectedNodeIds, edgeIds: selectedEdgeIds };

    const event: SelectionChangeEvent = {
      selectedNodeIds,
      selectedEdgeIds,
      timestamp: Date.now(),
      userId: currentUser.id,
    };

    this._selectionChanges$.next(event);

    // Update collaboration service with current cursor position
    const cursorPosition = this._lastCursorPosition || new Point(0, 0);
    this._collaborationService
      .updateUserCursor(currentUser.id, {
        position: { x: cursorPosition.x, y: cursorPosition.y },
        selectedNodeIds,
        selectedEdgeIds,
        isVisible: true,
      })
      .subscribe();
  }

  /**
   * Hide local cursor
   */
  hideLocalCursor(): void {
    if (!this._isActive$.value) return;

    const currentUser = this._collaborationService.getCurrentUser();
    if (!currentUser) return;

    const position = this._lastCursorPosition || new Point(0, 0);
    this.updateLocalCursor(position, false);
  }

  /**
   * Show local cursor
   */
  showLocalCursor(): void {
    if (!this._isActive$.value) return;

    const currentUser = this._collaborationService.getCurrentUser();
    if (!currentUser) return;

    const position = this._lastCursorPosition || new Point(0, 0);
    this.updateLocalCursor(position, true);
  }

  /**
   * Get remote cursor for a specific user
   */
  getRemoteCursor(userId: string): CursorState | null {
    return this._remoteCursors$.value.get(userId) || null;
  }

  /**
   * Get all remote cursors
   */
  getAllRemoteCursors(): Map<string, CursorState> {
    return new Map(this._remoteCursors$.value);
  }

  /**
   * Update remote cursor from collaboration events
   */
  updateRemoteCursor(userId: string, cursorState: CursorState): void {
    const currentUser = this._collaborationService.getCurrentUser();
    if (currentUser?.id === userId) return; // Don't update own cursor

    const remoteCursors = new Map(this._remoteCursors$.value);
    remoteCursors.set(userId, cursorState);
    this._remoteCursors$.next(remoteCursors);
  }

  /**
   * Remove remote cursor
   */
  removeRemoteCursor(userId: string): void {
    const remoteCursors = new Map(this._remoteCursors$.value);
    remoteCursors.delete(userId);
    this._remoteCursors$.next(remoteCursors);
  }

  /**
   * Setup cursor tracking event listeners
   */
  private _setupCursorTracking(): void {
    if (!this._config.shareCursorMovement || !this._targetElement) return;

    this._ngZone.runOutsideAngular(() => {
      // Mouse movement tracking
      const mouseMove$ = fromEvent<MouseEvent>(this._targetElement!, 'mousemove').pipe(
        map(event => {
          const rect = this._targetElement!.getBoundingClientRect();
          return new Point(event.clientX - rect.left, event.clientY - rect.top);
        }),
        debounceTime(this._config.cursorDebounceTime),
        distinctUntilChanged((a, b) => a.x === b.x && a.y === b.y),
        filter(() => this._isActive$.value),
        takeUntil(this._destroy$),
      );

      mouseMove$.subscribe(position => {
        this._ngZone.run(() => {
          this.updateLocalCursor(position, true);
        });
      });

      // Mouse enter/leave tracking
      const mouseEnter$ = fromEvent<MouseEvent>(this._targetElement!, 'mouseenter').pipe(
        takeUntil(this._destroy$),
      );

      const mouseLeave$ = fromEvent<MouseEvent>(this._targetElement!, 'mouseleave').pipe(
        takeUntil(this._destroy$),
      );

      mouseEnter$.subscribe(() => {
        this._ngZone.run(() => {
          this.showLocalCursor();
        });
      });

      mouseLeave$.subscribe(() => {
        this._ngZone.run(() => {
          this.hideLocalCursor();
        });
      });
    });
  }

  /**
   * Setup selection tracking (this would be integrated with X6 selection events)
   */
  private _setupSelectionTracking(): void {
    if (!this._config.shareSelectionChanges) return;

    // This would be integrated with X6 graph selection events
    // For now, we'll provide the public methods for manual updates
    // In a real implementation, this would listen to X6 selection events
  }

  /**
   * Setup collaboration event handling
   */
  private _setupCollaborationEventHandling(): void {
    // Listen to session participants for cursor updates
    this._collaborationService.sessionParticipants$
      .pipe(
        filter(participants => participants.length > 0),
        takeUntil(this._destroy$),
      )
      .subscribe(participants => {
        const currentUser = this._collaborationService.getCurrentUser();
        const remoteCursors = new Map(this._remoteCursors$.value);

        // Update remote cursors from participants
        for (const participant of participants) {
          if (participant.user.id !== currentUser?.id && participant.cursorState) {
            remoteCursors.set(participant.user.id, participant.cursorState);
          }
        }

        // Remove cursors for users no longer in session
        const participantIds = new Set(participants.map(p => p.user.id));
        for (const userId of remoteCursors.keys()) {
          if (!participantIds.has(userId)) {
            remoteCursors.delete(userId);
          }
        }

        this._remoteCursors$.next(remoteCursors);
      });
  }

  /**
   * Convert screen coordinates to canvas coordinates
   */
  screenToCanvas(screenPoint: Point): Point {
    if (!this._targetElement) return screenPoint;

    const rect = this._targetElement.getBoundingClientRect();
    return new Point(screenPoint.x - rect.left, screenPoint.y - rect.top);
  }

  /**
   * Convert canvas coordinates to screen coordinates
   */
  canvasToScreen(canvasPoint: Point): Point {
    if (!this._targetElement) return canvasPoint;

    const rect = this._targetElement.getBoundingClientRect();
    return new Point(canvasPoint.x + rect.left, canvasPoint.y + rect.top);
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._isActive$.complete();
    this._cursorMovements$.complete();
    this._selectionChanges$.complete();
    this._remoteCursors$.complete();
  }
}
