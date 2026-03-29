/**
 * Utilities for exporting mermaid diagram SVGs as SVG files, PNG files, or clipboard data.
 */

/**
 * Clone an SVG element for export, removing Angular-specific attributes.
 */
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
 * Get the intrinsic dimensions of an SVG element.
 * Prefers viewBox, falls back to width/height attributes, then getBoundingClientRect.
 */
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
function generateFilename(extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `mermaid-diagram-${timestamp}.${extension}`;
}

/**
 * Serialize an SVG element to a Blob.
 */
function svgToBlob(svg: SVGSVGElement): Blob {
  const serializer = new XMLSerializer();
  const svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
  return new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
}

/**
 * Trigger a file download from a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export an SVG element as an SVG file download.
 */
export function exportAsSvg(svgElement: SVGSVGElement): void {
  const clone = cloneSvgForExport(svgElement);
  const blob = svgToBlob(clone);
  downloadBlob(blob, generateFilename('svg'));
}

/**
 * Render an SVG to a canvas and return the canvas.
 * Scale factor: max(2, 2 * currentZoom) for retina quality.
 */
function renderSvgToCanvas(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const clone = cloneSvgForExport(svgElement);
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
 * Export an SVG element as a PNG file download.
 * @param svgElement - The SVG element to export.
 * @param currentZoom - Current zoom level (1.0 = 100%). PNG scale = max(2, 2 * currentZoom).
 */
export async function exportAsPng(svgElement: SVGSVGElement, currentZoom: number): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const blob = await canvasToBlob(canvas);
  downloadBlob(blob, generateFilename('png'));
}

/**
 * Copy a diagram to the clipboard as both PNG and SVG (if supported), or PNG only.
 * @param svgElement - The SVG element to copy.
 * @param currentZoom - Current zoom level for PNG resolution.
 */
export async function copyDiagramToClipboard(
  svgElement: SVGSVGElement,
  currentZoom: number,
): Promise<void> {
  const canvas = await renderSvgToCanvas(svgElement, currentZoom);
  const pngBlob = await canvasToBlob(canvas);

  // Try to write both SVG and PNG; fall back to PNG only
  try {
    const clone = cloneSvgForExport(svgElement);
    const svgBlob = svgToBlob(clone);
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/svg+xml': svgBlob,
        'image/png': pngBlob,
      }),
    ]);
  } catch {
    // SVG clipboard not supported in this browser; fall back to PNG only
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': pngBlob,
      }),
    ]);
  }
}
