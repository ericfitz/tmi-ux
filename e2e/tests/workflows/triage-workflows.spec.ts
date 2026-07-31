import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TriageFlow } from '../../flows/triage.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { ReviewerAssignmentFlow } from '../../flows/reviewer-assignment.flow';
import { TriagePage } from '../../pages/triage.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { ReviewerAssignmentPage } from '../../pages/reviewer-assignment.page';
import { testConfig } from '../../config/test.config';

interface SeededResponse {
  id: string;
  surveyName: string;
}

type SeedResult = { ok: true; id: string } | { ok: false; step: string; status?: number };

/**
 * Create and submit a survey response against an existing active survey, and
 * optionally transition it to a different triage status. Fails loudly
 * (throws) on any error instead of warning, and returns the created
 * response's id so tests can act on the exact response they created rather
 * than an unscoped `.first()` from the shared triage queue.
 */
// SEM@6a2f9c1b3e5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a: seed a submitted survey response via the intake API and optionally set its triage status (mutates shared state)
async function seedSurveyResponse(
  page: Page,
  apiUrl: string,
  opts: { surveyName: string; answers: Record<string, unknown>; status?: string },
): Promise<SeededResponse> {
  const result: SeedResult = await page.evaluate(
    async (args: { api: string; surveyName: string; answers: Record<string, unknown> }) => {
      const listRes = await fetch(`${args.api}/intake/surveys?limit=100`, {
        credentials: 'include',
      });
      if (!listRes.ok) return { ok: false, step: 'list', status: listRes.status };
      const list = await listRes.json();
      const survey = (list.surveys || []).find((s: { name: string }) => s.name === args.surveyName);
      if (!survey) return { ok: false, step: 'find' };

      const createRes = await fetch(`${args.api}/intake/survey_responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ survey_id: survey.id, is_confidential: false }),
      });
      if (!createRes.ok) return { ok: false, step: 'create', status: createRes.status };
      const draft = await createRes.json();

      const answersRes = await fetch(`${args.api}/intake/survey_responses/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ answers: args.answers, survey_id: survey.id }),
      });
      if (!answersRes.ok) return { ok: false, step: 'answers', status: answersRes.status };

      const submitRes = await fetch(`${args.api}/intake/survey_responses/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([{ op: 'replace', path: '/status', value: 'submitted' }]),
      });
      if (!submitRes.ok) return { ok: false, step: 'submit', status: submitRes.status };
      return { ok: true, id: draft.id as string };
    },
    { api: apiUrl, surveyName: opts.surveyName, answers: opts.answers },
  );

  if (!result.ok) {
    throw new Error(
      `Failed to seed a submitted survey_response for "${opts.surveyName}": ${JSON.stringify(result)}`,
    );
  }

  if (opts.status && opts.status !== 'submitted') {
    await setTriageResponseStatus(page, apiUrl, result.id, opts.status);
  }

  return { id: result.id, surveyName: opts.surveyName };
}

// SEM@6a2f9c1b3e5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a: patch a survey response's triage status via the reviewer API (mutates shared state)
async function setTriageResponseStatus(
  page: Page,
  apiUrl: string,
  responseId: string,
  status: string,
): Promise<void> {
  const result = await page.evaluate(
    async (args: { api: string; id: string; status: string }) => {
      const res = await fetch(`${args.api}/triage/survey_responses/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json-patch+json' },
        credentials: 'include',
        body: JSON.stringify([{ op: 'replace', path: '/status', value: args.status }]),
      });
      return { ok: res.ok, status: res.status };
    },
    { api: apiUrl, id: responseId, status },
  );
  if (!result.ok) {
    throw new Error(
      `Failed to set survey_response ${responseId} status to "${status}": HTTP ${result.status}`,
    );
  }
}

