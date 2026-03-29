import {
  Injectable,
  ApplicationRef,
  ComponentRef,
  ElementRef,
  Injector,
  createComponent,
} from '@angular/core';

import { MermaidViewerComponent } from '../components/mermaid-viewer/mermaid-viewer.component';

/**
 * Service that initializes MermaidViewerComponent instances on .mermaid elements
 * within a markdown preview container. Returns a cleanup function to destroy them.
 */
@Injectable({ providedIn: 'root' })
export class MermaidViewerService {
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
  ) {}

  /**
   * Find all .mermaid elements in the preview and attach viewer components.
   * @returns Cleanup function that destroys all created components and removes listeners.
   */
  initialize(previewElement: ElementRef<HTMLDivElement>): () => void {
    const mermaidElements = previewElement.nativeElement.querySelectorAll('.mermaid');
    const componentRefs: ComponentRef<MermaidViewerComponent>[] = [];
    const cleanupHandlers: (() => void)[] = [];

    mermaidElements.forEach(mermaidEl => {
      const svg = mermaidEl.querySelector('svg');
      if (!svg) return;

      const htmlEl = mermaidEl as HTMLElement;

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
      const onContextMenu = (e: Event): void =>
        componentRef.instance.onContextMenu(e as MouseEvent);
      const onDblClick = (): void => componentRef.instance.onDoubleClick();

      htmlEl.addEventListener('mouseenter', onMouseEnter);
      htmlEl.addEventListener('mouseleave', onMouseLeave);
      htmlEl.addEventListener('contextmenu', onContextMenu);
      htmlEl.addEventListener('dblclick', onDblClick);

      componentRefs.push(componentRef);
      cleanupHandlers.push(() => {
        htmlEl.removeEventListener('mouseenter', onMouseEnter);
        htmlEl.removeEventListener('mouseleave', onMouseLeave);
        htmlEl.removeEventListener('contextmenu', onContextMenu);
        htmlEl.removeEventListener('dblclick', onDblClick);
        // Reset inline zoom
        svg.style.transform = '';
        svg.style.transformOrigin = '';
        htmlEl.style.position = '';
        htmlEl.style.overflow = '';
      });
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
}
