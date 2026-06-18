import { Page } from '@playwright/test';

// SEM@fdc8fbf9fec9249ddbc6bf6d2c0396d524faeb8b: union type representing the four supported UI theme variants (pure)
export type ThemeMode = 'light' | 'dark' | 'light-colorblind' | 'dark-colorblind';

export const ALL_THEME_MODES: ThemeMode[] = [
  'light',
  'dark',
  'light-colorblind',
  'dark-colorblind',
];

/**
 * Apply a theme mode by toggling CSS classes on body and the CDK overlay container.
 * Matches ThemeService._applyThemeClasses() behavior.
 */
// SEM@fdc8fbf9fec9249ddbc6bf6d2c0396d524faeb8b: apply a theme mode by toggling CSS classes on the page DOM (mutates shared state)
export async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate((themeMode: string) => {
    const body = document.body;
    const overlay = document.querySelector('.cdk-overlay-container');

    body.classList.remove('dark-theme', 'colorblind-palette');
    overlay?.classList.remove('dark-theme', 'colorblind-palette');

    if (themeMode === 'dark' || themeMode === 'dark-colorblind') {
      body.classList.add('dark-theme');
      overlay?.classList.add('dark-theme');
    }
    if (themeMode === 'light-colorblind' || themeMode === 'dark-colorblind') {
      body.classList.add('colorblind-palette');
      overlay?.classList.add('colorblind-palette');
    }
  }, mode);

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await page.waitForTimeout(200);
}

/**
 * Detect the current theme mode from body CSS classes.
 */
// SEM@fdc8fbf9fec9249ddbc6bf6d2c0396d524faeb8b: detect active theme mode from page body CSS classes (pure)
export async function detectCurrentTheme(page: Page): Promise<ThemeMode> {
  return page.evaluate((): string => {
    const isDark = document.body.classList.contains('dark-theme');
    const isColorblind = document.body.classList.contains('colorblind-palette');
    if (isDark && isColorblind) return 'dark-colorblind';
    if (isDark) return 'dark';
    if (isColorblind) return 'light-colorblind';
    return 'light';
  }) as Promise<ThemeMode>;
}
