import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

export interface PaletteItemEvent {
  type: string;
  event: DragEvent | MouseEvent;
}

@Component({
  selector: 'app-diagram-palette',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoModule],
  template: `
    <div class="palette-container">
      <h3 class="palette-title">{{ 'editor.palette.title' | transloco }}</h3>

      <div class="palette-items">
        <!-- Process -->
        <div
          class="palette-item"
          draggable="true"
          [matTooltip]="'editor.palette.items.process' | transloco"
          (dragstart)="onDragStart($event, 'process')"
          (click)="onClick($event, 'process')"
        >
          <mat-icon class="process-icon">crop_square</mat-icon>
          <span class="item-label">{{ 'editor.palette.items.process' | transloco }}</span>
        </div>

        <!-- Store -->
        <div
          class="palette-item"
          draggable="true"
          [matTooltip]="'editor.palette.items.store' | transloco"
          (dragstart)="onDragStart($event, 'store')"
          (click)="onClick($event, 'store')"
        >
          <mat-icon class="store-icon">database</mat-icon>
          <span class="item-label">{{ 'editor.palette.items.store' | transloco }}</span>
        </div>

        <!-- Actor -->
        <div
          class="palette-item"
          draggable="true"
          [matTooltip]="'editor.palette.items.actor' | transloco"
          (dragstart)="onDragStart($event, 'actor')"
          (click)="onClick($event, 'actor')"
        >
          <mat-icon class="actor-icon">person</mat-icon>
          <span class="item-label">{{ 'editor.palette.items.actor' | transloco }}</span>
        </div>

        <!-- Flow -->
        <div
          class="palette-item"
          [matTooltip]="'editor.palette.items.flow' | transloco"
          (click)="onClick($event, 'flow')"
        >
          <mat-icon class="flow-icon">arrow_forward</mat-icon>
          <span class="item-label">{{ 'editor.palette.items.flow' | transloco }}</span>
        </div>

        <!-- Boundary -->
        <div
          class="palette-item"
          draggable="true"
          [matTooltip]="'editor.palette.items.boundary' | transloco"
          (dragstart)="onDragStart($event, 'boundary')"
          (click)="onClick($event, 'boundary')"
        >
          <mat-icon class="boundary-icon">crop_square</mat-icon>
          <span class="item-label">{{ 'editor.palette.items.boundary' | transloco }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .palette-container {
        padding: 16px;
        background-color: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .palette-title {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 18px;
        font-weight: 500;
      }

      .palette-items {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .palette-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .palette-item:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }

      .palette-item:active {
        background-color: rgba(0, 0, 0, 0.1);
      }

      .process-icon {
        color: #2196f3;
      }

      .store-icon {
        color: #4caf50;
      }

      .actor-icon {
        color: #9c27b0;
      }

      .flow-icon {
        color: #ff9800;
      }

      .boundary-icon {
        color: #9e9e9e;
      }

      .item-label {
        font-size: 14px;
      }
    `,
  ],
})
export class PaletteComponent {
  @Output() itemDragStart = new EventEmitter<PaletteItemEvent>();
  @Output() itemClick = new EventEmitter<PaletteItemEvent>();

  onDragStart(event: DragEvent, type: string): void {
    if (event.dataTransfer) {
      // Set the drag data
      event.dataTransfer.setData('application/diagram-element', type);

      // Create a custom drag image
      const dragIcon = document.createElement('div');
      dragIcon.style.width = '40px';
      dragIcon.style.height = '40px';
      dragIcon.style.borderRadius = '4px';
      dragIcon.style.backgroundColor = '#2196F3';
      dragIcon.style.display = 'flex';
      dragIcon.style.alignItems = 'center';
      dragIcon.style.justifyContent = 'center';

      // Add an icon to the drag image
      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined';
      iconSpan.style.color = 'white';
      iconSpan.style.fontSize = '24px';

      switch (type) {
        case 'process':
          iconSpan.textContent = 'crop_square';
          break;
        case 'store':
          iconSpan.textContent = 'database';
          break;
        case 'actor':
          iconSpan.textContent = 'person';
          break;
        case 'boundary':
          iconSpan.textContent = 'crop_square';
          break;
      }

      dragIcon.appendChild(iconSpan);
      document.body.appendChild(dragIcon);

      // Set it as the drag image and position it at the cursor
      event.dataTransfer.setDragImage(dragIcon, 20, 20);

      // Set effectAllowed to copy to indicate we're creating a new element
      event.dataTransfer.effectAllowed = 'copy';

      // Set a timeout to remove the ghost element after it's no longer needed
      setTimeout(() => {
        document.body.removeChild(dragIcon);
      }, 0);
    }

    this.itemDragStart.emit({ type, event });
  }

  onClick(event: MouseEvent, type: string): void {
    this.itemClick.emit({ type, event });
  }
}
