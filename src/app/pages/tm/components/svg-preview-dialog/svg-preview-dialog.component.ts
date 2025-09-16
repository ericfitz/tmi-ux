import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CORE_MATERIAL_IMPORTS, FORM_MATERIAL_IMPORTS } from '@app/shared/imports';
import { Diagram } from '../../models/diagram.model';

export interface SvgPreviewDialogData {
  diagram: Diagram;
  svgDataUrl: string;
}

@Component({
  selector: 'app-svg-preview-dialog',
  standalone: true,
  imports: [CORE_MATERIAL_IMPORTS, FORM_MATERIAL_IMPORTS],
  template: `
    <div class="svg-preview-dialog">
      <div mat-dialog-title class="dialog-header">
        <h2>{{ data.diagram.name }}</h2>
        <button
          mat-icon-button
          (click)="close()"
          aria-label="Close"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <div class="svg-container">
          <img
            [src]="data.svgDataUrl"
            [alt]="'Large preview of ' + data.diagram.name"
            class="svg-image"
            (error)="onImageError($event)"
            (load)="onImageLoad($event)"
          />
        </div>
        
        <div class="diagram-info">
          <p><strong>Diagram ID:</strong> {{ data.diagram.id }}</p>
          <p><strong>Type:</strong> {{ data.diagram.type }}</p>
          <p><strong>Data URL Length:</strong> {{ data.svgDataUrl.length }} characters</p>
          <p><strong>Base64 Length:</strong> {{ base64Data.length }} characters</p>
          <p><strong>Decoded SVG Length:</strong> {{ decodedSvg.length }} characters</p>
        </div>

        <div class="data-fields">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Base64 Encoded SVG</mat-label>
            <textarea
              matInput
              [value]="base64Data"
              readonly
              rows="4"
              class="monospace-text"
            ></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Decoded SVG Content</mat-label>
            <textarea
              matInput
              [value]="decodedSvg"
              readonly
              rows="8"
              class="monospace-text"
            ></textarea>
          </mat-form-field>
        </div>
      </div>

      <div mat-dialog-actions class="dialog-actions">
        <button mat-button (click)="close()">Close</button>
        <button mat-button (click)="copyDataUrl()">Copy Data URL</button>
      </div>
    </div>
  `,
  styles: [`
    .svg-preview-dialog {
      width: 80vw;
      height: 80vh;
      max-width: 1200px;
      max-height: 900px;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .dialog-header h2 {
      margin: 0;
      flex: 1;
    }

    .dialog-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow: auto;
    }

    .svg-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background-color: #fafafa;
      min-height: 400px;
      overflow: auto;
    }

    .svg-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      border-radius: 4px;
    }

    .diagram-info {
      background-color: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Roboto Condensed', monospace;
      font-size: 12px;
    }

    .diagram-info p {
      margin: 4px 0;
      word-break: break-all;
    }

    .data-fields {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .monospace-text {
      font-family: 'Courier New', monospace;
      font-size: 12px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
  `]
})
export class SvgPreviewDialogComponent {
  base64Data: string;
  decodedSvg: string;

  constructor(
    public dialogRef: MatDialogRef<SvgPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SvgPreviewDialogData
  ) {
    // Extract base64 data from the diagram
    this.base64Data = data.diagram.image?.svg || '';
    
    // Decode the base64 to get SVG content
    try {
      this.decodedSvg = atob(this.base64Data);
    } catch (error) {
      this.decodedSvg = `Error decoding base64: ${String(error)}`;
      console.error('Failed to decode base64 SVG data:', error);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  copyDataUrl(): void {
    void navigator.clipboard.writeText(this.data.svgDataUrl).then(() => {
      // Could add a snackbar here for feedback
    });
  }

  onImageError(event: Event): void {
    console.error('SVG image failed to load:', event);
    console.error('Data URL that failed:', this.data.svgDataUrl.substring(0, 200));
  }

  onImageLoad(event: Event): void {
    console.info('SVG image loaded successfully:', event);
    const img = event.target as HTMLImageElement;
    console.info('Image dimensions:', { 
      naturalWidth: img.naturalWidth, 
      naturalHeight: img.naturalHeight 
    });
  }
}