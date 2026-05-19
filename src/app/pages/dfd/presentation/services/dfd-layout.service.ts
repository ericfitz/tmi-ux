import { Injectable } from '@angular/core';

import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { DFD_STYLING } from '../../constants/styling-constants';
import {
  ArchIconData,
  ICON_ELIGIBLE_SHAPES,
  ICON_HIDEABLE_BORDER_SHAPES,
} from '../../types/arch-icon.types';
import { ICON_SIZE } from '../../types/icon-placement.types';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';
import {
  AUTO_LAYOUT_DEFAULTS,
  ChildBox,
  IconColumn,
  Orientation,
  iconOnlyFitGeometry,
  inferOrientation,
  labelLineHeightForFontSize,
  layoutContainer,
  sortChildrenByPorts,
  sortChildrenByPosition,
} from '../../utils/auto-layout.util';
import { isCellLayoutLocked } from '../../utils/layout-lock.util';
import { measureLabelWidth } from '../../utils/text-measurement.util';

/**
 * Auto-layout glue for the DFD page (#638, #642).
 *
 * This service owns the graph-coupled GLUE around the pure layout math in
 * `auto-layout.util.ts`: container-fit, icon-only fit, and the cascade that
 * walks ancestor containers. It performs cell reads/writes (resize, position,
 * attr paths) but never dispatches operations or touches change detection.
 *
 * The component retains the `_runLayoutCycle` orchestrator: it owns the
 * `_inLayoutCycle` re-entrancy guard, captures pre-state for history, calls
 * the pure layout methods here, and dispatches the batched history operation.
 */
@Injectable({ providedIn: 'root' })
export class DfdLayoutService {
  constructor(private userPreferences: UserPreferencesService) {}

  /**
   * Top-level auto-layout entry point. Returns true if any change was applied.
   *
   * Dispatches to icon-only fit for leaf iconned shapes, or container fit for
   * any auto-layout-eligible shape with embedded non-text-box children.
   *
   * `sortBy` controls how container-fit children are ordered:
   *   - `ports` (default) — by connection-port usage (initial layout)
   *   - `position` — by current (x, y) (after a child drag)
   */
  applyAutoLayout(
    cell: LayoutCell,
    graph: LayoutGraph,
    sortBy: 'ports' | 'position' = 'ports',
  ): boolean {
    if (!this.userPreferences.getPreferences().autoLayoutEnabled) return false;
    if (isCellLayoutLocked(cell)) return false;
    const data = cell.getData() ?? {};
    const allChildren = cell.getChildren() ?? [];
    const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
    if (layoutChildren.length > 0) {
      return this.applyContainerFit(cell, layoutChildren, graph, sortBy);
    }
    if (!data['_arch']) return false;
    return this.applyIconOnlyFit(cell);
  }

