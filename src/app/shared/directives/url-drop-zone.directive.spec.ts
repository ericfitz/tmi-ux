import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UrlDropZoneDirective } from './url-drop-zone.directive';
import type { Renderer2 } from '@angular/core';

function createDragEvent(type: string, data?: Record<string, string>): DragEvent {
  const dataTransfer: Partial<DataTransfer> = {
    types: Object.keys(data || {}),
    getData: vi.fn((format: string) => data?.[format] || ''),
  };
  const event = new Event(type, { bubbles: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
  Object.defineProperty(event, 'stopPropagation', { value: vi.fn() });
  return event;
}

describe('UrlDropZoneDirective', () => {
  let directive: UrlDropZoneDirective;
  let mockElement: HTMLElement;
  let mockRenderer: { addClass: ReturnType<typeof vi.fn>; removeClass: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockElement = document.createElement('div');
    mockRenderer = {
      addClass: vi.fn(),
      removeClass: vi.fn(),
    };
    directive = new UrlDropZoneDirective(
      { nativeElement: mockElement },
      mockRenderer as unknown as Renderer2,
    );
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  describe('dragover', () => {
    it('should call preventDefault to allow drop', () => {
      const event = createDragEvent('dragover', { 'text/uri-list': 'https://example.com' });
      directive.onDragOver(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should not preventDefault for non-URL drags', () => {
      const event = createDragEvent('dragover', { Files: '' });
      directive.onDragOver(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('dragenter', () => {
    it('should add url-drop-active class on dragenter with URL data', () => {
      const event = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(event);
      expect(mockRenderer.addClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should not add class for non-URL drags', () => {
      const event = createDragEvent('dragenter', { Files: '' });
      directive.onDragEnter(event);
      expect(mockRenderer.addClass).not.toHaveBeenCalled();
    });

    it('should not add class for text/plain-only drags', () => {
      const event = createDragEvent('dragenter', { 'text/plain': 'https://example.com' });
      directive.onDragEnter(event);
      expect(mockRenderer.addClass).not.toHaveBeenCalled();
    });
  });

  describe('dragleave', () => {
    it('should remove class when counter reaches 0', () => {
      const enterEvent = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent);

      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should not remove class when nested elements cause enter/leave', () => {
      const enterEvent1 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent1);

      const enterEvent2 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent2);

      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      expect(mockRenderer.removeClass).not.toHaveBeenCalled();
    });
  });

  describe('drop', () => {
    it('should emit URL from text/uri-list', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://example.com');
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should fall back to text/plain when text/uri-list is empty', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/plain': 'https://example.com/page',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://example.com/page');
    });

    it('should not emit for non-URL plain text', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', { 'text/plain': 'just some text' });
      directive.onDrop(event);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('should remove url-drop-active class on drop', () => {
      const enterEvent = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent);

      const dropEvent = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(dropEvent);
      expect(mockRenderer.removeClass).toHaveBeenCalledWith(mockElement, 'url-drop-active');
    });

    it('should reset enter counter on drop', () => {
      const enterEvent1 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent1);
      const enterEvent2 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent2);

      const dropEvent = createDragEvent('drop', { 'text/uri-list': 'https://example.com' });
      directive.onDrop(dropEvent);

      // After drop + reset, a new dragenter/dragleave cycle should work cleanly
      const enterEvent3 = createDragEvent('dragenter', { 'text/uri-list': 'https://example.com' });
      directive.onDragEnter(enterEvent3);
      const leaveEvent = createDragEvent('dragleave', { 'text/uri-list': 'https://example.com' });
      directive.onDragLeave(leaveEvent);
      // removeClass called twice: once for drop, once for this dragleave
      expect(mockRenderer.removeClass).toHaveBeenCalledTimes(2);
    });

    it('should take the first URL from text/uri-list with multiple lines', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/uri-list': 'https://first.com\nhttps://second.com',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://first.com');
    });

    it('should skip comment lines in text/uri-list', () => {
      const emitSpy = vi.spyOn(directive.urlDropped, 'emit');
      const event = createDragEvent('drop', {
        'text/uri-list': '# comment\nhttps://actual.com',
      });
      directive.onDrop(event);
      expect(emitSpy).toHaveBeenCalledWith('https://actual.com');
    });
  });
});
