// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import { vi, expect, describe, it } from 'vitest';

import {
  cloneSvgForExport,
  exportAsSvg,
  exportAsPng,
  copyDiagramToClipboard,
} from './mermaid-export.utils';

describe('mermaid-export.utils', () => {
  describe('cloneSvgForExport', () => {
    it('should clone an SVG element', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      svg.appendChild(rect);

      const clone = cloneSvgForExport(svg);

      expect(clone.tagName).toBe('svg');
      expect(clone.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
      expect(clone.querySelector('rect')).not.toBeNull();
    });

    it('should remove Angular-specific attributes', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('_ngcontent-abc', '');
      svg.setAttribute('ng-reflect-something', 'value');
      svg.setAttribute('width', '200');

      const clone = cloneSvgForExport(svg);

      expect(clone.getAttribute('_ngcontent-abc')).toBeNull();
      expect(clone.getAttribute('ng-reflect-something')).toBeNull();
      expect(clone.getAttribute('width')).toBe('200');
    });
  });

  describe('exportAsSvg', () => {
    it('should create and click a download link', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');

      const clickSpy = vi.fn();
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');

      exportAsSvg(svg);

      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test');

      createElementSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });
  });

  describe('exportAsPng', () => {
    it('should use max(2, 2 * currentZoom) as the scale factor', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.setAttribute('viewBox', '0 0 200 100');

      // Mock canvas and image
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn((callback: (blob: Blob) => void) => {
          callback(new Blob([''], { type: 'image/png' }));
        }),
      };
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      });
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      // Mock Image so that onload fires synchronously when src is set
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          if (this.onload) this.onload();
        }
      }
      vi.stubGlobal('Image', MockImage);

      // With zoom 3.0, scale should be max(2, 2*3) = 6
      await exportAsPng(svg, 3.0);

      expect(mockCanvas.width).toBe(200 * 6);
      expect(mockCanvas.height).toBe(100 * 6);

      vi.unstubAllGlobals();
    });
  });

  describe('copyDiagramToClipboard', () => {
    it('should write to clipboard with PNG blob', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '200');
      svg.setAttribute('height', '100');
      svg.setAttribute('viewBox', '0 0 200 100');

      const writeSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { write: writeSpy },
      });

      // Mock canvas for PNG generation
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({ drawImage: vi.fn() }),
        toBlob: vi.fn((callback: (blob: Blob) => void) => {
          callback(new Blob([''], { type: 'image/png' }));
        }),
      };
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
        return { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement;
      });

      // Mock Image so that onload fires synchronously when src is set
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          if (this.onload) this.onload();
        }
      }
      vi.stubGlobal('Image', MockImage);

      // ClipboardItem is not available in jsdom — stub it
      vi.stubGlobal(
        'ClipboardItem',
        class MockClipboardItem {
          constructor(public data: Record<string, Blob>) {}
        },
      );

      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      await copyDiagramToClipboard(svg, 1.0);

      vi.unstubAllGlobals();

      expect(writeSpy).toHaveBeenCalled();
    });
  });
});
