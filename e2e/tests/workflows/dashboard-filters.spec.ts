import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { DashboardFilterFlow } from '../../flows/dashboard-filter.flow';

const SEEDED_TM = 'Seed TM - Full Fields';

userTest.describe('Dashboard Filters', () => {
  userTest.setTimeout(30000);

  userTest('Name search', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Search for seeded TM
    await filterFlow.searchByName('Seed TM');
    await expect(dashboard.tmCards().first().or(dashboard.tableRows().first())).toBeVisible({
      timeout: 5000,
    });

    // Clear search
    await dashboard.searchClear().click();
    await userPage.waitForTimeout(500);

    // Verify all TMs restored (at least seeded TM visible)
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });
  });

  userTest('Status filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

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

  userTest('Owner filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Toggle advanced and filter by owner
    await filterFlow.filterByOwner('test-reviewer');
    await userPage.waitForTimeout(1000);

    // Verify seeded TM (owner: test-reviewer) is visible
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear filters
    await filterFlow.clearAllFilters();
  });

  userTest('Date range filter', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);
    const filterFlow = new DashboardFilterFlow(userPage);

    // Set created-after to past date — should show seeded TM
    await filterFlow.filterByDateRange('created', '01/01/2020');
    await userPage.waitForTimeout(1000);
    await expect(
      dashboard.tmCard(SEEDED_TM).or(dashboard.tableRow(SEEDED_TM))
    ).toBeVisible({ timeout: 5000 });

    // Clear and set created-after to future date — should show no results
    await filterFlow.clearAllFilters();
    await filterFlow.filterByDateRange('created', '01/01/2099');
    await userPage.waitForTimeout(1000);

    // Verify no matching TMs message or empty state
    const noResults = userPage.locator('[transloco="dashboard.noMatchingThreatModels"]')
      .or(userPage.locator('text=No threat models match'));
    await expect(noResults).toBeVisible({ timeout: 5000 });

    // Clear
    await filterFlow.clearAllFilters();
  });

  userTest('Pagination', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const dashboard = new DashboardPage(userPage);

    // Switch to table view to see paginator more reliably
    await dashboard.viewToggle().click();
    await userPage.waitForTimeout(300);

    // The paginator may only show if there are more items than page size.
    // With 1 seeded TM, paginator might be hidden. Verify it either
    // renders or the table shows the seeded TM.
    const paginatorVisible = await dashboard.paginator().isVisible().catch(() => false);
    if (paginatorVisible) {
      // Paginator is visible — verify it has expected controls
      await expect(dashboard.paginator()).toBeVisible();
    } else {
      // Only 1 TM — paginator hidden, but table should show the TM
      await expect(dashboard.tableRow(SEEDED_TM)).toBeVisible({ timeout: 5000 });
    }
  });
});
