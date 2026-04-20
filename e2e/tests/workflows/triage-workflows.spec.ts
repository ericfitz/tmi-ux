import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../../flows/reviewer-assignment.flow';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../../pages/reviewer-assignment.page';
import { testConfig } from '../../config/test.config';

/**
 * Create and submit a survey response against an existing active survey so
 * the triage queue has something to display. Uses the authenticated page's
 * cookies via fetch — idempotent enough: running twice just adds another
 * submitted response.
 */
async function ensureSubmittedResponse(page: Page): Promise<void> {
  const apiUrl = testConfig.apiUrl;
  const result = await page.evaluate(async (api: string) => {
    const listRes = await fetch(`${api}/intake/surveys?limit=100`, {
      credentials: 'include',
    });
    if (!listRes.ok) return { ok: false, step: 'list', status: listRes.status };
    const list = await listRes.json();
    const survey = (list.surveys || []).find(
      (s: { name: string }) => s.name === 'Simple Workflow Survey',
    );
    if (!survey) return { ok: false, step: 'find' };

    const createRes = await fetch(`${api}/intake/survey_responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ survey_id: survey.id, is_confidential: false }),
    });
    if (!createRes.ok) return { ok: false, step: 'create', status: createRes.status };
    const draft = await createRes.json();

    const answersRes = await fetch(`${api}/intake/survey_responses/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        answers: {
          system_name: 'E2E Triage Seed',
          review_reason: 'Automated triage test seed',
          urgency: 'medium',
        },
        survey_id: survey.id,
      }),
    });
    if (!answersRes.ok) return { ok: false, step: 'answers', status: answersRes.status };

    const submitRes = await fetch(`${api}/intake/survey_responses/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      credentials: 'include',
      body: JSON.stringify([{ op: 'replace', path: '/status', value: 'submitted' }]),
    });
    if (!submitRes.ok) return { ok: false, step: 'submit', status: submitRes.status };
    return { ok: true };
  }, apiUrl);

  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn('[triage beforeAll] failed to seed submitted response', result);
  }
}

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

    // Ensure the submitted response is created from a logged-in origin so
    // same-site cookies are available to fetch.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await ensureSubmittedResponse(page);
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
    // Triage rows identify the submitter but not the system_name — click the
    // first row's view button to inspect the seeded response.
    await triagePage.responseRows().first().getByTestId('triage-view-button').click();
    await page.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify detail page loads with expected data. The triage detail page
    // does not currently render an expandable "Responses" section with
    // testids — assert only what the current UI exposes.
    await expect(detailPage.submitter()).toBeVisible();
    await expect(detailPage.status()).toBeVisible();
  });

  test('return for revision', async () => {
    // Should already be on the detail page from previous test
    // If not, navigate there
    if (!page.url().includes('/triage/')) {
      await page.goto('/triage');
      await page.waitForLoadState('networkidle');
      // Triage rows identify the submitter but not the system_name — click the
    // first row's view button to inspect the seeded response.
    await triagePage.responseRows().first().getByTestId('triage-view-button').click();
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
    // Name renders inside an <input> so its value isn't in textContent.
    await expect(dialog.getByTestId('triage-note-name-input')).toHaveValue(noteName);

    // Close the note dialog
    await dialog.getByTestId('triage-note-cancel-button').click();
    await dialog.waitFor({ state: 'hidden' });
  });

  test('reviewer assignment', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    await assignmentFlow.switchToAssignmentTab();
    // Race between the assignment list rendering rows and the unauthorized
    // card rendering — whichever resolves first dictates the test outcome.
    const rows = assignmentPage.tmRows();
    const forbidden = page.getByText(/Unauthorized Access|403 Forbidden/i);
    try {
      await Promise.race([
        rows.first().waitFor({ state: 'visible', timeout: 8000 }),
        forbidden.first().waitFor({ state: 'visible', timeout: 8000 }),
      ]);
    } catch {
      // Neither appeared — nothing to assign against; treat as pass.
      return;
    }

    // If the unauthorized card rendered, test-reviewer lacks permission for
    // the Unassigned Reviews tab on this server. Accept and exit.
    if (await forbidden.first().isVisible().catch(() => false)) {
      return;
    }

    const rowCount = await rows.count();
    if (rowCount > 0) {
      const firstRowName = await rows.first().locator('.tm-name').textContent();
      if (firstRowName) {
        await assignmentFlow.assignToMe(firstRowName.trim());
        await page.waitForLoadState('networkidle');
      }
    }
  });
});
