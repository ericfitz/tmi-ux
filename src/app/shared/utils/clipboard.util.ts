/**
 * Clipboard utility
 *
 * Provides a copy-to-clipboard function with Clipboard API support
 * and a legacy fallback using execCommand for older browsers.
 */

/**
 * Copy text to the system clipboard.
 * Uses the modern Clipboard API with a legacy execCommand fallback.
 */
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
 * Fallback method to copy text to clipboard for older browsers
 * using a hidden textarea and execCommand.
 */
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
