/**
 * Types for the reusable confirm action dialog.
 */

/**
 * Configuration data for the confirm action dialog.
 */
export interface ConfirmActionDialogData {
  /** Dialog title (translation key) */
  title: string;

  /** Main message body (translation key) */
  message: string;

  /** Material icon name (default: 'warning') */
  icon?: string;

  /** Confirm button label (translation key, default: 'common.confirm') */
  confirmLabel?: string;

  /** Cancel button label (translation key, default: 'common.cancel') */
  cancelLabel?: string;

  /** Whether confirm button should use warn color (default: true) */
  confirmIsDestructive?: boolean;
}

/**
 * Result returned when dialog closes.
 */
export interface ConfirmActionDialogResult {
  /** True if user confirmed the action */
  confirmed: boolean;
}
