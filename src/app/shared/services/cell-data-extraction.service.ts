import { Injectable } from '@angular/core';
import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import {
  DiagramOption,
  CellOption,
} from '../../pages/tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { LoggerService } from '../../core/services/logger.service';
import { CANONICAL_EDGE_SHAPE } from '../../pages/dfd/utils/cell-property-filter.util';

/**
 * Interface for X6 Graph basic operations
 */
interface X6Graph {
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: list all cells in an X6 graph (pure)
  getCells(): X6Cell[];
}

/**
 * Interface for X6 Cell operations
 */
interface X6Cell {
  id: string;
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: check whether a diagram cell is a node (pure)
  isNode(): boolean;
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: check whether a diagram cell is an edge (pure)
  isEdge(): boolean;
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: fetch the primary label of a diagram cell (pure)
  getLabel?(): X6CellLabel;
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: list all labels on a diagram cell (pure)
  getLabels?(): X6CellLabel[];
  // SEM@fde089a9df7229c2b08ae0dc8c2e0f60997deea1: fetch a cell attribute value at a given path (pure)
  getAttrByPath?(path: string): unknown;
}

/**
 * Interface for X6 Cell Label
 */
interface X6CellLabel {
  attrs?: { [key: string]: { value?: string } };
}

/**
 * Interface for stored edge label (X6 native format)
 * Edge labels are stored in a labels array, with text at labels[].attrs.text.text
 */
interface StoredEdgeLabel {
  attrs?: {
    text?: { text?: string };
    [key: string]: unknown;
  };
  position?: number;
}

/**
 * Interface for stored cell data from threat models (X6 format)
 * - Nodes: attrs.text.text
 * - Edges: labels[].attrs.text.text (X6 native format)
 */
interface StoredCell {
  id: string;
  shape?: string;
  attrs?: {
    text?: { text?: string };
    [key: string]: unknown;
  };
  labels?: StoredEdgeLabel[];
  data?: {
    id?: string;
    label?: string;
  };
}

/**
 * Interface for extracted cell data that includes both diagram and cell information
 */
interface DiagramCellData {
  diagrams: DiagramOption[];
  cells: CellOption[];
}

