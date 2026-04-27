/**
 * Per-cell layout-lock helpers (#641).
 *
 * The lock is a tag on cell.data: `_layoutLocked: true` when locked, absent otherwise.
 * Reading: `isCellLayoutLocked(cell)`. Writing is done in dfd.component via setData.
 */

const LOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="11" fill="white" stroke="white" stroke-width="2"/>
  <path fill="#666" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/>
</svg>`;

/**
 * The href used for the lock-badge image element on cells. Inlined SVG data URL
 * so the badge has zero asset-loading dependencies and renders immediately.
 */
export const LOCK_BADGE_ICON_HREF = `data:image/svg+xml,${encodeURIComponent(LOCK_SVG)}`;

/**
 * Returns true if the cell's data contains `_layoutLocked: true`.
 *
 * Tolerates null/undefined cells, cells without getData, and cells with empty data.
 * Used at every auto-layout entry point and cascade walk to gate layout effects.
 */
export function isCellLayoutLocked(cell: unknown): boolean {
  if (!cell || typeof (cell as { getData?: unknown }).getData !== 'function') {
    return false;
  }
  const data = (cell as { getData: () => unknown }).getData();
  if (!data || typeof data !== 'object') {
    return false;
  }
  return (data as { _layoutLocked?: unknown })._layoutLocked === true;
}
