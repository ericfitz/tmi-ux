import { expect } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { CreateTmDialog } from '../../dialogs/create-tm.dialog';
import { DeleteConfirmDialog } from '../../dialogs/delete-confirm.dialog';
import { angularFill } from '../../helpers/angular-fill';

// === Error Scenarios (User) ===

userTest.describe('Error Scenarios (User)', () => {
  userTest.setTimeout(60000);

  userTest('unauthorized page displays correctly', async ({ userPage }) => {
    await userPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await userPage.waitForLoadState('networkidle');

    // Verify the unauthorized page content is visible
    const card = userPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify OK button exists and navigates home
    const okButton = userPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Should navigate to home
    await userPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });

  userTest('wildcard route redirects home', async ({ userPage }) => {
    await userPage.goto('/this-route-does-not-exist');
    await userPage.waitForLoadState('networkidle');

    // Wildcard route redirects to / or the user's default landing page
    await userPage.waitForURL(
      url =>
        url.pathname === '/' ||
        url.pathname.includes('/login') ||
        url.pathname.includes('/intake') ||
        url.pathname.includes('/dashboard'),
      { timeout: 10000 },
    );

    const currentUrl = userPage.url();
    expect(
      currentUrl.endsWith('/') ||
        currentUrl.includes('/login') ||
        currentUrl.includes('/intake') ||
        currentUrl.includes('/dashboard'),
    ).toBeTruthy();
  });

  userTest('delete confirmation requires exact text', async ({ userPage }) => {
    const dashboardPage = new DashboardPage(userPage);
    const deleteConfirmDialog = new DeleteConfirmDialog(userPage);
    const threatModelFlow = new ThreatModelFlow(userPage);

    const tmName = `E2E Delete Validation Test ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);

    // Go to dashboard and initiate delete
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await dashboardPage.tmDeleteButton(tmName).click();

    // Dialog is open — button should be disabled initially
    await deleteConfirmDialog.confirmInput().waitFor({ state: 'visible' });
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type wrong text — button should still be disabled
    await angularFill(deleteConfirmDialog.confirmInput(), 'wrong text');
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type correct text — button should enable
    await angularFill(deleteConfirmDialog.confirmInput(), 'gone forever');
    await expect(deleteConfirmDialog.confirmButton()).toBeEnabled();

    // Complete the deletion (cleanup)
    await deleteConfirmDialog.confirmButton().click();
    await expect(dashboardPage.tmCard(tmName)).toHaveCount(0, { timeout: 10000 });
  });

  userTest('form validation prevents save', async ({ userPage }) => {
    const dashboardPage = new DashboardPage(userPage);
    const createTmDialog = new CreateTmDialog(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

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
    await userPage.keyboard.press('Escape');
  });
});

// === Error Scenarios (Reviewer) ===

reviewerTest.describe('Error Scenarios (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('unauthorized page displays correctly', async ({ reviewerPage }) => {
    await reviewerPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await reviewerPage.waitForLoadState('networkidle');

    // Verify the unauthorized page content is visible
    const card = reviewerPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify OK button exists and navigates home
    const okButton = reviewerPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Should navigate to home
    await reviewerPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });
});

// === Error Scenarios (Admin) ===

adminTest.describe('Error Scenarios (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('unauthorized page displays correctly', async ({ adminPage }) => {
    await adminPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await adminPage.waitForLoadState('networkidle');

    // Verify the unauthorized page content is visible
    const card = adminPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify OK button exists and navigates home
    const okButton = adminPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Should navigate to home
    await adminPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });
});
