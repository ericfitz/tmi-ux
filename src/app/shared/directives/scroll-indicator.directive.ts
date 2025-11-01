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
export class ScrollIndicatorDirective implements OnInit, AfterViewInit, OnDestroy {
  private _indicator: HTMLElement | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _scrollListener: (() => void) | null = null;

  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    this._createIndicator();
  }

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

  ngOnDestroy(): void {
    this._cleanup();
  }

  /**
   * Creates the scroll indicator element
   */
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
  private _setupScrollListener(): void {
    const element = this._elementRef.nativeElement;

    this._scrollListener = this._renderer.listen(element, 'scroll', () => {
      this._updateIndicatorVisibility();
    });
  }

  /**
   * Sets up ResizeObserver to detect content changes
   */
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
