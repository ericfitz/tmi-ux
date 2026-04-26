/**
 * Text measurement utility.
 *
 * Uses an offscreen 2D canvas to measure rendered text width with the same
 * font as the live DOM. Reused via a lazy singleton — creating the canvas
 * once amortizes the (small) DOM allocation across many measurements.
 *
 * Falls back to a character-count heuristic when canvas is unavailable
 * (e.g., during SSR or in test environments without `document`). The
 * heuristic accepts ~10–20% error which is acceptable for the icon column
 * in a container layout — overshoot only adds whitespace.
 */

let cachedContext: CanvasRenderingContext2D | null = null;
let canvasUnavailable = false;

function getContext(): CanvasRenderingContext2D | null {
  if (canvasUnavailable) return null;
  if (cachedContext) return cachedContext;
  if (typeof document === 'undefined') {
    canvasUnavailable = true;
    return null;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvasUnavailable = true;
    return null;
  }
  cachedContext = ctx;
  return ctx;
}

/**
 * Measure the rendered width (in pixels) of `text` at the given font.
 *
 * @param text Label string. Empty/missing → 0.
 * @param fontSize Font size in pixels (e.g., 12).
 * @param fontFamily Font family stack (e.g., `"'Roboto Condensed', Arial, sans-serif"`).
 */
export function measureLabelWidth(
  text: string | null | undefined,
  fontSize: number,
  fontFamily: string,
): number {
  if (!text) return 0;
  const ctx = getContext();
  if (ctx) {
    ctx.font = `${fontSize}px ${fontFamily}`;
    return ctx.measureText(text).width;
  }
  return text.length * fontSize * 0.55;
}

/**
 * Test-only: reset the cached context. Lets tests exercise both the
 * canvas and fallback branches independently.
 */
export function _resetTextMeasurementCacheForTesting(): void {
  cachedContext = null;
  canvasUnavailable = false;
}
