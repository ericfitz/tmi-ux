import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';

export interface CanvasDropEvent {
  elementType: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-diagram-canvas',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule, TranslocoModule],
  template: `
    <div class="canvas-container" [class.loading]="loading">
      <div
        #canvasElement
        class="canvas"
        [class.grid-enabled]="gridEnabled"
        [class.drag-over]="isDragOver"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      ></div>

      <!-- Loading overlay with spinner -->
      <div class="loading-overlay" *ngIf="loading">
        <mat-spinner diameter="50"></mat-spinner>
        <p class="loading-text">{{ loadingMessage }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .canvas-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #ffffff;
      }

      .canvas {
        width: 100%;
        height: 100%;
        overflow: auto;
      }

      .grid-enabled {
        background-image:
          linear-gradient(#e0e0e0 1px, transparent 1px),
          linear-gradient(90deg, #e0e0e0 1px, transparent 1px);
        background-size: 20px 20px;
      }

      .drag-over {
        border: 2px dashed #2196f3;
        background-color: rgba(33, 150, 243, 0.05);
      }

      .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background-color: rgba(255, 255, 255, 0.8);
        z-index: 10;
      }

      .loading-text {
        margin-top: 16px;
        font-size: 16px;
        color: #616161;
      }
    `,
  ],
})
export class DiagramCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLDivElement>;

  @Input() gridEnabled = true;
  @Input() loading = false;
  @Input() loadingMessage = 'Loading diagram...';

  @Output() canvasReady = new EventEmitter<HTMLElement>();
  @Output() elementDropped = new EventEmitter<CanvasDropEvent>();

  isDragOver = false;

  ngAfterViewInit(): void {
    if (this.canvasElement) {
      this.canvasReady.emit(this.canvasElement.nativeElement);
    }
  }

  ngOnDestroy(): void {
    // Clean up any resources if needed
  }

  /**
   * Handle dragover event on the canvas
   * @param event The drag event
   */
  onDragOver(event: DragEvent): void {
    // Prevent default to allow drop
    event.preventDefault();

    // Set the dropEffect to copy
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    // Add visual indicator that dropping is allowed
    this.isDragOver = true;
  }

  /**
   * Handle dragleave event on the canvas
   * @param event The drag event
   */
  onDragLeave(event: DragEvent): void {
    // Prevent default
    event.preventDefault();

    // Remove visual indicator
    this.isDragOver = false;
  }

  /**
   * Handle drop event on the canvas
   * @param event The drag event
   */
  onDrop(event: DragEvent): void {
    // Prevent default browser behavior
    event.preventDefault();

    // Remove visual indicator
    this.isDragOver = false;

    // Get the element type from the dataTransfer
    if (event.dataTransfer) {
      const elementType = event.dataTransfer.getData('application/diagram-element');

      if (elementType) {
        // Calculate the drop position relative to the canvas
        const canvasRect = this.canvasElement.nativeElement.getBoundingClientRect();
        const x = event.clientX - canvasRect.left;
        const y = event.clientY - canvasRect.top;

        // Emit the drop event
        this.elementDropped.emit({ elementType, x, y });
      }
    }
  }
}
