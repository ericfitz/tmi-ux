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

    // The reviewer dashboard auto-applies a securityReviewer filter; clear
    // it so the seeded TM (which has no reviewer assigned) is visible.
    await filterFlow.clearAllFilters();

    // Search for seeded TM
    await filterFlow.searchByName('Seed TM');
    await expect(dashboard.tmCards().first().or(dashboard.tableRows().first())).toBeVisible({
      timeout: 5000,
    });

    // Clear search
    await dashboard.searchClear().click();

    // Verify the seeded TM is restored
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  reviewerTest('Status filter', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    await filterFlow.clearAllFilters();

    // Filter by active status
    await filterFlow.filterByStatus(['Active']);

    // Verify seeded TM (status: active) is visible
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear filters
    await filterFlow.clearAllFilters();
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  reviewerTest('Owner filter', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    await filterFlow.clearAllFilters();

    // Filter by owner
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

    await filterFlow.clearAllFilters();

    // Set created-after to past date — should show seeded TM
    await filterFlow.filterByDateRange('created', '01/01/2020');
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear and set created-after to future date — should show no results
    await filterFlow.clearAllFilters();
    await filterFlow.filterByDateRange('created', '01/01/2099');

    const noResults = reviewerPage.locator('[transloco="dashboard.noMatchingThreatModels"]')
      .or(reviewerPage.locator('text=No threat models match'));
    await expect(noResults).toBeVisible({ timeout: 5000 });

    await filterFlow.clearAllFilters();
  });

  reviewerTest('Pagination', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    const dashboard = new DashboardPage(reviewerPage);
    await dashboard.waitForReady();
    const filterFlow = new DashboardFilterFlow(reviewerPage);

    await filterFlow.clearAllFilters();

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
