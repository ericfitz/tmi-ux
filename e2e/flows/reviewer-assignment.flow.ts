import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { ReviewerAssignmentPage } from '../pages/reviewer-assignment.page';

export class ReviewerAssignmentFlow {
  private triagePage: TriagePage;
  private assignment: ReviewerAssignmentPage;

  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.assignment = new ReviewerAssignmentPage(page);
  }

  async switchToAssignmentTab() {
    // mat-tab applies the testid to the content wrapper, not the tab label.
    // Click the label by its role/name instead.
    await this.page.getByRole('tab', { name: /Unassigned Reviews/i }).click();
    await this.page.waitForTimeout(300);
  }

  async filterUnassigned() {
    await this.assignment.unassignedCheckbox().click();
    await this.page.waitForLoadState('networkidle');
  }

  async assignReviewer(tmName: string, reviewerName: string) {
    await this.assignment.reviewerSelect(tmName).click();
    await this.page.locator('mat-option').filter({ hasText: reviewerName }).click();
    await this.assignment.assignButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models/') && resp.status() < 300
    );
  }

  async assignToMe(tmName: string) {
    await this.assignment.assignMeButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models/') && resp.status() < 300
    );
  }

  async openTm(tmName: string) {
    await this.assignment.openTmButton(tmName).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
  }
}
