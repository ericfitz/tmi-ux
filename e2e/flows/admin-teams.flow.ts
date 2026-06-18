import { Dialog, expect, Page } from '@playwright/test';
import { AdminTeamsPage } from '../pages/admin-teams.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';

// SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: E2E flow helper orchestrating CRUD operations on admin teams page
export class AdminTeamsFlow {
  private adminTeamsPage: AdminTeamsPage;
  private createTeamDialog: CreateTeamDialog;
  private editTeamDialog: EditTeamDialog;
  private teamMembersDialog: TeamMembersDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedTeamsDialog: RelatedTeamsDialog;
  private metadataDialog: MetadataDialog;
  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: build page object and dialog handles for the admin teams flow (pure)
  constructor(private page: Page) {
    this.adminTeamsPage = new AdminTeamsPage(page);
    this.createTeamDialog = new CreateTeamDialog(page);
    this.editTeamDialog = new EditTeamDialog(page);
    this.teamMembersDialog = new TeamMembersDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedTeamsDialog = new RelatedTeamsDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: create a team via the admin UI dialog and wait for it to close
  async createTeam(name: string, description?: string) {
    await this.adminTeamsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createTeamDialog.fillName(name);
    if (description) {
      await this.createTeamDialog.fillDescription(description);
    }
    await this.createTeamDialog.submitButton().waitFor({ state: 'visible' });
    await expect(this.createTeamDialog.submitButton()).toBeEnabled({ timeout: 5000 });
    await this.createTeamDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: rename a team via the admin edit dialog and wait for close
  async editTeam(name: string, newName: string) {
    await this.adminTeamsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.editTeamDialog.fillName(newName);
    await this.editTeamDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: open the team members dialog for a team and cancel it
  async openMembers(name: string) {
    await this.adminTeamsPage.membersButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.teamMembersDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: open the responsible parties dialog for a team and cancel it
  async openResponsibleParties(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.responsiblePartiesDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: open the related teams dialog for a team and cancel it
  async openRelatedTeams(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.relatedTeamsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.relatedTeamsDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@f1bfdaee3d5f7f1c879afe5c43d4285e2fabe2ea: open the metadata dialog for a team and cancel it
  async openMetadata(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.metadataDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: delete a team via the admin UI, accepting the confirmation dialog
  async deleteTeam(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: accept a browser native confirmation dialog (pure)
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminTeamsPage.deleteItem().dispatchEvent('click');
  }
}
