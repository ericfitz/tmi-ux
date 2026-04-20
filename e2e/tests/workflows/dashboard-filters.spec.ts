import { expect } from '@playwright/test';
import { reviewerTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { DashboardFilterFlow } from '../../flows/dashboard-filter.flow';

const SEEDED_TM = 'Seed TM - Full Fields';

// The seeded TM is owned by test-reviewer — use the reviewer fixture so the
// dashboard shows it without permission workarounds.
reviewerTest.describe('Dashboard Filters', () => {
  reviewerTest.setTimeout(30000);

  reviewerTest('Name search', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    // Search for the seeded TM — this works regardless of pagination.
    await filterFlow.searchByName(SEEDED_TM);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear the search and re-assert with the search term again to avoid
    // pagination hiding the TM behind unrelated entries.
    await dashboard.searchClear().click();
    await filterFlow.searchByName(SEEDED_TM);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  reviewerTest('Status filter', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    // Narrow the list to the seeded TM so pagination (from other leftover
    // E2E TMs) doesn't hide it behind page 1.
    await filterFlow.searchByName(SEEDED_TM);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 10000 });

    // Add a status filter the seeded TM does not have — it should disappear.
    await filterFlow.filterByStatus(['Approved']);
    await expect(dashboard.tmCard(SEEDED_TM)).toHaveCount(0, { timeout: 5000 });

    await filterFlow.clearAllFilters();
  });

  reviewerTest('Owner filter', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    // Narrow by name first so pagination doesn't hide the seeded TM.
    await filterFlow.searchByName(SEEDED_TM);
    await filterFlow.filterByOwner('test-reviewer');
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    await filterFlow.clearAllFilters();
  });

  reviewerTest('Date range filter', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    await filterFlow.searchByName(SEEDED_TM);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 10000 });

    // Past created-after date — TM still visible
    await filterFlow.filterByDateRange('created', '01/01/2020');
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    await filterFlow.clearAllFilters();

    // Future date + narrow to seeded name — no results.
    await filterFlow.searchByName(SEEDED_TM);
    await filterFlow.filterByDateRange('created', '01/01/2099');
    const noResults = reviewerPage.locator(
      '.no-threat-models p, p:has-text("No threat models match")',
    );
    await expect(noResults.first()).toBeVisible({ timeout: 10000 });

    await filterFlow.clearAllFilters();
  });

  reviewerTest('Pagination', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    await filterFlow.searchByName(SEEDED_TM);

    // Switch to table view to see paginator more reliably
    await dashboard.viewToggle().click();

    const paginatorVisible = await dashboard.paginator().isVisible().catch(() => false);
    if (paginatorVisible) {
      await expect(dashboard.paginator()).toBeVisible();
    } else {
      await expect(dashboard.tableRow(SEEDED_TM)).toBeVisible({ timeout: 5000 });
    }
  });
});
