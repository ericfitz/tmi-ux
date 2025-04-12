import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DiagramRendererService } from '../services/diagram-renderer.service';
import { ThemeInfo } from '../models/diagram-theme.model';

@Component({
  selector: 'app-theme-selector',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatSelectModule],
  template: `
    <div class="theme-selector">
      <mat-form-field appearance="fill">
        <mat-select
          [value]="currentThemeId"
          (selectionChange)="onThemeChange($event.value)"
          placeholder="Theme"
        >
          <mat-option *ngFor="let theme of availableThemes" [value]="theme.id">
            {{ theme.name }} theme
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [
    `
      .theme-selector {
        margin: 0;
        max-width: 180px;
        display: flex;
        align-items: center;
      }

      ::ng-deep .mat-mdc-form-field {
        width: 100%;
      }

      ::ng-deep .mat-mdc-text-field-wrapper {
        padding: 0 8px !important;
        height: 32px !important;
      }

      ::ng-deep .mat-mdc-form-field-infix {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
        min-height: unset !important;
      }

      ::ng-deep .mat-mdc-form-field-flex .mdc-floating-label {
        display: none !important;
      }

      ::ng-deep .mdc-text-field--filled:not(.mdc-text-field--disabled) {
        background-color: transparent;
      }

      ::ng-deep .mat-mdc-select-value-text {
        font-size: 13px;
      }

      ::ng-deep .mat-mdc-select-placeholder {
        color: rgba(0, 0, 0, 0.6);
        font-size: 13px;
      }

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    `,
  ],
})
export class ThemeSelectorComponent implements OnInit {
  currentThemeId = 'default-theme';
  availableThemes: ThemeInfo[] = [];

  constructor(private diagramRenderer: DiagramRendererService) {}

  ngOnInit(): void {
    // Get saved theme preference
    const themeId = this.diagramRenderer.getCurrentThemeId();
    if (themeId) {
      this.currentThemeId = themeId;
    }

    // Load available themes
    this.diagramRenderer.getAvailableThemes().subscribe(themes => {
      this.availableThemes = themes;
    });
  }

  onThemeChange(themeId: string): void {
    this.currentThemeId = themeId;
    // Use void operator to explicitly mark the promise as handled
    void this.diagramRenderer.switchTheme(themeId);
  }
}
