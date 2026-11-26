import { expect, Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/** Extracts the response id from a /intake/fill/<surveyId>/<responseId> URL. */
export function draftIdFromFillUrl(url: string): string {
  const match = /\/intake\/fill\/[^/]+\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`not a survey fill URL: ${url}`);
  return match[1];
}

/**
 * Deletes a survey response (draft or submitted) and asserts the delete
 * succeeded. A 404 counts as success, so after-hooks can call it for a response
 * that a failed test never got far enough to create.
 *
 * Starting a survey creates a draft on page load. Drafts and responses left
 * behind show up on the survey list ("Your drafts") and in my-responses, which
 * breaks the visual baselines for those pages, so every spec that starts a
 * survey must delete what it created. The server lets the response owner delete
 * it whatever its status.
 */
export async function deleteSurveyResponseViaApi(page: Page, id: string): Promise<void> {
  const status = await page.evaluate(
    async ({ api, responseId }) => {
      const res = await fetch(`${api}/intake/survey_responses/${responseId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return res.status;
    },
    { api: testConfig.apiUrl, responseId: id },
  );
  expect(
    status === 204 || status === 404,
    `cleanup: deleting survey response ${id} returned ${status}`,
  ).toBe(true);
}

/**
 * Force-deletes every survey with this exact name, together with its responses,
 * and asserts each delete succeeded. Finding none is success. Needs an admin
 * session on `page`.
 *
 * The admin UI's delete never passes `force`, and the server refuses (409) to
 * delete a survey that still has responses, so UI cleanup cannot remove a
 * survey a test has filled in.
 */
export async function forceDeleteSurveyByNameViaApi(page: Page, name: string): Promise<void> {
  const result = await page.evaluate(
    async ({ api, surveyName }) => {
      const ids: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const res = await fetch(`${api}/admin/surveys?limit=100&offset=${offset}`, {
          credentials: 'include',
        });
        if (!res.ok) return `list returned ${res.status}`;
        const body = (await res.json()) as {
          surveys?: { id: string; name: string }[];
          total?: number;
        };
        const surveys = body.surveys ?? [];
        ids.push(...surveys.filter(s => s.name === surveyName).map(s => s.id));
        if (surveys.length === 0 || offset + surveys.length >= (body.total ?? 0)) break;
      }
      for (const id of ids) {
        const res = await fetch(`${api}/admin/surveys/${id}?force=true`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.status !== 204 && res.status !== 404) return `DELETE ${id} returned ${res.status}`;
      }
      return '';
    },
    { api: testConfig.apiUrl, surveyName: name },
  );
  expect(result, `cleanup: force-deleting survey "${name}"`).toBe('');
}
