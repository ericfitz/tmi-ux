import { Injectable } from '@angular/core';

import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { ArchitectureIconService } from '../../infrastructure/services/architecture-icon.service';
import { DFD_STYLING } from '../../constants/styling-constants';
import {
  ArchIconData,
  ICON_ELIGIBLE_SHAPES,
  ICON_HIDEABLE_BORDER_SHAPES,
  ICON_HIDEABLE_BORDER_SELECTORS,
} from '../../types/arch-icon.types';
import {
  ICON_PLACEMENT_ATTRS,
  ICON_SIZE,
  DEFAULT_LABEL_ATTRS_BY_SHAPE,
  getIconPlacementKey,
  getLabelAttrsForIconPlacement,
} from '../../types/icon-placement.types';
import { LayoutCell, LayoutGraph } from '../../types/layout-cell.types';
import { isCellLayoutLocked, LOCK_BADGE_ICON_HREF } from '../../utils/layout-lock.util';
import { DfdLayoutService } from './dfd-layout.service';

/**
 * Architecture-icon application glue for the DFD page.
 *
 * This service owns the cell-mutation steps that apply (and revert)
 * architecture icons, lock badges, and border preferences to X6 cells. It
 * performs cell reads/writes (attr paths, resize, data) but never dispatches
 * operations or touches change detection.
 *
 * The component retains the `onIconSelected` / `onIconRemoved` /
 * `onIconPlacementChanged` handlers: they own history capture, the
 * `executeOperation` dispatch, and the `cdr.detectChanges()` call, and they
 * delegate the per-cell mutations here.
 */
@Injectable({ providedIn: 'root' })
// SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: apply, restore, and sync icon visual state across diagram cells (mutates shared state)
export class DfdIconService {
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: inject user preferences, architecture icon, and layout service dependencies (pure)
  constructor(
    private userPreferences: UserPreferencesService,
    private architectureIcon: ArchitectureIconService,
    private dfdLayout: DfdLayoutService,
  ) {}

