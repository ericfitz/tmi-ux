import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../services/logger.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { UserPreferencesService } from '../../services/user-preferences.service';
import { AUTH_SERVICE, IAuthService } from '../../interfaces';
import {
  DeleteUserDataDialogComponent,
  DeleteUserDataDialogData,
} from '../delete-user-data-dialog/delete-user-data-dialog.component';
import { UserProfile } from '@app/auth/models/auth.models';
import { ThreatModelAuthorizationService } from '@app/pages/tm/services/threat-model-authorization.service';
import { ClientCredentialInfo, ClientCredentialResponse } from '@app/types/client-credential.types';
import { ClientCredentialService } from '../../services/client-credential.service';
import { CreateCredentialDialogComponent } from './create-credential-dialog/create-credential-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from './credential-secret-dialog/credential-secret-dialog.component';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import {
  UserPickerDialogComponent,
  UserPickerDialogData,
} from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { UserService } from '../../services/user.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { AdminUser } from '@app/types/user.types';

export interface UserPreferences {
  animations: boolean;
  themeMode: ThemeMode;
  colorBlindMode: boolean;
  pageSize: 'usLetter' | 'A4';
  marginSize: 'narrow' | 'standard' | 'wide';
  showDeveloperTools: boolean;
  dashboardListView: boolean;
}

interface CheckboxChangeEvent {
  checked: boolean;
}

