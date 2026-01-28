/**
 * Centralized configuration for session management timing constants.
 * These values control token refresh and session expiry behavior.
 */
export const SESSION_CONFIG = {
  /**
   * Time before token expiration to show warning dialog (for inactive users).
   * Default: 5 minutes
   */
  WARNING_TIME_MS: 5 * 60 * 1000,

  /**
   * Time before token expiration to proactively refresh (for active users).
   * Active users get silent background refresh at this threshold.
   * Default: 15 minutes
   */
  PROACTIVE_REFRESH_MS: 15 * 60 * 1000,

  /**
   * Interval for checking user activity and triggering proactive refresh.
   * Default: 1 minute
   */
  ACTIVITY_CHECK_INTERVAL_MS: 60 * 1000,

  /**
   * Window of time within which a user is considered "active".
   * If the user has interacted within this window, they're considered active.
   * Default: 2 minutes
   */
  ACTIVITY_WINDOW_MS: 2 * 60 * 1000,

  /**
   * Grace period after token expiry before forcing logout.
   * This allows in-flight refresh requests to complete before triggering logout.
   * If a refresh succeeds during this window, new timers are set from the new token.
   * Default: 30 seconds
   */
  LOGOUT_GRACE_PERIOD_MS: 30 * 1000,
} as const;

/**
 * Type for SESSION_CONFIG to enable type inference
 */
export type SessionConfig = typeof SESSION_CONFIG;
