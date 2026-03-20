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
export class UrlDropZoneDirective {
  @Output() urlDropped = new EventEmitter<string>();

  private _enterCounter = 0;

  constructor(
    private _elementRef: ElementRef<HTMLElement>,
    private _renderer: Renderer2,
  ) {}

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this._hasUrlData(event)) {
      event.preventDefault();
    }
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (!this._hasUrlData(event)) return;
    this._enterCounter++;
    if (this._enterCounter === 1) {
      this._renderer.addClass(this._elementRef.nativeElement, DROP_ACTIVE_CLASS);
    }
  }

  @HostListener('dragleave', ['$event'])
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

  private _hasUrlData(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    // Only signal URL drag for explicit URI types — text/plain is too broad
    // (it matches every plain-text drag) and getData() is unavailable during
    // dragover/dragenter anyway. text/plain is still used as a fallback in _extractUrl.
    return types.includes('text/uri-list');
  }

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