  /**
   * Apply the icon-only fit: 32 × (32 + labelLineHeight). Only fires when:
   *   - shape ∈ {actor, process, store}
   *   - showShapeBordersWithIcons === false (icon-only mode)
   *   - cell has no embedded children
   *   - current size is shape default OR is the size we previously set
   *
   * Returns true if any change was applied.
   */
  applyIconOnlyFit(cell: LayoutCell): boolean {
    if (!(ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(cell.shape)) return false;

    const prefs = this.userPreferences.getPreferences();
    if (prefs.showShapeBordersWithIcons) return false;

    const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
    const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
    if (!shapeConfig) return false;
    const defaultWidth = shapeConfig.DEFAULT_WIDTH as number;
    const defaultHeight = shapeConfig.DEFAULT_HEIGHT as number;

    const data = cell.getData() ?? {};
    const previousAutoFit = data['_archAutoFit'] as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    const { width: currentWidth, height: currentHeight } = cell.getSize();
    const atDefaultSize = currentWidth === defaultWidth && currentHeight === defaultHeight;
    const stillAtPreviousAutoFit =
      !!previousAutoFit &&
      currentWidth === previousAutoFit.width &&
      currentHeight === previousAutoFit.height;
    if (!atDefaultSize && !stillAtPreviousAutoFit) return false;

    const lineHeight = labelLineHeightForFontSize(DFD_STYLING.DEFAULT_FONT_SIZE);
    const geom = iconOnlyFitGeometry(lineHeight);

    if (currentWidth !== geom.width || currentHeight !== geom.height) {
      cell.resize(geom.width, geom.height);
    }
    this.setAbsoluteIconAttrs(cell, geom.iconAttrs);
    this.setAbsoluteLabelAttrs(cell, geom.labelAttrs);

    cell.setData(
      {
        ...cell.getData(),
        _archAutoFit: { kind: 'icon-only', width: geom.width, height: geom.height },
      },
      { silent: true },
    );
    return true;
  }

  /**
   * Apply container fit. Resizes the cell to fit a grid of layout children
   * plus an optional icon column/row, repositions each child within the grid,
   * and updates icon/label attrs for iconned cells. Returns true if any
   * change was applied.
   *
   * Eligibility: shape ∈ {actor, process, store, security-boundary} AND
   * current size is shape default OR matches the previously-recorded auto-fit
   * size (i.e., the user has not manually resized this cell).
   */
  applyContainerFit(
    cell: LayoutCell,
    layoutChildren: LayoutCell[],
    graph: LayoutGraph,
    sortBy: 'ports' | 'position',
  ): boolean {
    if (!(ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape)) return false;

    const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
    const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
    if (!shapeConfig) return false;
    const defaultWidth = shapeConfig.DEFAULT_WIDTH as number;
    const defaultHeight = shapeConfig.DEFAULT_HEIGHT as number;

    const data = cell.getData() ?? {};
    const previousAutoFit = data['_archAutoFit'] as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    const { width: currentWidth, height: currentHeight } = cell.getSize();
    const atDefaultSize = currentWidth === defaultWidth && currentHeight === defaultHeight;
    const stillAtPreviousAutoFit =
      !!previousAutoFit &&
      currentWidth === previousAutoFit.width &&
      currentHeight === previousAutoFit.height;
    if (!atDefaultSize && !stillAtPreviousAutoFit) return false;

    const fontSize = DFD_STYLING.DEFAULT_FONT_SIZE;
    const fontFamily = DFD_STYLING.TEXT_FONT_FAMILY;
    const lineHeight = labelLineHeightForFontSize(fontSize);

    const arch = data['_arch'] as ArchIconData | undefined;
    const iconCol: IconColumn = this.buildIconColumn(cell, arch, fontSize, fontFamily, lineHeight);

    const childBoxes: ChildBox[] = layoutChildren.map(child => this.buildChildBox(graph, child));

    const orientation = this.resolveLayoutOrientation(graph);
    const sorted =
      sortBy === 'position'
        ? sortChildrenByPosition(childBoxes, orientation)
        : sortChildrenByPorts(childBoxes, orientation);

    const padding = {
      outer: AUTO_LAYOUT_DEFAULTS.outerPad,
      iconGap: AUTO_LAYOUT_DEFAULTS.iconGap,
      gap: AUTO_LAYOUT_DEFAULTS.gap,
    };
    const layout = layoutContainer(iconCol, sorted, orientation, padding, lineHeight);

    if (currentWidth !== layout.containerWidth || currentHeight !== layout.containerHeight) {
      cell.resize(layout.containerWidth, layout.containerHeight);
    }

    if (layout.iconAttrs) {
      this.setAbsoluteIconAttrs(cell, layout.iconAttrs);
    }
    if (layout.labelAttrs) {
      this.setAbsoluteLabelAttrs(cell, layout.labelAttrs);
    }

    // layoutContainer returns child positions in container-local coords; x6
    // children use absolute graph coords, so translate by the container's
    // current absolute position.
    const cellPos = cell.getPosition();
    for (const pos of layout.childPositions) {
      const child = graph.getCellById(pos.id);
      if (!child) continue;
      const absX = cellPos.x + pos.x;
      const absY = cellPos.y + pos.y;
      const cur = child.getPosition();
      if (cur.x !== absX || cur.y !== absY) {
        child.setPosition(absX, absY);
      }
    }

    cell.setData(
      {
        ...cell.getData(),
        _archAutoFit: {
          kind: 'container',
          width: layout.containerWidth,
          height: layout.containerHeight,
        },
      },
      { silent: true },
    );

    return true;
  }

  private buildIconColumn(
    cell: LayoutCell,
    arch: ArchIconData | undefined,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
  ): IconColumn {
    if (!arch) {
      return { hasIcon: false, width: 0, height: 0 };
    }
    const attrs = cell.getAttrs() as Record<string, Record<string, unknown>>;
    const labelText = (attrs?.['text']?.['text'] as string | undefined) ?? '';
    const labelWidth = measureLabelWidth(labelText, fontSize, fontFamily);
    return {
      hasIcon: true,
      width: Math.max(ICON_SIZE, Math.ceil(labelWidth)),
      height: ICON_SIZE + AUTO_LAYOUT_DEFAULTS.labelGap + lineHeight,
    };
  }

  /**
   * Build a `ChildBox` for a layout child: its size, current position, and a
   * map of which of the four cardinal ports carry a connected edge.
   */
  buildChildBox(graph: LayoutGraph, child: LayoutCell): ChildBox {
    const { width, height } = child.getSize();
    const ports: { top: boolean; right: boolean; bottom: boolean; left: boolean } = {
      top: false,
      right: false,
      bottom: false,
      left: false,
    };
    const markPort = (portId: unknown): void => {
      if (portId === 'top' || portId === 'right' || portId === 'bottom' || portId === 'left') {
        ports[portId] = true;
      }
    };
    const edges = graph.getConnectedEdges?.(child) ?? [];
    for (const edge of edges) {
      if (edge.getSourceCellId?.() === child.id) {
        markPort(edge.getSourcePortId?.());
      }
      if (edge.getTargetCellId?.() === child.id) {
        markPort(edge.getTargetPortId?.());
      }
    }
    const pos = child.getPosition();
    return { id: child.id, width, height, ports, x: pos.x, y: pos.y };
  }

  /**
   * Resolve the auto-layout orientation. Honors an explicit user preference;
   * otherwise infers it from the geometry of the top-level nodes.
   */
  resolveLayoutOrientation(graph: LayoutGraph): Orientation {
    const prefs = this.userPreferences.getPreferences();
    if (prefs.autoLayoutOrientation === 'horizontal') return 'horizontal';
    if (prefs.autoLayoutOrientation === 'vertical') return 'vertical';
    const topLevel = graph.getNodes().filter(n => !n.getParent());
    return inferOrientation(
      topLevel.map(n => {
        const p = n.getPosition();
        const s = n.getSize();
        return { x: p.x, y: p.y, width: s.width, height: s.height };
      }),
    );
  }

  /**
   * Walk up the parent chain from `startCell`. For each ancestor that is in
   * container-fit state, re-apply container fit. Stops at the first ancestor
   * without an `_archAutoFit.kind === 'container'` flag.
   */
  cascadeContainerLayout(startCell: LayoutCell, graph: LayoutGraph): void {
    let parent = startCell.getParent();
    while (parent) {
      if (isCellLayoutLocked(parent)) break;
      const data = parent.getData?.() ?? {};
      const autoFit = data['_archAutoFit'] as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') break;
      const allChildren = parent.getChildren() ?? [];
      const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
      if (layoutChildren.length === 0) break;
      this.applyContainerFit(parent, layoutChildren, graph, 'ports');
      parent = parent.getParent();
    }
  }

  /**
   * Apply auto-layout to every eligible cell. Used when a global preference
   * (showShapeBordersWithIcons, autoLayoutEnabled, autoLayoutOrientation)
   * changes — newly-placed icons handle themselves through onIconSelected.
   *
   * Eligible cells include any iconned shape (icon-only or container fit) plus
   * security boundaries with embedded layout children (container fit, no icon).
   */
  applyAutoLayoutToAllEligibleCells(graph: LayoutGraph): void {
    for (const node of graph.getNodes()) {
      if (isCellLayoutLocked(node)) continue;
      const data = node.getData();
      const allChildren = node.getChildren() ?? [];
      const hasLayoutChildren = allChildren.some(c => c.shape !== 'text-box');
      if (data?.['_arch'] || hasLayoutChildren) {
        this.applyAutoLayout(node, graph);
      }
    }
  }

  /**
   * Clear routing vertices on every edge connected to `node`. Used before a
   * container re-layout so dragged children don't keep stale edge bends.
   */
  clearVerticesOfConnectedEdges(graph: LayoutGraph, node: LayoutCell): void {
    const edges = graph.getConnectedEdges?.(node) ?? [];
    for (const edge of edges) {
      if (typeof edge.setVertices === 'function') {
        edge.setVertices([]);
      }
    }
  }

  /**
   * Write the absolute icon ref attrs (`refX/refY/refX2/refY2`) onto a cell.
   */
  private setAbsoluteIconAttrs(
    cell: LayoutCell,
    attrs: { refX: number; refY: number; refX2: number; refY2: number },
  ): void {
    cell.setAttrByPath('icon/refX', attrs.refX);
    cell.setAttrByPath('icon/refY', attrs.refY);
    cell.setAttrByPath('icon/refX2', attrs.refX2);
    cell.setAttrByPath('icon/refY2', attrs.refY2);
  }

  /**
   * Write the absolute label ref/anchor attrs onto a cell.
   */
  private setAbsoluteLabelAttrs(
    cell: LayoutCell,
    attrs: {
      refX: number;
      refY: number;
      refX2: number;
      refY2: number;
      textAnchor: 'middle';
      textVerticalAnchor: 'top' | 'middle' | 'bottom';
    },
  ): void {
    cell.setAttrByPath('text/refX', attrs.refX);
    cell.setAttrByPath('text/refY', attrs.refY);
    cell.setAttrByPath('text/refX2', attrs.refX2);
    cell.setAttrByPath('text/refY2', attrs.refY2);
    cell.setAttrByPath('text/textAnchor', attrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', attrs.textVerticalAnchor);
  }
}
