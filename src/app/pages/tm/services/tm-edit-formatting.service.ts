import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { LoggerService } from '@app/core/services/logger.service';
import { Diagram } from '../models/diagram.model';

/** Supported diagram model export formats. */
export type DiagramModelFormat = 'json' | 'yaml' | 'graphml';

/**
 * Stateless presentation helpers extracted from TmEditComponent.
 *
 * All methods are pure input → output functions. The `LoggerService` and
 * `TranslocoService` dependencies are injected for diagnostics and future
 * label lookup — they do not introduce side-effects on the outputs.
 */
@Injectable({ providedIn: 'root' })
export class TmEditFormattingService {
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  /**
   * Returns the MIME type string for a given diagram model export format.
   *
   * @param format - The export format identifier
   * @returns MIME type string
   */
  getMimeTypeForFormat(format: DiagramModelFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'yaml':
        return 'application/x-yaml';
      case 'graphml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Returns the file extension (including leading dot) for a given diagram
   * model export format.
   *
   * @param format - The export format identifier
   * @returns File extension string (e.g. '.json')
   */
  getExtensionForFormat(format: DiagramModelFormat): string {
    switch (format) {
      case 'json':
        return '.json';
      case 'yaml':
        return '.yaml';
      case 'graphml':
        return '.graphml';
      default:
        return '';
    }
  }

  /**
   * Strips the protocol and optional www prefix from a URL and truncates it
   * to 40 characters for compact display. Appends '...' when truncated.
   *
   * @param url - The full URL string to display
   * @returns Shortened display string, or empty string for empty input
   */
  getTruncatedUrl(url: string): string {
    if (!url) return '';
    let displayUrl = url.replace(/^https?:\/\/(www\.)?/, '');
    const maxLength = 40;
    if (displayUrl.length > maxLength) {
      displayUrl = displayUrl.substring(0, maxLength - 3) + '...';
    }
    return displayUrl;
  }

  /**
   * Returns the Material icon name appropriate for a diagram, derived from its
   * type prefix (e.g. 'DFD-1.0.0' → 'DFD' → 'graph_3').
   *
   * @param diagram - The diagram whose icon should be determined
   * @returns Material icon name string
   */
  getDiagramIcon(diagram: Diagram): string {
    if (!diagram.type) {
      return 'indeterminate_question_box';
    }
    const typePrefix = diagram.type.split('-')[0].toUpperCase();
    switch (typePrefix) {
      case 'DFD':
        return 'graph_3';
      default:
        return 'indeterminate_question_box';
    }
  }

  /**
   * Returns tooltip text for a diagram's type icon.
   *
   * @param diagram - The diagram whose tooltip should be determined
   * @returns The diagram type string, or 'Unknown Type' when absent
   */
  getDiagramTooltip(diagram: Diagram): string {
    return diagram.type || 'Unknown Type';
  }

  /**
   * Returns the Material icon name for an asset type.
   *
   * @param type - Asset type string (e.g. 'data', 'software')
   * @returns Material icon name, defaulting to 'diamond' for unknown types
   */
  getAssetTypeIcon(type?: string): string {
    if (!type) {
      return 'diamond';
    }
    const iconMap: Record<string, string> = {
      data: 'database',
      software: 'deployed_code',
      hardware: 'host',
      infrastructure: 'factory',
      service: 'cloud_circle',
      personnel: 'person',
    };
    return iconMap[type] ?? 'diamond';
  }

  /**
   * Generates a safe filename for a diagram model download.
   *
   * Format: `{threatModelName}-{diagramName}-model{extension}`.
   * Each name segment is sanitized (filesystem-unsafe characters replaced with
   * dashes, consecutive dashes collapsed) and truncated to 40 characters.
   * Falls back to 'ThreatModel' when the threat model name is blank.
   *
   * @param threatModelName - Name of the parent threat model
   * @param diagramName - Name of the diagram
   * @param extension - File extension including leading dot (e.g. '.json')
   * @returns Sanitized filename string
   */
  generateDiagramModelFilename(
    threatModelName: string | undefined,
    diagramName: string,
    extension: string,
  ): string {
    const sanitizeAndTruncate = (name: string, maxLength: number): string => {
      const sanitized = name
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
    };

    const modelPart = sanitizeAndTruncate(threatModelName?.trim() || 'ThreatModel', 40);
    const diagramPart = sanitizeAndTruncate(diagramName.trim(), 40);
    const filename = `${modelPart}-${diagramPart}-model${extension}`;

    this.logger.debugComponent('TmEdit', 'Generated diagram model filename', {
      threatModelName,
      diagramName,
      filename,
    });

    return filename;
  }

  /** Validate that a base64 string decodes to well-formed SVG markup. */
  isValidBase64Svg(base64Svg: string): boolean {
    try {
      if (!base64Svg || base64Svg.length === 0) {
        return false;
      }
      const svgText = atob(base64Svg);
      const trimmed = svgText.trim();
      if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
        this.logger.warn('SVG validation failed: does not start with <svg or <?xml', {
          actualStart: trimmed.substring(0, 20),
        });
        return false;
      }
      if (!trimmed.includes('<svg')) {
        this.logger.warn('SVG validation failed: does not contain <svg tag');
        return false;
      }
      if (!trimmed.includes('</svg>')) {
        this.logger.warn('SVG validation failed: does not contain </svg> closing tag');
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn('SVG validation failed with error', { error });
      return false;
    }
  }

  /** Extract the viewBox attribute from a diagram's base64-encoded SVG, or null. */
  extractViewBoxFromSvg(diagram: Diagram): string | null {
    if (!diagram.image?.svg) {
      return null;
    }
    try {
      const svgContent = atob(diagram.image.svg);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      if (!svgElement) {
        return null;
      }
      return svgElement.getAttribute('viewBox');
    } catch (error) {
      this.logger.warn('Failed to extract viewBox from SVG', { error });
      return null;
    }
  }
}
