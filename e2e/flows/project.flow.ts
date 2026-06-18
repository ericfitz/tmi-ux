import { Page } from '@playwright/test';
import { ProjectsPage } from '../pages/projects.page';
import { CreateProjectDialog } from '../dialogs/create-project.dialog';
import { EditProjectDialog } from '../dialogs/edit-project.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../dialogs/related-projects.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { UserPickerDialog } from '../dialogs/user-picker.dialog';

// SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: E2E flow helper for CRUD and relationship actions on projects
export class ProjectFlow {
  private projectsPage: ProjectsPage;
  private createProjectDialog: CreateProjectDialog;
  private editProjectDialog: EditProjectDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedProjectsDialog: RelatedProjectsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: build ProjectFlow and initialize all project page and dialog wrappers (pure)
  constructor(private page: Page) {
    this.projectsPage = new ProjectsPage(page);
    this.createProjectDialog = new CreateProjectDialog(page);
    this.editProjectDialog = new EditProjectDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedProjectsDialog = new RelatedProjectsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: create a project via the create dialog and wait for the API POST
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

  // SEM@0044214fdc57a3ef5cd64987b680cab157eedffc: update project fields via the edit dialog and wait for the API PATCH
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

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: delete a project via the more menu and confirm deletion dialog
  async deleteProject(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: open the responsible parties dialog for a named project
  async openResponsibleParties(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  // SEM@bb65e02191d3f75c13fdb0a10b75f2837d573933: add a responsible party user with a given role via user picker
  async addResponsibleParty(email: string, role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    const picker = new UserPickerDialog(this.page);
    await picker.pickUser(email, role);
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: open the related projects dialog for a named project
  async openRelatedProjects(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.relatedProjectsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: search for and link a related project with a given relationship type
  async addRelatedProject(projectName: string, relationship: string) {
    await this.relatedProjectsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedProjectsDialog.searchProject(projectName);
    await this.relatedProjectsDialog.selectRelationship(relationship);
    await this.relatedProjectsDialog.confirmAdd();
  }

  // SEM@d7c4da22330e2aa1eb04b7b122520ad2b0596635: open the metadata dialog for a named project
  async openMetadata(name: string) {
    await this.projectsPage.moreButton(name).click();
    await this.projectsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
