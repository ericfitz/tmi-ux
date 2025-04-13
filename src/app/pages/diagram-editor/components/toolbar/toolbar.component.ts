import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-diagram-toolbar',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoModule],
  template: `
    <div class="toolbar-container">
      <h3 class="toolbar-title">{{ 'editor.toolbar.title' | transloco }}</h3>

      <div class="toolbar-actions">
        <button
          mat-icon-button
          [disabled]="!hasSelectedCell"
          [matTooltip]="'editor.toolbar.items.delete' | transloco"
          (click)="onDelete()"
        >
          <mat-icon>delete</mat-icon>
        </button>

        <button
          mat-icon-button
          [matTooltip]="'editor.toolbar.items.style' | transloco"
          (click)="onStyle()"
        >
          <mat-icon>palette</mat-icon>
        </button>

        <button
          mat-icon-button
          [matTooltip]="'editor.toolbar.items.grid' | transloco"
          [class.active]="gridEnabled"
          (click)="onToggleGrid()"
        >
          <mat-icon>grid_on</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .toolbar-container {
        padding: 16px;
        background-color: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .toolbar-title {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 18px;
        font-weight: 500;
      }

      .toolbar-actions {
        display: flex;
        gap: 8px;
      }

      button.active {
        background-color: rgba(0, 0, 0, 0.1);
      }
    `,
  ],
})
export class ToolbarComponent {
  @Input() hasSelectedCell = false;
  @Input() gridEnabled = true;

  @Output() deleteCell = new EventEmitter<void>();
  @Output() styleCell = new EventEmitter<void>();
  @Output() toggleGrid = new EventEmitter<boolean>();

  onDelete(): void {
    this.deleteCell.emit();
  }

  onStyle(): void {
    this.styleCell.emit();
  }

  onToggleGrid(): void {
    this.gridEnabled = !this.gridEnabled;
    this.toggleGrid.emit(this.gridEnabled);
  }
}
