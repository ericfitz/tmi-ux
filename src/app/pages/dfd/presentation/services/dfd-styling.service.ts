import { Injectable } from '@angular/core';

import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';
import { NodeType } from '../../domain/value-objects/node-info';
import { GraphOperation } from '../../types/graph-operation.types';
import { getLabelPositionFromAttrs, LABEL_POSITION_ATTRS } from '../../types/label-position.types';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';
import { ArchIconData } from '../../types/arch-icon.types';
import {
  CellStyleInfo,
  StyleChangeEvent,
} from '../../presentation/components/style-panel/style-panel.component';
import { IconPickerCellInfo } from '../../presentation/components/icon-picker-panel/icon-picker-panel.component';

/**
 * Style-panel / edge-styling glue for the DFD page.
 *
 * This service owns the cell-mutation and computation behind the style and
 * icon-picker panels: it builds the `CellStyleInfo` / `IconPickerCellInfo`
 * view models from graph cells, and applies style changes (color, fill,
 * label-position) by writing X6 attr paths and `customStyles` data on the cell.
 *
 * It never dispatches operations or touches change detection. The mutation
 * methods (`applyNodeStyleChange`, `applyEdgeStyleChange`, `clearCustomFormatting`)
 * mutate the cell AND build the history `GraphOperation` describing that change
 * — `previousState` is captured before mutation, so the read and the write
 * cannot be split. The component receives the returned operation and performs
 * the `executeOperation(...).subscribe(...)` dispatch plus `cdr.detectChanges()`.
 */
