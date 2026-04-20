import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { CreateTmDialog } from '../dialogs/create-tm.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class ThreatModelFlow {
  private dashboardPage: DashboardPage;
  private tmEditPage: TmEditPage;
  private createTmDialog: CreateTmDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.dashboardPage = new DashboardPage(page);
    this.tmEditPage = new TmEditPage(page);
    this.createTmDialog = new CreateTmDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromDashboard(name: string) {
    await this.page.goto('/dashboard');
    await this.dashboardPage.waitForReady();
    await this.dashboardPage.createTmButton().click();
    await this.createTmDialog.fillName(name);
    await this.createTmDialog.submit();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async openFromDashboard(name: string) {
    await this.dashboardPage.tmCard(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async deleteFromDashboard(name: string) {
    await this.dashboardPage.tmDeleteButton(name).click();
    await this.deleteConfirmDialog.confirmDeletion();
  }

  /**
   * Delete a threat model by name using the API. Does NOT rely on the
   * dashboard showing the TM — useful for afterAll cleanup under roles
   * whose default dashboard filter excludes the just-created TM (e.g.
   * a reviewer creating a TM they haven't also been assigned to review).
   *
   * Uses the browser's authenticated fetch so cookies/bearer tokens
   * flow automatically.
   */
  async deleteByNameViaApi(name: string): Promise<void> {
    await this.page.evaluate(async (tmName: string) => {
      const list = await fetch(
        `http://localhost:8080/threat_models?limit=100&name=${encodeURIComponent(tmName)}`,
        { credentials: 'include' },
      ).then(r => (r.ok ? r.json() : { threat_models: [] }));
      for (const tm of list.threat_models || []) {
        if (tm.name === tmName) {
          await fetch(`http://localhost:8080/threat_models/${tm.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        }
      }
    }, name);
  }
}
