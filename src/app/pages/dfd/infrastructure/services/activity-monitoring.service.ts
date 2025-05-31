import { Injectable, NgZone, Optional, Inject, InjectionToken } from '@angular/core';
import { Observable, Subject, BehaviorSubject, timer, combineLatest } from 'rxjs';
import { map, filter, distinctUntilChanged, takeUntil, switchMap } from 'rxjs/operators';

import { UserTrackingService, UserActivityEvent } from './user-tracking.service';
import { CollaborationApplicationService } from '../../application/collaboration/collaboration-application.service';
import {
  UserPresence,
  PresenceStatus,
  UserActivity,
} from '../../domain/collaboration/user-presence';
import { User } from '../../domain/collaboration/user';

/**
 * Configuration for activity monitoring
 */
export interface ActivityMonitoringConfig {
  /** Interval for checking user activity in milliseconds */
  monitoringInterval: number;
  /** Time threshold for marking user as away in milliseconds */
  awayThreshold: number;
  /** Time threshold for marking user as offline in milliseconds */
  offlineThreshold: number;
  /** Whether to automatically update presence based on activity */
  autoUpdatePresence: boolean;
  /** Whether to track detailed activity metrics */
  trackDetailedMetrics: boolean;
}

/**
 * Injection token for activity monitoring configuration
 */
export const ACTIVITY_MONITORING_CONFIG = new InjectionToken<ActivityMonitoringConfig>(
  'ACTIVITY_MONITORING_CONFIG',
);

/**
 * Default configuration for activity monitoring
 */
const DEFAULT_CONFIG: ActivityMonitoringConfig = {
  monitoringInterval: 5000, // 5 seconds
  awayThreshold: 5 * 60 * 1000, // 5 minutes
  offlineThreshold: 30 * 60 * 1000, // 30 minutes
  autoUpdatePresence: true,
  trackDetailedMetrics: true,
};

/**
 * Activity metrics for a user session
 */
export interface ActivityMetrics {
  userId: string;
  sessionStartTime: Date;
  totalActiveTime: number;
  totalIdleTime: number;
  mouseMovements: number;
  keyboardEvents: number;
  scrollEvents: number;
  focusEvents: number;
  lastActivityTime: Date;
  currentActivity: UserActivity;
  activityHistory: ActivityHistoryEntry[];
}

/**
 * Activity history entry
 */
export interface ActivityHistoryEntry {
  activity: UserActivity;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tool?: string;
}

/**
 * Activity summary for reporting
 */
export interface ActivitySummary {
  totalUsers: number;
  activeUsers: number;
  awayUsers: number;
  offlineUsers: number;
  averageActiveTime: number;
  mostActiveUser?: string;
  activityDistribution: Record<UserActivity, number>;
}

/**
 * Service for monitoring and analyzing user activity in collaboration sessions
 */
@Injectable({
  providedIn: 'root',
})
export class ActivityMonitoringService {
  private readonly _config: ActivityMonitoringConfig;
  private readonly _destroy$ = new Subject<void>();
  private readonly _isMonitoring$ = new BehaviorSubject<boolean>(false);
  private readonly _userMetrics$ = new BehaviorSubject<Map<string, ActivityMetrics>>(new Map());
  private readonly _activitySummary$ = new BehaviorSubject<ActivitySummary | null>(null);

  private _monitoringTimer: ReturnType<typeof setTimeout> | null = null;

  // Public observables
  public readonly isMonitoring$ = this._isMonitoring$.asObservable();
  public readonly userMetrics$ = this._userMetrics$.asObservable();
  public readonly activitySummary$ = this._activitySummary$.asObservable();

