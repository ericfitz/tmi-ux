import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { angularFill } from '../helpers/angular-fill';

export class DashboardFilterFlow {
  private dashboardPage: DashboardPage;

  constructor(private page: Page) {
    this.dashboardPage = new DashboardPage(page);
  }

  async searchByName(term: string) {
    await angularFill(this.dashboardPage.searchInput(), term);
    await this.page.waitForTimeout(500);
  }

  async filterByStatus(statuses: string[]) {
    await this.dashboardPage.statusFilter().click();
    for (const status of statuses) {
      await this.page.locator('mat-option').filter({ hasText: status }).click();
    }
    // Close the multi-select overlay by clicking outside
    await this.page.locator('.cdk-overlay-backdrop').click();
    await this.page.waitForTimeout(500);
  }

  async filterByOwner(owner: string) {
    await this.toggleAdvancedFilters();
    await angularFill(this.dashboardPage.ownerFilter(), owner);
    await this.page.waitForTimeout(500);
  }

  async filterByDateRange(
    field: 'created' | 'modified',
    after?: string,
    before?: string,
  ) {
    await this.toggleAdvancedFilters();
    if (after) {
      const locator =
        field === 'created'
          ? this.dashboardPage.createdAfter()
          : this.dashboardPage.modifiedAfter();
      await angularFill(locator, after);
    }
    if (before) {
      const locator =
        field === 'created'
          ? this.dashboardPage.createdBefore()
          : this.dashboardPage.modifiedBefore();
      await angularFill(locator, before);
    }
    await this.page.waitForTimeout(500);
  }

  async clearAllFilters() {
    await this.dashboardPage.clearFiltersButton().click();
    await this.page.waitForTimeout(500);
  }

  async toggleAdvancedFilters() {
    // Only toggle if not already visible
    const isVisible = await this.dashboardPage
      .descriptionFilter()
      .isVisible()
      .catch(() => false);
    if (!isVisible) {
      await this.dashboardPage.moreFiltersButton().click();
      await this.page.waitForTimeout(300);
    }
  }
}
