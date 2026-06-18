import { Page } from '@playwright/test';
import { TriagePage } from '../pages/triage.page';
import { ReviewerAssignmentPage } from '../pages/reviewer-assignment.page';

// SEM@bf6dd66ecfe72e81a0751e3d6bbef49042fb4f9f: E2E page-object flow for triage reviewer assignment actions (pure)
export class ReviewerAssignmentFlow {
  private triagePage: TriagePage;
  private assignment: ReviewerAssignmentPage;

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: initialize triage and assignment page objects for the flow (pure)
  constructor(private page: Page) {
    this.triagePage = new TriagePage(page);
    this.assignment = new ReviewerAssignmentPage(page);
  }

  // SEM@7cbd1a4a9519eb72ea7f3f46e9a76e4e192159d2: navigate to the Unassigned Reviews tab in the triage UI
  async switchToAssignmentTab() {
    // mat-tab applies the testid to the content wrapper, not the tab label.
    // Click the label by its role/name instead.
    await this.page.getByRole('tab', { name: /Unassigned Reviews/i }).click();
    await this.page.waitForTimeout(300);
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: toggle the unassigned filter checkbox and wait for list reload
  async filterUnassigned() {
    await this.assignment.unassignedCheckbox().click();
    await this.page.waitForLoadState('networkidle');
  }

  // SEM@bf6dd66ecfe72e81a0751e3d6bbef49042fb4f9f: assign a named reviewer to a threat model and await API confirmation
  async assignReviewer(tmName: string, reviewerName: string) {
    await this.assignment.reviewerSelect(tmName).click();
    await this.page.locator('mat-option').filter({ hasText: reviewerName }).click();
    await this.assignment.assignButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models/') && resp.status() < 300,
      { timeout: 10000 },
    );
  }

  // SEM@bf6dd66ecfe72e81a0751e3d6bbef49042fb4f9f: assign the current user as reviewer for a threat model via Assign Me
  async assignToMe(tmName: string) {
    await this.assignment.assignMeButton(tmName).click();
    await this.page.waitForResponse(
      (resp) => resp.url().includes('/threat_models/') && resp.status() < 300,
      { timeout: 10000 },
    );
  }

  // SEM@8697500456874c624d6100bf8ef5713b83d84248: navigate to a threat model edit page from the assignment list
  async openTm(tmName: string) {
    await this.assignment.openTmButton(tmName).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
  }
}