  constructor(
    private readonly _ngZone: NgZone,
    private readonly _userTrackingService: UserTrackingService,
    private readonly _collaborationService: CollaborationApplicationService,
    @Optional() @Inject(ACTIVITY_MONITORING_CONFIG) config?: Partial<ActivityMonitoringConfig>,
  ) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._setupActivityTracking();
  }

  /**
   * Start activity monitoring
   */
  startMonitoring(): void {
    if (this._isMonitoring$.value) return;

    this._isMonitoring$.next(true);
    this._startMonitoringTimer();
  }

  /**
   * Stop activity monitoring
   */
  stopMonitoring(): void {
    this._isMonitoring$.next(false);
    this._clearMonitoringTimer();
  }

  /**
   * Get metrics for a specific user
   */
  getUserMetrics(userId: string): ActivityMetrics | null {
    return this._userMetrics$.value.get(userId) || null;
  }

  /**
   * Get metrics for all users
   */
  getAllUserMetrics(): Map<string, ActivityMetrics> {
    return new Map(this._userMetrics$.value);
  }

  /**
   * Get current activity summary
   */
  getCurrentSummary(): ActivitySummary | null {
    return this._activitySummary$.value;
  }

  /**
   * Reset metrics for a specific user
   */
  resetUserMetrics(userId: string): void {
    const metrics = new Map(this._userMetrics$.value);
    metrics.delete(userId);
    this._userMetrics$.next(metrics);
    this._updateActivitySummary();
  }

  /**
   * Reset all metrics
   */
  resetAllMetrics(): void {
    this._userMetrics$.next(new Map());
    this._activitySummary$.next(null);
  }

  /**
   * Export activity data for analysis
   */
  exportActivityData(): {
    summary: ActivitySummary | null;
    userMetrics: Record<string, ActivityMetrics>;
    exportTime: Date;
  } {
    const userMetrics: Record<string, ActivityMetrics> = {};
    for (const [userId, metrics] of this._userMetrics$.value) {
      userMetrics[userId] = { ...metrics };
    }

    return {
      summary: this._activitySummary$.value,
      userMetrics,
      exportTime: new Date(),
    };
  }

  /**
   * Setup activity tracking from user tracking service
   */
  private _setupActivityTracking(): void {
    // Track user activity events
    this._userTrackingService.userActivity$
      .pipe(
        filter(() => this._isMonitoring$.value),
        takeUntil(this._destroy$),
      )
      .subscribe(event => {
        this._handleActivityEvent(event);
      });

    // Track user presence changes
    this._userTrackingService.userPresence$
      .pipe(
        filter(presence => presence !== null),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        takeUntil(this._destroy$),
      )
      .subscribe(presence => {
        if (presence) {
          this._handlePresenceChange(presence);
        }
      });

    // Track session participants
    this._collaborationService.sessionParticipants$
      .pipe(takeUntil(this._destroy$))
      .subscribe(participants => {
        this._updateParticipantMetrics(participants);
      });
  }

  /**
   * Handle activity events from user tracking
   */
  private _handleActivityEvent(event: UserActivityEvent): void {
    const currentUser = this._collaborationService.getCurrentUser();
    if (!currentUser) return;

    const metrics = this._getOrCreateUserMetrics(currentUser.id, currentUser);

    // Update activity counters
    switch (event.type) {
      case 'mouse':
        metrics.mouseMovements++;
        break;
      case 'keyboard':
        metrics.keyboardEvents++;
        break;
      case 'scroll':
        metrics.scrollEvents++;
        break;
      case 'focus':
        metrics.focusEvents++;
        break;
    }

    // Update last activity time
    metrics.lastActivityTime = new Date(event.timestamp);

    // Determine current activity
    let newActivity = UserActivity.VIEWING;
    if (event.type === 'keyboard') {
      newActivity = UserActivity.EDITING;
    } else if (event.type === 'mouse' && event.target === 'svg') {
      newActivity = UserActivity.SELECTING;
    } else if (event.type === 'blur') {
      newActivity = UserActivity.IDLE;
    }

    // Update activity history if activity changed
    if (metrics.currentActivity !== newActivity) {
      this._updateActivityHistory(metrics, newActivity);
      metrics.currentActivity = newActivity;
    }

    this._updateUserMetrics(currentUser.id, metrics);
  }

  /**
   * Handle presence changes
   */
  private _handlePresenceChange(presence: UserPresence): void {
    const metrics = this._getOrCreateUserMetrics(presence.user.id, presence.user);

    // Update activity based on presence
    if (presence.activity !== metrics.currentActivity) {
      this._updateActivityHistory(metrics, presence.activity);
      metrics.currentActivity = presence.activity;
    }

    this._updateUserMetrics(presence.user.id, metrics);
  }

  /**
   * Update participant metrics from collaboration service
   */
  private _updateParticipantMetrics(participants: UserPresence[]): void {
    const currentMetrics = new Map(this._userMetrics$.value);

    // Add metrics for new participants
    for (const participant of participants) {
      if (!currentMetrics.has(participant.user.id)) {
        const metrics = this._createUserMetrics(participant.user.id, participant.user);
        currentMetrics.set(participant.user.id, metrics);
      }
    }

    // Remove metrics for users who left
    const participantIds = new Set(participants.map(p => p.user.id));
    for (const userId of currentMetrics.keys()) {
      if (!participantIds.has(userId)) {
        currentMetrics.delete(userId);
      }
    }

    this._userMetrics$.next(currentMetrics);
    this._updateActivitySummary();
  }

  /**
   * Get or create user metrics
   */
  private _getOrCreateUserMetrics(userId: string, user: User): ActivityMetrics {
    const existing = this._userMetrics$.value.get(userId);
    if (existing) return existing;

    return this._createUserMetrics(userId, user);
  }

  /**
   * Create new user metrics
   */
  private _createUserMetrics(userId: string, user: User): ActivityMetrics {
    return {
      userId,
      sessionStartTime: new Date(),
      totalActiveTime: 0,
      totalIdleTime: 0,
      mouseMovements: 0,
      keyboardEvents: 0,
      scrollEvents: 0,
      focusEvents: 0,
      lastActivityTime: new Date(),
      currentActivity: UserActivity.VIEWING,
      activityHistory: [],
    };
  }

  /**
   * Update user metrics
   */
  private _updateUserMetrics(userId: string, metrics: ActivityMetrics): void {
    const currentMetrics = new Map(this._userMetrics$.value);
    currentMetrics.set(userId, metrics);
    this._userMetrics$.next(currentMetrics);
    this._updateActivitySummary();
  }

  /**
   * Update activity history
   */
  private _updateActivityHistory(metrics: ActivityMetrics, newActivity: UserActivity): void {
    const now = new Date();

    // End current activity if exists
    if (metrics.activityHistory.length > 0) {
      const currentEntry = metrics.activityHistory[metrics.activityHistory.length - 1];
      if (!currentEntry.endTime) {
        currentEntry.endTime = now;
        currentEntry.duration = currentEntry.endTime.getTime() - currentEntry.startTime.getTime();

        // Update total times
        if (currentEntry.activity === UserActivity.IDLE) {
          metrics.totalIdleTime += currentEntry.duration;
        } else {
          metrics.totalActiveTime += currentEntry.duration;
        }
      }
    }

    // Add new activity entry
    if (this._config.trackDetailedMetrics) {
      metrics.activityHistory.push({
        activity: newActivity,
        startTime: now,
      });

      // Limit history size to prevent memory issues
      if (metrics.activityHistory.length > 1000) {
        metrics.activityHistory = metrics.activityHistory.slice(-500);
      }
    }
  }

  /**
   * Update activity summary
   */
  private _updateActivitySummary(): void {
    const metrics = this._userMetrics$.value;
    if (metrics.size === 0) {
      this._activitySummary$.next(null);
      return;
    }

    const summary: ActivitySummary = {
      totalUsers: metrics.size,
      activeUsers: 0,
      awayUsers: 0,
      offlineUsers: 0,
      averageActiveTime: 0,
      activityDistribution: {
        [UserActivity.VIEWING]: 0,
        [UserActivity.EDITING]: 0,
        [UserActivity.SELECTING]: 0,
        [UserActivity.IDLE]: 0,
      },
    };

    let totalActiveTime = 0;
    let mostActiveTime = 0;
    let mostActiveUser: string | undefined;

    for (const [userId, userMetrics] of metrics) {
      // Count by current activity
      summary.activityDistribution[userMetrics.currentActivity]++;

      // Count by presence status (approximate based on last activity)
      const timeSinceActivity = Date.now() - userMetrics.lastActivityTime.getTime();
      if (timeSinceActivity < this._config.awayThreshold) {
        summary.activeUsers++;
      } else if (timeSinceActivity < this._config.offlineThreshold) {
        summary.awayUsers++;
      } else {
        summary.offlineUsers++;
      }

      // Track most active user
      if (userMetrics.totalActiveTime > mostActiveTime) {
        mostActiveTime = userMetrics.totalActiveTime;
        mostActiveUser = userId;
      }

      totalActiveTime += userMetrics.totalActiveTime;
    }

    summary.averageActiveTime = totalActiveTime / metrics.size;
    summary.mostActiveUser = mostActiveUser;

    this._activitySummary$.next(summary);
  }

  /**
   * Start monitoring timer
   */
  private _startMonitoringTimer(): void {
    this._clearMonitoringTimer();

    this._monitoringTimer = setTimeout(() => {
      this._performMonitoringCheck();
      this._startMonitoringTimer(); // Restart timer
    }, this._config.monitoringInterval);
  }

  /**
   * Perform periodic monitoring check
   */
  private _performMonitoringCheck(): void {
    if (!this._isMonitoring$.value) return;

    // Update activity times for all users
    const now = Date.now();
    const metrics = new Map(this._userMetrics$.value);

    for (const [userId, userMetrics] of metrics) {
      // Update total times based on current activity
      const timeSinceLastUpdate = now - userMetrics.lastActivityTime.getTime();

      if (userMetrics.currentActivity === UserActivity.IDLE) {
        userMetrics.totalIdleTime += this._config.monitoringInterval;
      } else {
        userMetrics.totalActiveTime += this._config.monitoringInterval;
      }

      // Auto-update presence if enabled
      if (this._config.autoUpdatePresence) {
        this._autoUpdateUserPresence(userId, userMetrics, timeSinceLastUpdate);
      }
    }

    this._userMetrics$.next(metrics);
    this._updateActivitySummary();
  }

  /**
   * Auto-update user presence based on activity
   */
  private _autoUpdateUserPresence(
    userId: string,
    metrics: ActivityMetrics,
    timeSinceActivity: number,
  ): void {
    const currentUser = this._collaborationService.getCurrentUser();
    if (currentUser?.id !== userId) return; // Only update own presence

    if (timeSinceActivity >= this._config.offlineThreshold) {
      // Mark as offline
      this._collaborationService.markUserAsAway(userId).subscribe();
    } else if (timeSinceActivity >= this._config.awayThreshold) {
      // Mark as away
      this._collaborationService.markUserAsAway(userId).subscribe();
    } else if (metrics.currentActivity !== UserActivity.IDLE) {
      // Mark as online if active
      this._collaborationService.markUserAsOnline(userId).subscribe();
    }
  }

  /**
   * Clear monitoring timer
   */
  private _clearMonitoringTimer(): void {
    if (this._monitoringTimer) {
      clearTimeout(this._monitoringTimer);
      this._monitoringTimer = null;
    }
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._clearMonitoringTimer();
    this._isMonitoring$.complete();
    this._userMetrics$.complete();
    this._activitySummary$.complete();
  }
}
