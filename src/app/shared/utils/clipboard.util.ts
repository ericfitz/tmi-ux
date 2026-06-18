/**
 * Clipboard utility
 *
 * Provides a copy-to-clipboard function with Clipboard API support
 * and a legacy fallback using execCommand for older browsers.
 */

import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';

/**
 * Collaborators required by {@link copyToClipboardWithFeedback}.
 */
export interface ClipboardFeedbackDeps {
  /** Snackbar used to surface the success toast. */
  snackBar: MatSnackBar;
  /** Transloco service used to localize the toast strings. */
  transloco: TranslocoService;
  /** Logger used to record copy failures. */
  logger: LoggerService;
}

/**
 * Copy text to the system clipboard.
 * Uses the modern Clipboard API with a legacy execCommand fallback.
 */
// SEM@e19c6684da148f53fab89e000721a9721f83d6d2: copy text to the system clipboard, with legacy execCommand fallback (pure)
export function copyToClipboard(text: string): void {
  try {
    navigator.clipboard.writeText(text).then(
      () => {
        // Success
      },
      (_error: unknown) => {
        fallbackCopyToClipboard(text);
      },
    );
  } catch {
    fallbackCopyToClipboard(text);
  }
}

/**
 * Copy text to the system clipboard and surface a localized snackbar toast.
 *
 * Writes via the Clipboard API; on success shows a "copied" toast for 2000ms,
 * and on failure logs the error via the provided logger. Unlike
 * {@link copyToClipboard}, this does not fall back to execCommand.
 *
 * @param text - The text to copy
 * @param deps - The snackbar, transloco, and logger collaborators
 */
// SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: copy text to the clipboard and show a localized success toast notification
export function copyToClipboardWithFeedback(text: string, deps: ClipboardFeedbackDeps): void {
  const { snackBar, transloco, logger } = deps;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      snackBar.open(
        transloco.translate('common.copiedToClipboard'),
        transloco.translate('common.close'),
        { duration: 2000 },
      );
    })
    .catch((err: unknown) => {
      logger.error('Could not copy text: ', err);
    });
}

/**
 * Fallback method to copy text to clipboard for older browsers
 * using a hidden textarea and execCommand.
 */
// SEM@e19c6684da148f53fab89e000721a9721f83d6d2: copy text to the clipboard via hidden textarea execCommand for older browsers (mutates shared state)
function fallbackCopyToClipboard(text: string): void {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
  } catch {
    // Last resort: show the text in an alert so user can manually copy
    alert('Please manually copy this text:\n\n' + text);
  }

  document.body.removeChild(textArea);
}
