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
        <mat-label>Theme</mat-label>
        <mat-select [value]="currentThemeId" (selectionChange)="onThemeChange($event.value)">
          <mat-option *ngFor="let theme of availableThemes" [value]="theme.id">
            {{ theme.name }}
          </mat-option>
        </mat-select>
      </mat-form-field>
    </div>
  `,
  styles: [`
    .theme-selector {
      margin: 10px;
      max-width: 200px;
    }
    
    ::ng-deep .mat-mdc-form-field {
      width: 100%;
    }
  `]
})
export class ThemeSelectorComponent implements OnInit {
  currentThemeId = 'default-theme';
  availableThemes: ThemeInfo[] = [];

  constructor(private diagramRenderer: DiagramRendererService) {}

  ngOnInit(): void {
    // Get saved theme preference
    this.currentThemeId = this.diagramRenderer.getCurrentThemeId();
    
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