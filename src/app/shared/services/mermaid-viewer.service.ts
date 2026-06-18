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

/** Class name applied to the wrapper div created around each .mermaid element. */
const WRAPPER_CLASS = 'mermaid-viewer-wrapper';

/**
 * Service that initializes MermaidViewerComponent instances on .mermaid elements
 * within a markdown preview container. Returns a cleanup function to destroy them.
 *
 * The viewer component is placed as a sibling of the .mermaid element inside a
 * wrapper div, rather than as a child of .mermaid. This is necessary because
 * mermaid.run() replaces the .mermaid element's innerHTML asynchronously, which
 * would destroy any child nodes we append. The wrapper is immune to this because
 * innerHTML replacement only affects the target element's children, not its siblings.
 */
@Injectable({ providedIn: 'root' })
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: attach and manage MermaidViewerComponent overlays on diagram elements
export class MermaidViewerService {
  // SEM@8967000098ce9524a88950fb01388a9402de0924: inject application ref, injector, and logger dependencies
  constructor(
    private appRef: ApplicationRef,
    private injector: Injector,
    private logger: LoggerService,
  ) {}

  /**
   * Find all .mermaid elements in the preview and attach viewer components.
   * @returns Cleanup function, or null if no .mermaid elements exist yet.
   */
  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: attach viewer components to all diagram elements; return cleanup function (mutates DOM)
  initialize(previewElement: ElementRef<HTMLDivElement>): (() => void) | null {
    const mermaidElements = previewElement.nativeElement.querySelectorAll('.mermaid');

    if (mermaidElements.length === 0) {
      return null;
    }

    const componentRefs: ComponentRef<MermaidViewerComponent>[] = [];
    const cleanupHandlers: (() => void)[] = [];

    mermaidElements.forEach(mermaidEl => {
      const htmlEl = mermaidEl as HTMLElement;
      const cleanup = this.attachViewer(htmlEl, componentRefs);
      cleanupHandlers.push(cleanup);
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
   * Create a wrapper around the .mermaid element and attach a MermaidViewerComponent
   * as a sibling. The wrapper serves as the positioning context for the viewer's
   * absolute positioning.
   *
   * The viewer is NOT appended inside .mermaid because mermaid.run() asynchronously
   * replaces .mermaid's innerHTML, which would destroy any appended children.
   *
   * @returns Cleanup function that removes the wrapper, restores the .mermaid element
   * to its original position, and removes event listeners.
   */
  // SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: wrap a diagram element, mount viewer component as sibling, wire events (mutates DOM)
  private attachViewer(
    mermaidEl: HTMLElement,
    componentRefs: ComponentRef<MermaidViewerComponent>[],
  ): () => void {
    const parent = mermaidEl.parentElement;
    if (!parent) {
      this.logger.warn('Mermaid element has no parent — cannot attach viewer');
      return (): void => {};
    }

    // Create wrapper and insert it where .mermaid currently is
    const wrapper = document.createElement('div');
    wrapper.className = WRAPPER_CLASS;
    wrapper.style.position = 'relative';
    parent.insertBefore(wrapper, mermaidEl);
    wrapper.appendChild(mermaidEl);

    // Create the viewer component dynamically
    const componentRef = createComponent(MermaidViewerComponent, {
      environmentInjector: this.appRef.injector,
      elementInjector: this.injector,
    });

    componentRef.instance.mermaidElement = mermaidEl;

    // Append the viewer as a sibling of .mermaid inside the wrapper
    wrapper.appendChild(componentRef.location.nativeElement);
    this.appRef.attachView(componentRef.hostView);

    // Attach event listeners on the wrapper so the toolbar (a sibling of .mermaid
    // inside the wrapper) is included in the hover area
    // SEM@8967000098ce9524a88950fb01388a9402de0924: handle mouse-enter event to show viewer toolbar overlay
    const onMouseEnter = (): void => componentRef.instance.onMouseEnter();
    // SEM@8967000098ce9524a88950fb01388a9402de0924: handle mouse-leave event to hide viewer toolbar overlay
    const onMouseLeave = (): void => componentRef.instance.onMouseLeave();
    // SEM@8967000098ce9524a88950fb01388a9402de0924: handle context-menu event on a diagram element
    const onContextMenu = (e: Event): void => componentRef.instance.onContextMenu(e as MouseEvent);
    // SEM@8967000098ce9524a88950fb01388a9402de0924: handle double-click event on a diagram element
    const onDblClick = (): void => componentRef.instance.onDoubleClick();

    wrapper.addEventListener('mouseenter', onMouseEnter);
    wrapper.addEventListener('mouseleave', onMouseLeave);
    wrapper.addEventListener('contextmenu', onContextMenu);
    wrapper.addEventListener('dblclick', onDblClick);

    componentRefs.push(componentRef);

    return (): void => {
      wrapper.removeEventListener('mouseenter', onMouseEnter);
      wrapper.removeEventListener('mouseleave', onMouseLeave);
      wrapper.removeEventListener('contextmenu', onContextMenu);
      wrapper.removeEventListener('dblclick', onDblClick);

      // Unwrap: move .mermaid back to its original position and remove wrapper
      if (wrapper.parentElement) {
        wrapper.parentElement.insertBefore(mermaidEl, wrapper);
        wrapper.remove();
      }
    };
  }
}
