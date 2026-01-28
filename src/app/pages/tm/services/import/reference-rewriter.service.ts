import { Injectable } from '@angular/core';
import { IdTranslationService } from './id-translation.service';

/**
 * Service for rewriting ID references in imported objects.
 * Updates references to use new server-assigned IDs instead of original IDs.
 */
@Injectable({
  providedIn: 'root',
})
export class ReferenceRewriterService {
  constructor(private _idTranslation: IdTranslationService) {}

  /**
   * Rewrites ID references in a Threat object.
   * Updates: diagram_id, asset_id
   * Preserves: cell_id (client-managed)
   */
  rewriteThreatReferences(threat: Record<string, unknown>): Record<string, unknown> {
    const rewritten = { ...threat };

    // Rewrite diagram_id if present
    if (typeof rewritten['diagram_id'] === 'string' && rewritten['diagram_id']) {
      const newDiagramId = this._idTranslation.getDiagramId(rewritten['diagram_id']);
      if (newDiagramId) {
        rewritten['diagram_id'] = newDiagramId;
      } else {
        // Diagram ID not found in translation map - clear the reference
        console.warn(
          `Threat references unknown diagram_id: ${rewritten['diagram_id']}. Reference will be cleared.`,
        );
        delete rewritten['diagram_id'];
      }
    }

    // Rewrite asset_id if present
    if (typeof rewritten['asset_id'] === 'string' && rewritten['asset_id']) {
      const newAssetId = this._idTranslation.getAssetId(rewritten['asset_id']);
      if (newAssetId) {
        rewritten['asset_id'] = newAssetId;
      } else {
        // Asset ID not found in translation map - clear the reference
        console.warn(
          `Threat references unknown asset_id: ${rewritten['asset_id']}. Reference will be cleared.`,
        );
        delete rewritten['asset_id'];
      }
    }

    // Note: cell_id is preserved as-is (client-managed, not server-assigned)

    return rewritten;
  }

  /**
   * Rewrites ID references in a Diagram object.
   * Diagrams contain cells with IDs that should be preserved (client-managed).
   * Rewrites data asset references in cell data.
   */
  rewriteDiagramReferences(diagram: Record<string, unknown>): Record<string, unknown> {
    const rewritten = { ...diagram };

    // Process cells if present
    if (Array.isArray(rewritten['cells'])) {
      rewritten['cells'] = (rewritten['cells'] as Record<string, unknown>[]).map(cell => {
        if (cell['data'] && typeof cell['data'] === 'object') {
          return {
            ...cell,
            data: this.rewriteCellDataAssetReferences(cell['data'] as Record<string, unknown>),
          };
        }
        return { ...cell };
      });
    }

    return rewritten;
  }

  /**
   * Rewrites data asset references in cell data.
   * Handles both new data_assets[] array format and legacy dataAssetId format.
   * Translates original asset IDs to new server-assigned IDs.
   */
  rewriteCellDataAssetReferences(cellData: Record<string, unknown>): Record<string, unknown> {
    const rewritten = { ...cellData };

    // Handle new data_assets array format
    if (Array.isArray(rewritten['data_assets'])) {
      const translatedIds = (rewritten['data_assets'] as string[])
        .map(assetId => this._idTranslation.getAssetId(assetId))
        .filter((id): id is string => id !== undefined);

      if (translatedIds.length > 0) {
        rewritten['data_assets'] = translatedIds;
      } else {
        // All asset IDs were unmapped - remove the field
        delete rewritten['data_assets'];
      }
    }

    // Handle legacy dataAssetId format - migrate to new format during import
    if (typeof rewritten['dataAssetId'] === 'string' && rewritten['dataAssetId']) {
      const newId = this._idTranslation.getAssetId(rewritten['dataAssetId']);
      if (newId) {
        // Migrate to new format
        if (Array.isArray(rewritten['data_assets'])) {
          // Append to existing array if not already present
          if (!(rewritten['data_assets'] as string[]).includes(newId)) {
            rewritten['data_assets'] = [...(rewritten['data_assets'] as string[]), newId];
          }
        } else {
          rewritten['data_assets'] = [newId];
        }
      }
      // Always remove legacy field during import
      delete rewritten['dataAssetId'];
    }

    return rewritten;
  }

  /**
   * Rewrites ID references in a Note object.
   * Notes don't currently have cross-references to other entities.
   */
  rewriteNoteReferences(note: Record<string, unknown>): Record<string, unknown> {
    // No cross-references to rewrite in notes currently
    return { ...note };
  }

  /**
   * Rewrites ID references in an Asset object.
   * Assets don't currently have cross-references to other entities.
   */
  rewriteAssetReferences(asset: Record<string, unknown>): Record<string, unknown> {
    // No cross-references to rewrite in assets currently
    return { ...asset };
  }

  /**
   * Rewrites ID references in a Document object.
   * Documents don't currently have cross-references to other entities.
   */
  rewriteDocumentReferences(document: Record<string, unknown>): Record<string, unknown> {
    // No cross-references to rewrite in documents currently
    return { ...document };
  }

  /**
   * Rewrites ID references in a Repository object.
   * Repositories don't currently have cross-references to other entities.
   */
  rewriteRepositoryReferences(repository: Record<string, unknown>): Record<string, unknown> {
    // No cross-references to rewrite in repositories currently
    return { ...repository };
  }
}
