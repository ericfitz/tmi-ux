import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { CreateTmDialog } from '../dialogs/create-tm.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { testConfig } from '../config/test.config';

// SEM@13b76c5ab4901ec8f70a703f94076e186a33c951: E2E page-object facade orchestrating threat model CRUD flows
export class ThreatModelFlow {
  private dashboardPage: DashboardPage;
  private tmEditPage: TmEditPage;
  private createTmDialog: CreateTmDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: build all page-object and dialog handles for the threat model flow (pure)
  constructor(private page: Page) {
    this.dashboardPage = new DashboardPage(page);
    this.tmEditPage = new TmEditPage(page);
    this.createTmDialog = new CreateTmDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  // SEM@317e7eace5680fd59d8903cf838f9255699f65b7: build a threat model from the dashboard and navigate to the edit page
  async createFromDashboard(name: string) {
    await this.page.goto('/dashboard');
    await this.dashboardPage.waitForReady();
    await this.dashboardPage.createTmButton().click();
    await this.createTmDialog.fillName(name);
    await this.createTmDialog.submit();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: navigate to a threat model's edit page by clicking its dashboard card
  async openFromDashboard(name: string) {
    await this.dashboardPage.tmCard(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  // SEM@24593ac1fd9e4021fa8762c985f77832560c8ebb: delete a threat model via the dashboard delete button and confirm dialog
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
   *
   * Throws if the TM could not be found or the DELETE did not succeed.
   * Cleanup used to be entirely silent, and leaked threat models are not a
   * harmless nuisance: they accumulate on the dashboard until the seeded TM
   * that field-coverage looks for is pushed off the first page, at which
   * point unrelated specs start failing in ways that look like product bugs.
   * A local run reached 78 leaked TMs against 3 real ones before this was
   * caught. Callers that genuinely want best-effort cleanup should catch.
   */
  // SEM@13b76c5ab4901ec8f70a703f94076e186a33c951: delete a threat model by name using the authenticated browser fetch API
  async deleteByNameViaApi(name: string): Promise<void> {
    const result = await this.page.evaluate(
      async ({ tmName, apiUrl }: { tmName: string; apiUrl: string }) => {
        const listResp = await fetch(
          `${apiUrl}/threat_models?limit=100&name=${encodeURIComponent(tmName)}`,
          { credentials: 'include' },
        );
        if (!listResp.ok) {
          return { ok: false, reason: `list returned ${listResp.status}` };
        }
        const list = (await listResp.json()) as { threat_models?: { id: string; name: string }[] };
        const matches = (list.threat_models || []).filter(tm => tm.name === tmName);
        if (matches.length === 0) {
          return { ok: false, reason: 'no threat model matched the name' };
        }
        for (const tm of matches) {
          const delResp = await fetch(`${apiUrl}/threat_models/${tm.id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          if (!delResp.ok) {
            return { ok: false, reason: `DELETE ${tm.id} returned ${delResp.status}` };
          }
        }
        return { ok: true, reason: '' };
      },
      { tmName: name, apiUrl: testConfig.apiUrl },
    );

    if (!result.ok) {
      throw new Error(`Failed to clean up threat model "${name}": ${result.reason}`);
    }
  }
}
