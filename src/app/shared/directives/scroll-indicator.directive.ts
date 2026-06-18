import { Directive, ElementRef, OnInit, OnDestroy, Renderer2, AfterViewInit } from '@angular/core';

/**
 * Directive that adds a scroll indicator at the bottom of scrollable content.
 * Shows a filled triangle with pulse animation when more content is available below.
 *
 * Usage:
 * <mat-dialog-content appScrollIndicator>
 *   <!-- scrollable content -->
 * </mat-dialog-content>
 */
@Directive({
  selector: '[appScrollIndicator]',
  standalone: true,
})
// SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: directive that appends an animated scroll indicator when content overflows
export class ScrollIndicatorDirective implements OnInit, AfterViewInit, OnDestroy {
  private _indicator: HTMLElement | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _scrollListener: (() => void) | null = null;

  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: inject host element reference and renderer (pure)
  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _renderer: Renderer2,
  ) {}

  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: build and attach the scroll indicator DOM element on init
  ngOnInit(): void {
    this._createIndicator();
  }

  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: register scroll and resize listeners and perform initial visibility check
  ngAfterViewInit(): void {
    this._setupScrollListener();
    this._setupResizeObserver();
    this._updateIndicatorVisibility();

    // Check again after a short delay to handle dynamic content
    setTimeout(() => {
      this._updateIndicatorVisibility();
    }, 100);

    // Check again after animations might complete
    setTimeout(() => {
      this._updateIndicatorVisibility();
    }, 300);
  }

  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: remove listeners, observers, and indicator element on teardown
  ngOnDestroy(): void {
    this._cleanup();
  }

  /**
   * Creates the scroll indicator element
   */
  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: build and append the indicator DOM element to the host (mutates shared state)
  private _createIndicator(): void {
    const element = this._elementRef.nativeElement;

    // Create indicator container
    this._indicator = this._renderer.createElement('div') as HTMLElement;
    this._renderer.addClass(this._indicator, 'scroll-indicator');
    this._renderer.setAttribute(this._indicator, 'aria-hidden', 'true');

    // Create triangle icon
    const triangle = this._renderer.createText('▼') as Text;
    this._renderer.appendChild(this._indicator, triangle);

    // Add to parent element
    this._renderer.appendChild(element, this._indicator);

    // Ensure parent has position relative for absolute positioning
    const position = window.getComputedStyle(element).position;
    if (position === 'static') {
      this._renderer.setStyle(element, 'position', 'relative');
    }
  }

  /**
   * Sets up scroll event listener
   */
  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: register a scroll event listener to update indicator visibility (mutates shared state)
  private _setupScrollListener(): void {
    const element = this._elementRef.nativeElement;

    this._scrollListener = this._renderer.listen(element, 'scroll', () => {
      this._updateIndicatorVisibility();
    });
  }

  /**
   * Sets up ResizeObserver to detect content changes
   */
  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: register a ResizeObserver on host and children to recheck overflow (mutates shared state)
  private _setupResizeObserver(): void {
    const element = this._elementRef.nativeElement;

    this._resizeObserver = new ResizeObserver(() => {
      this._updateIndicatorVisibility();
    });

    this._resizeObserver.observe(element);

    // Also observe all children for content changes
    const children = element.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child !== this._indicator) {
        this._resizeObserver.observe(child);
      }
    }
  }

  /**
   * Updates indicator visibility based on scroll position
   */
  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: show or hide the indicator based on remaining scrollable content (mutates shared state)
  private _updateIndicatorVisibility(): void {
    if (!this._indicator) {
      return;
    }

    const element = this._elementRef.nativeElement;
    const scrollTop = element.scrollTop;
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;

    // Show indicator if there's more content below (with small threshold)
    const hasMoreContent = scrollTop + clientHeight < scrollHeight - 5;

    if (hasMoreContent) {
      this._renderer.addClass(this._indicator, 'visible');
    } else {
      this._renderer.removeClass(this._indicator, 'visible');
    }
  }

  /**
   * Cleanup listeners and observers
   */
  // SEM@b45fcc259874666aebc8f6e9494a3357aba9fc8c: detach scroll listener, disconnect resize observer, and remove indicator element
  private _cleanup(): void {
    if (this._scrollListener) {
      this._scrollListener();
      this._scrollListener = null;
    }

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }

    if (this._indicator && this._indicator.parentNode) {
      this._renderer.removeChild(this._indicator.parentNode, this._indicator);
      this._indicator = null;
    }
  }
}
