import { Directive, DoCheck, ElementRef } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

/**
 * Automatically syncs aria-label with the matTooltip message on the same element.
 *
 * Applies to every element with [matTooltip]. If an explicit [attr.aria-label]
 * is already set in the template, this directive will not overwrite it — the
 * template binding takes precedence because Angular evaluates attribute bindings
 * after directive lifecycle hooks within the same change-detection cycle.
 *
 * For elements where the aria-label should intentionally differ from the tooltip,
 * add [attr.aria-label] with the desired value.
 */
@Directive({
  selector: '[matTooltip]',
  standalone: true,
})
export class TooltipAriaLabelDirective implements DoCheck {
  private _lastMessage = '';

  constructor(
    private _tooltip: MatTooltip,
    private _elementRef: ElementRef<HTMLElement>,
  ) {}

  ngDoCheck(): void {
    const message = this._tooltip.message;
    if (message !== this._lastMessage) {
      this._lastMessage = message;
      const el = this._elementRef.nativeElement;
      if (message) {
        el.setAttribute('aria-label', message);
      } else {
        el.removeAttribute('aria-label');
      }
    }
  }
}