// SEM@6a2f9c1b3e5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a: fetch a survey response's current triage status via the reviewer API (pure)
async function fetchTriageResponseStatus(
  page: Page,
  apiUrl: string,
  responseId: string,
): Promise<string | null> {
  return page.evaluate(
    async (args: { api: string; id: string }) => {
      const res = await fetch(`${args.api}/triage/survey_responses/${args.id}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      const body = await res.json();
      return (body.status as string) ?? null;
    },
    { api: apiUrl, id: responseId },
  );
}

type CreateTmResult = { ok: true; id: string } | { ok: false; status: number };

// SEM@6a2f9c1b3e5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a: create a threat model with no assigned reviewer via the API, guaranteeing a row in the assignment queue (mutates shared state)
async function createUnassignedThreatModel(
  page: Page,
  apiUrl: string,
  name: string,
): Promise<string> {
  const result: CreateTmResult = await page.evaluate(
    async (args: { api: string; name: string }) => {
      const res = await fetch(`${args.api}/threat_models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: args.name }),
      });
      if (!res.ok) return { ok: false, status: res.status };
      const body = await res.json();
      return { ok: true, id: body.id as string };
    },
    { api: apiUrl, name },
  );
  if (!result.ok) {
    throw new Error(`Failed to create seed threat model "${name}": HTTP ${result.status}`);
  }
  return result.id;
}

// SEM@6a2f9c1b3e5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a: fetch a threat model via the API to read back its security_reviewer (pure)
async function fetchThreatModel(
  page: Page,
  apiUrl: string,
  id: string,
): Promise<{ security_reviewer?: unknown } | null> {
  return page.evaluate(
    async (args: { api: string; id: string }) => {
      const res = await fetch(`${args.api}/threat_models/${args.id}`, {
        credentials: 'include',
      });
      if (!res.ok) return null;
      return res.json();
    },
    { api: apiUrl, id },
  );
}

