import {
  Directive,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  Renderer2,
} from '@angular/core';

const DROP_ACTIVE_CLASS = 'url-drop-active';
const URL_PATTERN = /^https?:\/\//i;

/**
 * Directive that enables drag-and-drop URL handling on a host element.
 * Emits `urlDropped` with the dropped URL string when a URL is dropped.
 * Adds the `url-drop-active` CSS class while a URL drag is in progress over the element.
 *
 * Usage:
 * <div appUrlDropZone (urlDropped)="onUrl($event)">Drop a URL here</div>
 */
@Directive({
  selector: '[appUrlDropZone]',
  standalone: true,
})
// SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: directive that accepts dropped URLs on a host element and emits the URL (mutates shared state)
export class UrlDropZoneDirective {
  @Output() urlDropped = new EventEmitter<string>();

  private _enterCounter = 0;

  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: inject host element reference and renderer for DOM manipulation (pure)
  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _renderer: Renderer2,
  ) {}

  @HostListener('dragover', ['$event'])
  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: allow a URL drag over the drop zone by cancelling the default browser rejection (mutates shared state)
  onDragOver(event: DragEvent): void {
    if (this._hasUrlData(event)) {
      event.preventDefault();
    }
  }

  @HostListener('dragenter', ['$event'])
  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: add active CSS class to host when a URL drag enters the drop zone (mutates shared state)
  onDragEnter(event: DragEvent): void {
    if (!this._hasUrlData(event)) return;
    this._enterCounter++;
    if (this._enterCounter === 1) {
      this._renderer.addClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);
    }
  }

  @HostListener('dragleave', ['$event'])
  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: remove active CSS class from host when a URL drag leaves the drop zone (mutates shared state)
  onDragLeave(event: DragEvent): void {
    if (!this._hasUrlData(event)) return;
    if (this._enterCounter > 0) {
      this._enterCounter--;
    }
    if (this._enterCounter === 0) {
      this._renderer.removeClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);
    }
  }

  @HostListener('drop', ['$event'])
  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: extract dropped URL and emit it via urlDropped output (mutates shared state)
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this._enterCounter = 0;
    this._renderer.removeClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);

    const url = this._extractUrl(event);
    if (url) {
      this.urlDropped.emit(url);
    }
  }

  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: check whether a drag event carries URI data (pure)
  private _hasUrlData(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    // Only signal URL drag for explicit URI types — text/plain is too broad
    // (it matches every plain-text drag) and getData() is unavailable during
    // dragover/dragenter anyway. text/plain is still used as a fallback in _extractUrl.
    return types.includes('text/uri-list');
  }

  // SEM@60a60bd1cbe57ecd30def58877849e868f9669ee: parse the first valid HTTP URL from a drop event's data transfer (pure)
  private _extractUrl(event: DragEvent): string | null {
    const dt = event.dataTransfer;
    if (!dt) return null;

    // Try text/uri-list first (RFC 2483 format: one URL per line, # = comment)
    const uriList = dt.getData('text/uri-list');
    if (uriList) {
      const firstUrl = uriList
        .split('\n')
        .map(line => line.trim())
        .find(line => line && !line.startsWith('#'));
      if (firstUrl && URL_PATTERN.test(firstUrl)) return firstUrl;
    }

    // Fall back to text/plain
    const plain = dt.getData('text/plain')?.trim();
    if (plain && URL_PATTERN.test(plain)) return plain;

    return null;
  }
}
