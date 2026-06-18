import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { NavbarPage } from '../../pages/navbar.page';

// === Theme UI ===
//
// End-to-end coverage of the user-facing theme switch path:
// navbar user menu → User Preferences dialog → theme + colorblind selections.
// Complements theme-persistence.spec.ts (which applies classes via direct DOM
// manipulation) by driving the real UI and asserting server-side persistence
// across reload.

userTest.describe('Theme UI', () => {
  userTest.setTimeout(90000);

  userTest('dark + colorblind selections apply, persist across reload, and revert', async ({
    userPage,
  }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const navbar = new NavbarPage(userPage);
    const dialog = userPage.locator('[data-testid="user-preferences-dialog"]');

    // SEM@b0c615fca19cc3cb61a27950cb062681163d7e5d: open the user preferences dialog and navigate to the Display tab (mutates shared state)
    const openDialog = async (): Promise<void> => {
      await navbar.userMenu().click();
      await dialog.waitFor({ state: 'visible', timeout: 5000 });
      // Make sure we're on the Display tab (first tab containing theme controls)
      const displayTab = userPage.locator('.mat-mdc-tab', { hasText: /Display/i }).first();
      if (await displayTab.isVisible()) {
        await displayTab.click();
      }
    };

    // SEM@b0c615fca19cc3cb61a27950cb062681163d7e5d: wait for preference sync PUT then close the preferences dialog (mutates shared state)
    const closeDialog = async (): Promise<void> => {
      // Wait longer than the UserPreferencesService 500ms debounce before closing
      // to ensure the server sync PUT fires.
      const putPromise = userPage
        .waitForResponse(
          resp =>
            resp.url().includes('/me/preferences') && resp.request().method() === 'PUT',
          { timeout: 5000 },
        )
        .catch(() => null);
      await userPage.waitForTimeout(700);
      await putPromise;
      await userPage.getByTestId('pref-close-button').click();
      await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    };

    // SEM@b0c615fca19cc3cb61a27950cb062681163d7e5d: fetch the current CSS class list from the document body (pure)
    const bodyClasses = (): Promise<string> =>
      userPage.evaluate(() => document.body.className);

    // --- Step 1: select dark + colorblind ---
    await openDialog();

    await userPage.getByTestId('pref-theme-dark').click();
    await expect
      .poll(async () => await bodyClasses(), { timeout: 5000 })
      .toContain('dark-theme');

    await userPage.getByTestId('pref-colorblind-toggle').click();
    await expect
      .poll(async () => await bodyClasses(), { timeout: 5000 })
      .toContain('colorblind-palette');

    await closeDialog();

    // --- Step 2: reload and verify preferences persisted ---
    await userPage.reload();
    await userPage.waitForLoadState('networkidle');

    const afterReload = await bodyClasses();
    expect(afterReload).toContain('dark-theme');
    expect(afterReload).toContain('colorblind-palette');

    // --- Step 3: revert to light + normal ---
    await openDialog();

    await userPage.getByTestId('pref-theme-light').click();
    await expect
      .poll(async () => await bodyClasses(), { timeout: 5000 })
      .not.toContain('dark-theme');

    await userPage.getByTestId('pref-colorblind-toggle').click();
    await expect
      .poll(async () => await bodyClasses(), { timeout: 5000 })
      .not.toContain('colorblind-palette');

    await closeDialog();

    // --- Step 4: reload and verify revert persisted ---
    await userPage.reload();
    await userPage.waitForLoadState('networkidle');

    const afterRevert = await bodyClasses();
    expect(afterRevert).not.toContain('dark-theme');
    expect(afterRevert).not.toContain('colorblind-palette');
  });
});