test.describe.serial('Triage Workflows', () => {
  test.setTimeout(60000);

  const apiUrl = testConfig.apiUrl;
  const seedSuffix = Date.now();

  let context: BrowserContext;
  let page: Page;
  let triageFlow: TriageFlow;
  let detailFlow: TriageDetailFlow;
  let assignmentFlow: ReviewerAssignmentFlow;
  let triagePage: TriagePage;
  let detailPage: TriageDetailPage;
  let assignmentPage: ReviewerAssignmentPage;

  // Seeded, independently-identifiable response. Tests act on it by id
  // instead of on `.first()` from the shared, unscoped triage queue. Two
  // further responses (a different template, a different status) are
  // seeded in beforeAll purely so the filter test has a known row to
  // exclude — their ids aren't otherwise referenced.
  let seedSubmitted: SeededResponse;

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

    // Seed responses from a logged-in origin so same-site cookies are
    // available to fetch.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    seedSubmitted = await seedSurveyResponse(page, apiUrl, {
      surveyName: 'Simple Workflow Survey',
      answers: {
        system_name: `E2E Triage Seed Submitted ${seedSuffix}`,
        review_reason: 'Automated triage test seed',
        urgency: 'medium',
      },
    });
    await seedSurveyResponse(page, apiUrl, {
      surveyName: 'Kitchen Sink Survey',
      answers: { project_name: `E2E Triage Seed Kitchen Sink ${seedSuffix}` },
    });
    await seedSurveyResponse(page, apiUrl, {
      surveyName: 'Simple Workflow Survey',
      answers: {
        system_name: `E2E Triage Seed Revision ${seedSuffix}`,
        review_reason: 'Automated triage test seed',
        urgency: 'low',
      },
      status: 'needs_revision',
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('triage list filters', async () => {
    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    const submittedRow = triagePage
      .responseRows()
      .filter({ hasText: 'Simple Workflow Survey' })
      .filter({ hasText: 'Submitted' });
    const needsRevisionRow = triagePage.responseRows().filter({ hasText: 'Needs revision' });
    const kitchenSinkRow = triagePage.responseRows().filter({ hasText: 'Kitchen Sink Survey' });

    // Default filter (status = Submitted) shows submitted responses and
    // hides the needs-revision seed.
    await expect(submittedRow.first()).toBeVisible({ timeout: 10000 });
    await expect(needsRevisionRow).toHaveCount(0);

    // Status filter: switching to "Needs revision" flips which rows show.
    await triageFlow.setStatusFilter(['Needs revision']);
    await expect(needsRevisionRow.first()).toBeVisible({ timeout: 10000 });
    await expect(submittedRow).toHaveCount(0);

    // Restore the submitted-only view before checking the template filter,
    // so each filter is exercised from a known baseline.
    await triageFlow.setStatusFilter(['Submitted']);
    await expect(submittedRow.first()).toBeVisible({ timeout: 10000 });

    // Template filter: narrowing to "Simple Workflow Survey" hides the
    // Kitchen Sink seed.
    await triageFlow.filterByTemplate('Simple Workflow Survey');
    await expect(submittedRow.first()).toBeVisible({ timeout: 10000 });
    await expect(kitchenSinkRow).toHaveCount(0);

    // Submitter/survey search: narrowing to "Kitchen Sink" should show that
    // seed and hide the Simple Workflow one.
    await triageFlow.clearFilters();
    await triageFlow.searchByName('Kitchen Sink');
    await expect(kitchenSinkRow.first()).toBeVisible({ timeout: 10000 });
    await expect(submittedRow).toHaveCount(0);

    // Clear filters: both submitted-status seeds are visible again.
    await triageFlow.clearFilters();
    await expect(submittedRow.first()).toBeVisible({ timeout: 10000 });
    await expect(kitchenSinkRow.first()).toBeVisible({ timeout: 10000 });
  });

  test('view response detail', async () => {
    await page.goto(`/triage/${seedSubmitted.id}`);
    await page.waitForLoadState('networkidle');

    // Verify detail page loads with expected data. The triage detail page
    // does not currently render an expandable "Responses" section with
    // testids — assert only what the current UI exposes.
    await expect(detailPage.submitter()).toBeVisible();
    await expect(detailPage.status()).toBeVisible();
  });

  test('return for revision', async () => {
    await page.goto(`/triage/${seedSubmitted.id}`);
    await page.waitForLoadState('networkidle');

    await detailFlow.returnForRevision('Please provide more detail about the architecture');

    // Verify status changed to needs_revision in the UI and via an
    // independent API read-back.
    await expect(detailPage.status()).toContainText(/revision/i, {
      timeout: 10000,
    });
    await expect
      .poll(() => fetchTriageResponseStatus(page, apiUrl, seedSubmitted.id), {
        message: `expected survey_response ${seedSubmitted.id} to reach needs-revision`,
        timeout: 10000,
      })
      .toMatch(/revision/i);
  });

  test('triage notes', async () => {
    await page.goto(`/triage/${seedSubmitted.id}`);
    await page.waitForLoadState('networkidle');

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
    // Seed a threat model with no reviewer assigned and status != closed, so
    // the Unassigned Reviews tab always has a deterministic row to act on.
    const tmName = `E2E Assignment Seed ${Date.now()}`;
    const tmId = await createUnassignedThreatModel(page, apiUrl, tmName);

    await page.goto('/triage');
    await page.waitForLoadState('networkidle');

    await assignmentFlow.switchToAssignmentTab();
    await page.waitForLoadState('networkidle').catch(() => {});

    // If the assignment list API returns 403, the whole tab shows an
    // "Unauthorized Access" card — test-reviewer does not reliably have
    // permission on every server config. Skip explicitly (visible as
    // skipped, not a silent pass) rather than returning.
    const forbidden = page.getByText(/Unauthorized Access|403 Forbidden/i);
    const isForbidden = await forbidden
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    test.skip(
      isForbidden || /forbidden|error|unauthorized/i.test(page.url()),
      'test-reviewer is not authorized for reviewer assignment in this environment',
    );

    const row = assignmentPage.tmRow(tmName);
    await expect(row).toBeVisible({ timeout: 15000 });

    await assignmentFlow.assignToMe(tmName);

    // The row must drop out of the *unassigned* list once assigned...
    await expect(row).toHaveCount(0, { timeout: 10000 });

    // ...and an independent API read-back must confirm a reviewer landed.
    await expect
      .poll(
        async () => {
          const tm = await fetchThreatModel(page, apiUrl, tmId);
          return tm?.security_reviewer ?? null;
        },
        {
          message: `expected threat model ${tmId} to have a security_reviewer assigned`,
          timeout: 10000,
        },
      )
      .toBeTruthy();
  });
});
