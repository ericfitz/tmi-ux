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
      <h3 class="section-header" [transloco]="'userPreferences.userProfile.title'">User Profile</h3>

      <div class="profile-info">
        <div class="profile-item">
          <span class="profile-label" [transloco]="'common.name'">Name</span>
          <span class="profile-value">{{ userProfile?.name || 'N/A' }}</span>
        </div>

        <div class="profile-item">
          <span class="profile-label" [transloco]="'common.emailLabel'">Email</span>
          <span class="profile-value">{{ userProfile?.email || 'N/A' }}</span>
        </div>

        <div class="profile-item">
          <span class="profile-label" [transloco]="'userPreferences.userProfile.userId'"
            >User ID</span
          >
          <span class="profile-value user-id">{{ userProfile?.id || 'N/A' }}</span>
        </div>

        @if (userProfile && userProfile.providers && userProfile.providers.length > 0) {
          <div class="profile-item">
            <span class="profile-label" [transloco]="'userPreferences.userProfile.providers'">
              Linked Providers
            </span>
            <div class="profile-value providers-list">
              @for (provider of userProfile.providers; track provider.provider) {
                <span class="provider-badge">
                  {{ provider.provider }}
                  @if (provider.is_primary) {
                    <span class="primary-badge" [transloco]="'userPreferences.userProfile.primary'">
                      (Primary)
                    </span>
                  }
                </span>
              }
            </div>
          </div>
        }

        @if (userProfile && userProfile.groups && userProfile.groups.length > 0) {
          <div class="profile-item">
            <span class="profile-label" [transloco]="'userPreferences.userProfile.groups'"
              >Groups</span
            >
            <div class="profile-value groups-list">
              @for (group of userProfile.groups; track group) {
                <span class="group-badge">{{ group }}</span>
              }
            </div>
          </div>
        }

        @if (currentThreatModelRole) {
          <div class="profile-item">
            <span class="profile-label" [transloco]="'userPreferences.userProfile.currentRole'">
              Current Threat Model Role
            </span>
            <span class="profile-value role-badge">
              {{ 'common.roles.' + currentThreatModelRole | transloco }}
            </span>
          </div>
        }
      </div>

      <mat-divider></mat-divider>

      <h3 class="section-header" [transloco]="'userPreferences.displayPreferences'">
        Display Preferences
      </h3>

      <div class="preference-item">
        <mat-checkbox
          [(ngModel)]="preferences.animations"
          (change)="onAnimationPreferenceChange($event)"
          tabindex="1"
        >
          <span [transloco]="'userPreferences.diagramAnimationEffects'"
            >Diagram animation effects</span
          >
        </mat-checkbox>
      </div>

      <div class="preference-item">
        <label class="preference-label" [transloco]="'userPreferences.theme'">Theme</label>
        <mat-radio-group
          [(ngModel)]="preferences.themeMode"
          (change)="onThemeModeChange()"
          class="radio-group"
        >
          <mat-radio-button value="automatic" tabindex="2">
            <span [transloco]="'userPreferences.themeMode.automatic'">Automatic (System)</span>
          </mat-radio-button>
          <mat-radio-button value="light" tabindex="3">
            <span [transloco]="'userPreferences.themeMode.light'">Light</span>
          </mat-radio-button>
          <mat-radio-button value="dark" tabindex="4">
            <span [transloco]="'userPreferences.themeMode.dark'">Dark</span>
          </mat-radio-button>
        </mat-radio-group>
      </div>

      <div class="preference-item">
        <mat-checkbox
          [(ngModel)]="preferences.colorBlindMode"
          (change)="onColorBlindModeChange($event)"
          tabindex="5"
        >
          <span [transloco]="'userPreferences.colorBlindMode'">Color Blind Safe Palette</span>
        </mat-checkbox>
      </div>

      <mat-divider></mat-divider>

      <h3 class="section-header" [transloco]="'userPreferences.reportPreferences'">
        Report Preferences
      </h3>

      <div class="preference-item">
        <label class="preference-label" [transloco]="'userPreferences.pageSize.title'"
          >Preferred Page Size for Reports</label
        >
        <mat-radio-group
          [(ngModel)]="preferences.pageSize"
          (change)="onPageSizeChange()"
          class="radio-group"
        >
          <mat-radio-button value="usLetter" tabindex="6">
            <span [transloco]="'userPreferences.pageSize.usLetter'">US Letter</span>
          </mat-radio-button>
          <mat-radio-button value="A4" tabindex="7">
            <span [transloco]="'userPreferences.pageSize.A4'">A4</span>
          </mat-radio-button>
        </mat-radio-group>
      </div>

      <div class="preference-item">
        <label class="preference-label" [transloco]="'userPreferences.marginSize.title'"
          >Preferred Margin Size for Reports</label
        >
        <mat-radio-group
          [(ngModel)]="preferences.marginSize"
          (change)="onMarginSizeChange()"
          class="radio-group"
        >
          <mat-radio-button value="narrow" tabindex="8">
            <span [transloco]="'userPreferences.marginSize.narrow'">Narrow</span>
          </mat-radio-button>
          <mat-radio-button value="standard" tabindex="9">
            <span [transloco]="'userPreferences.marginSize.standard'">Standard</span>
          </mat-radio-button>
          <mat-radio-button value="wide" tabindex="10">
            <span [transloco]="'userPreferences.marginSize.wide'">Wide</span>
          </mat-radio-button>
        </mat-radio-group>
      </div>

      <mat-divider></mat-divider>

      @if (userProfile?.is_admin) {
        <div class="preference-item">
          <button
            mat-raised-button
            color="primary"
            (click)="onAdminClick()"
            tabindex="11"
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
          color="warn"
          (click)="onDeleteData()"
          [tabindex]="userProfile?.is_admin ? 12 : 11"
          class="delete-button"
        >
          <mat-icon>delete_forever</mat-icon>
          <span [transloco]="'userPreferences.deleteMyData.title'">Delete All My Data</span>
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        (click)="close()"
        [transloco]="'common.close'"
        tabindex="12"
        [attr.aria-label]="'common.close' | transloco"
      >
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .preference-item {
        margin: 16px 0;
      }

      mat-dialog-content {
        min-width: 400px;
        max-height: calc(100vh - 250px);
        overflow-y: auto;
        overflow-x: hidden;
      }

      @media (max-height: 900px) {
        mat-dialog-content {
          max-height: calc(100vh - 220px);
        }
      }

      @media (max-height: 768px) {
        mat-dialog-content {
          max-height: calc(100vh - 190px);
        }
      }

      mat-dialog-actions {
        position: sticky;
        bottom: 0;
        background: var(--theme-background, #fff);
        border-top: 1px solid var(--theme-divider, rgba(0, 0, 0, 0.12));
        margin-top: 8px;
      }

      .section-header {
        margin: 20px 0 12px 0;
        font-size: 16px;
        font-weight: 500;
        color: var(--theme-text-primary);
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

      mat-divider {
        margin: 20px 0;
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

      .providers-list,
      .groups-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .provider-badge,
      .group-badge,
      .role-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 12px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 12px;
        font-size: 13px;
        font-weight: 500;
      }

      .primary-badge {
        margin-left: 4px;
        font-size: 11px;
        font-weight: 400;
        opacity: 0.7;
      }

      .role-badge {
        background-color: var(--theme-primary-light, rgba(63, 81, 181, 0.1));
        color: var(--theme-primary, #3f51b5);
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