  /**
   * Deep-clone a cell snapshot for history tracking. Used by handlers that
   * mutate cell.data/attrs before calling executeOperation — the executor's
   * own previousState capture runs after the mutation, so it would record
   * the post-mutation state. metadata.previousCellState overrides that.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: deep-clone a cell's full state snapshot for undo history (pure)
  captureCellStateForHistory(cell: LayoutCell): unknown {
    const parent = cell.getParent();
    return JSON.parse(
      JSON.stringify({
        id: cell.id,
        shape: cell.shape,
        position: cell.getPosition(),
        size: cell.getSize(),
        attrs: cell.getAttrs(),
        ports: cell.getPorts(),
        data: cell.getData(),
        visible: cell.isVisible(),
        zIndex: cell.getZIndex(),
        parent: parent?.isNode() ? parent.id : undefined,
      }),
    );
  }

  /**
   * Apply an architecture icon and its locked label to a cell: writes the
   * icon href/size/ref attrs and the label ref/anchor attrs derived from the
   * icon's placement.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: apply icon href and label placement attrs to a diagram cell (mutates shared state)
  applyIconToCell(cell: LayoutCell, arch: ArchIconData): void {
    const iconPath = this.architectureIcon.getIconPath(arch);
    const placementKey = getIconPlacementKey(arch.placement);
    const placementAttrs = ICON_PLACEMENT_ATTRS[placementKey];

    cell.setAttrByPath('icon/href', iconPath);
    cell.setAttrByPath('icon/width', ICON_SIZE);
    cell.setAttrByPath('icon/height', ICON_SIZE);
    cell.setAttrByPath('icon/refX', placementAttrs.refX);
    cell.setAttrByPath('icon/refY', placementAttrs.refY);
    cell.setAttrByPath('icon/refX2', -ICON_SIZE / 2);
    cell.setAttrByPath('icon/refY2', -ICON_SIZE / 2);

    // Label is locked to the icon: horizontally centered on it, below with padding,
    // for every placement and every eligible shape (including security-boundary).
    const labelAttrs = getLabelAttrsForIconPlacement(arch.placement);
    cell.setAttrByPath('text/refX', labelAttrs.refX);
    cell.setAttrByPath('text/refY', labelAttrs.refY);
    cell.setAttrByPath('text/refX2', labelAttrs.refX2);
    cell.setAttrByPath('text/refY2', labelAttrs.refY2);
    cell.setAttrByPath('text/textAnchor', labelAttrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', labelAttrs.textVerticalAnchor);
  }

  /**
   * Restore a cell's label attrs to the shape's default placement. Used when
   * an icon is removed and the label should return to centered.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: restore cell label attrs to shape-default centered placement (mutates shared state)
  restoreLabelDefaults(cell: LayoutCell): void {
    const defaults = DEFAULT_LABEL_ATTRS_BY_SHAPE[cell.shape];
    if (!defaults) return;
    cell.setAttrByPath('text/refX', defaults.refX);
    cell.setAttrByPath('text/refY', defaults.refY);
    cell.setAttrByPath('text/refX2', 0);
    cell.setAttrByPath('text/refY2', 0);
    cell.setAttrByPath('text/textAnchor', 'middle');
    cell.setAttrByPath('text/textVerticalAnchor', 'middle');
  }

  /**
   * Hide a cell's border when the user preference says icons should be shown
   * without borders and the shape supports border hiding.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: hide cell border per user preference when showing icon without border (mutates shared state)
  applyBorderPreference(cell: LayoutCell): void {
    const prefs = this.userPreferences.getPreferences();
    if (
      !prefs.showShapeBordersWithIcons &&
      (ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(cell.shape)
    ) {
      const selectors = ICON_HIDEABLE_BORDER_SELECTORS[cell.shape] ?? ['body'];
      for (const sel of selectors) {
        cell.setAttrByPath(`${sel}/stroke`, 'transparent');
        cell.setAttrByPath(`${sel}/fill`, 'transparent');
      }
    }
  }

  /**
   * Restore a cell's border (stroke/fill) to its shape default. Used when an
   * icon is removed or the border preference flips back on.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: restore cell border stroke and fill to shape default styling (mutates shared state)
  restoreBorder(cell: LayoutCell): void {
    const shape = cell.shape;
    const nodeStyles = DFD_STYLING.NODES as Record<string, any>;
    const shapeKey = shape.toUpperCase().replace(/-/g, '_');
    const config = nodeStyles[shapeKey];
    if (!config) return;
    const stroke = config.STROKE ?? DFD_STYLING.DEFAULT_STROKE;
    const fill = config.FILL ?? DFD_STYLING.DEFAULT_FILL;
    const selectors = ICON_HIDEABLE_BORDER_SELECTORS[shape] ?? ['body'];
    for (const sel of selectors) {
      cell.setAttrByPath(`${sel}/stroke`, stroke);
      cell.setAttrByPath(`${sel}/fill`, fill);
    }
  }

  /**
   * Apply persisted icons, border preferences, auto-layout, and lock badges
   * to every node in a graph. Used on diagram load.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: apply persisted icons, borders, auto-layout, and lock badges to all nodes on diagram load (mutates shared state)
  applyIconsOnLoad(graph: LayoutGraph): void {
    for (const node of graph.getNodes()) {
      const data = node.getData<{ _arch?: ArchIconData }>();
      const arch = data?._arch;
      if (arch) {
        this.applyIconToCell(node, arch);
        this.applyBorderPreference(node);
      }
      // Auto-layout pass for both iconned cells and security boundaries with
      // embedded children. applyAutoLayout no-ops anything that isn't eligible.
      this.dfdLayout.applyAutoLayout(node, graph);
      // Sync lock badge visibility from persisted _layoutLocked.
      this.applyLockBadge(node);
    }
  }

  /**
   * Re-apply the border preference to every iconned cell. Used when a global
   * preference flips: `showBorders` true restores borders, false hides them.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: update border visibility on all iconned cells when global border preference changes (mutates shared state)
  reapplyBorderPreferenceToAllIconnedCells(graph: LayoutGraph, showBorders: boolean): void {
    for (const node of graph.getNodes()) {
      const data = node.getData<{ _arch?: ArchIconData }>();
      if (!data?._arch) continue;
      if (showBorders) {
        this.restoreBorder(node);
      } else {
        this.applyBorderPreference(node);
      }
    }
  }

  /**
   * Reverse a prior auto-fit (icon-only or container). Only acts on cells
   * whose current size still matches the dimensions we recorded — if the
   * user has resized the cell since, leave size alone and just clear the
   * flag. Returns true if the cell carried an auto-fit flag to clear.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: reverse a prior auto-fit resize on a cell if size is unchanged by user (mutates shared state)
  revertAutoFit(cell: LayoutCell): boolean {
    const data = cell.getData<Record<string, unknown>>() ?? {};
    const previousAutoFit = data['_archAutoFit'] as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    if (!previousAutoFit) return false;

    const { width, height } = cell.getSize();
    const stillAtAutoFitSize = width === previousAutoFit.width && height === previousAutoFit.height;

    if (stillAtAutoFitSize) {
      const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
      const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
      if (shapeConfig) {
        cell.resize(shapeConfig.DEFAULT_WIDTH as number, shapeConfig.DEFAULT_HEIGHT as number);
      }
      // Restore icon and label to user-chosen placement.
      const arch = data['_arch'] as ArchIconData | undefined;
      if (arch) {
        this.applyIconToCell(cell, arch);
      }
    }

    const next = { ...cell.getData<Record<string, unknown>>() };
    delete next['_archAutoFit'];
    cell.setData(next, { silent: true, overwrite: true });
    return true;
  }

  /**
   * Revert auto-fit on every cell that has an `_archAutoFit` tag.
   * Used when a global preference flips the auto-layout system off.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: revert auto-fit on every tagged cell when auto-layout is disabled globally (mutates shared state)
  revertAutoFitOnAllAutoFitCells(graph: LayoutGraph): void {
    for (const node of graph.getNodes()) {
      if (isCellLayoutLocked(node)) continue;
      const data = node.getData<{ _archAutoFit?: unknown }>();
      if (data?._archAutoFit) this.revertAutoFit(node);
    }
  }

  /**
   * Sync the lock-badge markup on a cell to its `_layoutLocked` data flag.
   *
   * - When locked: sets the badge's `href` and shows it (display: 'block').
   * - When unlocked: hides the badge (display: 'none').
   *
   * Early-returns on non-lock-eligible shapes so we don't write `lockBadge`
   * attrs to cells whose markup doesn't have that selector — those writes
   * would still land in the cell's attrs data and bloat patch payloads.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: sync lock badge visibility on a cell from its layout-locked data flag (mutates shared state)
  applyLockBadge(cell: LayoutCell): void {
    if (!(ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape)) return;
    const locked = isCellLayoutLocked(cell);
    if (locked) {
      cell.setAttrByPath('lockBadge/href', LOCK_BADGE_ICON_HREF);
      cell.setAttrByPath('lockBadge/display', 'block');
    } else {
      cell.setAttrByPath('lockBadge/display', 'none');
    }
  }
}
