import { Component, ElementRef, Injector, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatMenuTrigger } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Overlay, OverlayConfig, GlobalPositionStrategy } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

import { CORE_MATERIAL_IMPORTS, FEEDBACK_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../core/services/logger.service';
import { exportAsSvg, exportAsPng, copyDiagramToClipboard } from '../../utils/mermaid-export.utils';
import { MermaidOverlayViewerComponent } from '../mermaid-overlay-viewer/mermaid-overlay-viewer.component';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 16;
const ZOOM_STEP = 0.25;

/**
 * Inline mermaid diagram viewer with hover toolbar and context menu.
 * Attached to each .mermaid element by MermaidViewerService.
 *
 * The SVG element is looked up dynamically from mermaidElement rather than
 * stored as a reference, because mermaid.run() replaces the .mermaid element's
 * innerHTML asynchronously, which invalidates any previously stored SVG reference.
 */
@Component({
  selector: 'app-mermaid-viewer',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ...CORE_MATERIAL_IMPORTS, ...FEEDBACK_MATERIAL_IMPORTS],
  templateUrl: './mermaid-viewer.component.html',
  styleUrls: ['./mermaid-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: render a Mermaid diagram with inline zoom, context menu, and fullscreen overlay
export class MermaidViewerComponent {
  @ViewChild('contextMenuTrigger') contextMenuTrigger?: MatMenuTrigger;

  /** The .mermaid container element. Set by MermaidViewerService. */
  mermaidElement!: HTMLElement;

  currentZoom = 1;

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: inject overlay, injector, i18n, snackbar, and logger dependencies (pure)
  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private overlay: Overlay,
    private injector: Injector,
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  /** Get the toolbar element from this component's DOM. */
  private get toolbarElement(): HTMLElement | null {
    return this.elementRef.nativeElement.querySelector('.mermaid-toolbar');
  }

  /**
   * Get the current SVG element from the mermaid container.
   * Looked up dynamically because mermaid.run() may replace the innerHTML.
   */
  private get svgElement(): SVGSVGElement | null {
    return this.mermaidElement?.querySelector('svg') ?? null;
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: show the diagram toolbar when the pointer enters the viewer (mutates shared state)
  onMouseEnter(): void {
    this.toolbarElement?.classList.add('mermaid-toolbar-visible');
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: hide the diagram toolbar when the pointer leaves the viewer (mutates shared state)
  onMouseLeave(): void {
    this.toolbarElement?.classList.remove('mermaid-toolbar-visible');
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: open the context menu at the pointer position on right-click (mutates shared state)
  onContextMenu(event: MouseEvent): void {
    event.preventDefault();
    // Update context menu trigger position via direct DOM (Angular bindings
    // don't work for dynamically created components attached to appRef)
    const triggerContainer =
      this.elementRef.nativeElement.querySelector<HTMLElement>('.context-menu-anchor');
    if (triggerContainer) {
      triggerContainer.style.left = `${event.clientX}px`;
      triggerContainer.style.top = `${event.clientY}px`;
    }
    this.contextMenuTrigger?.openMenu();
  }

  // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: open the fullscreen overlay when the diagram is double-clicked
  onDoubleClick(): void {
    this.openOverlay();
  }

  // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: increase diagram zoom level by one step and apply to SVG (mutates shared state)
  zoomIn(): void {
    this.currentZoom = Math.min(MAX_ZOOM, this.currentZoom + ZOOM_STEP);
    this.applyInlineZoom();
  }

  // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: decrease diagram zoom level by one step and apply to SVG (mutates shared state)
  zoomOut(): void {
    this.currentZoom = Math.max(MIN_ZOOM, this.currentZoom - ZOOM_STEP);
    this.applyInlineZoom();
  }

  // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: reset diagram zoom to 1:1 and apply to the inline SVG (mutates shared state)
  resetZoom(): void {
    this.currentZoom = 1;
    this.applyInlineZoom();
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: build and attach a fullscreen overlay portal displaying the diagram SVG
  openOverlay(): void {
    const svg = this.svgElement;
    if (!svg) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const config = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-dark-backdrop',
      positionStrategy: new GlobalPositionStrategy().top('0').left('0'),
      width: '100vw',
      height: '100vh',
    });

    const overlayRef = this.overlay.create(config);
    const portal = new ComponentPortal(MermaidOverlayViewerComponent, null, this.injector);
    const componentRef = overlayRef.attach(portal);

    componentRef.instance.svgElement = svg;
    componentRef.instance.overlayRef = overlayRef;
    componentRef.instance.onClose = (): void => previouslyFocused?.focus();

    // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: return keyboard focus to the element that was active before the overlay opened
    const restoreFocus = (): void => {
      previouslyFocused?.focus();
    };

    overlayRef.backdropClick().subscribe(() => {
      overlayRef.dispose();
      restoreFocus();
    });
    overlayRef.keydownEvents().subscribe(event => {
      if (event.key === 'Escape') {
        overlayRef.dispose();
        restoreFocus();
      }
    });
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: export the rendered diagram SVG to a downloadable file
  async onExportSvg(): Promise<void> {
    const svg = this.svgElement;
    if (!svg) return;
    try {
      await exportAsSvg(svg);
    } catch (err) {
      this.logger.error('Failed to export SVG', err);
      this.showExportError();
    }
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: export the rendered diagram as a PNG at the current zoom level
  async onExportPng(): Promise<void> {
    const svg = this.svgElement;
    if (!svg) return;
    try {
      await exportAsPng(svg, this.currentZoom);
    } catch (err) {
      this.logger.error('Failed to export PNG', err);
      this.showExportError();
    }
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: copy the rendered diagram image to the system clipboard
  async copyToClipboard(): Promise<void> {
    const svg = this.svgElement;
    if (!svg) return;
    try {
      await copyDiagramToClipboard(svg, this.currentZoom);
      this.snackBar.open(this.translocoService.translate('common.copiedToClipboard'), '', {
        duration: 2000,
      });
    } catch (err) {
      this.logger.error('Failed to copy diagram to clipboard', err);
      this.showExportError();
    }
  }

  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: apply CSS scale transform to the SVG element at current zoom (mutates shared state)
  private applyInlineZoom(): void {
    const svg = this.svgElement;
    if (svg) {
      svg.style.transform = `scale(${this.currentZoom})`;
      svg.style.transformOrigin = 'center center';
    }
  }

  // SEM@06a4092abccd8f89fbdc19c676d5362526585d95: notify the user of a diagram export failure via snackbar
  private showExportError(): void {
    this.snackBar.open(this.translocoService.translate('mermaidViewer.exportFailed'), '', {
      duration: 4000,
      panelClass: ['error-snackbar'],
    });
  }
}
