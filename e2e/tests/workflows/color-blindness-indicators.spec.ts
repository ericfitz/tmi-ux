import { reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { assertColorIndependentIndicators } from '../../helpers/accessibility';

// === Color-Blindness Indicator Differentiation ===
//
// Under light-colorblind and dark-colorblind theme modes, verifies that
// status / severity / priority / CVSS / admin-marker indicators remain
// distinguishable without relying on color alone: each matched element
// must carry a mat-icon or non-whitespace text content.

const SEEDED_TM = 'Seed TM - Full Fields';

reviewerTest.describe('Color-blindness indicator differentiation — reviewer', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('dashboard — TM cards convey status via text', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');

    await assertColorIndependentIndicators(reviewerPage, [
      '[data-testid="threat-model-card"] .threat-model-status',
    ]);
  });

  reviewerTest('tm edit — severity and status badges are text-bearing', async ({
    reviewerPage,
  }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await new DashboardPage(reviewerPage).tmCard(SEEDED_TM).first().click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Expand the threats panel if collapsed — the seed TM has threats
    const threatsPanel = reviewerPage
      .locator('mat-expansion-panel')
      .filter({ hasText: /Threats/i })
      .first();
    if (await threatsPanel.count()) {
      const expanded = await threatsPanel.getAttribute('aria-expanded');
      if (expanded !== 'true') {
        await threatsPanel.locator('mat-expansion-panel-header').click();
        await reviewerPage.waitForTimeout(300);
      }
    }

    await assertColorIndependentIndicators(reviewerPage, [
      '.severity-badge',
      '.status-badge',
    ]);
  });

  reviewerTest('triage — response status chips bear localized text', async ({
    reviewerPage,
  }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    await assertColorIndependentIndicators(reviewerPage, ['table mat-chip']);
  });
});

adminTest.describe('Color-blindness indicator differentiation — admin', () => {
  adminTest.setTimeout(60000);

  adminTest('admin users — admin marker carries icon and text', async ({ adminPage }) => {
    await adminPage.goto('/admin/users');
    await adminPage.waitForLoadState('networkidle');

    await assertColorIndependentIndicators(adminPage, ['.admin-badge']);
  });
});
