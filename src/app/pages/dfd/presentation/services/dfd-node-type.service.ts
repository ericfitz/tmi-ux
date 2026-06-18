import { Injectable } from '@angular/core';
import { NodeType } from '../../domain/value-objects/node-info';
import type { LayoutCell } from '../../types/layout-cell.types';

/**
 * Pure node-type mapping and data-asset predicates for the DFD editor.
 * Holds no state — all cell/selection state stays in the component.
 */
@Injectable({ providedIn: 'root' })
// SEM@78ec1e38fde70c14588b63411f0defa8fe691543: stateless service for node-type mapping and data-asset predicates on DFD cells (pure)
export class DfdNodeTypeService {
  /**
   * Map a raw shape string to a known NodeType, defaulting to 'process'
   * for unrecognized values.
   */
  // SEM@0469810b1b99b769654583c819ed256c216078e2: convert a raw shape string to a canonical NodeType, defaulting to process (pure)
  mapStringToNodeType(nodeType: string): NodeType {
    switch (nodeType) {
      case 'actor':
        return 'actor';
      case 'process':
        return 'process';
      case 'store':
        return 'store';
      case 'security-boundary':
        return 'security-boundary';
      case 'text-box':
        return 'text-box';
      default:
        return 'process';
    }
  }

  /** Read a cell's data assets, supporting both the array and legacy single-id formats. */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: fetch data asset IDs from a cell, normalizing array and legacy single-id formats (pure)
  getCellDataAssets(cell: LayoutCell): string[] {
    const data = cell.getData() ?? {};
    const assets = (data as { data_assets?: unknown }).data_assets;
    if (Array.isArray(assets)) {
      return (assets as unknown[]).filter((v): v is string => typeof v === 'string');
    }
    const legacy = (data as { dataAssetId?: unknown }).dataAssetId;
    if (typeof legacy === 'string') {
      return [legacy];
    }
    return [];
  }

  /** Write data assets to a cell in the array format, removing the legacy key. */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: store data asset IDs on a cell in array format, removing the legacy key (mutates shared state)
  setCellDataAssets(cell: LayoutCell, assetIds: string[]): void {
    const updated: Record<string, unknown> = { ...(cell.getData() ?? {}) };
    delete updated['dataAssetId'];
    if (assetIds.length > 0) {
      updated['data_assets'] = assetIds;
    } else {
      delete updated['data_assets'];
    }
    cell.setData(updated);
  }

  /** True when every cell in the selection map has the given asset. */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: validate that every selected cell carries a given data asset (pure)
  isDataAssetChecked(selected: ReadonlyMap<string, Set<string>>, assetId: string): boolean {
    if (selected.size === 0) {
      return false;
    }
    for (const assetSet of selected.values()) {
      if (!assetSet.has(assetId)) {
        return false;
      }
    }
    return true;
  }

  /** True when some — but not all — cells in the selection map have the asset. */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: compute whether a data asset is present on only some selected cells (pure)
  isDataAssetIndeterminate(selected: ReadonlyMap<string, Set<string>>, assetId: string): boolean {
    if (selected.size <= 1) {
      return false;
    }
    let hasAsset = false;
    let missingAsset = false;
    for (const assetSet of selected.values()) {
      if (assetSet.has(assetId)) {
        hasAsset = true;
      } else {
        missingAsset = true;
      }
      if (hasAsset && missingAsset) {
        return true;
      }
    }
    return false;
  }
}
