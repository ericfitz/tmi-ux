import { Injectable } from '@angular/core';
import type { Metadata } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  sanitizeCellsForApi,
  sanitizeCellForApi,
} from '../../../dfd/utils/cell-property-filter.util';
import type { Cell } from '../../../../core/types/websocket-message.types';
import type {
  ApiThreatModelInput,
  ApiThreatInput,
  ApiAssetInput,
  ApiNoteInput,
  ApiDocumentInput,
  ApiRepositoryInput,
  ApiCreateDiagramRequest,
} from '@app/generated/api-type-helpers';

/**
 * Service for filtering read-only fields from objects before sending to the server.
 * Based on the OpenAPI specification, these fields are server-managed and should not
 * be included in POST/PUT/PATCH requests.
 */
@Injectable({
  providedIn: 'root',
})
export class ReadonlyFieldFilterService {
  constructor(private readonly _logger: LoggerService) {}

  /**
   * Read-only fields on Authorization that should be stripped before POST/PUT/PATCH.
   * display_name is populated by the server based on the principal identity.
   * @see ApiAuthorization in @app/generated/api-type-helpers
   */
  private readonly _authorizationReadOnlyFields = ['display_name'] as const;

  /**
   * Constructs a typed ApiThreatModelInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterThreatModel(data: Record<string, unknown>): {
    filtered: ApiThreatModelInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiThreatModelInput = {
      name: data['name'] as string,
      is_confidential: (data['is_confidential'] as boolean) ?? false,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['threat_model_framework'] != null)
      filtered.threat_model_framework = data['threat_model_framework'] as string;
    if (data['authorization'] != null)
      filtered.authorization = data['authorization'] as ApiThreatModelInput['authorization'];
    if (data['issue_uri'] != null) filtered.issue_uri = data['issue_uri'] as string;

    return { filtered, metadata };
  }

  /**
   * Constructs a typed ApiThreatInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterThreat(data: Record<string, unknown>): {
    filtered: ApiThreatInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiThreatInput = {
      name: data['name'] as string,
      threat_type: (data['threat_type'] as string[]) ?? [],
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['mitigation'] != null) filtered.mitigation = data['mitigation'] as string;
    if (data['diagram_id'] != null) filtered.diagram_id = data['diagram_id'] as string;
    if (data['cell_id'] != null) filtered.cell_id = data['cell_id'] as string;
    if (data['severity'] != null) filtered.severity = data['severity'] as string;
    if (data['score'] != null) filtered.score = data['score'] as number;
    if (data['priority'] != null) filtered.priority = data['priority'] as string;
    if (data['mitigated'] != null) filtered.mitigated = data['mitigated'] as boolean;
    if (data['status'] != null) filtered.status = data['status'] as string;
    if (data['issue_uri'] != null) filtered.issue_uri = data['issue_uri'] as string;
    if (data['asset_id'] != null) filtered.asset_id = data['asset_id'] as string;
    if (data['cwe_id'] != null) filtered.cwe_id = data['cwe_id'] as string[];
    if (data['cvss'] != null) filtered.cvss = data['cvss'] as ApiThreatInput['cvss'];

    return { filtered, metadata };
  }

  /**
   * Constructs a typed ApiCreateDiagramRequest from the input data.
   * Extracts fields that belong in the subsequent PUT
   * (BaseDiagramInput / DfdDiagramInput) for separate handling.
   */
  filterDiagram(data: Record<string, unknown>): {
    filtered: ApiCreateDiagramRequest;
    metadata: Metadata[] | undefined;
    cells: unknown[] | undefined;
    description: string | undefined;
    includeInReport: boolean | undefined;
    image: Record<string, unknown> | undefined;
    colorPalette: unknown[] | undefined;
    timmyEnabled: boolean | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const cells = data['cells'] as unknown[] | undefined;
    const description = data['description'] as string | undefined;
    const includeInReport = data['include_in_report'] as boolean | undefined;
    const image = data['image'] as Record<string, unknown> | undefined;
    const colorPalette = data['color_palette'] as unknown[] | undefined;
    const timmyEnabled = data['timmy_enabled'] as boolean | undefined;

    // Allow-list: only pass fields accepted by CreateDiagramRequest
    const filtered: ApiCreateDiagramRequest = {
      name: data['name'] as string,
      type: (data['type'] as ApiCreateDiagramRequest['type']) ?? 'DFD-1.0.0',
    };

    return {
      filtered,
      metadata,
      cells,
      description,
      includeInReport,
      image,
      colorPalette,
      timmyEnabled,
    };
  }

