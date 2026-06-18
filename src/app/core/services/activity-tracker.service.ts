import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription, fromEvent, merge } from 'rxjs';
import { throttleTime, tap } from 'rxjs/operators';
import { LoggerService } from './logger.service';
import { SESSION_CONFIG } from '../../auth/config/session.config';

/**
 * Service for tracking user activity
 * Monitors mouse, keyboard, touch, and scroll events to determine if user is active
 */
@Injectable({
  providedIn: 'root',
})
// SEM@52f1d038d7a612c8e8827fe1da4a5bee64f7b5aa: track user input events and expose last-activity timestamp as an observable (mutates shared state)
export class ActivityTrackerService implements OnDestroy {
  // Time window for considering user "active"
  private readonly activityWindow = SESSION_CONFIG.ACTIVITY_WINDOW_MS;

  // Throttle time for activity events (1 second - prevents excessive updates)
  private readonly eventThrottleTime = 1000;

  // Last time user activity was detected
  private lastActivityTime: Date = new Date();

  // Observable of last activity time
  private lastActivitySubject$ = new BehaviorSubject<Date>(this.lastActivityTime);
  public lastActivity$: Observable<Date> = this.lastActivitySubject$.asObservable();

  // Whether tracking is currently enabled
  private isTracking = false;

  // Subscription for activity events (stored for cleanup)
  private activitySubscription: Subscription | null = null;

  // Track the current activity state to detect state changes
  private currentActiveState = true; // Start as active since we just loaded

  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: initialize activity tracking by starting DOM event listeners (mutates shared state)
  constructor(
    private logger: LoggerService,
    private ngZone: NgZone,
  ) {
    this.startTracking();
  }

  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: stop DOM event listeners and release subscriptions on service destroy (mutates shared state)
  ngOnDestroy(): void {
    this.stopTracking();
  }

  /**
   * Start tracking user activity
   * Sets up event listeners for mouse, keyboard, touch, and scroll events
   */
  // SEM@52f1d038d7a612c8e8827fe1da4a5bee64f7b5aa: subscribe to DOM input events outside Angular zone and update last-activity on each event (mutates shared state)
  private startTracking(): void {
    if (this.isTracking) {
      return;
    }

    this.logger.debugComponent('ActivityTracker', 'Starting activity tracking');

    // Run event listeners outside Angular zone for performance
    this.ngZone.runOutsideAngular(() => {
      // Merge all activity events
      const activityEvents$ = merge(
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'keydown'),
        fromEvent(document, 'click'),
        fromEvent(document, 'scroll', { passive: true, capture: true }),
        fromEvent(document, 'touchstart', { passive: true }),
      );

      // Throttle events and update last activity time
      this.activitySubscription = activityEvents$
        .pipe(
          throttleTime(this.eventThrottleTime),
          tap(() => {
            this.ngZone.run(() => {
              this.updateLastActivity();
            });
          }),
        )
        .subscribe();
    });

    this.isTracking = true;
  }

  /**
   * Stop tracking user activity
   */
  // SEM@52f1d038d7a612c8e8827fe1da4a5bee64f7b5aa: unsubscribe from DOM input events and mark tracking as stopped (mutates shared state)
  private stopTracking(): void {
    if (!this.isTracking) {
      return;
    }

    this.logger.debugComponent('ActivityTracker', 'Stopping activity tracking');

    // Unsubscribe from activity events to prevent memory leak
    if (this.activitySubscription) {
      this.activitySubscription.unsubscribe();
      this.activitySubscription = null;
    }

    this.isTracking = false;
  }

  /**
   * Update the last activity time to now
   */
  // SEM@dd193f1c86f0f5c66e5f7e6af070d51813c13577: record the current time as last activity and emit to subscribers (mutates shared state)
  private updateLastActivity(): void {
    this.lastActivityTime = new Date();
    this.lastActivitySubject$.next(this.lastActivityTime);

    // Only log when transitioning from inactive to active
    if (!this.currentActiveState) {
      this.currentActiveState = true;
      this.logger.debugComponent('ActivityTracker', 'User became active', {
        time: this.lastActivityTime.toISOString(),
      });
    }
  }

  /**
   * Check if user is currently active
   * User is considered active if they performed an action within the activity window
   */
  // SEM@dd193f1c86f0f5c66e5f7e6af070d51813c13577: return whether user activity occurred within the configured window (pure)
  public isUserActive(): boolean {
    const now = new Date();
    const timeSinceActivity = now.getTime() - this.lastActivityTime.getTime();
    const isActive = timeSinceActivity < this.activityWindow;

    // Only log when state changes from active to inactive
    if (this.currentActiveState && !isActive) {
      this.currentActiveState = false;
      this.logger.debugComponent('ActivityTracker', 'User became inactive', {
        lastActivity: this.lastActivityTime.toISOString(),
        timeSinceActivity: `${Math.floor(timeSinceActivity / 1000)}s`,
      });
    }

    return isActive;
  }

  /**
   * Get time since last user activity in milliseconds
   */
  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: return elapsed milliseconds since the last recorded user activity (pure)
  public getTimeSinceLastActivity(): number {
    const now = new Date();
    return now.getTime() - this.lastActivityTime.getTime();
  }

  /**
   * Manually mark user as active (useful for programmatic activity)
   */
  // SEM@90a716ed2a998adc01cf92b2f2b7e7ef13582a4a: programmatically record current time as last user activity (mutates shared state)
  public markActive(): void {
    this.updateLastActivity();
  }
}