/**
 * Service for extracting diagram and cell data for threat editor dialogs.
 * Handles both X6 runtime cells and threat model stored data.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: service that extracts diagram and cell options from threat models or live X6 graphs
export class CellDataExtractionService {
  // SEM@0f5b46881ccb144e2325cc70ec1c369253dc4aff: inject logger dependency (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Extracts diagram and cell data from a threat model.
   * Optionally filters cells to a specific diagram.
   *
   * @param threatModel - The threat model containing diagrams and their cells
   * @param diagramId - Optional diagram ID to filter cells by
   * @returns DiagramCellData containing diagrams and cells for dropdowns
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: extract diagram and cell options from a stored threat model for editor dropdowns (pure)
  extractFromThreatModel(threatModel: ThreatModel, diagramId?: string): DiagramCellData {
    this.logger.debugComponent(
      'CellDataExtractionService',
      'Extracting cell data from threat model',
      {
        threatModelId: threatModel.id,
        diagramCount: threatModel.diagrams?.length || 0,
        filterByDiagram: !!diagramId,
        targetDiagramId: diagramId,
      },
    );

    // Extract diagram options
    const diagrams: DiagramOption[] = (threatModel.diagrams || []).map(diagram => ({
      id: diagram.id,
      name: diagram.name,
    }));

    // Extract cell options
    const cells: CellOption[] = [];

    if (threatModel.diagrams) {
      // If filtering by diagram, only process that diagram
      const diagramsToProcess = diagramId
        ? threatModel.diagrams.filter(diagram => diagram.id === diagramId)
        : threatModel.diagrams;

      diagramsToProcess.forEach(diagram => {
        if (diagram.cells) {
          diagram.cells.forEach(cell => {
            const cellLabel = this.extractCellLabel(cell, 'stored');
            cells.push({
              id: cell.id,
              label: cellLabel,
              diagramId: diagram.id, // Include which diagram this cell belongs to
            });
          });
        }
      });
    }

    this.logger.debugComponent(
      'CellDataExtractionService',
      'Extracted cell data from threat model',
      {
        diagramCount: diagrams.length,
        cellCount: cells.length,
        sampleCells: cells.slice(0, 3).map(c => ({
          id: c.id.substring(0, 8) + '...',
          label: c.label,
        })),
      },
    );

    return { diagrams, cells };
  }

  /**
   * Extracts cell data from X6 runtime graph.
   * Used when working with active DFD editor.
   *
   * @param x6Graph - The X6 Graph instance
   * @param diagramId - The current diagram ID
   * @param diagramName - The current diagram name
   * @returns DiagramCellData containing current diagram and its cells
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: extract diagram and cell options from a live X6 graph instance (pure)
  extractFromX6Graph(x6Graph: X6Graph, diagramId: string, diagramName: string): DiagramCellData {
    this.logger.debugComponent('CellDataExtractionService', 'Extracting cell data from X6 graph', {
      diagramId,
      diagramName,
      hasGraph: !!x6Graph,
    });

    // Create diagram options (just the current diagram)
    const diagrams: DiagramOption[] = [
      {
        id: diagramId,
        name: diagramName,
      },
    ];

    // Extract cell options from current graph
    const cells: CellOption[] = [];

    try {
      if (x6Graph && typeof x6Graph.getCells === 'function') {
        const x6Cells = x6Graph.getCells();

        this.logger.debugComponent('CellDataExtractionService', 'Found X6 cells in graph', {
          totalCells: x6Cells.length,
        });

        x6Cells.forEach((cell: X6Cell) => {
          const cellLabel = this.extractCellLabel(cell, 'x6');
          cells.push({
            id: cell.id,
            label: cellLabel,
            diagramId: diagramId, // Include which diagram this cell belongs to
          });
        });
      }
    } catch (error) {
      this.logger.error('Error extracting cells from X6 graph', error);
    }

    this.logger.debugComponent('CellDataExtractionService', 'Extracted cell data from X6 graph', {
      diagramCount: diagrams.length,
      cellCount: cells.length,
      sampleCells: cells.slice(0, 3).map(c => ({
        id: c.id.substring(0, 8) + '...',
        label: c.label,
      })),
    });

    return { diagrams, cells };
  }

  /**
   * Extracts the label from a cell, handling both stored cells and X6 runtime cells.
   *
   * @param cell - The cell object (either stored Cell or X6 Cell)
   * @param cellType - The type of cell to determine extraction method
   * @returns The cell label as a string
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: extract a human-readable label from a stored or runtime diagram cell (pure)
  private extractCellLabel(cell: X6Cell | StoredCell, cellType: 'stored' | 'x6'): string {
    if (!cell || !cell.id) {
      return 'Unknown Cell';
    }

    try {
      const label =
        cellType === 'x6'
          ? this.extractX6CellLabel(cell as X6Cell)
          : this.extractStoredCellLabel(cell);

      return this.cleanLabel(label, cell.id);
    } catch (error) {
      this.logger.warn('Error extracting cell label, using ID as fallback', {
        cellId: cell.id,
        cellType,
        error,
      });
      return cell.id;
    }
  }

  /**
   * Extracts label from an X6 runtime cell using getLabel() or manual fallback.
   */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: extract the display label from a live X6 cell object (pure)
  private extractX6CellLabel(x6Cell: X6Cell): string | null {
    if (typeof x6Cell.getLabel === 'function') {
      const extractedLabel = x6Cell.getLabel();
      const labelText = this.extractLabelText(extractedLabel);
      if (labelText?.trim()) {
        return labelText.trim();
      }
      return null;
    }

    // Fallback manual extraction for X6 cells
    if (x6Cell.isNode?.()) {
      const textValue = x6Cell.getAttrByPath?.('text/text');
      if (textValue && typeof textValue === 'string') {
        return textValue.trim();
      }
    } else if (x6Cell.isEdge?.()) {
      const labels = x6Cell.getLabels?.();
      if (labels && labels.length > 0) {
        const firstLabelValue = labels[0]?.attrs?.['text']?.value;
        if (firstLabelValue) {
          return firstLabelValue.trim();
        }
      }
    }

    return null;
  }

  /**
   * Extracts label from a stored cell, trying strategies in priority order:
   * 1. Edge labels array (X6 native edge format)
   * 2. Node attrs.text.text (X6 node format)
   * 3. Generate friendly label from cell ID
   */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: extract the display label from a stored cell, falling back through multiple strategies (pure)
  private extractStoredCellLabel(storedCell: StoredCell): string | null {
    return (
      this.tryExtractEdgeLabel(storedCell) ??
      this.tryExtractNodeAttrsLabel(storedCell) ??
      this.generateFriendlyLabel(storedCell)
    );
  }

  /** Extracts label from X6 edge labels array (labels[].attrs.text.text). */
  // SEM@629da63a9c7d9e6f04041836bc89aae48d2cde81: extract the label text from a stored edge cell's labels array (pure)
  private tryExtractEdgeLabel(cell: StoredCell): string | null {
    if (
      cell.shape !== CANONICAL_EDGE_SHAPE ||
      !Array.isArray(cell.labels) ||
      cell.labels.length === 0
    ) {
      return null;
    }
    const labelText = cell.labels[0]?.attrs?.text?.text;
    if (labelText && typeof labelText === 'string' && labelText.trim()) {
      return labelText.trim();
    }
    return null;
  }

  /** Extracts label from X6 node attrs (attrs.text.text). */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: extract the label text from a stored node cell's attrs (pure)
  private tryExtractNodeAttrsLabel(cell: StoredCell): string | null {
    const text = cell.attrs?.text?.text;
    if (text && typeof text === 'string' && text.trim()) {
      return text.trim();
    }
    return null;
  }

  /** Cleans up a label by collapsing newlines and trimming, falling back to cell ID. */
  // SEM@ae48a36a6dc6b6223757be6fcf33bc9ab342c036: normalize a cell label by collapsing whitespace, falling back to cell ID (pure)
  private cleanLabel(label: string | null, cellId: string): string {
    if (typeof label === 'string') {
      const cleaned = label.replace(/\n/g, ' ').trim();
      if (cleaned) {
        return cleaned;
      }
    }
    return cellId;
  }

  /**
   * Extracts text from an X6 cell label object
   */
  // SEM@016cf91ed31dd9e800b8d2c22c26718ea531c7d4: extract a string value from an X6 cell label attrs object (pure)
  private extractLabelText(label: X6CellLabel | undefined): string | null {
    if (!label) return null;

    // Try to extract text from label attrs
    if (label.attrs) {
      for (const [_key, attr] of Object.entries(label.attrs)) {
        if (attr && typeof attr === 'object' && 'value' in attr && typeof attr.value === 'string') {
          return attr.value;
        }
      }
    }

    return null;
  }

  /**
   * Generates a more user-friendly label from cell data when no proper label is available.
   * This is used as a fallback for stored cells that don't preserve label information.
   */
  // SEM@016cf91ed31dd9e800b8d2c22c26718ea531c7d4: build a human-readable fallback label from a cell ID (pure)
  private generateFriendlyLabel(cell: X6Cell | StoredCell): string {
    // Try to create a more meaningful label based on cell properties
    const cellId = cell.id || 'unknown';

    // If it's a short ID (like a UUID fragment), show it as is
    if (cellId.length <= 8) {
      return cellId;
    }

    // For longer IDs, try to make them more readable
    if (cellId.includes('-')) {
      // If it looks like a UUID, show first part + "..."
      const parts = cellId.split('-');
      if (parts.length > 1) {
        return `${parts[0]}...`;
      }
    }

    // For very long IDs, truncate and add ellipsis
    if (cellId.length > 12) {
      return `${cellId.substring(0, 8)}...`;
    }

    return cellId;
  }
}
