import { Injectable } from '@angular/core';
import type { Metadata } from '../../models/threat-model.model';

/**
 * Service for filtering read-only fields from objects before sending to the server.
 * Based on the OpenAPI specification, these fields are server-managed and should not
 * be included in POST/PUT/PATCH requests.
 */
@Injectable({
  providedIn: 'root',
})
export class ReadonlyFieldFilterService {
  /**
   * Read-only fields on ThreatModel that should be stripped before POST/PUT
   */
  private readonly _threatModelReadOnlyFields = [
    'id',
    'created_at',
    'modified_at',
    'created_by',
    'owner',
    'documents',
    'repositories',
    'diagrams',
    'threats',
    'notes',
    'assets',
    'status_updated',
  ] as const;

  /**
   * Read-only fields on Threat that should be stripped before POST/PUT
   */
  private readonly _threatReadOnlyFields = [
    'id',
    'threat_model_id',
    'created_at',
    'modified_at',
  ] as const;

  /**
   * Read-only fields on Diagram (BaseDiagram) that should be stripped before POST/PUT
   */
  private readonly _diagramReadOnlyFields = ['id', 'update_vector'] as const;

  /**
   * Fields that should be stripped before POST (create) but allowed in PUT (update)
   * CreateDiagramRequest only accepts 'name' and 'type' fields
   */
  private readonly _diagramCreateOnlyFields = [
    'cells',
    'description',
    'image',
    'created_at',
    'modified_at',
    'metadata',
  ] as const;

  /**
   * Read-only fields on Note that should be stripped before POST/PUT
   * Note: metadata is NOT read-only despite what the schema says - it's managed via separate endpoints
   */
  private readonly _noteReadOnlyFields = ['id', 'created_at', 'modified_at', 'metadata'] as const;

  /**
   * Read-only fields on Asset that should be stripped before POST/PUT
   * Note: metadata is NOT read-only despite what the schema says - it's managed via separate endpoints
   */
  private readonly _assetReadOnlyFields = [
    'id',
    'created_at',
    'modified_at',
    'metadata',
    'threat_model_id',
  ] as const;

  /**
   * Read-only fields on Document that should be stripped before POST/PUT
   */
  private readonly _documentReadOnlyFields = [
    'id',
    'created_at',
    'modified_at',
    'metadata',
  ] as const;

  /**
   * Read-only fields on Repository that should be stripped before POST/PUT
   */
  private readonly _repositoryReadOnlyFields = [
    'id',
    'created_at',
    'modified_at',
    'metadata',
  ] as const;

  /**
   * Filters read-only fields from a ThreatModel object.
   * Also extracts metadata for separate handling.
   */
  filterThreatModel(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._threatModelReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from a Threat object.
   * Also extracts metadata for separate handling.
   */
  filterThreat(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._threatReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from a Diagram object for CREATE operations.
   * Extracts metadata and cells for separate handling.
   * CreateDiagramRequest only accepts 'name' and 'type' fields.
   * Cells must be added via a subsequent PUT/PATCH operation.
   */
  filterDiagram(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
    cells: unknown[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const cells = data['cells'] as unknown[] | undefined;

    // Combine both readonly and create-only fields for filtering
    const allFieldsToFilter = [...this._diagramReadOnlyFields, ...this._diagramCreateOnlyFields];
    const filtered = this._filterFields(data, allFieldsToFilter);

    return { filtered, metadata, cells };
  }

  /**
   * Filters read-only fields from a Note object.
   * Extracts metadata for separate handling via metadata endpoint.
   */
  filterNote(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._noteReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from an Asset object.
   * Extracts metadata for separate handling via metadata endpoint.
   */
  filterAsset(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._assetReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from a Document object.
   * Extracts metadata for separate handling via metadata endpoint.
   */
  filterDocument(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._documentReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters read-only fields from a Repository object.
   * Extracts metadata for separate handling via metadata endpoint.
   */
  filterRepository(data: Record<string, unknown>): {
    filtered: Record<string, unknown>;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;
    const filtered = this._filterFields(data, this._repositoryReadOnlyFields);
    return { filtered, metadata };
  }

  /**
   * Filters cell-specific fields to match API schema requirements.
   * Handles differences between nodes and edges:
   * - Edges: Removes 'shape' field (type='edge' is sufficient), normalizes label positions
   * - Nodes: Keeps 'shape' field (required for node type discrimination)
   *
   * @param cell The cell object to filter
   * @returns Filtered cell object ready for API submission
   */
  filterCell(cell: Record<string, unknown>): Record<string, unknown> {
    const filtered = { ...cell };

    // Determine if this is an edge based on type or shape
    const isEdge = filtered['type'] === 'edge' || filtered['shape'] === 'edge';

    if (isEdge) {
      // For edges, remove the 'shape' field entirely
      // The API uses 'type' for discrimination and doesn't expect 'shape' for edges
      delete filtered['shape'];

      // Normalize edge label positions from X6 format to API format
      // X6 uses {distance, offset, angle} but API expects a simple number 0-1
      if (Array.isArray(filtered['labels'])) {
        filtered['labels'] = (filtered['labels'] as Array<Record<string, unknown>>).map(label => {
          const normalizedLabel = { ...label };
          if (
            typeof label['position'] === 'object' &&
            label['position'] !== null &&
            'distance' in label['position']
          ) {
            // Extract the distance value as the position (0-1 range)
            const posObj = label['position'] as Record<string, unknown>;
            normalizedLabel['position'] = posObj['distance'];
          }
          return normalizedLabel;
        });
      }
    }

    return filtered;
  }

  /**
   * Filters an array of cells, applying cell-specific filtering to each.
   *
   * @param cells Array of cells to filter
   * @returns Array of filtered cells
   */
  filterCells(cells: unknown[]): unknown[] {
    return cells.map(cell => {
      if (typeof cell === 'object' && cell !== null) {
        return this.filterCell(cell as Record<string, unknown>);
      }
      return cell;
    });
  }

  /**
   * Generic field filtering helper
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
