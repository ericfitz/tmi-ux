import { Page } from '@playwright/test';
import { AdminTeamsPage } from '../pages/admin-teams.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class AdminTeamsFlow {
  private adminTeamsPage: AdminTeamsPage;
  private createTeamDialog: CreateTeamDialog;
  private editTeamDialog: EditTeamDialog;
  private teamMembersDialog: TeamMembersDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedTeamsDialog: RelatedTeamsDialog;
  private metadataDialog: MetadataDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.adminTeamsPage = new AdminTeamsPage(page);
    this.createTeamDialog = new CreateTeamDialog(page);
    this.editTeamDialog = new EditTeamDialog(page);
    this.teamMembersDialog = new TeamMembersDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedTeamsDialog = new RelatedTeamsDialog(page);
    this.metadataDialog = new MetadataDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createTeam(name: string, description?: string) {
    await this.adminTeamsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createTeamDialog.fillName(name);
    if (description) {
      await this.createTeamDialog.fillDescription(description);
    }
    await this.createTeamDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editTeam(name: string, newName: string) {
    await this.adminTeamsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.editTeamDialog.fillName(newName);
    await this.editTeamDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openMembers(name: string) {
    await this.adminTeamsPage.membersButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.teamMembersDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openResponsibleParties(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.responsiblePartiesDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openRelatedTeams(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.relatedTeamsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.relatedTeamsDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openMetadata(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.metadataDialog.cancel();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteTeam(name: string) {
    await this.adminTeamsPage.moreButton(name).click();
    await this.adminTeamsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }
}
