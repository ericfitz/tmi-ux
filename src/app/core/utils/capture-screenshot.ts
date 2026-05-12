/**
 * Capture a viewport screenshot of the current page using html2canvas.
 *
 * Designed to be called BEFORE opening a feedback dialog so that the dialog
 * overlay is not in the captured image. The CDK overlay container (which
 * hosts both open Material menus and dialogs at capture time) is excluded
 * defensively in case the caller fires before the menu has fully detached.
 *
 * Returns a JPEG data URL on success, or `null` on any failure (the caller
 * proceeds without a screenshot rather than blocking on capture errors —
 * feedback submission is more important than the attached image).
 *
 * html2canvas is loaded lazily so it stays out of the main bundle. The
 * library is ~50 KB gzipped and only needed when feedback is invoked.
 */
export async function captureViewportScreenshot(): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const { default: html2canvas } = await import('html2canvas');
    const overlay = document.querySelector('.cdk-overlay-container');
    const canvas = await html2canvas(document.body, {
      backgroundColor: null,
      logging: false,
      // Half-resolution capture keeps the data URL well under typical request
      // body limits (~150–400 KB after JPEG compression) while remaining
      // legible enough for support context.
      scale: 0.5,
      ignoreElements: el => el === overlay || (overlay?.contains(el) ?? false),
      // Avoid mutating the live page during cloning.
      removeContainer: true,
    });
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    // Any capture failure (CORS, OOM, unsupported CSS, etc.) is non-fatal.
    return null;
  }
}
