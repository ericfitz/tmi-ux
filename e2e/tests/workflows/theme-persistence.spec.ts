import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { NavbarPage } from '../../pages/navbar.page';
import { applyTheme, ALL_THEME_MODES } from '../../helpers/theme-utils';

// === Theme Persistence ===

userTest.describe('Theme Persistence', () => {
  userTest.setTimeout(60000);

  userTest('theme classes apply and page survives reload for all modes', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    for (const mode of ALL_THEME_MODES) {
      await applyTheme(userPage, mode);

      const bodyClass: string = await userPage.evaluate(() => document.body.className);

      if (mode === 'dark' || mode === 'dark-colorblind') {
        expect(bodyClass).toContain('dark-theme');
      }
      if (mode === 'light-colorblind' || mode === 'dark-colorblind') {
        expect(bodyClass).toContain('colorblind-palette');
      }

      await userPage.reload();
      await userPage.waitForLoadState('networkidle');

      const navbar = new NavbarPage(userPage);
      await expect(navbar.dashboardLink()).toBeVisible({ timeout: 10000 });
    }
  });

  userTest('dark mode persists across in-app navigation', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await applyTheme(userPage, 'dark');

    const navbar = new NavbarPage(userPage);
    await navbar.intakeLink().click();
    await userPage.waitForURL(/\/intake/, { timeout: 10000 });

    const isDark: boolean = await userPage.evaluate(() =>
      document.body.classList.contains('dark-theme'),
    );
    expect(isDark).toBe(true);
  });
});
