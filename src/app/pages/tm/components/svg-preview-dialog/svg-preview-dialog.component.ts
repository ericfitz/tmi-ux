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
        <button mat-icon-button (click)="close()" aria-label="Close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div mat-dialog-content class="dialog-content">
        <div class="svg-previews">
          <div class="svg-container">
            <h3>Original SVG</h3>
            <img
              [src]="data.svgDataUrl"
              [alt]="'Original preview of ' + data.diagram.name"
              class="svg-image"
              (error)="onOriginalImageError($event)"
              (load)="onOriginalImageLoad($event)"
            />
          </div>

          <div class="svg-container">
            <h3>Processed SVG (viewBox removed)</h3>
            <img
              [src]="processedDataUrl"
              [alt]="'Processed preview of ' + data.diagram.name"
              class="svg-image"
              (error)="onProcessedImageError($event)"
              (load)="onProcessedImageLoad($event)"
            />
          </div>
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
            <mat-label>Decoded SVG Content (Original)</mat-label>
            <textarea
              matInput
              [value]="decodedSvg"
              readonly
              rows="6"
              class="monospace-text"
            ></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Processed SVG Content (viewBox removed)</mat-label>
            <textarea
              matInput
              [value]="processedSvg"
              readonly
              rows="6"
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
  styles: [
    `
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

      .svg-previews {
        display: flex;
        gap: 16px;
        flex: 1;
        min-height: 400px;
      }

      .svg-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        background-color: #fafafa;
        overflow: auto;
      }

      .svg-container h3 {
        margin: 8px 12px;
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }

      .svg-container .svg-image {
        flex: 1;
        margin: 12px;
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
    `,
  ],
})
export class SvgPreviewDialogComponent {
  base64Data: string;
  decodedSvg: string;
  processedSvg: string;
  processedDataUrl: string;

  constructor(
    public dialogRef: MatDialogRef<SvgPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SvgPreviewDialogData,
  ) {
    // Extract base64 data from the diagram
    this.base64Data = data.diagram.image?.svg || '';

    // Decode the base64 to get SVG content
    try {
      this.decodedSvg = atob(this.base64Data);
      this.processedSvg = this.processSvgForBetterDisplay(this.decodedSvg);
      // Use modern UTF-8 safe encoding for SVG content
      const encoder = new TextEncoder();
      const data = encoder.encode(this.processedSvg);
      const base64Svg = btoa(String.fromCharCode(...data));
      this.processedDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
    } catch (error) {
      this.decodedSvg = `Error decoding base64: ${String(error)}`;
      this.processedSvg = this.decodedSvg;
      this.processedDataUrl = this.data.svgDataUrl;
      console.error('Failed to decode base64 SVG data:', error);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  /**
   * Process SVG to improve display by removing or adjusting viewBox
   * @param svgContent The original SVG content
   * @returns Processed SVG content
   */
  private processSvgForBetterDisplay(svgContent: string): string {
    try {
      // Create a temporary DOM element to parse the SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        return svgContent; // Return original if we can't parse it
      }

      // Option 1: Remove viewBox entirely and let browser auto-fit
      svgElement.removeAttribute('viewBox');

      // Option 2: Set width and height to auto to let content determine size
      svgElement.setAttribute('width', 'auto');
      svgElement.setAttribute('height', 'auto');

      // Option 3: Try to calculate bounding box of visible content
      // This is more complex and would require analyzing all elements

      return new XMLSerializer().serializeToString(svgDoc);
    } catch (error) {
      console.error('Failed to process SVG:', error);
      return svgContent; // Return original on error
    }
  }

  copyDataUrl(): void {
    void navigator.clipboard.writeText(this.data.svgDataUrl).then(() => {
      // Could add a snackbar here for feedback
    });
  }

  onOriginalImageError(event: Event): void {
    console.error('Original SVG image failed to load:', event);
    console.error('Original data URL that failed:', this.data.svgDataUrl.substring(0, 200));
  }

  onOriginalImageLoad(event: Event): void {
    console.info('Original SVG image loaded successfully:', event);
    const img = event.target as HTMLImageElement;
    console.info('Original image dimensions:', {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  }

  onProcessedImageError(event: Event): void {
    console.error('Processed SVG image failed to load:', event);
    console.error('Processed data URL that failed:', this.processedDataUrl.substring(0, 200));
  }

  onProcessedImageLoad(event: Event): void {
    console.info('Processed SVG image loaded successfully:', event);
    const img = event.target as HTMLImageElement;
    console.info('Processed image dimensions:', {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });
  }
}
