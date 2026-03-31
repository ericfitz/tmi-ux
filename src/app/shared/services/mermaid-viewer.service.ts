import {
  Injectable,
  ApplicationRef,
  ComponentRef,
  ElementRef,
  Injector,
  createComponent,
} from '@angular/core';

import { LoggerService } from '../../core/services/logger.service';
import { MermaidViewerComponent } from '../components/mermaid-viewer/mermaid-viewer.component';

/** Max time (ms) to wait for mermaid to render SVGs before giving up. */
const SVG_WAIT_TIMEOUT = 10_000;

/**
 * Service that initializes MermaidViewerComponent instances on .mermaid elements
 * within a markdown preview container. Returns a cleanup function to destroy them.
 *
 * Because mermaid.run() is async and ngx-markdown does not await it, SVGs may not
 * exist when this service is first called. A MutationObserver watches each .mermaid
 * element for SVG insertion and attaches the viewer once the SVG appears.
 */
@Injectable({ providedIn: 'root' })
export class MermaidViewerService {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private logger: LoggerService,
  ) {}

  /**
   * Find all .mermaid elements in the preview and attach viewer components.
   * If an SVG is not yet present (mermaid still rendering), a MutationObserver
   * waits for it to appear before attaching the viewer.
   * @returns Cleanup function that destroys all created components and removes listeners.
   */
  initialize(previewElement: ElementRef<HTMLDivElement>): () => void {
    const mermaidElements = previewElement.nativeElement.querySelectorAll('.mermaid');
    const componentRefs: ComponentRef<MermaidViewerComponent>[] = [];
    const cleanupHandlers: (() => void)[] = [];

    mermaidElements.forEach(mermaidEl => {
      const htmlEl = mermaidEl as HTMLElement;
      const svg = htmlEl.querySelector('svg');

      if (svg) {
        // SVG already rendered — attach immediately
        const cleanup = this.attachViewer(htmlEl, svg, componentRefs);
        cleanupHandlers.push(cleanup);
      } else {
        // SVG not yet rendered — observe for insertion
        const cleanup = this.observeForSvg(htmlEl, componentRefs);
        cleanupHandlers.push(cleanup);
      }
    });

    return (): void => {
      for (const handler of cleanupHandlers) {
        handler();
      }
      for (const ref of componentRefs) {
        this.appRef.detachView(ref.hostView);
        ref.destroy();
      }
    };
  }

  /**
   * Watch a .mermaid element for an SVG child to be inserted, then attach the viewer.
   * Disconnects automatically on SVG detection or timeout.
   */
  private observeForSvg(
    htmlEl: HTMLElement,
    componentRefs: ComponentRef<MermaidViewerComponent>[],
  ): () => void {
    let observerCleanup: (() => void) | undefined;
    let attached = false;

    const observer = new MutationObserver(() => {
      const svg = htmlEl.querySelector('svg');
      if (svg) {
        attached = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        observerCleanup = this.attachViewer(htmlEl, svg, componentRefs);
      }
    });

    observer.observe(htmlEl, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => {
      if (!attached) {
        observer.disconnect();
        this.logger.warn('Mermaid SVG not rendered within timeout — viewer not attached');
      }
    }, SVG_WAIT_TIMEOUT);

    return (): void => {
      observer.disconnect();
      clearTimeout(timeoutId);
      observerCleanup?.();
    };
  }

  /**
   * Create and attach a MermaidViewerComponent to a .mermaid element.
   * @returns Cleanup function for event listeners and inline styles.
   */
  private attachViewer(
    htmlEl: HTMLElement,
    svg: SVGSVGElement,
    componentRefs: ComponentRef<MermaidViewerComponent>[],
  ): () => void {
    // Make the mermaid container a positioning context
    htmlEl.style.position = 'relative';
    htmlEl.style.overflow = 'auto';

    // Create the viewer component dynamically
    const componentRef = createComponent(MermaidViewerComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: this.injector,
    });

    componentRef.instance.mermaidElement = htmlEl;
    componentRef.instance.svgElement = svg;
    componentRef.instance.setChangeDetectorRef(componentRef.changeDetectorRef);

    // Append the component's host element to the mermaid container
    htmlEl.appendChild(componentRef.location.nativeElement);
    this.appRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();

    // Attach event listeners on the mermaid container
    const onMouseEnter = (): void => componentRef.instance.onMouseEnter();
    const onMouseLeave = (): void => componentRef.instance.onMouseLeave();
    const onContextMenu = (e: Event): void => componentRef.instance.onContextMenu(e as MouseEvent);
    const onDblClick = (): void => componentRef.instance.onDoubleClick();

    htmlEl.addEventListener('mouseenter', onMouseEnter);
    htmlEl.addEventListener('mouseleave', onMouseLeave);
    htmlEl.addEventListener('contextmenu', onContextMenu);
    htmlEl.addEventListener('dblclick', onDblClick);

    componentRefs.push(componentRef);

    return (): void => {
      htmlEl.removeEventListener('mouseenter', onMouseEnter);
      htmlEl.removeEventListener('mouseleave', onMouseLeave);
      htmlEl.removeEventListener('contextmenu', onContextMenu);
      htmlEl.removeEventListener('dblclick', onDblClick);
      // Reset inline zoom
      svg.style.transform = '';
      svg.style.transformOrigin = '';
      htmlEl.style.position = '';
      htmlEl.style.overflow = '';
    };
  }
}
