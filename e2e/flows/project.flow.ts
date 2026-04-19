import { Page } from '@playwright/test';
import { ProjectsPage } from '../pages/projects.page';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class ProjectFlow {
  private projectsPage: ProjectsPage;
  private createProjectDialog: CreateProjectDialog;
  private editProjectDialog: EditProjectDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedProjectsDialog: RelatedProjectsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.projectsPage = new ProjectsPage(page);
    this.createProjectDialog = new CreateProjectDialog(page);
    this.editProjectDialog = new EditProjectDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedProjectsDialog = new RelatedProjectsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  async createProject(fields: {
    name: string;
    team: string;
    description?: string;
    status?: string;
  }) {
    await this.projectsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createProjectDialog.fillName(fields.name);
    await this.createProjectDialog.selectTeam(fields.team);
    if (fields.description) {
      await this.createProjectDialog.fillDescription(fields.description);
    }
    if (fields.status) {
      await this.createProjectDialog.fillStatus(fields.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/projects') && resp.request().method() === 'POST',
    );
    await this.createProjectDialog.submit();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editProject(
    name: string,
    updates: {
      name?: string;
      description?: string;
      team?: string;
      status?: string;
    },
  ) {
    await this.projectsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    if (updates.name) {
      await this.editProjectDialog.fillName(updates.name);
    }
    if (updates.description) {
      await this.editProjectDialog.fillDescription(updates.description);
    }
    if (updates.team) {
      await this.editProjectDialog.selectTeam(updates.team);
    }
    if (updates.status) {
      await this.editProjectDialog.selectStatus(updates.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PATCH',
    );
    await this.editProjectDialog.save();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteProject(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openResponsibleParties(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addResponsibleParty(_userId: string, _role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    await this.page.waitForTimeout(500);
  }

  async openRelatedProjects(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.relatedProjectsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addRelatedProject(projectName: string, relationship: string) {
    await this.relatedProjectsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedProjectsDialog.searchProject(projectName);
    await this.relatedProjectsDialog.selectRelationship(relationship);
    await this.relatedProjectsDialog.confirmAdd();
  }

  async openMetadata(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
