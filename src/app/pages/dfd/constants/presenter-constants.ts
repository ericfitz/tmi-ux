/**
 * Constants for presenter mode functionality
 */
export const PRESENTER_CURSOR_CONFIG = {
  /**
   * Interval for broadcasting cursor position updates (in milliseconds)
   */
  UPDATE_INTERVAL: 50,

  /**
   * Timeout duration for reverting to normal cursor when no presenter events received (in milliseconds)
   */
  TIMEOUT_DURATION: 2000,
} as const;

/**
 * CSS classes for presenter mode cursor styling
 */
export const PRESENTER_CURSOR_STYLES = {
  /**
   * CSS class applied to graph container when showing presenter cursor
   */
  PRESENTER_CURSOR_CLASS: 'presenter-cursor-active',

  /**
   * CSS custom cursor URL for presenter cursor
   */
  PRESENTER_CURSOR_URL: 'url("/presenter-cursor.svg"), auto',
} as const;
