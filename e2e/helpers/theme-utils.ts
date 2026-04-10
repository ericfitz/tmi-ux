import { Page } from '@playwright/test';

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
