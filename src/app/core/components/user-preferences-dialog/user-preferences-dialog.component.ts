import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { DIALOG_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../services/logger.service';
import { ThemeService, ThemeMode, PaletteType } from '../../services/theme.service';
import { AUTH_SERVICE, IAuthService } from '../../interfaces';
import {
  DeleteUserDataDialogComponent,
  DeleteUserDataDialogData,
} from '../delete-user-data-dialog/delete-user-data-dialog.component';
import { UserProfile } from '@app/auth/models/auth.models';
import { ThreatModelAuthorizationService } from '@app/pages/tm/services/threat-model-authorization.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface UserPreferences {
  animations: boolean;
  themeMode: ThemeMode;
  colorBlindMode: boolean;
  pageSize: 'usLetter' | 'A4';
  marginSize: 'narrow' | 'standard' | 'wide';
}

interface CheckboxChangeEvent {
  checked: boolean;
}

@Component({
  selector: 'app-user-preferences-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
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
                <span class="profile-value">{{ userProfile?.display_name || 'N/A' }}</span>
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

        <!-- Credentials Tab (Placeholder) -->
        <mat-tab [label]="'userPreferences.tabs.credentials' | transloco">
          <div class="tab-content credentials-placeholder">
            <mat-icon class="placeholder-icon">vpn_key</mat-icon>
            <h3 class="placeholder-title" [transloco]="'userPreferences.credentials.title'">
              API Credentials
            </h3>
            <p
              class="placeholder-description"
              [transloco]="'userPreferences.credentials.description'"
            >
              This feature will allow you to manage API credentials for webhooks, external
              integrations, and programmatic access to your threat models.
            </p>
            <span class="coming-soon-badge" [transloco]="'userPreferences.credentials.comingSoon'">
              Coming soon
            </span>
          </div>
        </mat-tab>

        <!-- Danger Tab -->
        <mat-tab [label]="'userPreferences.tabs.danger' | transloco">
          <div class="tab-content danger-tab">
            @if (userProfile?.is_admin) {
              <div class="preference-item">
                <button
                  mat-raised-button
                  color="primary"
                  (click)="onAdminClick()"
                  class="admin-button"
                >
                  <mat-icon>supervisor_account</mat-icon>
                  <span [transloco]="'userPreferences.administration.title'">Administration</span>
                </button>
              </div>
            }

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
        min-width: 550px;
        padding: 0 24px;
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
        margin: 0 0 16px 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .preference-item {
        margin: 16px 0;
      }

      .preference-label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .radio-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-left: 8px;
      }

      .admin-button,
      .delete-button {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .admin-button mat-icon,
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

      /* Credentials placeholder styles */
      .credentials-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px 20px;
        min-height: 200px;
      }

      .placeholder-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: var(--theme-text-secondary);
        margin-bottom: 16px;
      }

      .placeholder-title {
        margin: 0 0 12px 0;
        font-size: 18px;
        font-weight: 500;
        color: var(--theme-text-primary);
      }

      .placeholder-description {
        margin: 0 0 16px 0;
        font-size: 14px;
        color: var(--theme-text-secondary);
        max-width: 400px;
        line-height: 1.5;
      }

      .coming-soon-badge {
        display: inline-block;
        padding: 4px 12px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Danger tab styles */
      .danger-tab {
        padding-top: 8px;
      }
    `,
  ],
})
export class UserPreferencesDialogComponent implements OnInit, OnDestroy {
  preferences: UserPreferences;
  userProfile: UserProfile | null = null;
  currentThreatModelRole: 'owner' | 'writer' | 'reader' | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    public dialogRef: MatDialogRef<UserPreferencesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown,
    @Inject(AUTH_SERVICE) private authService: IAuthService,
    private logger: LoggerService,
    private dialog: MatDialog,
    private router: Router,
    private themeService: ThemeService,
    private threatModelAuthService: ThreatModelAuthorizationService,
  ) {
    this.preferences = this.loadPreferences();
    // Sync with current theme preferences from ThemeService
    const themePrefs = this.themeService.getPreferences();
    this.preferences.themeMode = themePrefs.mode;
    this.preferences.colorBlindMode = themePrefs.palette === 'colorblind';
  }

  ngOnInit(): void {
    // Get user profile from synchronous property
    this.userProfile = this.authService.userProfile;

    // Refresh user profile to get latest admin status
    this.authService
      .refreshUserProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: profile => {
          this.userProfile = profile;
        },
      });

    // Get current threat model role if available
    this.threatModelAuthService.currentUserPermission$
      .pipe(takeUntil(this.destroy$))
      .subscribe(role => {
        this.currentThreatModelRole = role;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadPreferences(): UserPreferences {
    const stored = localStorage.getItem('tmi_user_preferences');
    if (stored) {
      try {
        const prefs = JSON.parse(stored) as Record<string, unknown>;
        // Handle legacy format
        if ('darkMode' in prefs && !('themeMode' in prefs)) {
          prefs['themeMode'] = prefs['darkMode'] ? 'dark' : 'light';
          delete prefs['darkMode'];
        }
        return prefs as unknown as UserPreferences;
      } catch (e) {
        this.logger.error('Error parsing user preferences:', e);
      }
    }

    // Default preferences
    const defaultPrefs: UserPreferences = {
      animations: true,
      themeMode: 'automatic',
      colorBlindMode: false,
      pageSize: 'usLetter',
      marginSize: 'standard',
    };
    this.savePreferences(defaultPrefs);
    return defaultPrefs;
  }

  private savePreferences(preferences: UserPreferences): void {
    localStorage.setItem('tmi_user_preferences', JSON.stringify(preferences));
  }

  onAnimationPreferenceChange(event: CheckboxChangeEvent): void {
    this.preferences.animations = event.checked;
    this.savePreferences(this.preferences);
  }

  onThemeModeChange(): void {
    this.savePreferences(this.preferences);
    // Apply the theme immediately
    this.themeService.setThemeMode(this.preferences.themeMode);
  }

  onColorBlindModeChange(event: CheckboxChangeEvent): void {
    this.preferences.colorBlindMode = event.checked;
    this.savePreferences(this.preferences);
    // Apply the palette immediately
    const palette: PaletteType = event.checked ? 'colorblind' : 'normal';
    this.themeService.setPalette(palette);
  }

  onPageSizeChange(): void {
    this.savePreferences(this.preferences);
  }

  onMarginSizeChange(): void {
    this.savePreferences(this.preferences);
  }

  onAdminClick(): void {
    this.logger.info('Administration button clicked');
    // Close the preferences dialog
    this.dialogRef.close();
    // Navigate to admin page
    void this.router.navigate(['/admin']);
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
}
