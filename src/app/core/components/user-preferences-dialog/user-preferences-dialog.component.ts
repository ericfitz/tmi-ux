import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { DIALOG_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../services/logger.service';
import { ThemeService, ThemeMode, PaletteType } from '../../services/theme.service';
import { AUTH_SERVICE, IAuthService } from '../../interfaces';
import {
  DeleteUserDataDialogComponent,
  DeleteUserDataDialogData,
} from '../delete-user-data-dialog/delete-user-data-dialog.component';

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

      <div class="preference-item">
        <button
          mat-raised-button
          color="warn"
          (click)="onDeleteData()"
          tabindex="11"
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
    `,
  ],
})
export class UserPreferencesDialogComponent {
  preferences: UserPreferences;

  constructor(
    public dialogRef: MatDialogRef<UserPreferencesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown,
    @Inject(AUTH_SERVICE) private authService: IAuthService,
    private logger: LoggerService,
    private dialog: MatDialog,
    private themeService: ThemeService,
  ) {
    this.preferences = this.loadPreferences();
    // Sync with current theme preferences from ThemeService
    const themePrefs = this.themeService.getPreferences();
    this.preferences.themeMode = themePrefs.mode;
    this.preferences.colorBlindMode = themePrefs.palette === 'colorblind';
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
