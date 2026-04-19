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
}