  /**
   * Constructs a typed ApiNoteInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterNote(data: Record<string, unknown>): {
    filtered: ApiNoteInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiNoteInput = {
      name: data['name'] as string,
      content: (data['content'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;

    return { filtered, metadata };
  }

  /**
   * Constructs a typed ApiAssetInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterAsset(data: Record<string, unknown>): {
    filtered: ApiAssetInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiAssetInput = {
      name: data['name'] as string,
      type: (data['type'] as ApiAssetInput['type']) ?? 'data',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['criticality'] != null) filtered.criticality = data['criticality'] as string;
    if (data['classification'] != null)
      filtered.classification = data['classification'] as string[];
    if (data['sensitivity'] != null) filtered.sensitivity = data['sensitivity'] as string;

    return { filtered, metadata };
  }

  /**
   * Constructs a typed ApiDocumentInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterDocument(data: Record<string, unknown>): {
    filtered: ApiDocumentInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiDocumentInput = {
      name: data['name'] as string,
      uri: (data['uri'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;

    return { filtered, metadata };
  }

  /**
   * Constructs a typed ApiRepositoryInput from the input data, picking only
   * allowed fields. Metadata is extracted separately for the metadata endpoint.
   */
  filterRepository(data: Record<string, unknown>): {
    filtered: ApiRepositoryInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiRepositoryInput = {
      uri: (data['uri'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['name'] != null) filtered.name = data['name'] as string;
    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['type'] != null) filtered.type = data['type'] as ApiRepositoryInput['type'];
    if (data['parameters'] != null)
      filtered.parameters = data['parameters'] as ApiRepositoryInput['parameters'];

    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from an Authorization object.
   * Removes display_name which is a server-managed field.
   *
   * @param authorization The authorization object to filter
   * @returns Filtered authorization object ready for API submission
   */
  filterAuthorization(authorization: Record<string, unknown>): Record<string, unknown> {
    return this._filterFields(authorization, this._authorizationReadOnlyFields);
  }

  /**
   * Filters an array of authorization objects.
   *
   * @param authorizations Array of authorizations to filter
   * @returns Array of filtered authorizations
   */
  filterAuthorizations(authorizations: unknown[]): unknown[] {
    return authorizations.map(auth => {
      if (typeof auth === 'object' && auth !== null) {
        return this.filterAuthorization(auth as Record<string, unknown>);
      }
      return auth;
    });
  }

  /**
   * Filters cell-specific fields to match API schema requirements.
   *
   * Uses the centralized cell-property-filter utility which:
   * - Removes known-transient properties (tools, children, visible, zIndex, markup, etc.)
   * - Filters attrs to match NodeAttrs/EdgeAttrs schema
   * - Warns about unknown properties being removed
   * - Ensures edge shape is set correctly for discriminator
   *
   * @param cell The cell object to filter
   * @returns Filtered cell object ready for API submission
   */
  filterCell(cell: Record<string, unknown>): Record<string, unknown> {
    return sanitizeCellForApi(cell as Cell, this._logger);
  }

  /**
   * Filters an array of cells, applying API schema compliance filtering to each.
   *
   * This method:
   * - Converts 'children' arrays to 'parent' references on child cells
   * - Filters each cell to match the OpenAPI Cell/Node/Edge schemas
   * - Logs warnings for unknown properties being removed
   *
   * @param cells Array of cells to filter
   * @returns Array of filtered cells ready for API submission
   */
  filterCells(cells: unknown[]): unknown[] {
    // Filter out non-object cells and cast to Cell[]
    const validCells = cells.filter(
      (cell): cell is Cell => typeof cell === 'object' && cell !== null,
    );

    return sanitizeCellsForApi(validCells, this._logger);
  }

  /**
   * Generic field filtering helper (block-list)
   */
  private _filterFields(
    data: Record<string, unknown>,
    fieldsToRemove: readonly string[],
  ): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (!fieldsToRemove.includes(key)) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
