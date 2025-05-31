import { Injectable, NgZone, Optional, Inject, InjectionToken } from '@angular/core';
import { Observable, Subject, BehaviorSubject, fromEvent, merge, timer } from 'rxjs';
import { map, filter, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';

import { User } from '../../domain/collaboration/user';
import {
  UserPresence,
  PresenceStatus,
  UserActivity,
} from '../../domain/collaboration/user-presence';
import { Point } from '../../domain/value-objects/point';

/**
 * Configuration for user tracking behavior
 */
export interface UserTrackingConfig {
  /** Time in milliseconds before marking user as away */
  awayThreshold: number;
  /** Time in milliseconds before marking user as offline */
  offlineThreshold: number;
  /** Debounce time for activity events in milliseconds */
  activityDebounceTime: number;
  /** Whether to track mouse movements */
  trackMouseMovement: boolean;
  /** Whether to track keyboard activity */
  trackKeyboardActivity: boolean;
  /** Whether to track scroll events */
  trackScrollEvents: boolean;
}

/**
 * Injection token for user tracking configuration
 */
export const USER_TRACKING_CONFIG = new InjectionToken<UserTrackingConfig>('USER_TRACKING_CONFIG');

/**
 * Default configuration for user tracking
 */
const DEFAULT_CONFIG: UserTrackingConfig = {
  awayThreshold: 5 * 60 * 1000, // 5 minutes
  offlineThreshold: 30 * 60 * 1000, // 30 minutes
  activityDebounceTime: 1000, // 1 second
  trackMouseMovement: true,
  trackKeyboardActivity: true,
  trackScrollEvents: true,
};

/**
 * User activity event types
 */
export interface UserActivityEvent {
  type: 'mouse' | 'keyboard' | 'scroll' | 'focus' | 'blur';
  timestamp: number;
  position?: Point;
  target?: string;
}

/**
 * Service for tracking user activity and managing presence state
 */
@Injectable({
  providedIn: 'root',
})
export class UserTrackingService {
  private readonly _config: UserTrackingConfig;
  private readonly _destroy$ = new Subject<void>();
  private readonly _currentUser$ = new BehaviorSubject<User | null>(null);
  private readonly _userPresence$ = new BehaviorSubject<UserPresence | null>(null);
  private readonly _userActivity$ = new Subject<UserActivityEvent>();
  private readonly _isTracking$ = new BehaviorSubject<boolean>(false);

  private _lastActivityTime = Date.now();
  private _activityTimer: ReturnType<typeof setTimeout> | null = null;
  private _presenceTimer: ReturnType<typeof setTimeout> | null = null;

  // Public observables
  public readonly currentUser$ = this._currentUser$.asObservable();
  public readonly userPresence$ = this._userPresence$.asObservable();
  public readonly userActivity$ = this._userActivity$.asObservable();
  public readonly isTracking$ = this._isTracking$.asObservable();

  constructor(
    private readonly _ngZone: NgZone,
    @Optional() @Inject(USER_TRACKING_CONFIG) config?: Partial<UserTrackingConfig>,
  ) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._setupActivityTracking();
    this._setupPresenceMonitoring();
  }

  /**
   * Start tracking for a specific user
   */
  startTracking(user: User): void {
    this._currentUser$.next(user);
    const initialPresence = UserPresence.createInitial(user);
    this._userPresence$.next(initialPresence);
    this._isTracking$.next(true);
    this._lastActivityTime = Date.now();
    this._startPresenceTimer();
  }

  /**
   * Stop tracking the current user
   */
  stopTracking(): void {
    const currentPresence = this._userPresence$.value;
    if (currentPresence) {
      const offlinePresence = currentPresence.markAsOffline();
      this._userPresence$.next(offlinePresence);
    }

    this._currentUser$.next(null);
    this._userPresence$.next(null);
    this._isTracking$.next(false);
    this._clearTimers();
  }

  /**
   * Update user activity manually
   */
  updateActivity(activity: UserActivity, tool?: string): void {
    const currentPresence = this._userPresence$.value;
    if (!currentPresence) return;

    let updatedPresence = currentPresence.withStatus(PresenceStatus.ONLINE).withActivity(activity);

    if (tool) {
      updatedPresence = updatedPresence.withTool(tool);
    }

    this._userPresence$.next(updatedPresence);
    this._lastActivityTime = Date.now();
  }

  /**
   * Update cursor position
   */
  updateCursorPosition(
    position: Point,
    selectedNodeIds: string[] = [],
    selectedEdgeIds: string[] = [],
  ): void {
    const currentPresence = this._userPresence$.value;
    if (!currentPresence) return;

    const cursorState = {
      position,
      selectedNodeIds,
      selectedEdgeIds,
      isVisible: true,
    };

    const updatedPresence = currentPresence
      .withCursorState(cursorState)
      .withStatus(PresenceStatus.ONLINE)
      .withActivity(UserActivity.VIEWING);

    this._userPresence$.next(updatedPresence);
    this._lastActivityTime = Date.now();
  }

  /**
   * Hide cursor
   */
  hideCursor(): void {
    const currentPresence = this._userPresence$.value;
    if (!currentPresence?.cursorState) return;

    const hiddenCursorState = {
      ...currentPresence.cursorState,
      isVisible: false,
    };

    const updatedPresence = currentPresence.withCursorState(hiddenCursorState);
    this._userPresence$.next(updatedPresence);
  }

  /**
   * Get current presence
   */
  getCurrentPresence(): UserPresence | null {
    return this._userPresence$.value;
  }

  /**
   * Get time since last activity
   */
  getTimeSinceLastActivity(): number {
    return Date.now() - this._lastActivityTime;
  }

  /**
   * Check if user is currently active
   */
  isUserActive(): boolean {
    return this.getTimeSinceLastActivity() < this._config.awayThreshold;
  }

  /**
   * Setup activity tracking event listeners
   */
  private _setupActivityTracking(): void {
    this._ngZone.runOutsideAngular(() => {
      const events: Observable<UserActivityEvent>[] = [];

      // Mouse movement tracking
      if (this._config.trackMouseMovement) {
        const mouseMove$ = fromEvent<MouseEvent>(document, 'mousemove').pipe(
          map(event => ({
            type: 'mouse' as const,
            timestamp: Date.now(),
            position: new Point(event.clientX, event.clientY),
            target: (event.target as Element)?.tagName?.toLowerCase(),
          })),
        );
        events.push(mouseMove$);

        const mouseClick$ = fromEvent<MouseEvent>(document, 'click').pipe(
          map(event => ({
            type: 'mouse' as const,
            timestamp: Date.now(),
            position: new Point(event.clientX, event.clientY),
            target: (event.target as Element)?.tagName?.toLowerCase(),
          })),
        );
        events.push(mouseClick$);
      }

      // Keyboard activity tracking
      if (this._config.trackKeyboardActivity) {
        const keyDown$ = fromEvent<KeyboardEvent>(document, 'keydown').pipe(
          map(event => ({
            type: 'keyboard' as const,
            timestamp: Date.now(),
            target: (event.target as Element)?.tagName?.toLowerCase(),
          })),
        );
        events.push(keyDown$);
      }

      // Scroll tracking
      if (this._config.trackScrollEvents) {
        const scroll$ = fromEvent<Event>(document, 'scroll', { passive: true }).pipe(
          map(event => ({
            type: 'scroll' as const,
            timestamp: Date.now(),
            target: (event.target as Element)?.tagName?.toLowerCase(),
          })),
        );
        events.push(scroll$);
      }

      // Focus/blur tracking
      const focus$ = fromEvent<FocusEvent>(window, 'focus').pipe(
        map(() => ({
          type: 'focus' as const,
          timestamp: Date.now(),
        })),
      );
      events.push(focus$);

      const blur$ = fromEvent<FocusEvent>(window, 'blur').pipe(
        map(() => ({
          type: 'blur' as const,
          timestamp: Date.now(),
        })),
      );
      events.push(blur$);

      // Merge all activity events
      merge(...events)
        .pipe(
          debounceTime(this._config.activityDebounceTime),
          filter(() => this._isTracking$.value),
          takeUntil(this._destroy$),
        )
        .subscribe(event => {
          this._ngZone.run(() => {
            this._handleActivityEvent(event);
          });
        });
    });
  }

  /**
   * Handle activity events
   */
  private _handleActivityEvent(event: UserActivityEvent): void {
    this._lastActivityTime = event.timestamp;
    this._userActivity$.next(event);

    const currentPresence = this._userPresence$.value;
    if (!currentPresence) return;

    // Update presence based on activity type
    let activity = UserActivity.VIEWING;
    if (event.type === 'keyboard') {
      activity = UserActivity.EDITING;
    } else if (event.type === 'mouse' && event.target === 'svg') {
      activity = UserActivity.SELECTING;
    } else if (event.type === 'blur') {
      activity = UserActivity.IDLE;
    }

    // Update cursor position for mouse events
    if (event.type === 'mouse' && event.position) {
      this.updateCursorPosition(event.position);
    } else {
      // Update activity without cursor change
      const updatedPresence = currentPresence
        .withStatus(PresenceStatus.ONLINE)
        .withActivity(activity);
      this._userPresence$.next(updatedPresence);
    }
  }

  /**
   * Setup presence monitoring timer
   */
  private _setupPresenceMonitoring(): void {
    // Monitor presence changes
    this._userPresence$
      .pipe(
        filter(presence => presence !== null),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this._destroy$),
      )
      .subscribe(() => {
        // Restart presence timer when presence changes
        this._startPresenceTimer();
      });
  }

  /**
   * Start presence monitoring timer
   */
  private _startPresenceTimer(): void {
    this._clearTimers();

    this._presenceTimer = setTimeout(() => {
      this._checkPresenceStatus();
    }, 1000); // Check every second
  }

  /**
   * Check and update presence status based on activity
   */
  private _checkPresenceStatus(): void {
    const currentPresence = this._userPresence$.value;
    if (!currentPresence || !this._isTracking$.value) return;

    const timeSinceActivity = this.getTimeSinceLastActivity();

    if (timeSinceActivity >= this._config.offlineThreshold) {
      // Mark as offline
      const offlinePresence = currentPresence.markAsOffline();
      this._userPresence$.next(offlinePresence);
    } else if (timeSinceActivity >= this._config.awayThreshold) {
      // Mark as away
      if (currentPresence.status !== PresenceStatus.AWAY) {
        const awayPresence = currentPresence.markAsAway();
        this._userPresence$.next(awayPresence);
      }
    } else {
      // Mark as online if currently away
      if (currentPresence.status === PresenceStatus.AWAY) {
        const onlinePresence = currentPresence
          .withStatus(PresenceStatus.ONLINE)
          .withActivity(UserActivity.VIEWING);
        this._userPresence$.next(onlinePresence);
      }
    }

    // Continue monitoring
    this._startPresenceTimer();
  }

  /**
   * Clear all timers
   */
  private _clearTimers(): void {
    if (this._activityTimer) {
      clearTimeout(this._activityTimer);
      this._activityTimer = null;
    }
    if (this._presenceTimer) {
      clearTimeout(this._presenceTimer);
      this._presenceTimer = null;
    }
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._clearTimers();
    this._currentUser$.complete();
    this._userPresence$.complete();
    this._userActivity$.complete();
    this._isTracking$.complete();
  }
}
