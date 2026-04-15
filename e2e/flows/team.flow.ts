import { Page } from '@playwright/test';
import { TeamsPage } from '../pages/teams.page';
import { CreateTeamDialog } from '../dialogs/create-team.dialog';
import { EditTeamDialog } from '../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../dialogs/related-teams.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class TeamFlow {
  private teamsPage: TeamsPage;
  private createTeamDialog: CreateTeamDialog;
  private editTeamDialog: EditTeamDialog;
  private teamMembersDialog: TeamMembersDialog;
  private responsiblePartiesDialog: ResponsiblePartiesDialog;
  private relatedTeamsDialog: RelatedTeamsDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.teamsPage = new TeamsPage(page);
    this.createTeamDialog = new CreateTeamDialog(page);
    this.editTeamDialog = new EditTeamDialog(page);
    this.teamMembersDialog = new TeamMembersDialog(page);
    this.responsiblePartiesDialog = new ResponsiblePartiesDialog(page);
    this.relatedTeamsDialog = new RelatedTeamsDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
    this.metadataDialog = new MetadataDialog(page);
  }

  async createTeam(fields: { name: string; description?: string; status?: string }) {
    await this.teamsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.createTeamDialog.fillName(fields.name);
    if (fields.description) {
      await this.createTeamDialog.fillDescription(fields.description);
    }
    if (fields.status) {
      await this.createTeamDialog.selectStatus(fields.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams') && resp.request().method() === 'POST',
    );
    await this.createTeamDialog.submit();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async editTeam(
    name: string,
    updates: {
      name?: string;
      description?: string;
      status?: string;
    },
  ) {
    await this.teamsPage.editButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    if (updates.name) {
      await this.editTeamDialog.fillName(updates.name);
    }
    if (updates.description) {
      await this.editTeamDialog.fillDescription(updates.description);
    }
    if (updates.status) {
      await this.editTeamDialog.selectStatus(updates.status);
    }
    const responsePromise = this.page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT',
    );
    await this.editTeamDialog.save();
    await responsePromise;
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteTeam(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.deleteItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.deleteConfirmDialog.confirmDeletion();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async openMembers(name: string) {
    await this.teamsPage.membersButton(name).click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addMember(_userId: string, _role: string) {
    await this.teamMembersDialog.addButton().click();
    // The add member flow opens a UserPickerDialog — interaction depends on
    // that dialog's implementation. The UserPickerDialog should provide its own
    // search + select interaction.
    await this.page.waitForTimeout(500);
  }

  async removeMember(index: number) {
    await this.teamMembersDialog.removeButton(index).click();
  }

  async openResponsibleParties(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.responsiblePartiesItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addResponsibleParty(_userId: string, _role: string) {
    await this.responsiblePartiesDialog.addButton().click();
    await this.page.waitForTimeout(500);
  }

  async openRelatedTeams(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.relatedTeamsItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }

  async addRelatedTeam(teamName: string, relationship: string) {
    await this.relatedTeamsDialog.addButton().click();
    await this.page.waitForTimeout(300);
    await this.relatedTeamsDialog.searchTeam(teamName);
    await this.relatedTeamsDialog.selectRelationship(relationship);
    await this.relatedTeamsDialog.confirmAdd();
  }

  async openMetadata(name: string) {
    await this.teamsPage.moreButton(name).click();
    await this.teamsPage.metadataItem().dispatchEvent('click');
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
  }
}
