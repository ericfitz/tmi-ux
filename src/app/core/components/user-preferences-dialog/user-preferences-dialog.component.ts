import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { FeedbackMaterialModule } from '../../../shared/material/feedback-material.module';
import { FormMaterialModule } from '../../../shared/material/form-material.module';
import { CoreMaterialModule } from '../../../shared/material/core-material.module';

export interface UserPreferences {
  animations: boolean;
}

interface CheckboxChangeEvent {
  checked: boolean;
}

@Component({
  selector: 'app-user-preferences-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FeedbackMaterialModule,
    FormMaterialModule,
    CoreMaterialModule,
    TranslocoModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'userPreferences.title'">User Preferences</h2>
    <mat-dialog-content>
      <div class="preference-item">
        <mat-checkbox
          [(ngModel)]="preferences.animations"
          (change)="onAnimationPreferenceChange($event)">
          <span [transloco]="'userPreferences.diagramAnimationEffects'">Diagram animation effects</span>
        </mat-checkbox>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close()" [transloco]="'common.close'">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .preference-item {
      margin: 16px 0;
    }
    
    mat-dialog-content {
      min-width: 300px;
    }
  `]
})
export class UserPreferencesDialogComponent {
  preferences: UserPreferences;

  constructor(
    public dialogRef: MatDialogRef<UserPreferencesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: unknown,
  ) {
    this.preferences = this.loadPreferences();
  }

  private loadPreferences(): UserPreferences {
    const stored = localStorage.getItem('tmi_user_preferences');
    if (stored) {
      try {
        return JSON.parse(stored) as UserPreferences;
      } catch (e) {
        console.error('Error parsing user preferences:', e);
      }
    }
    
    // Default preferences
    const defaultPrefs: UserPreferences = { animations: true };
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

  close(): void {
    this.dialogRef.close();
  }
}