import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { LoggerService } from '@app/core/services/logger.service';
import { getFieldKeysForFieldType, migrateFieldValue } from '@app/shared/utils/field-value-helpers';
import { Diagram } from '../models/diagram.model';
import { Repository, Threat } from '../models/threat-model.model';

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

  /** Legacy-to-camelCase severity key mapping for synchronous migration. */
  private readonly severityMap: Record<string, string> = {
    '0': 'critical',
    '1': 'high',
    '2': 'medium',
    '3': 'low',
    '4': 'informational',
    '5': 'unknown',
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
    Informational: 'informational',
    Info: 'informational',
    Unknown: 'unknown',
    None: 'unknown',
  };

  private readonly statusMap: Record<string, string> = {
    '0': 'open',
    '1': 'confirmed',
    '2': 'mitigation_planned',
    '3': 'mitigation_in_progress',
    '4': 'verification_pending',
    '5': 'resolved',
    '6': 'accepted',
    '7': 'false_positive',
    '8': 'deferred',
    '9': 'closed',
    Open: 'open',
    Confirmed: 'confirmed',
    'Mitigation Planned': 'mitigation_planned',
    'Mitigation In Progress': 'mitigation_in_progress',
    'Verification Pending': 'verification_pending',
    Resolved: 'resolved',
    Accepted: 'accepted',
    'False Positive': 'false_positive',
    Deferred: 'deferred',
    Closed: 'closed',
  };

  private readonly priorityMap: Record<string, string> = {
    '0': 'immediate',
    '1': 'high',
    '2': 'medium',
    '3': 'low',
    '4': 'deferred',
    'Immediate (P0)': 'immediate',
    'High (P1)': 'high',
    'Medium (P2)': 'medium',
    'Low (P3)': 'low',
    'Deferred (P4)': 'deferred',
    Immediate: 'immediate',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };

  private readonly severityKeys = getFieldKeysForFieldType('threatEditor.threatSeverity');
  private readonly threatStatusKeys = getFieldKeysForFieldType('threatEditor.threatStatus');

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
   * Tooltip text for a repository list item: uri, optional description, optional parameters.
   *
   * @param repository - The repository to generate tooltip for
   * @returns Formatted tooltip text with URI, description, and ref parameters
   */
  getRepositoryTooltip(repository: Repository): string {
    let tooltip = repository.uri;
    if (repository.description) {
      tooltip += `\n\n${repository.description}`;
    }
    if (repository.parameters) {
      tooltip += `\n\n${repository.parameters.refType}: ${repository.parameters.refValue}`;
      if (repository.parameters.subPath) {
        tooltip += `\nPath: ${repository.parameters.subPath}`;
      }
    }
    return tooltip;
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

  /**
   * Validate that a base64 string decodes to well-formed SVG markup.
   * @param base64Svg Base64-encoded SVG string.
   * @returns True if the decoded content is well-formed SVG, false otherwise.
   */
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

  /**
   * Gets the CSS class for a threat severity value, handling legacy numeric values.
   * @param severity The threat severity value (camelCase key, numeric, or legacy string).
   * @returns The CSS class string, e.g. 'severity-high'.
   */
  getThreatSeverityClass(severity: string | null | undefined): string {
    const key = severity
      ? (migrateFieldValue(severity, 'threatEditor.threatSeverity', this.transloco) ?? 'unknown')
      : 'unknown';
    return 'severity-' + key;
  }

  /**
   * Migrate a threat's legacy field values (numeric keys or English strings)
   * to camelCase keys. Returns a new threat; does not mutate the input.
   * @param threat The threat to migrate.
   * @returns A new threat object with migrated field values.
   */
  migrateThreatFieldValues(threat: Threat): Threat {
    const migratedThreat = { ...threat };

    if (
      migratedThreat.severity &&
      !this.severityKeys.includes(migratedThreat.severity) &&
      this.severityMap[migratedThreat.severity]
    ) {
      migratedThreat.severity = this.severityMap[migratedThreat.severity];
    }

    if (
      migratedThreat.status &&
      !this.threatStatusKeys.includes(migratedThreat.status) &&
      this.statusMap[migratedThreat.status]
    ) {
      migratedThreat.status = this.statusMap[migratedThreat.status];
    }

    const priorityKeys = getFieldKeysForFieldType('threatEditor.threatPriority');
    if (
      migratedThreat.priority &&
      !priorityKeys.includes(migratedThreat.priority) &&
      this.priorityMap[migratedThreat.priority]
    ) {
      migratedThreat.priority = this.priorityMap[migratedThreat.priority];
    }

    return migratedThreat;
  }
}
