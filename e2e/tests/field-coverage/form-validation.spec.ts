import { expect, Locator, Page } from '@playwright/test';
import { userTest, adminTest, reviewerTest } from '../../fixtures/auth-fixtures';
import { angularFill } from '../../helpers/angular-fill';
import { DashboardPage } from '../../pages/dashboard.page';
import { TeamsPage } from '../../pages/teams.page';
import { ProjectsPage } from '../../pages/projects.page';
import { AdminWebhooksPage } from '../../pages/admin-webhooks.page';

// === Form Validation Error Coverage ===
//
// Per-dialog tests that verify the specific mat-error message renders
// after submitting invalid data. Complements the existing CRUD workflow
// tests (which exercise form.invalid implicitly by asserting the submit
// button is disabled) by asserting that users actually see the error
// text — not just a disabled button.
//
// Dialogs skipped:
//  - Add-quota dialog: no mat-error elements (validation gates submit
//    button only; button-disabled state is already covered elsewhere).
//  - Create-automation-user dialog: no data-testids on input fields yet.
//
// Covered dialogs:
//  - Create TM (blank name)
//  - Create Diagram (blank name)
//  - Create Team (blank name, invalid email)
//  - Create Project (blank name, no team selected)
//  - Threat Editor (blank name)
//  - Add Webhook (blank name, invalid URL, no events)

const DIALOG = 'mat-dialog-container';
const SEEDED_TM = 'Seed TM - Full Fields';

async function waitDialog(page: Page): Promise<void> {
  await page.locator(DIALOG).waitFor({ state: 'visible', timeout: 5000 });
}

async function closeDialog(page: Page): Promise<void> {
  // Cancel via Escape — avoids depending on a specific cancel button testid
  await page.keyboard.press('Escape');
  await page.locator(DIALOG).waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Focus the input, then blur it by focusing a neighbour. Marks the form
 * control as touched so the default ErrorStateMatcher will show mat-error.
 */
async function focusThenBlur(page: Page, input: Locator): Promise<void> {
  await input.click();
  await input.evaluate((el: HTMLElement) => el.blur());
  // Allow change detection to run
  await page.waitForTimeout(100);
}

async function expectErrorContaining(
  page: Page,
  pattern: RegExp,
): Promise<void> {
  const error = page.locator(DIALOG).locator('mat-error').filter({ hasText: pattern });
  await expect(error.first()).toBeVisible({ timeout: 5000 });
}

userTest.describe('Form validation — user-scoped dialogs', () => {
  userTest.setTimeout(60000);

  userTest('create threat model — blank name shows required error', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).createTmButton().click();
    await waitDialog(userPage);

    await focusThenBlur(userPage, userPage.getByTestId('create-tm-name-input'));
    await expectErrorContaining(userPage, /required/i);

    await closeDialog(userPage);
  });
});

reviewerTest.describe('Form validation — reviewer-scoped dialogs', () => {
  reviewerTest.setTimeout(90000);

  reviewerTest('create team — blank name and invalid email both show errors', async ({
    reviewerPage,
  }) => {
    await reviewerPage.goto('/teams');
    await reviewerPage.waitForLoadState('networkidle');
    await new TeamsPage(reviewerPage).addButton().click();
    await waitDialog(reviewerPage);

    const name = reviewerPage.getByTestId('create-team-name-input');
    const email = reviewerPage.getByTestId('create-team-email-input');

    await focusThenBlur(reviewerPage, name);
    await expectErrorContaining(reviewerPage, /required/i);

    await angularFill(email, 'not-a-valid-email');
    await focusThenBlur(reviewerPage, email);
    await expectErrorContaining(reviewerPage, /valid email/i);

    await closeDialog(reviewerPage);
  });

  reviewerTest('create project — blank name and missing team both show errors', async ({
    reviewerPage,
  }) => {
    await reviewerPage.goto('/projects');
    await reviewerPage.waitForLoadState('networkidle');
    await new ProjectsPage(reviewerPage).addButton().click();
    await waitDialog(reviewerPage);

    const name = reviewerPage.getByTestId('create-project-name-input');
    const team = reviewerPage.getByTestId('create-project-team-select');

    await focusThenBlur(reviewerPage, name);
    await expectErrorContaining(reviewerPage, /required/i);

    // Open and immediately close team select to mark touched without choosing
    await team.click();
    await reviewerPage.keyboard.press('Escape');
    await reviewerPage.waitForTimeout(200);
    await expectErrorContaining(reviewerPage, /team.*required|required.*team/i);

    await closeDialog(reviewerPage);
  });

  reviewerTest('create diagram — blank name shows required error', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await new DashboardPage(reviewerPage).tmCard(SEEDED_TM).first().click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    const addDiagramBtn = reviewerPage.getByTestId('add-diagram-button');
    await addDiagramBtn.scrollIntoViewIfNeeded();
    await addDiagramBtn.click();
    await waitDialog(reviewerPage);

    await focusThenBlur(reviewerPage, reviewerPage.getByTestId('diagram-name-input'));
    await expectErrorContaining(reviewerPage, /required/i);

    await closeDialog(reviewerPage);
  });

  reviewerTest('threat editor — blank name shows required error', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await new DashboardPage(reviewerPage).tmCard(SEEDED_TM).first().click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    const addThreatBtn = reviewerPage.getByTestId('add-threat-button');
    await addThreatBtn.scrollIntoViewIfNeeded();
    await addThreatBtn.click();
    await waitDialog(reviewerPage);

    await focusThenBlur(reviewerPage, reviewerPage.getByTestId('threat-editor-name-input'));
    await expectErrorContaining(reviewerPage, /required/i);

    await closeDialog(reviewerPage);
  });
});

adminTest.describe('Form validation — admin-scoped dialogs', () => {
  adminTest.setTimeout(60000);

  adminTest('add webhook — blank name, invalid URL, and no events all show errors', async ({
    adminPage,
  }) => {
    await adminPage.goto('/admin/webhooks');
    await adminPage.waitForLoadState('networkidle');
    await new AdminWebhooksPage(adminPage).addButton().click();
    await waitDialog(adminPage);

    const name = adminPage.getByTestId('add-webhook-name-input');
    const url = adminPage.getByTestId('add-webhook-url-input');
    const events = adminPage.getByTestId('add-webhook-events-select');

    await focusThenBlur(adminPage, name);
    await expectErrorContaining(adminPage, /name.*required|required.*name/i);

    await angularFill(url, 'not a valid url at all');
    await focusThenBlur(adminPage, url);
    await expectErrorContaining(adminPage, /valid url|invalid/i);

    await events.click();
    await adminPage.keyboard.press('Escape');
    await adminPage.waitForTimeout(200);
    await expectErrorContaining(adminPage, /event.*required|at least one event/i);

    await closeDialog(adminPage);
  });
});
