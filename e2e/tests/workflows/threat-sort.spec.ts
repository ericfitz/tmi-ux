import { expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';

/** Matches the threats list request for any threat model. */
const isThreatList = (r: Request): boolean =>
  r.method() === 'GET' && /\/threat_models\/[a-f0-9-]+\/threats\?/.test(r.url());

/** Returns the `sort` param of the next threats list request triggered by `action`. */
async function sortParamAfter(page: Page, action: () => Promise<unknown>): Promise<string | null> {
  const [request] = await Promise.all([page.waitForRequest(isThreatList), action()]);
  return new URL(request.url()).searchParams.get('sort');
}

// Asserts on the outgoing request, so it needs no threats of mixed severity.
userTest.describe('Threat list sorting (#945)', () => {
  userTest.setTimeout(30000);

  userTest('opens most-severe first and never drops the sort param', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const testName = `E2E Threat Sort ${Date.now()}`;
    let created = false;
    try {
      const initial = await sortParamAfter(userPage, async () => {
        await tmFlow.createFromDashboard(testName);
        created = true;
      });
      expect(initial).toBe('severity:desc');

      const header = userPage.locator('.threats-table th.column-severity');
      const sorts: (string | null)[] = [];
      for (let i = 0; i < 3; i++) {
        sorts.push(await sortParamAfter(userPage, () => header.click()));
      }
      expect(sorts).toEqual(['severity:asc', 'severity:desc', 'severity:asc']);
    } finally {
      // Only when creation succeeded: the cleanup throws on "not found" and would mask the real failure
      if (created) await tmFlow.deleteByNameViaApi(testName);
    }
  });
});
