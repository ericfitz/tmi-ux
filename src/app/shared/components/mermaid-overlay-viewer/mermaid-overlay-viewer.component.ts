import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OverlayRef } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';

import { CORE_MATERIAL_IMPORTS, FEEDBACK_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../core/services/logger.service';
import { exportAsSvg, exportAsPng, copyDiagramToClipboard } from '../../utils/mermaid-export.utils';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const ZOOM_STEP = 0.25;

/**
 * Full-viewport overlay for viewing a mermaid diagram with zoom and pan controls.
 * Opened programmatically via CDK Overlay.
 */
@Component({
  selector: 'app-mermaid-overlay-viewer',
  standalone: true,
  imports: [
    CommonModule,
    TranslocoModule,
    A11yModule,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
  ],
  templateUrl: './mermaid-overlay-viewer.component.html',
  styleUrls: ['./mermaid-overlay-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: full-screen overlay to view, zoom, pan, and export a Mermaid diagram SVG (mutates shared state)
export class MermaidOverlayViewerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgHost') svgHost?: ElementRef<HTMLDivElement>;

  /** The SVG element to display. Set by the opener before view init. */
  svgElement!: SVGSVGElement;

  /** The CDK OverlayRef. Set by the opener for close/dispose. */
  overlayRef!: OverlayRef;

  /** Optional callback invoked when the overlay closes, for focus restoration. */
  onClose?: () => void;

  currentZoom = 1;
  panX = 0;
  panY = 0;
  isPanning = false;

  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;

  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: inject translation, snack-bar, and logger dependencies (pure)
  constructor(
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: clone and mount the SVG element into the overlay host container (mutates shared state)
  ngAfterViewInit(): void {
    if (this.svgHost && this.svgElement) {
      const clone = this.svgElement.cloneNode(true) as SVGSVGElement;
      this.svgHost.nativeElement.appendChild(clone);
    }
  }

  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: dispose the CDK overlay when the component is destroyed (mutates shared state)
  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  @HostListener('document:keydown', ['$event'])
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: dispatch keyboard shortcuts for zoom, reset, and close actions (mutates shared state)
  handleKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case '+':
      case '=':
        event.preventDefault();
        this.zoomIn();
        break;
      case '-':
        event.preventDefault();
        this.zoomOut();
        break;
      case '0':
        event.preventDefault();
        this.resetZoom();
        break;
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
  }

  /** Zoom in by one step. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: increase diagram zoom level by one step, clamped to maximum (mutates shared state)
  zoomIn(): void {
    this.currentZoom = Math.min(MAX_ZOOM, this.currentZoom + ZOOM_STEP);
  }

  /** Zoom out by one step. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: decrease diagram zoom level by one step, clamped to minimum (mutates shared state)
  zoomOut(): void {
    this.currentZoom = Math.max(MIN_ZOOM, this.currentZoom - ZOOM_STEP);
  }

  /** Reset zoom to 1:1 and clear pan offset. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: reset diagram zoom to 1:1 and clear pan offset (mutates shared state)
  resetZoom(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /** Fit diagram to viewport (currently resets to default 1:1 view). */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: fit diagram to viewport by resetting zoom and pan to default (mutates shared state)
  fitToView(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /** Handle mouse wheel scroll to zoom in/out. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: handle mouse wheel scroll to zoom the diagram in or out (mutates shared state)
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  /** Begin a pan drag. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: begin a pan drag, capturing pointer and recording drag origin (mutates shared state)
  onPointerDown(event: PointerEvent): void {
    this.isPanning = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Update pan position while dragging. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: update pan offset while pointer drag is active (mutates shared state)
  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  /** End a pan drag. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: end a pan drag and release pointer capture (mutates shared state)
  onPointerUp(event: PointerEvent): void {
    this.isPanning = false;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }

  /** Close and dispose the overlay. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: invoke close callback then dispose the overlay (mutates shared state)
  close(): void {
    try {
      this.onClose?.();
    } finally {
      this.overlayRef?.dispose();
    }
  }

  /** Export the diagram as an SVG file. */
  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: export the diagram SVG element as a downloadable SVG file
  async onExportSvg(): Promise<void> {
    try {
      await exportAsSvg(this.svgElement);
    } catch (err) {
      this.logger.error('Failed to export SVG', err);
      this.showError();
    }
  }

  /** Export the diagram as a PNG file. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: export the diagram SVG element as a downloadable PNG file at current zoom
  async onExportPng(): Promise<void> {
    try {
      await exportAsPng(this.svgElement, this.currentZoom);
    } catch (err) {
      this.logger.error('Failed to export PNG', err);
      this.showError();
    }
  }

  /** Copy the diagram to the clipboard as a PNG image. */
  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: copy the diagram to the clipboard as a PNG image and notify the user
  async copyToClipboard(): Promise<void> {
    try {
      await copyDiagramToClipboard(this.svgElement, this.currentZoom);
      this.snackBar.open(this.translocoService.translate('common.copiedToClipboard'), '', {
        duration: 2000,
      });
    } catch (err) {
      this.logger.error('Failed to copy diagram to clipboard', err);
      this.showError();
    }
  }

  // SEM@a176d9b44e5e25af3d59fd2466636610806c4689: notify the user of an export failure via a snackbar error message
  private showError(): void {
    this.snackBar.open(this.translocoService.translate('mermaidViewer.exportFailed'), '', {
      duration: 4000,
      panelClass: ['error-snackbar'],
    });
  }
}
