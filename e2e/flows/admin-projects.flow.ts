import { Page } from '@playwright/test';
import { AdminProjectsPage } from '../pages/admin-projects.page';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class AdminProjectsFlow {
  private adminProjectsPage: AdminProjectsPage;
  private createProjectDialog: CreateProjectDialog;
  private editProjectDialog: EditProjectDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedProjectsDialog: RelatedProjectsDialog;
  private metadataDialog: MetadataDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.adminProjectsPage = new AdminProjectsPage(page);
    this.createProjectDialog = new CreateProjectDialog(page);
    this.editProjectDialog = new EditProjectDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedProjectsDialog = new RelatedProjectsDialog(page);
    this.metadataDialog = new MetadataDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createProject(name: string, description?: string) {
    await this.adminProjectsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createProjectDialog.fillName(name);
    if (description) {
      await this.createProjectDialog.fillDescription(description);
    }
    await this.createProjectDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editProject(name: string, newName: string) {
    await this.adminProjectsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.editProjectDialog.fillName(newName);
    await this.editProjectDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openResponsibleParties(name: string) {
    await this.adminProjectsPage.moreButton(name).click();
    await this.adminProjectsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.responsiblePartiesDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openRelatedProjects(name: string) {
    await this.adminProjectsPage.moreButton(name).click();
    await this.adminProjectsPage.relatedProjectsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.relatedProjectsDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openMetadata(name: string) {
    await this.adminProjectsPage.moreButton(name).click();
    await this.adminProjectsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.metadataDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteProject(name: string) {
    await this.adminProjectsPage.moreButton(name).click();
    await this.adminProjectsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
