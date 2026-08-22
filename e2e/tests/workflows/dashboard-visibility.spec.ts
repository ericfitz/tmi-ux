import { expect } from '@playwright/test';
import { userTest, reviewerTest, outsiderTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';

/**
 * Who sees which threat models on the dashboard, asserted positively and
 * negatively.
 *
 * The dashboard opens with a role-specific identity filter already applied
 * (`computeDefaultFilters`, dashboard-filter.model.ts): security reviewers get
 * `securityReviewer = <their email>`, everyone else gets `owner = <their
 * email>`. That default is the "only mine" view, and it is the reason a test
 * that simply loads /dashboard and looks for a seeded threat model can fail
 * even though the data and the grants are both correct.
 *
 * The seed is arranged so a single threat model exercises both roles:
 * `Seed TM - Full Fields` is owned by `test-user` (not a reviewer) and has
 * `test-reviewer` as its security reviewer, so it satisfies each role's
 * default filter. `test-outsider` owns nothing and is granted nothing, which
 * makes the negative case meaningful rather than vacuous.
 */

const SEEDED_TM = 'Seed TM - Full Fields';

/**
 * Navigate to the dashboard and return the server's threat-model listing.
 *
 * A "sees nothing" assertion is worthless on its own: an empty dashboard looks
 * identical whether the user genuinely has no access or the API call failed —
 * and the dev port-forward does drop connections, so that is a live risk, not a
 * hypothetical one. Both empty states in dashboard.component.html render on
 * error too, so the UI cannot be used as its own control. Asserting the
 * response is ok() proves the server answered, and its `total` proves what it
 * answered with.
 */
async function gotoDashboardAndCaptureListing(
  page: import('@playwright/test').Page,
): Promise<{ total: number; names: string[] }> {
  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/threat_models?') && r.request().method() === 'GET',
      { timeout: 20000 },
    ),
    page.goto('/dashboard'),
  ]);

  expect(response.ok(), `GET /threat_models returned ${response.status()}`).toBeTruthy();

  const body = (await response.json()) as {
    threat_models: { name: string }[];
    total: number;
  };
  return { total: body.total, names: body.threat_models.map(t => t.name) };
}

reviewerTest.describe('Dashboard visibility — security reviewer', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest(
    'sees assigned models by default, and more once the filter is cleared',
    async ({ reviewerPage }) => {
      const dashboard = new DashboardPage(reviewerPage);
      const scoped = await gotoDashboardAndCaptureListing(reviewerPage);
      await dashboard.waitForReady();

      // Default view is scoped to models this reviewer is assigned to.
      await expect(dashboard.securityReviewerFilter()).toHaveValue('test-reviewer@tmi.local');
      expect(scoped.names).toContain(SEEDED_TM);
      await expect(dashboard.tmCard(SEEDED_TM).first()).toBeVisible({ timeout: 10000 });

      const scopedCount = await dashboard.tmCards().count();
      expect(scopedCount).toBeGreaterThan(0);

      // Clearing the "only mine" filter must not lose anything it was showing,
      // and may reveal models assigned to other reviewers.
      await dashboard.securityReviewerFilter().fill('');
      await expect(dashboard.securityReviewerFilter()).toHaveValue('');
      await expect(dashboard.tmCard(SEEDED_TM).first()).toBeVisible({ timeout: 10000 });
      expect(await dashboard.tmCards().count()).toBeGreaterThanOrEqual(scopedCount);
    },
  );
});

userTest.describe('Dashboard visibility — non-reviewer who owns a model', () => {
  userTest.setTimeout(60000);

  userTest('sees the model they own under the default owner filter', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const listing = await gotoDashboardAndCaptureListing(userPage);
    await dashboard.waitForReady();

    // A non-reviewer gets the owner filter, pre-filled with their own address.
    await expect(dashboard.ownerFilter()).toHaveValue('test-user@tmi.local');
    expect(listing.names).toContain(SEEDED_TM);

    // test-user owns the seeded model, so the default view already shows it —
    // no filter clearing required.
    await expect(dashboard.tmCard(SEEDED_TM).first()).toBeVisible({ timeout: 10000 });
  });
});

outsiderTest.describe('Dashboard visibility — non-reviewer who owns nothing', () => {
  outsiderTest.setTimeout(60000);

  outsiderTest('sees no threat models', async ({ outsiderPage }) => {
    const dashboard = new DashboardPage(outsiderPage);
    const listing = await gotoDashboardAndCaptureListing(outsiderPage);
    await dashboard.waitForReady();

    // The server answered, and it answered with nothing for this user.
    expect(listing.total).toBe(0);
    expect(listing.names).toEqual([]);

    await expect(dashboard.ownerFilter()).toHaveValue('test-outsider@tmi.local');
    await expect(dashboard.tmCards()).toHaveCount(0);
  });

  outsiderTest('still sees nothing once every filter is cleared', async ({ outsiderPage }) => {
    const dashboard = new DashboardPage(outsiderPage);
    await gotoDashboardAndCaptureListing(outsiderPage);
    await dashboard.waitForReady();

    // The point of this case: an empty dashboard must be the result of having
    // no access, not merely of the default filter. Clearing the filter issues a
    // fresh request, and that request must also come back empty — otherwise the
    // seeded threat model owned by someone else would be exposed.
    const [unfiltered] = await Promise.all([
      outsiderPage.waitForResponse(
        r => r.url().includes('/threat_models?') && r.request().method() === 'GET',
        { timeout: 20000 },
      ),
      dashboard.ownerFilter().fill(''),
    ]);

    expect(unfiltered.ok(), `GET /threat_models returned ${unfiltered.status()}`).toBeTruthy();
    const body = (await unfiltered.json()) as { threat_models: { name: string }[]; total: number };
    expect(body.total).toBe(0);
    expect(body.threat_models.map(t => t.name)).not.toContain(SEEDED_TM);

    await expect(dashboard.ownerFilter()).toHaveValue('');
    await expect(dashboard.tmCard(SEEDED_TM)).toHaveCount(0);
    await expect(dashboard.tmCards()).toHaveCount(0);
  });
});
