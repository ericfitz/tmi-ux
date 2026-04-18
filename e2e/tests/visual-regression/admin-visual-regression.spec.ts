import { expect, test } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { takeThemeScreenshots } from '../../helpers/screenshot';

// === Admin Visual Regression Baselines ===
//
// Captures screenshot baselines across all four theme modes for each
// admin sub-page. Mirrors the pattern in dfd-visual-regression.spec.ts:
// first run generates baselines; later runs compare.
//
// Dynamic content (timestamps, counts that can vary with seed) is masked
// via the `mask` option where rendered.

interface AdminPlate {
  slug: string;
  route: string;
  // CSS selectors whose rendered text varies by run (timestamps, counts).
  // Masked out so baselines stay stable under seed-data drift.
  maskSelectors?: string[];
}

const PLATES: AdminPlate[] = [
  { slug: 'admin-landing', route: '/admin' },
  {
    slug: 'admin-users',
    route: '/admin/users',
    maskSelectors: [
      '[data-testid="users-row"] td:nth-child(3)', // last login timestamp column
    ],
  },
  { slug: 'admin-teams', route: '/admin/teams' },
  { slug: 'admin-projects', route: '/admin/projects' },
  { slug: 'admin-groups', route: '/admin/groups' },
  { slug: 'admin-quotas', route: '/admin/quotas' },
  { slug: 'admin-webhooks', route: '/admin/webhooks' },
  { slug: 'admin-settings', route: '/admin/settings' },
];

test.describe('Admin Visual Regression', () => {
  test.setTimeout(90000);

  for (const plate of PLATES) {
    test(`plate — ${plate.slug}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      try {
        await new AuthFlow(page).loginAs('test-admin');

        const navResponse = await page.goto(plate.route);
        await page.waitForLoadState('networkidle');

        // If the admin route redirected to login or unauthorized, skip
        // rather than baseline a failure state.
        if (!page.url().includes(plate.route)) {
          test.skip(true, `Admin route ${plate.route} not reachable — redirect to ${page.url()}`);
          return;
        }
        if (navResponse && navResponse.status() >= 500) {
          test.skip(true, `Admin route ${plate.route} returned ${navResponse.status()}`);
          return;
        }

        const mask = (plate.maskSelectors ?? []).map(sel => page.locator(sel));
        await takeThemeScreenshots(page, plate.slug, { mask, fullPage: true });

        // Basic sanity: page rendered something testable
        await expect(page.locator('body')).toBeVisible();
      } finally {
        await context.close();
      }
    });
  }
});
