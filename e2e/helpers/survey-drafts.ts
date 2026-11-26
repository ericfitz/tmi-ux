import { expect, Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/** Extracts the response id from a /intake/fill/<surveyId>/<responseId> URL. */
export function draftIdFromFillUrl(url: string): string {
  const match = /\/intake\/fill\/[^/]+\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`not a survey fill URL: ${url}`);
  return match[1];
}

/**
 * Deletes a draft survey response and asserts the delete succeeded.
 *
 * Starting a survey creates a draft on page load. Drafts left behind show up on
 * the survey list ("Your drafts") and in my-responses, which breaks the visual
 * baselines for those pages, so every spec that starts a survey must delete it.
 */
export async function deleteDraftViaApi(page: Page, id: string): Promise<void> {
  const ok = await page.evaluate(
    async ({ api, responseId }) => {
      const res = await fetch(`${api}/intake/survey_responses/${responseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.ok || res.status === 404;
    },
    { api: testConfig.apiUrl, responseId: id },
  );
  expect(ok, `cleanup: failed to delete draft survey response ${id}`).toBe(true);
}
