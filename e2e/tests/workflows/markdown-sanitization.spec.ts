import { expect, Page } from '@playwright/test';
import { multiRoleTest, reviewerTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { PermissionsFlow } from '../../flows/permissions.flow';
import { NoteFlow } from '../../flows/note.flow';
import { TriageDetailFlow } from '../../flows/triage-detail.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { TriageDetailPage } from '../../pages/triage-detail.page';
import { testConfig } from '../../config/test.config';
import {
  buildHostileMarkdownCases,
  hostileMarkdownContent,
  installXssFlag,
  installDialogBackstop,
  assertNoScriptExecuted,
  assertSanitizedRender,
} from '../../helpers/markdown-xss';

/**
 * Regression coverage for TMI-UX#818 / TRIAGE.md finding f001 (markdown
 * renderer.link XSS). The vulnerability is believed already fixed in
 * markdown-providers.ts (a DOMPurify SANITIZE chokepoint plus per-renderer
 * sanitization) with unit coverage in markdown-providers.spec.ts. This file
 * is the missing end-to-end guard: it proves hostile markdown persisted by
 * one identity cannot execute script when rendered through the real DOM on
 * each surface, not just that the pure sanitizer function behaves.
 *
 * If f001 were still unfixed, these tests would fail on first run — that is
 * the intended outcome for a regression guard.
 *
 * Surfaces covered: TM note (cross-role: owner persists, a writer-shared
 * reviewer renders) and triage note (same-role: see the note explaining why
 * a true cross-identity split isn't available on that surface). The chat
 * message surface (chat-messages.component.html) is NOT covered here — see
 * the skipped test at the bottom of this file for why.
 */

/**
 * Opens the details kebab menu (more_vert) in the TM edit page header.
 * Mirrors the equivalent local helper in tm-workflows.spec.ts — the kebab
 * trigger has no data-testid, so it's located by scoping to `.details-card`.
 */
async function openDetailsKebab(page: Page): Promise<void> {
  await page
    .locator('.details-card .action-buttons button')
    .filter({ has: page.locator('mat-icon:text("more_vert")') })
    .click();
}

multiRoleTest.describe('Markdown sanitization — TM note (cross-role)', () => {
  multiRoleTest.setTimeout(90000);

  let tmName: string | undefined;

  multiRoleTest.afterEach(async ({ userPage }) => {
    if (!tmName) return;
    const name = tmName;
    tmName = undefined;
    const flow = new ThreatModelFlow(userPage);
    const dashboard = new DashboardPage(userPage);
    await userPage.goto('/dashboard');
    await dashboard.waitForReady();
    await flow.deleteFromDashboard(name);
    await expect(dashboard.tmCard(name), `cleanup: failed to delete TM "${name}"`).toHaveCount(0, {
      timeout: 10000,
    });
  });

  multiRoleTest(
    'hostile markdown persisted by the owner cannot execute when a shared writer renders the note',
    async ({ userPage, reviewerPage }) => {
      const token = `${Date.now()}`;
      const cases = buildHostileMarkdownCases(token);
      const content = hostileMarkdownContent(token);
      tmName = `E2E XSS Note TM ${token}`;
      const noteName = `E2E XSS Note ${token}`;

      await installXssFlag(userPage);
      await installXssFlag(reviewerPage);
      const attackerDialogState = installDialogBackstop(userPage);
      const victimDialogState = installDialogBackstop(reviewerPage);

      // Attacker (owner): create the TM, share it with the victim, and
      // persist hostile markdown into a note.
      const attackerTmFlow = new ThreatModelFlow(userPage);
      const attackerNoteFlow = new NoteFlow(userPage);

      await attackerTmFlow.createFromDashboard(tmName);

      await openDetailsKebab(userPage);
      await userPage.getByTestId('tm-permissions-button').click();
      const permissionsFlow = new PermissionsFlow(userPage);
      await permissionsFlow.addPermission('user', 'TMI', 'test-reviewer', 'writer');
      await permissionsFlow.saveAndClose();

      await attackerNoteFlow.createFromTmEdit(noteName, content);

      // Victim (shared writer): open the TM the attacker shared and render
      // the note the attacker authored.
      const victimDashboard = new DashboardPage(reviewerPage);
      await reviewerPage.goto('/dashboard');
      await victimDashboard.waitForReady();
      // The reviewer dashboard auto-applies a securityReviewer filter that
      // can hide a just-shared TM with no reviewer assigned.
      await victimDashboard.clearFiltersButton().click();
      await victimDashboard.tmCard(tmName).waitFor({ state: 'visible', timeout: 10000 });
      await victimDashboard.tmCard(tmName).click();
      await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      const victimNoteFlow = new NoteFlow(reviewerPage);
      await victimNoteFlow.openFromTmEdit(noteName);

      // The note page auto-selects preview mode whenever a note has
      // existing content (see NotePageComponent.populateForm), so the
      // markdown renders immediately without an explicit toggle click.
      const preview = reviewerPage.locator('.note-page-container .markdown-preview');
      await preview.waitFor({ state: 'visible', timeout: 10000 });

      await assertSanitizedRender(preview, cases);
      await assertNoScriptExecuted(userPage, attackerDialogState);
      await assertNoScriptExecuted(reviewerPage, victimDialogState);
    },
  );
});

/**
 * Creates and submits a survey response against the "Simple Workflow
 * Survey" seed fixture so the triage detail page has something to attach a
 * note to. Mirrors the pattern in triage-workflows.spec.ts, but (per this
 * suite's house rules) asserts its own cleanup instead of leaving the
 * response behind — see the afterEach below.
 */
async function seedSubmittedResponse(page: Page): Promise<string> {
  const apiUrl = testConfig.apiUrl;
  return page.evaluate(async api => {
    const listRes = await fetch(`${api}/intake/surveys?limit=100`, { credentials: 'include' });
    if (!listRes.ok) throw new Error(`list surveys failed: ${listRes.status}`);
    const list = (await listRes.json()) as { surveys?: { id: string; name: string }[] };
    const survey = (list.surveys || []).find(s => s.name === 'Simple Workflow Survey');
    if (!survey) throw new Error('seed survey "Simple Workflow Survey" not found');

    const createRes = await fetch(`${api}/intake/survey_responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ survey_id: survey.id, is_confidential: false }),
    });
    if (!createRes.ok) throw new Error(`create response failed: ${createRes.status}`);
    const draft = (await createRes.json()) as { id: string };

    const answersRes = await fetch(`${api}/intake/survey_responses/${draft.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        answers: {
          system_name: 'E2E Markdown XSS Seed',
          review_reason: 'Automated markdown sanitization test seed',
          urgency: 'medium',
        },
        survey_id: survey.id,
      }),
    });
    if (!answersRes.ok) throw new Error(`answers failed: ${answersRes.status}`);

    const submitRes = await fetch(`${api}/intake/survey_responses/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      credentials: 'include',
      body: JSON.stringify([{ op: 'replace', path: '/status', value: 'submitted' }]),
    });
    if (!submitRes.ok) throw new Error(`submit failed: ${submitRes.status}`);

    return draft.id;
  }, apiUrl);
}

/** Deletes a seeded survey response and asserts the delete succeeded. */
async function deleteResponseViaApi(page: Page, id: string): Promise<void> {
  const apiUrl = testConfig.apiUrl;
  const ok = await page.evaluate(
    async ({ api, responseId }) => {
      const res = await fetch(`${api}/intake/survey_responses/${responseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok || res.status === 404;
    },
    { api: apiUrl, responseId: id },
  );
  expect(ok, `cleanup: failed to delete seeded survey response ${id}`).toBe(true);
}

reviewerTest.describe('Markdown sanitization — triage note', () => {
  reviewerTest.setTimeout(60000);

  let responseId: string | undefined;

  reviewerTest.afterEach(async ({ reviewerPage }) => {
    if (!responseId) return;
    const id = responseId;
    responseId = undefined;
    await deleteResponseViaApi(reviewerPage, id);
  });

  reviewerTest(
    'hostile markdown persisted in a triage note cannot execute on a fresh re-render',
    async ({ reviewerPage }) => {
      // Triage notes are a reviewer-only artifact scoped to a single survey
      // response, and this suite's seeded accounts include exactly one
      // reviewer — there is no second identity available to open the note
      // as a different "victim". This covers the surface same-role instead:
      // the note is persisted to the server, the page is reloaded (a fresh
      // navigation, discarding any in-memory component state left over from
      // authoring), and the same reviewer reopens it. That still proves
      // sanitization runs on server-fetched content at render time, which is
      // the property this regression guard cares about — it just can't also
      // exercise the authorization boundary the TM note test above covers.
      const token = `${Date.now()}`;
      const cases = buildHostileMarkdownCases(token);
      const content = hostileMarkdownContent(token);
      const noteName = `E2E XSS Triage Note ${token}`;

      await installXssFlag(reviewerPage);
      const dialogState = installDialogBackstop(reviewerPage);

      responseId = await seedSubmittedResponse(reviewerPage);

      const detailFlow = new TriageDetailFlow(reviewerPage);
      const detailPage = new TriageDetailPage(reviewerPage);

      await reviewerPage.goto(`/triage/${responseId}`);
      await detailPage.status().waitFor({ state: 'visible', timeout: 10000 });

      await detailFlow.addNote(noteName, content);
      await expect(detailPage.noteRow(noteName)).toBeVisible({ timeout: 10000 });

      await reviewerPage.reload();
      await detailPage.status().waitFor({ state: 'visible', timeout: 10000 });
      await detailFlow.viewNote(noteName);

      const dialog = reviewerPage.locator('mat-dialog-container');
      const preview = dialog.locator('.markdown-preview');
      await preview.waitFor({ state: 'visible', timeout: 10000 });

      await assertSanitizedRender(preview, cases);
      await assertNoScriptExecuted(reviewerPage, dialogState);

      await dialog.getByTestId('triage-note-cancel-button').click();
      await dialog.waitFor({ state: 'hidden' });
    },
  );
});

reviewerTest.describe('Markdown sanitization — chat message (not covered)', () => {
  reviewerTest('chat message markdown rendering is not covered by this suite', () => {
    // Deliberately not silently dropped — documenting why instead.
    //
    // chat-messages.component.html only runs attacker-shaped markdown
    // through the <markdown> renderer for role === 'assistant' messages.
    // Those are LLM-generated: a user cannot directly author the content
    // of an assistant bubble, so the "attacker persists, victim renders"
    // shape this file exercises for TM notes and triage notes doesn't
    // apply to chat the same way, and getting an LLM to reliably echo an
    // exact payload back is not a deterministic regression test.
    //
    // Separately, this suite has no chat/Timmy e2e infrastructure yet
    // (no ChatPage, no flow) — that infrastructure, plus the LLM
    // credentials or canned-response mode it would need, is scoped to
    // journey scenario S-J13-1 in
    // docs/superpowers/specs/2026-07-31-integration-test-scenarios.json,
    // which itself flags "the e2e server has LLM credentials or a
    // deterministic canned mode" as an open, unconfirmed assumption.
    // Building that infrastructure here would be scope creep beyond this
    // issue's regression guard.
    //
    // chat-messages.component.html renders through the exact same
    // ngx-markdown + sanitizeMarkdownHtml pipeline (provideMarkdownConfig)
    // proven end-to-end on two other surfaces in this file, so the
    // sanitizer itself is not going untested — only the wiring on this
    // one DOM surface is unverified by an automated test.
    reviewerTest.skip(
      true,
      'chat markdown surface requires new chat e2e infra + LLM credentials (S-J13-1); see comment above',
    );
  });
});
