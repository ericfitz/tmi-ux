import { Injectable } from '@angular/core';
import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import {
  DiagramOption,
  CellOption,
} from '../../pages/tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { LoggerService } from '../../core/services/logger.service';

/**
 * Interface for X6 Graph basic operations
 */
interface X6Graph {
  getCells(): X6Cell[];
}

/**
 * Interface for X6 Cell operations
 */
interface X6Cell {
  id: string;
  isNode(): boolean;
  isEdge(): boolean;
  getLabel?(): X6CellLabel;
  getLabels?(): X6CellLabel[];
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
 * Interface for stored cell data from threat models
 * Supports both X6 format and legacy mxGraph format:
 * - Nodes: attrs.text.text
 * - Edges: labels[].attrs.text.text (X6 native format)
 * - Legacy: value/style fields
 */
interface StoredCell {
  id: string;
  shape?: string;
  attrs?: {
    text?: { text?: string };
    [key: string]: unknown;
  };
  // X6 edge labels array (edges store labels here, not in attrs.text.text)
  labels?: StoredEdgeLabel[];
  // Legacy mxGraph format properties (kept for backward compatibility)
  value?: string;
  style?: string | { [key: string]: unknown };
  data?: {
    id?: string;
    label?: string;
  };
}

/**
 * Interface for extracted cell data that includes both diagram and cell information
 */
export interface DiagramCellData {
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
export class CellDataExtractionService {
  constructor(private logger: LoggerService) {}

  /**
   * Extracts diagram and cell data from a threat model.
   * Optionally filters cells to a specific diagram.
   *
   * @param threatModel - The threat model containing diagrams and their cells
   * @param diagramId - Optional diagram ID to filter cells by
   * @returns DiagramCellData containing diagrams and cells for dropdowns
   */
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
  private extractCellLabel(cell: X6Cell | StoredCell, cellType: 'stored' | 'x6'): string {
    if (!cell || !cell.id) {
      return 'Unknown Cell';
    }

    try {
      const label =
        cellType === 'x6'
          ? this.extractX6CellLabel(cell as X6Cell)
          : this.extractStoredCellLabel(cell as StoredCell);

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
   * Extracts label from a stored cell, trying multiple strategies in priority order:
   * 1. Edge labels array (X6 native edge format)
   * 2. Node attrs.text.text (X6 node format)
   * 3. Legacy mxGraph value field (with HTML stripping)
   * 4. Legacy mxGraph style field (text/label attributes)
   * 5. Generate friendly label from cell ID
   */
  private extractStoredCellLabel(storedCell: StoredCell): string | null {
    return (
      this.tryExtractEdgeLabel(storedCell) ??
      this.tryExtractNodeAttrsLabel(storedCell) ??
      this.tryExtractLegacyValue(storedCell) ??
      this.tryExtractStyleLabel(storedCell) ??
      this.generateFriendlyLabel(storedCell)
    );
  }

  /** Extracts label from X6 edge labels array (labels[].attrs.text.text). */
  private tryExtractEdgeLabel(cell: StoredCell): string | null {
    if (cell.shape !== 'edge' || !Array.isArray(cell.labels) || cell.labels.length === 0) {
      return null;
    }
    const labelText = cell.labels[0]?.attrs?.text?.text;
    if (labelText && typeof labelText === 'string' && labelText.trim()) {
      return labelText.trim();
    }
    return null;
  }

  /** Extracts label from X6 node attrs (attrs.text.text). */
  private tryExtractNodeAttrsLabel(cell: StoredCell): string | null {
    const text = cell.attrs?.text?.text;
    if (text && typeof text === 'string' && text.trim()) {
      return text.trim();
    }
    return null;
  }

  /** Extracts label from legacy mxGraph value field, stripping HTML tags. */
  private tryExtractLegacyValue(cell: StoredCell): string | null {
    if (!cell.value || typeof cell.value !== 'string') {
      return null;
    }
    let cleanValue = cell.value;
    let previousValue;
    do {
      previousValue = cleanValue;
      cleanValue = cleanValue.replace(/<[^>]*>/g, '');
    } while (cleanValue !== previousValue);
    cleanValue = cleanValue.trim();
    if (cleanValue && cleanValue !== cell.id) {
      return cleanValue;
    }
    return null;
  }

  /** Extracts label from legacy mxGraph style field using regex patterns. */
  private tryExtractStyleLabel(cell: StoredCell): string | null {
    if (!cell.style || typeof cell.style !== 'string') {
      return null;
    }

    const stylePatterns = [
      /text=([^;]+)/i,
      /label=([^;]+)/i,
      /html=1;text=([^;]+)/i,
      /whiteSpace=wrap;.*text=([^;]+)/i,
    ];

    for (const pattern of stylePatterns) {
      const styleMatch = cell.style.match(pattern);
      if (styleMatch?.[1]) {
        try {
          let decodedText = decodeURIComponent(styleMatch[1]).trim();
          decodedText = decodedText.replace(/&[a-zA-Z0-9]+;/g, ' ').trim();
          decodedText = decodedText.replace(/\s+/g, ' ');
          if (decodedText && decodedText !== cell.id && decodedText.length > 0) {
            return decodedText;
          }
        } catch (error) {
          this.logger.warn('Error decoding style text', {
            styleMatch: styleMatch[1],
            error,
          });
        }
      }
    }
    return null;
  }

  /** Cleans up a label by collapsing newlines and trimming, falling back to cell ID. */
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
