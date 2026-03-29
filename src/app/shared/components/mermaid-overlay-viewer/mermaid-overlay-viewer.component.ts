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
const MAX_ZOOM = 4;
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

  constructor(
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  ngAfterViewInit(): void {
    if (this.svgHost && this.svgElement) {
      const clone = this.svgElement.cloneNode(true) as SVGSVGElement;
      this.svgHost.nativeElement.appendChild(clone);
    }
  }

  ngOnDestroy(): void {
    this.overlayRef?.dispose();
  }

  @HostListener('document:keydown', ['$event'])
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
  zoomIn(): void {
    this.currentZoom = Math.min(MAX_ZOOM, this.currentZoom + ZOOM_STEP);
  }

  /** Zoom out by one step. */
  zoomOut(): void {
    this.currentZoom = Math.max(MIN_ZOOM, this.currentZoom - ZOOM_STEP);
  }

  /** Reset zoom to 1:1 and clear pan offset. */
  resetZoom(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /** Fit diagram to viewport (currently resets to default 1:1 view). */
  fitToView(): void {
    this.currentZoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  /** Handle mouse wheel scroll to zoom in/out. */
  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  /** Begin a pan drag. */
  onPointerDown(event: PointerEvent): void {
    this.isPanning = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  /** Update pan position while dragging. */
  onPointerMove(event: PointerEvent): void {
    if (!this.isPanning) return;
    this.panX = this.panStartX + (event.clientX - this.dragStartX);
    this.panY = this.panStartY + (event.clientY - this.dragStartY);
  }

  /** End a pan drag. */
  onPointerUp(event: PointerEvent): void {
    this.isPanning = false;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  }

  /** Close and dispose the overlay. */
  close(): void {
    try {
      this.onClose?.();
    } finally {
      this.overlayRef?.dispose();
    }
  }

  /** Export the diagram as an SVG file. */
  onExportSvg(): void {
    try {
      exportAsSvg(this.svgElement);
    } catch (err) {
      this.logger.error('Failed to export SVG', err);
      this.showError();
    }
  }

  /** Export the diagram as a PNG file. */
  async onExportPng(): Promise<void> {
    try {
      await exportAsPng(this.svgElement, this.currentZoom);
    } catch (err) {
      this.logger.error('Failed to export PNG', err);
      this.showError();
    }
  }

  /** Copy the diagram to the clipboard as a PNG image. */
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

  private showError(): void {
    this.snackBar.open(this.translocoService.translate('mermaidViewer.exportFailed'), '', {
      duration: 4000,
      panelClass: ['error-snackbar'],
    });
  }
}
