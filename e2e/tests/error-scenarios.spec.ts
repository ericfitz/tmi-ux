import { test, expect } from '../fixtures/test-fixtures';

/**
 * Error scenario integration tests.
 *
 * Tests client-side error handling, validation, and edge cases.
 * Each test is independent (uses fixture isolation).
 */
test.describe('Error Scenarios', () => {
  test.setTimeout(60000);

  test('unauthorized page displays correctly', async ({ page }) => {
    await page.goto('/unauthorized?statusCode=403&reason=no_permission');
    await page.waitForLoadState('networkidle');

    // Verify the unauthorized page content is visible
    const card = page.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify OK button exists and navigates home
    const okButton = page.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Should navigate to home
    await page.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });

  test('wildcard route redirects home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('networkidle');

    // Wildcard route redirects to /
    await page.waitForURL(
      url => url.pathname === '/' || url.pathname.includes('/login'),
      { timeout: 10000 },
    );

    const currentUrl = page.url();
    expect(currentUrl.endsWith('/') || currentUrl.includes('/login')).toBeTruthy();
  });

  test('delete confirmation requires exact text', async ({
    page,
    authFlow,
    threatModelFlow,
    dashboardPage,
    deleteConfirmDialog,
  }) => {
    await authFlow.login();

    const tmName = `E2E Delete Validation Test ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);

    // Go to dashboard and initiate delete
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dashboardPage.tmDeleteButton(tmName).click();

    // Dialog is open — button should be disabled initially
    await deleteConfirmDialog.confirmInput().waitFor({ state: 'visible' });
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type wrong text — button should still be disabled
    await deleteConfirmDialog.confirmInput().fill('wrong text');
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type correct text — button should enable
    await deleteConfirmDialog.confirmInput().clear();
    await deleteConfirmDialog.confirmInput().fill('gone forever');
    await expect(deleteConfirmDialog.confirmButton()).toBeEnabled();

    // Complete the deletion (cleanup)
    await deleteConfirmDialog.confirmButton().click();
    await expect(dashboardPage.tmCard(tmName)).toHaveCount(0, { timeout: 10000 });
  });

  test('form validation prevents save', async ({
    page,
    authFlow,
    dashboardPage,
    createTmDialog,
  }) => {
    await authFlow.login();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await dashboardPage.createTmButton().click();
    await createTmDialog.nameInput().waitFor({ state: 'visible' });

    // Submit button should be disabled when name is empty
    await expect(createTmDialog.submitButton()).toBeDisabled();

    // Type a name — submit should enable
    await createTmDialog.nameInput().fill('Test Name');
    await expect(createTmDialog.submitButton()).toBeEnabled();

    // Clear the name — submit should disable again
    await createTmDialog.nameInput().clear();
    await expect(createTmDialog.submitButton()).toBeDisabled();

    // Cancel the dialog (no cleanup needed — nothing was created)
    await page.keyboard.press('Escape');
  });
});
