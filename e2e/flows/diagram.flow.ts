import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { DfdEditorPage } from '../pages/dfd-editor.page';
import { CreateDiagramDialog } from '../dialogs/create-diagram.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class DiagramFlow {
  private tmEditPage: TmEditPage;
  private dfdEditorPage: DfdEditorPage;
  private createDiagramDialog: CreateDiagramDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.dfdEditorPage = new DfdEditorPage(page);
    this.createDiagramDialog = new CreateDiagramDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string) {
    await this.tmEditPage.addDiagramButton().waitFor({ state: 'visible', timeout: 15000 });
    await this.tmEditPage.addDiagramButton().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.tmEditPage.addDiagramButton().click();
    await this.createDiagramDialog.fillName(name);
    await this.createDiagramDialog.submit();
    // Wait for diagram row to appear
    await this.tmEditPage.diagramRow(name).waitFor({ state: 'visible', timeout: 15000 });
  }

  async openFromTmEdit(name: string) {
    await this.tmEditPage.diagramRow(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 10000 });
    await this.dfdEditorPage.graphContainer().waitFor({ state: 'visible', timeout: 15000 });
  }

  async closeDiagram() {
    await this.dfdEditorPage.closeButton().click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    await this.tmEditPage.diagramKebabButton(name).click();
    await this.tmEditPage.diagramDeleteButton().waitFor({ state: 'visible' });
    await this.tmEditPage.diagramDeleteButton().click();
    await this.deleteConfirmDialog.confirmDeletion();
  }

  /**
   * Open a seeded diagram by name from the TM edit page.
   * Assumes the TM edit page is already loaded and the diagram exists in the list.
   */
  async openSeededDiagram(diagramName: string) {
    await this.tmEditPage.diagramRow(diagramName).waitFor({ state: 'visible', timeout: 15000 });
    await this.tmEditPage.diagramRow(diagramName).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 10000 });
    await this.dfdEditorPage.graphContainer().waitFor({ state: 'visible', timeout: 15000 });
  }
}
