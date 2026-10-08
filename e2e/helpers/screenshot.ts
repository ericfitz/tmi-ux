import { expect, Locator, Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES, applyTheme, detectCurrentTheme } from './theme-utils';

export type { ThemeMode };
export { ALL_THEME_MODES };

/**
 * Matches rendered dates in the formats the app uses (numeric `10/7/2026`,
 * medium `Oct 7, 2026` and ISO `2026-10-07`), for masking timestamps that
 * change with every seed.
 */
export const DATE_TEXT =
  /\d{1,2}\/\d{1,2}\/\d{2,4}|\b[A-Z][a-z]{2,8}\.? \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}/;

/**
 * Matches text that changes with every seed: UUIDs, and dates (DATE_TEXT) with
 * an optional trailing time such as `, 11:53:05 PM`.
 */
const VOLATILE_TEXT_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' +
  `|(?:${DATE_TEXT.source})` +
  '(?:,?\\s\\d{1,2}:\\d{2}(?::\\d{2})?(?:\\s?[AP]M)?)?';

export interface ScreenshotOptions {
  mask?: Locator[];
  threshold?: number;
  fullPage?: boolean;
  modes?: ThemeMode[];
  /**
   * Replace UUIDs and dates in the page's text with fixed placeholders before
   * each screenshot. Unlike a mask, this also removes the layout shift that
   * variable-width timestamps cause in auto-sized table columns. Trade-off:
   * a change in date format is invisible to screenshots taken this way.
   */
  freezeVolatileText?: boolean;
  /**
   * Set the text of every element matching each selector to a fixed string
   * before each screenshot, for per-run names (e.g. a generated threat model
   * name) that would otherwise change the text and its width.
   */
  replaceText?: { selector: string; text: string }[];
}

/** Sets the text content of every element matching each rule's selector. */
async function replaceText(page: Page, rules: { selector: string; text: string }[]): Promise<void> {
  await page.evaluate(list => {
    for (const { selector, text } of list) {
      document.querySelectorAll(selector).forEach(el => {
        el.textContent = text;
      });
    }
  }, rules);
}

/** Rewrites volatile text (see VOLATILE_TEXT_SOURCE) in every text node under body. */
async function freezeVolatileText(page: Page): Promise<void> {
  await page.evaluate(source => {
    const pattern = new RegExp(source, 'g');
    const uuid = /^[0-9a-f]{8}-/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? '';
      const frozen = text.replace(pattern, match =>
        uuid.test(match) ? '00000000-0000-0000-0000-000000000000' : '1/1/2000, 12:00 PM',
      );
      if (frozen !== text) node.nodeValue = frozen;
    }
  }, VOLATILE_TEXT_SOURCE);
}

/**
 * Take screenshots across all theme modes (or a specified subset).
 *
 * For each mode: applies theme via CSS classes, waits for repaint,
 * takes a screenshot with Playwright's toHaveScreenshot().
 * Restores the original theme after all screenshots.
 *
 * Screenshot names: `{name}-{mode}.png`
 */
// SEM@b63e497910f8ec54da2f8b7b3edfe80beb16c468: capture and assert screenshots for all theme modes, restore original theme
export async function takeThemeScreenshots(
  page: Page,
  name: string,
  options?: ScreenshotOptions,
): Promise<void> {
  const modes = options?.modes ?? ALL_THEME_MODES;
  const originalTheme = await detectCurrentTheme(page);

  try {
    for (const mode of modes) {
      await applyTheme(page, mode);
      // Per mode: a re-render between modes could restore the original text.
      if (options?.freezeVolatileText) await freezeVolatileText(page);
      if (options?.replaceText) await replaceText(page, options.replaceText);
      await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
        threshold: options?.threshold ?? 0.2,
        fullPage: options?.fullPage ?? false,
        mask: options?.mask ?? [],
      });
    }
  } finally {
    await applyTheme(page, originalTheme);
  }
}
