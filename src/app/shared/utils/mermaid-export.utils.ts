/**
 * Utilities for exporting mermaid diagram SVGs as SVG files, PNG files, or clipboard data.
 */

/**
 * Clone an SVG element for export, removing Angular-specific attributes.
 */
// SEM@9c4c045a3f2a5e91f495ef3a62d7bb725da4fd8c: clone an SVG element with Angular-specific attributes stripped for export (pure)
export function cloneSvgForExport(svgElement: SVGSVGElement): SVGSVGElement {
  const clone = svgElement.cloneNode(true) as SVGSVGElement;

  // Ensure xmlns is set
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Remove Angular-specific attributes from all elements
  const allElements = [clone, ...Array.from(clone.querySelectorAll('*'))];
  for (const el of allElements) {
    const attrsToRemove: string[] = [];
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('_ng') || attr.name.startsWith('ng-')) {
        attrsToRemove.push(attr.name);
      }
    }
    for (const name of attrsToRemove) {
      el.removeAttribute(name);
    }
  }

  return clone;
}

/**
 * Replace <foreignObject> elements with <text> elements containing the same
 * text content. Browsers refuse to render SVGs with <foreignObject> when loaded
 * as an Image source (security restriction), so this is required for PNG export.
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: replace SVG foreignObject elements with text elements for PNG-safe rendering (mutates shared state)
function replaceForeignObjects(svg: SVGSVGElement): void {
  const foreignObjects = Array.from(svg.querySelectorAll('foreignObject'));
  for (const fo of foreignObjects) {
    const x = fo.getAttribute('x') || '0';
    const y = fo.getAttribute('y') || '0';
    const width = parseFloat(fo.getAttribute('width') || '0');
    const height = parseFloat(fo.getAttribute('height') || '0');
    const textContent = fo.textContent?.trim() || '';

    if (!textContent) {
      fo.remove();
      continue;
    }

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', String(parseFloat(x) + width / 2));
    text.setAttribute('y', String(parseFloat(y) + height / 2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', '14');
    text.setAttribute('font-family', 'trebuchet ms, verdana, arial, sans-serif');
    text.setAttribute('fill', '#333');
    text.textContent = textContent;

    fo.parentElement?.replaceChild(text, fo);
  }
}

/**
 * Get the intrinsic dimensions of an SVG element.
 * Prefers viewBox, falls back to width/height attributes, then getBoundingClientRect.
 */
// SEM@9c4c045a3f2a5e91f495ef3a62d7bb725da4fd8c: compute an SVG element's intrinsic dimensions from viewBox, attributes, or layout (pure)
function getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const w = parseFloat(svg.getAttribute('width') || '0');
  const h = parseFloat(svg.getAttribute('height') || '0');
  if (w > 0 && h > 0) {
    return { width: w, height: h };
  }

  const rect = svg.getBoundingClientRect();
  return { width: rect.width || 300, height: rect.height || 150 };
}

/**
 * Generate a timestamped filename.
 */
// SEM@9c4c045a3f2a5e91f495ef3a62d7bb725da4fd8c: build a timestamped filename for a diagram export file (pure)
function generateFilename(extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `mermaid-diagram-${timestamp}.${extension}`;
}

/**
 * Serialize an SVG element to a Blob.
 */
// SEM@9c4c045a3f2a5e91f495ef3a62d7bb725da4fd8c: serialize an SVG element to an SVG Blob (pure)
function svgToBlob(svg: SVGSVGElement): Blob {
  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Save a Blob to a file. Uses the File System Access API (showSaveFilePicker)
 * when available for a native save dialog, falls back to <a download>.
 *
 * For the picker path, the caller must invoke this during a user gesture
 * (synchronously from a click handler) before any async work, otherwise the
 * browser rejects with SecurityError.
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: save a Blob to disk via native file picker or anchor download fallback
async function saveBlob(blob: Blob, filename: string, mimeType: string): Promise<void> {
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const extensionMap: Record<string, string> = {
        'image/svg+xml': '.svg',
        'image/png': '.png',
      };
      const extension = extensionMap[mimeType] || '';

      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: `${extension.slice(1).toUpperCase()} file`,
            accept: { [mimeType]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err: unknown) {
      // AbortError = user cancelled — not an error
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      // SecurityError = gesture expired — fall through to <a download>
      if (err instanceof DOMException && err.name === 'SecurityError') {
        // fall through
      } else {
        throw err;
      }
    }
  }

  // Fallback: <a download> (Firefox, Safari, or gesture-expired)
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Render an SVG to a canvas.
 * Replaces <foreignObject> elements with <text> before rendering,
 * since browsers block <foreignObject> in Image-loaded SVGs.
 * Scale factor: max(2, 2 * currentZoom) for retina quality.
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: convert an SVG element to a scaled canvas for raster export
function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const clone = cloneSvgForExport(svgElement);
    replaceForeignObjects(clone);

    const { width, height } = getSvgDimensions(clone);
    const scale = Math.max(2, 2 * currentZoom);

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get canvas 2d context'));
      return;
    }

    const blob = svgToBlob(clone);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = (): void => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };

    img.onerror = (): void => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

/**
 * Convert a canvas to a PNG Blob.
 */
// SEM@9c4c045a3f2a5e91f495ef3a62d7bb725da4fd8c: convert a canvas element to a PNG Blob (pure)
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG blob from canvas'));
      }
    }, 'image/png');
  });
}

/**
 * Export an SVG element as an SVG file.
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: export a diagram SVG element as a downloadable SVG file
export async function exportAsSvg(svgElement: SVGSVGElement): Promise<void> {
  const clone = cloneSvgForExport(svgElement);
  const blob = svgToBlob(clone);
  await saveBlob(blob, generateFilename('svg'), 'image/svg+xml');
}

/**
 * Export an SVG element as a PNG file.
 * @param svgElement - The SVG element to export.
 * @param currentZoom - Current zoom level (1.0 = 100%). PNG scale = max(2, 2 * currentZoom).
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: export a diagram SVG element as a downloadable PNG file
export async function exportAsPng(svgElement: SVGSVGElement, currentZoom: number): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const blob = await canvasToBlob(canvas);
  await saveBlob(blob, generateFilename('png'), 'image/png');
}

/**
 * Copy a diagram to the clipboard as a PNG image.
 * @param svgElement - The SVG element to copy.
 * @param currentZoom - Current zoom level for PNG resolution.
 */
// SEM@eb3174f04be92bbc0ec920476550d99e36c3dcc3: copy a diagram SVG element to the clipboard as a PNG image
export async function copyDiagramToClipboard(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const pngBlob = await canvasToBlob(canvas);

  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': pngBlob,
    }),
  ]);
}