@Component({
  selector: 'app-user-preferences-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    UserDisplayComponent,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'userPreferences.title'">User Preferences</h2>
    <mat-dialog-content>
      <mat-tab-group>
        <!-- Profile Tab -->
        <mat-tab [label]="'userPreferences.tabs.profile' | transloco">
          <div class="tab-content">
            <h3 class="section-header" [transloco]="'userPreferences.userProfile.title'">
              User Profile
            </h3>

            <div class="profile-info">
              <div class="profile-item">
                <span class="profile-label" [transloco]="'common.name'">Name</span>
                <span class="profile-value"
                  ><app-user-display [user]="userProfile" fallback="N/A"
                /></span>
              </div>

              <div class="profile-item">
                <span class="profile-label" [transloco]="'common.emailLabel'">Email</span>
                <span class="profile-value">{{ userProfile?.email || 'N/A' }}</span>
              </div>

              @if (userProfile?.provider) {
                <div class="profile-item">
                  <span class="profile-label" [transloco]="'userPreferences.userProfile.provider'">
                    Identity Provider
                  </span>
                  <span class="profile-value">{{ userProfile?.provider }}</span>
                </div>
              }

              @if (userProfile?.provider_id) {
                <div class="profile-item">
                  <span
                    class="profile-label"
                    [transloco]="'userPreferences.userProfile.providerId'"
                  >
                    Provider ID
                  </span>
                  <span class="profile-value user-id">{{ userProfile?.provider_id }}</span>
                </div>
              }

              @if (userProfile?.groups && (userProfile?.groups?.length ?? 0) > 0) {
                <div class="profile-item">
                  <span class="profile-label" [transloco]="'userPreferences.userProfile.groups'">
                    Groups
                  </span>
                  <div class="profile-value groups-list">
                    @for (group of userProfile?.groups; track group) {
                      <span class="group-badge">{{ group }}</span>
                    }
                  </div>
                </div>
              }

              @if (currentThreatModelRole) {
                <div class="profile-item">
                  <span
                    class="profile-label"
                    [transloco]="'userPreferences.userProfile.currentRole'"
                  >
                    Current Threat Model Role
                  </span>
                  <span class="profile-value">
                    {{ 'common.roles.' + currentThreatModelRole | transloco }}
                  </span>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Display Tab -->
        <mat-tab [label]="'userPreferences.tabs.display' | transloco">
          <div class="tab-content">
            <h3 class="section-header" [transloco]="'userPreferences.displayPreferences'">
              Display Preferences
            </h3>

            <div class="preference-item">
              <mat-checkbox
                [(ngModel)]="preferences.animations"
                (change)="onAnimationPreferenceChange($event)"
              >
                <span [transloco]="'userPreferences.diagramAnimationEffects'">
                  Diagram animation effects
                </span>
              </mat-checkbox>
            </div>

            <div class="preference-item">
              <label class="preference-label" [transloco]="'userPreferences.theme'">Theme</label>
              <mat-radio-group
                [(ngModel)]="preferences.themeMode"
                (change)="onThemeModeChange()"
                class="radio-group"
              >
                <mat-radio-button value="automatic">
                  <span [transloco]="'userPreferences.themeMode.automatic'">
                    Automatic (System)
                  </span>
                </mat-radio-button>
                <mat-radio-button value="light">
                  <span [transloco]="'userPreferences.themeMode.light'">Light</span>
                </mat-radio-button>
                <mat-radio-button value="dark">
                  <span [transloco]="'userPreferences.themeMode.dark'">Dark</span>
                </mat-radio-button>
              </mat-radio-group>
            </div>

            <div class="preference-item">
              <mat-checkbox
                [(ngModel)]="preferences.colorBlindMode"
                (change)="onColorBlindModeChange($event)"
              >
                <span [transloco]="'userPreferences.colorBlindMode'">
                  Color Blind Safe Palette
                </span>
              </mat-checkbox>
            </div>

            <div class="preference-item">
              <mat-checkbox
                [(ngModel)]="preferences.showDeveloperTools"
                (change)="onShowDeveloperToolsChange($event)"
              >
                <span [transloco]="'userPreferences.showDeveloperTools'">
                  Show Developer Tools
                </span>
              </mat-checkbox>
            </div>

            <div class="preference-item">
              <mat-checkbox
                [(ngModel)]="preferences.dashboardListView"
                (change)="onDashboardListViewChange($event)"
              >
                <span [transloco]="'userPreferences.dashboardListView'">
                  Show Dashboard as List View
                </span>
              </mat-checkbox>
            </div>
          </div>
        </mat-tab>

        <!-- Reports Tab -->
        <mat-tab [label]="'userPreferences.tabs.reports' | transloco">
          <div class="tab-content">
            <h3 class="section-header" [transloco]="'userPreferences.reportPreferences'">
              Report Preferences
            </h3>

            <div class="preference-item">
              <label class="preference-label" [transloco]="'userPreferences.pageSize.title'">
                Preferred Page Size for Reports
              </label>
              <mat-radio-group
                [(ngModel)]="preferences.pageSize"
                (change)="onPageSizeChange()"
                class="radio-group"
              >
                <mat-radio-button value="usLetter">
                  <span [transloco]="'userPreferences.pageSize.usLetter'">US Letter</span>
                </mat-radio-button>
                <mat-radio-button value="A4">
                  <span [transloco]="'userPreferences.pageSize.A4'">A4</span>
                </mat-radio-button>
              </mat-radio-group>
            </div>

            <div class="preference-item">
              <label class="preference-label" [transloco]="'userPreferences.marginSize.title'">
                Preferred Margin Size for Reports
              </label>
              <mat-radio-group
                [(ngModel)]="preferences.marginSize"
                (change)="onMarginSizeChange()"
                class="radio-group"
              >
                <mat-radio-button value="narrow">
                  <span [transloco]="'userPreferences.marginSize.narrow'">Narrow</span>
                </mat-radio-button>
                <mat-radio-button value="standard">
                  <span [transloco]="'userPreferences.marginSize.standard'">Standard</span>
                </mat-radio-button>
                <mat-radio-button value="wide">
                  <span [transloco]="'userPreferences.marginSize.wide'">Wide</span>
                </mat-radio-button>
              </mat-radio-group>
            </div>
          </div>
        </mat-tab>

        <!-- Credentials Tab -->
        <mat-tab [label]="'userPreferences.tabs.credentials' | transloco">
          <div class="tab-content credentials-tab">
            <h3 class="section-header" [transloco]="'userPreferences.credentials.title'">
              Client Credentials
            </h3>

            @if (credentialsLoading) {
              <div class="credentials-loading">
                <mat-spinner diameter="32"></mat-spinner>
              </div>
            } @else if (credentials.length === 0) {
              <div class="credentials-empty">
                <mat-icon class="empty-icon">vpn_key</mat-icon>
                <p class="empty-text" [transloco]="'userPreferences.credentials.noCredentials'">
                  No client credentials yet
                </p>
                <p
                  class="empty-description"
                  [transloco]="'userPreferences.credentials.noCredentialsDescription'"
                >
                  Create credentials to access the TMI API programmatically.
                </p>
              </div>
            } @else {
              <div class="credentials-table-container">
                <table mat-table [dataSource]="credentials" class="credentials-table">
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef [transloco]="'common.name'">Name</th>
                    <td mat-cell *matCellDef="let credential">
                      <div class="credential-name">{{ credential.name }}</div>
                      @if (credential.description) {
                        <div class="credential-description">{{ credential.description }}</div>
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="clientId">
                    <th
                      mat-header-cell
                      *matHeaderCellDef
                      [transloco]="'userPreferences.credentials.clientId'"
                    >
                      Client ID
                    </th>
                    <td mat-cell *matCellDef="let credential">
                      <span class="client-id">{{ credential.client_id }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="created">
                    <th
                      mat-header-cell
                      *matHeaderCellDef
                      [transloco]="'userPreferences.credentials.created'"
                    >
                      Created
                    </th>
                    <td mat-cell *matCellDef="let credential">
                      {{ formatDate(credential.created_at) }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="lastUsed">
                    <th
                      mat-header-cell
                      *matHeaderCellDef
                      [transloco]="'userPreferences.credentials.lastUsed'"
                    >
                      Last Used
                    </th>
                    <td mat-cell *matCellDef="let credential">
                      {{ formatLastUsed(credential.last_used_at) }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="expires">
                    <th
                      mat-header-cell
                      *matHeaderCellDef
                      [transloco]="'userPreferences.credentials.expires'"
                    >
                      Expires
                    </th>
                    <td mat-cell *matCellDef="let credential">
                      {{ formatExpires(credential.expires_at) }}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let credential">
                      <button
                        mat-icon-button
                        (click)="onDeleteCredential(credential)"
                        [matTooltip]="'common.delete' | transloco"
                        color="warn"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="credentialColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: credentialColumns"></tr>
                </table>
              </div>
            }

            <div class="credentials-actions">
              <button mat-raised-button color="primary" (click)="onAddCredential()">
                <mat-icon>add</mat-icon>
                <span [transloco]="'userPreferences.credentials.add'">Add</span>
              </button>
            </div>
          </div>
        </mat-tab>

        <!-- Danger Tab -->
        <mat-tab [label]="'userPreferences.tabs.danger' | transloco">
          <div class="tab-content danger-tab">
            <div class="preference-item">
              <button
                mat-raised-button
                color="warn"
                (click)="onTransferData()"
                class="transfer-button"
              >
                <mat-icon>swap_horiz</mat-icon>
                <span [transloco]="'userPreferences.transferData.title'"
                  >Transfer My Data to Another User</span
                >
              </button>
              <p class="danger-hint" [transloco]="'userPreferences.transferData.hint'">
                Transfers ownership of all your threat models and survey responses to another user.
                You will be downgraded to writer role on transferred items.
              </p>
            </div>
            <mat-divider></mat-divider>
            <div class="preference-item">
              <button
                mat-raised-button
                color="error"
                (click)="onDeleteData()"
                class="delete-button"
              >
                <mat-icon>delete_forever</mat-icon>
                <span [transloco]="'userPreferences.deleteMyData.title'">Delete All My Data</span>
              </button>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="close()"
        [transloco]="'common.close'"
        [attr.aria-label]="'common.close' | transloco"
      >
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content {
        padding: 0 24px;
      }

      ::ng-deep .mat-mdc-tab-header {
        --mdc-secondary-navigation-tab-container-height: 40px;
      }

      ::ng-deep .mat-mdc-tab-header-pagination {
        display: none !important;
      }

      ::ng-deep .mat-mdc-tab-body-wrapper {
        height: 320px;
      }

      ::ng-deep .mat-mdc-tab-body-content {
        overflow-y: auto;
      }

      .tab-content {
        padding: 16px 0;
      }

      .section-header {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .preference-item {
        margin: 8px 0;
      }

      .preference-label {
        display: block;
        margin-bottom: 4px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-left: 8px;
      }

      .delete-button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .delete-button mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        line-height: 20px;
      }

      .profile-info {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .profile-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .profile-label {
        font-weight: 500;
        font-size: 12px;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .profile-value {
        font-size: 14px;
        color: var(--theme-text-primary);
        word-break: break-word;
      }

      .user-id {
        font-family: monospace;
        font-size: 12px;
        color: var(--theme-text-secondary);
      }

      .groups-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .group-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
      }

      /* Credentials tab styles */
      .credentials-tab {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .credentials-loading {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 150px;
      }

      .credentials-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 24px;
        min-height: 150px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.02));
        border-radius: 8px;
        border: 1px dashed var(--theme-divider);
      }

      .empty-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--theme-text-secondary);
        margin-bottom: 12px;
      }

      .empty-text {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .empty-description {
        margin: 0;
        font-size: 13px;
        color: var(--theme-text-secondary);
      }

      .credentials-table-container {
        border: 1px solid var(--theme-divider);
        border-radius: 4px;
      }

      .credentials-table {
        width: 100%;
      }

      .credentials-table th,
      .credentials-table td {
        white-space: normal;
        word-break: break-word;
        vertical-align: top;
        padding-top: 12px;
        padding-bottom: 12px;
      }

      .credentials-table th {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--theme-text-secondary);
      }

      .credentials-table td {
        font-size: 13px;
      }

      .credential-name {
        font-weight: 500;
        word-break: break-word;
      }

      .credential-description {
        font-size: 12px;
        color: var(--theme-text-secondary);
        margin-top: 4px;
        word-break: break-word;
      }

      .client-id {
        font-family: monospace;
        font-size: 12px;
        color: var(--theme-text-secondary);
        word-break: break-all;
      }

      .credentials-actions {
        margin-top: 16px;
      }

      .credentials-actions button {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .credentials-actions mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      /* Danger tab styles */
      .danger-tab {
        padding-top: 8px;
      }

      .transfer-button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .transfer-button mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        line-height: 20px;
      }

      .danger-hint {
        margin: 8px 0 0 0;
        font-size: 12px;
        color: var(--theme-text-secondary);
        line-height: 1.4;
      }

      mat-divider {
        margin: 16px 0;
      }
    `,
  ],
})
export class UserPreferencesDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  preferences: UserPreferences;
  userProfile: UserProfile | null = null;
  currentThreatModelRole: 'owner' | 'writer' | 'reader' | null = null;

  // Credentials tab
  credentials: ClientCredentialInfo[] = [];
  credentialsLoading = false;
  credentialColumns = ['name', 'clientId', 'created', 'lastUsed', 'expires', 'actions'];

  constructor(
    public dialogRef: MatDialogRef<UserPreferencesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown,
    @Inject(AUTH_SERVICE) private authService: IAuthService,
    private logger: LoggerService,
    private dialog: MatDialog,
    private themeService: ThemeService,
    private userPreferencesService: UserPreferencesService,
    private threatModelAuthService: ThreatModelAuthorizationService,
    private clientCredentialService: ClientCredentialService,
    private userService: UserService,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
  ) {
    this.preferences = this.userPreferencesService.getPreferences();
  }

  ngOnInit(): void {
    // Get user profile from synchronous property
    this.userProfile = this.authService.userProfile;

    // Refresh user profile to get latest admin status
    this.authService
      .refreshUserProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: profile => {
          this.userProfile = profile;
        },
      });

    // Get current threat model role if available
    this.threatModelAuthService.currentUserPermission$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(role => {
        this.currentThreatModelRole = role;
      });

    // Load client credentials
    this.loadCredentials();
  }

  onAnimationPreferenceChange(event: CheckboxChangeEvent): void {
    this.preferences.animations = event.checked;
    this.userPreferencesService.updatePreferences({ animations: event.checked });
  }

  onThemeModeChange(): void {
    this.userPreferencesService.updatePreferences({ themeMode: this.preferences.themeMode });
  }

  onColorBlindModeChange(event: CheckboxChangeEvent): void {
    this.preferences.colorBlindMode = event.checked;
    this.userPreferencesService.updatePreferences({ colorBlindMode: event.checked });
  }

  onPageSizeChange(): void {
    this.userPreferencesService.updatePreferences({ pageSize: this.preferences.pageSize });
  }

  onMarginSizeChange(): void {
    this.userPreferencesService.updatePreferences({ marginSize: this.preferences.marginSize });
  }

  onShowDeveloperToolsChange(event: CheckboxChangeEvent): void {
    this.preferences.showDeveloperTools = event.checked;
    this.userPreferencesService.updatePreferences({ showDeveloperTools: event.checked });
  }

  onDashboardListViewChange(event: CheckboxChangeEvent): void {
    this.preferences.dashboardListView = event.checked;
    this.userPreferencesService.updatePreferences({ dashboardListView: event.checked });
  }

  onTransferData(): void {
    const dialogData: UserPickerDialogData = {
      title: this.transloco.translate('userPreferences.transferData.dialogTitle'),
    };

    const pickerRef = this.dialog.open(UserPickerDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
      data: dialogData,
    });

    pickerRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((selectedUser: AdminUser | undefined) => {
        if (!selectedUser) {
          return;
        }

        const confirmed = confirm(
          this.transloco.translate('userPreferences.transferData.confirmMessage', {
            email: selectedUser.email,
          }),
        );

        if (confirmed) {
          this.userService
            .transferOwnership(selectedUser.internal_uuid)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: result => {
                const message = this.transloco.translate('userPreferences.transferData.success', {
                  tmCount: result.threat_models_transferred.count,
                  srCount: result.survey_responses_transferred.count,
                });
                this.snackBar.open(message, undefined, { duration: 5000 });
              },
              error: error => {
                this.logger.error('Failed to transfer ownership', error);
                this.snackBar.open(
                  this.transloco.translate('userPreferences.transferData.error'),
                  undefined,
                  { duration: 5000 },
                );
              },
            });
        }
      });
  }

  onDeleteData(): void {
    this.logger.info('Delete data button clicked');

    const dialogData: DeleteUserDataDialogData = {
      userEmail: this.authService.userEmail,
    };

    const deleteDialogRef = this.dialog.open(DeleteUserDataDialogComponent, {
      width: '600px',
      data: dialogData,
      disableClose: true, // Prevent closing by clicking outside or ESC during processing
    });

    deleteDialogRef.afterClosed().subscribe(result => {
      if (result) {
        // User account was deleted, the dialog component handles logout
        // Close this preferences dialog as well
        this.dialogRef.close();
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  // Credentials methods
  private loadCredentials(): void {
    this.credentialsLoading = true;
    this.clientCredentialService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: credentials => {
          this.credentials = credentials;
          this.credentialsLoading = false;
        },
        error: () => {
          this.credentialsLoading = false;
        },
      });
  }

  onAddCredential(): void {
    const dialogRef = this.dialog.open(CreateCredentialDialogComponent, {
      width: '500px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: ClientCredentialResponse | null) => {
        if (result) {
          // Show the secret dialog
          this.showCredentialSecretDialog(result.client_id, result.client_secret);
          // Reload credentials list
          this.loadCredentials();
        }
      });
  }

  private showCredentialSecretDialog(clientId: string, clientSecret: string): void {
    const dialogData: CredentialSecretDialogData = {
      clientId,
      clientSecret,
    };
    this.dialog.open(CredentialSecretDialogComponent, {
      width: '600px',
      disableClose: true,
      data: dialogData,
    });
  }

  onDeleteCredential(credential: ClientCredentialInfo): void {
    const confirmed = confirm(
      `Are you sure you want to delete the credential "${credential.name}"? This action cannot be undone.`,
    );

    if (confirmed) {
      this.clientCredentialService
        .delete(credential.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Client credential deleted', { id: credential.id });
            this.loadCredentials();
          },
          error: error => {
            this.logger.error('Failed to delete client credential', error);
          },
        });
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatLastUsed(dateString: string | null | undefined): string {
    if (!dateString) {
      return 'Never';
    }
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  }

  formatExpires(dateString: string | null | undefined): string {
    if (!dateString) {
      return 'Never';
    }
    const date = new Date(dateString);
    const now = new Date();
    if (date < now) {
      return 'Expired';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
