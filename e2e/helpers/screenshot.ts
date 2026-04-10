import { expect, Locator, Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES, applyTheme, detectCurrentTheme } from './theme-utils';

export type { ThemeMode };
export { ALL_THEME_MODES };

export interface ScreenshotOptions {
  mask?: Locator[];
  threshold?: number;
  fullPage?: boolean;
  modes?: ThemeMode[];
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
