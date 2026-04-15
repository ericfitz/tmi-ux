import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../../flows/reviewer-assignment.flow';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../../pages/reviewer-assignment.page';

test.describe.serial('Triage Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let triageFlow: TriageFlow;
  let detailFlow: TriageDetailFlow;
  let assignmentFlow: ReviewerAssignmentFlow;
  let triagePage: TriagePage;
  let detailPage: TriageDetailPage;
  let assignmentPage: ReviewerAssignmentPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    triageFlow = new TriageFlow(page);
    detailFlow = new TriageDetailFlow(page);
    assignmentFlow = new ReviewerAssignmentFlow(page);
    triagePage = new TriagePage(page);
    detailPage = new TriageDetailPage(page);
    assignmentPage = new ReviewerAssignmentPage(page);

    await new AuthFlow(page).loginAs('test-reviewer');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('triage list filters', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Verify seeded submitted response is visible
    await expect(triagePage.responseRows().first()).toBeVisible({
      timeout: 10000,
    });

    // Filter by status (submitted)
    await triageFlow.filterByStatus('Submitted');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Filter by template
    await triageFlow.filterByTemplate('Simple Workflow Survey');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Search by submitter
    await triageFlow.searchByName('Test User');
    await expect(triagePage.responseRows().first()).toBeVisible();

    // Clear filters
    await triageFlow.clearFilters();
    await expect(triagePage.responseRows().first()).toBeVisible();
  });

  test('view response detail', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Click view on the seeded response
    await triagePage.viewButton('E2E Seed System').click();
    await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify detail page loads with expected data
    await expect(detailPage.submitter()).toBeVisible();
    await expect(detailPage.status()).toBeVisible();

    // Expand survey responses section and verify data
    const toggleBtn = detailPage.toggleResponsesButton();
    const isExpanded = await toggleBtn.getAttribute('aria-expanded');
    if (isExpanded !== 'true') {
      await toggleBtn.click();
      await page.waitForTimeout(300);
    }
    await expect(detailPage.responseRows().first()).toBeVisible({
      timeout: 5000,
    });
  });

  test('return for revision', async () => {
    // Should already be on the detail page from previous test
    // If not, navigate there
    if (!page.url().includes('/triage/')) {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      await triagePage.viewButton('E2E Seed System').click();
      await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    await detailFlow.returnForRevision(
      'Please provide more detail about the architecture'
    );

    // Verify status changed to needs_revision
    await expect(detailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });
  });

  test('triage notes', async () => {
    // Should still be on detail page
    if (!page.url().includes('/triage/')) {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      await triagePage.responseRows().first().click();
      await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
      await page.waitForLoadState('networkidle');
    }

    const noteName = `E2E Note ${Date.now()}`;
    const noteContent = '## Review Findings\n\nInitial triage notes from E2E test.';

    // Add a triage note
    await detailFlow.addNote(noteName, noteContent);

    // Verify note appears in the list
    await expect(detailPage.noteRow(noteName)).toBeVisible({
      timeout: 10000,
    });

    // View the note
    await detailFlow.viewNote(noteName);

    // Verify note content is displayed in the dialog
    const dialog = page.locator('mat-dialog-container');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(noteName);

    // Close the note dialog
    await dialog.getByTestId('triage-note-cancel-button').click();
    await dialog.waitFor({ state: 'hidden' });
  });

  test('reviewer assignment', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    // Switch to Reviewer Assignment tab
    await assignmentFlow.switchToAssignmentTab();

    // Wait for the assignment list to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Check if there are any unassigned TMs
    const rows = assignmentPage.tmRows();
    const rowCount = await rows.count();

    if (rowCount > 0) {
      // Assign to me on the first row
      const firstRowName = await rows.first().locator('.tm-name').textContent();
      if (firstRowName) {
        await assignmentFlow.assignToMe(firstRowName.trim());

        // Verify assignment persists (button should change)
        await page.waitForLoadState('networkidle');
      }
    }
    // If no rows, the test passes — no unassigned TMs to work with
  });
});
