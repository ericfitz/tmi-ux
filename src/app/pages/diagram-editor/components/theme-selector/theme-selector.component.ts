import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { DiagramThemeService } from '../../services/theming/diagram-theme.service';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, FormsModule],
  template: `
    <mat-form-field appearance="outline" class="theme-selector">
      <mat-label>Theme</mat-label>
      <mat-select [value]="currentTheme" (selectionChange)="onThemeChange($event.value)">
        <mat-option *ngFor="let theme of availableThemes" [value]="theme">
          {{ theme }}
        </mat-option>
      </mat-select>
    </mat-form-field>
  `,
  styles: [
    `
      .theme-selector {
        width: 150px;
        font-size: 14px;
      }

      ::ng-deep .theme-selector .mat-mdc-form-field-infix {
        padding-top: 8px;
        padding-bottom: 8px;
      }
    `,
  ],
})
export class ThemeSelectorComponent implements OnInit {
  currentTheme: string = 'tmi-default';
  availableThemes: string[] = ['tmi-default'];

  constructor(private themeService: DiagramThemeService) {}

  ngOnInit(): void {
    // Get current theme
    this.currentTheme = this.themeService.getCurrentTheme();

    // Get available themes
    const stylesheets = this.themeService.getAvailableThemes();
    if (stylesheets && stylesheets.length > 0) {
      this.availableThemes = stylesheets;
    }
  }

  onThemeChange(theme: string): void {
    this.themeService.setCurrentTheme(theme);
    this.currentTheme = theme;
  }
}