@Injectable({ providedIn: 'root' })
// SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: build style-panel view models and apply style mutations to DFD graph cells
export class DfdStylingService {
  /**
   * Build the `CellStyleInfo[]` shown in the style panel from the currently
   * selected cells. Returns an empty array if the graph is absent. Selected
   * ids not present in the graph are skipped.
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: build CellStyleInfo view models for selected cells for the style panel (pure)
  buildStylePanelCells(graph: LayoutGraph, selectedCellIds: string[] = []): CellStyleInfo[] {
    return selectedCellIds
      .map(id => graph.getCellById(id))
      .filter((cell): cell is LayoutCell => Boolean(cell))
      .map(cell => {
        const isNode = cell.isNode();
        const isEdge = cell.isEdge();
        const data = cell.getData() ?? {};
        const nodeType = (data as Record<string, any>)['nodeType'] || cell.shape || null;
        const attrs = cell.getAttrs() ?? {};

        let strokeColor: string | null = null;
        let fillColor: string | null = null;
        let fillOpacity: number | null = null;

        if (isNode) {
          const body = attrs['body'] || {};
          strokeColor = ((body as Record<string, any>)['stroke'] as string) || null;
          fillColor = ((body as Record<string, any>)['fill'] as string) || null;
          fillOpacity = ((body as Record<string, any>)['fillOpacity'] as number) ?? 1;
        } else if (isEdge) {
          const line = attrs['line'] || {};
          strokeColor = ((line as Record<string, any>)['stroke'] as string) || null;
        }

        let labelPosition = null;
        if (isNode && nodeType !== 'text-box') {
          const textAttrs = (attrs['text'] || {}) as Record<string, unknown>;
          labelPosition = getLabelPositionFromAttrs(textAttrs);
        }

        return {
          cellId: cell.id,
          isNode,
          isEdge,
          nodeType: isNode ? nodeType : null,
          strokeColor,
          fillColor,
          fillOpacity,
          hasCustomStyles: !!(data as Record<string, any>)['customStyles'],
          labelPosition,
          hasArchIcon: !!(data as Record<string, any>)['_arch'],
        };
      });
  }

  /**
   * Build the `IconPickerCellInfo[]` shown in the icon-picker panel from the
   * currently selected cells. Non-node selections are excluded.
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: build IconPickerCellInfo view models for selected node cells (pure)
  buildIconPickerCells(graph: LayoutGraph, selectedCellIds: string[] = []): IconPickerCellInfo[] {
    return selectedCellIds
      .map(id => graph.getCellById(id))
      .filter((cell): cell is LayoutCell => Boolean(cell?.isNode()))
      .map(cell => ({
        cellId: cell.id,
        nodeType: cell.shape,
        arch: (cell.getData()['_arch'] as ArchIconData) ?? null,
      }));
  }

  /**
   * Apply a node style change (stroke/fill/opacity or label position) to
   * `cell`, mutating its attrs and `customStyles` data, and return the
   * `GraphOperation` describing the change for history. Returns `null` for an
   * unknown label-position key (no mutation performed). The caller dispatches
   * the returned operation.
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: apply a node stroke/fill/label-position change and return the history operation (mutates shared state)
  applyNodeStyleChange(cell: LayoutCell, event: StyleChangeEvent): GraphOperation | null {
    const previousAttrs = cell.getAttrs() ?? {};
    const previousBody = (previousAttrs['body'] || {}) as Record<string, any>;
    const previousText = (previousAttrs['text'] || {}) as Record<string, any>;
    const previousData = cell.getData() ?? {};

    // Handle label position changes separately
    if (event.property === 'labelPosition') {
      return this.applyLabelPositionChange(cell, event, previousText, previousData);
    }

    const attrPathMap: Record<string, string> = {
      strokeColor: 'body/stroke',
      fillColor: 'body/fill',
      fillOpacity: 'body/fillOpacity',
    };
    const styleKeyMap: Record<string, string> = {
      strokeColor: 'stroke',
      fillColor: 'fill',
      fillOpacity: 'fillOpacity',
    };

    cell.setAttrByPath(attrPathMap[event.property], event.value);
    cell.setData({ ...previousData, customStyles: true }, { silent: true });

    return {
      id: `style-change-${Date.now()}-${cell.id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cell.id,
      updates: {
        style: { [styleKeyMap[event.property]]: event.value },
        properties: { customStyles: true },
      },
      previousState: {
        style: {
          stroke: previousBody['stroke'],
          fill: previousBody['fill'],
          fillOpacity: previousBody['fillOpacity'] ?? 1,
        },
        properties: { customStyles: previousData['customStyles'] || false },
      },
      includeInHistory: true,
    } as GraphOperation;
  }

  /**
   * Apply a label-position change to `cell`, mutating its text attrs and
   * `customStyles` data, and return the `GraphOperation` for history. Returns
   * `null` for an unknown position key (no mutation performed).
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: apply a label position change to a node cell and return the history operation (mutates shared state)
  private applyLabelPositionChange(
    cell: LayoutCell,
    event: StyleChangeEvent,
    previousText: Record<string, any>,
    previousData: Record<string, any>,
  ): GraphOperation | null {
    const positionKey = event.value as string;
    const posAttrs = LABEL_POSITION_ATTRS[positionKey];
    if (!posAttrs) {
      return null;
    }

    cell.setAttrByPath('text/refX', posAttrs.refX);
    cell.setAttrByPath('text/refY', posAttrs.refY);
    cell.setAttrByPath('text/textAnchor', posAttrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', posAttrs.textVerticalAnchor);
    cell.setData({ ...previousData, customStyles: true }, { silent: true });

    return {
      id: `label-position-${Date.now()}-${cell.id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cell.id,
      updates: {
        style: {
          refX: posAttrs.refX,
          refY: posAttrs.refY,
          textAnchor: posAttrs.textAnchor,
          textVerticalAnchor: posAttrs.textVerticalAnchor,
        },
        properties: { customStyles: true },
      },
      previousState: {
        style: {
          refX: previousText['refX'] ?? '50%',
          refY: previousText['refY'] ?? '50%',
          textAnchor: previousText['textAnchor'] ?? 'middle',
          textVerticalAnchor: previousText['textVerticalAnchor'] ?? 'middle',
        },
        properties: { customStyles: previousData['customStyles'] || false },
      },
      includeInHistory: true,
    } as GraphOperation;
  }

  /**
   * Apply an edge stroke-color change to `cell`, mutating its line attr, and
   * return the `GraphOperation` describing the change for history. The caller
   * dispatches the returned operation.
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: apply an edge stroke-color change and return the history operation (mutates shared state)
  applyEdgeStyleChange(cell: LayoutCell, event: StyleChangeEvent): GraphOperation {
    const previousAttrs = cell.getAttrs() ?? {};
    const previousLine = (previousAttrs['line'] || {}) as Record<string, any>;

    cell.setAttrByPath('line/stroke', event.value);

    return {
      id: `style-change-${Date.now()}-${cell.id}`,
      type: 'update-edge' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      edgeId: cell.id,
      updates: {
        style: { stroke: event.value },
      },
      previousState: {
        style: { stroke: previousLine['stroke'] },
      },
      includeInHistory: true,
    } as GraphOperation;
  }

  /**
   * Reset a single cell's custom formatting back to its type defaults,
   * mutating the cell, and return the `GraphOperation` describing the reset
   * for history. The caller loops over selected cells, dispatches each
   * returned operation, and triggers change detection.
   */
  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: reset a cell's style to type defaults and return the history operation (mutates shared state)
  clearCustomFormatting(cell: LayoutCell): GraphOperation | null {
    if (cell.isNode()) {
      const data = cell.getData() ?? {};
      const nodeType = data['nodeType'] || cell.shape || 'process';
      const defaultFill = DFD_STYLING_HELPERS.getDefaultFill(nodeType as NodeType);
      const defaultStroke = DFD_STYLING_HELPERS.getDefaultStroke(nodeType as NodeType);

      cell.setAttrByPath('body/fill', defaultFill);
      cell.setAttrByPath('body/stroke', defaultStroke);
      cell.setAttrByPath('body/fillOpacity', 1);
      // Reset label position to shape-specific defaults
      const defaultRefY = nodeType === 'store' ? '55%' : '50%';
      cell.setAttrByPath('text/refX', '50%');
      cell.setAttrByPath('text/refY', defaultRefY);
      cell.setAttrByPath('text/textAnchor', 'middle');
      cell.setAttrByPath('text/textVerticalAnchor', 'middle');
      cell.setData({ ...data, customStyles: undefined }, { silent: true });

      return {
        id: `clear-style-${Date.now()}-${cell.id}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
        nodeId: cell.id,
        updates: {
          style: {
            fill: defaultFill,
            stroke: defaultStroke,
            fillOpacity: 1,
            refX: '50%',
            refY: defaultRefY,
            textAnchor: 'middle',
            textVerticalAnchor: 'middle',
          },
          properties: { customStyles: undefined },
        },
        includeInHistory: true,
      } as GraphOperation;
    }

    if (cell.isEdge()) {
      const defaultStroke = DFD_STYLING.EDGES.DEFAULT_STROKE;
      cell.setAttrByPath('line/stroke', defaultStroke);

      return {
        id: `clear-style-${Date.now()}-${cell.id}`,
        type: 'update-edge' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
        edgeId: cell.id,
        updates: {
          style: { stroke: defaultStroke },
        },
        includeInHistory: true,
      } as GraphOperation;
    }

    return null;
  }
}
