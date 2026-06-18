import { Injectable } from '@angular/core';
import type { components } from '@app/generated/api-types';
import { IdTranslationService } from './id-translation.service';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local type alias for the API ThreatInput schema (pure)
type ApiThreatInput = components['schemas']['ThreatInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local type alias for the API AssetInput schema (pure)
type ApiAssetInput = components['schemas']['AssetInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local type alias for the API NoteInput schema (pure)
type ApiNoteInput = components['schemas']['NoteInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local type alias for the API DocumentInput schema (pure)
type ApiDocumentInput = components['schemas']['DocumentInput'];
// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local type alias for the API RepositoryInput schema (pure)
type ApiRepositoryInput = components['schemas']['RepositoryInput'];

/**
 * Service for rewriting ID references in imported objects.
 * Updates references to use new server-assigned IDs instead of original IDs.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@3521244b81193b9886a9e9b069a05db805528717: rewrite imported entity ID references to server-assigned IDs after import
export class ReferenceRewriterService {
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: inject IdTranslationService dependency (pure)
  constructor(private _idTranslation: IdTranslationService) {}

  /**
   * Rewrites ID references in a Threat object.
   * Updates: diagram_id, asset_id
   * Preserves: cell_id (client-managed)
   */
  // SEM@3521244b81193b9886a9e9b069a05db805528717: update threat's diagram and asset ID references to new server-assigned IDs (pure)
  rewriteThreatReferences(threat: ApiThreatInput): ApiThreatInput {
    const rewritten = { ...threat };

    // Rewrite diagram_id if present
    if (typeof rewritten.diagram_id === 'string' && rewritten.diagram_id) {
      const newDiagramId = this._idTranslation.getDiagramId(rewritten.diagram_id);
      if (newDiagramId) {
        rewritten.diagram_id = newDiagramId;
      } else {
        console.warn(
          `Threat references unknown diagram_id: ${rewritten.diagram_id}. Reference will be cleared.`,
        );
        delete rewritten.diagram_id;
      }
    }

    // Rewrite asset_id if present
    if (typeof rewritten.asset_id === 'string' && rewritten.asset_id) {
      const newAssetId = this._idTranslation.getAssetId(rewritten.asset_id);
      if (newAssetId) {
        rewritten.asset_id = newAssetId;
      } else {
        console.warn(
          `Threat references unknown asset_id: ${rewritten.asset_id}. Reference will be cleared.`,
        );
        delete rewritten.asset_id;
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
  // SEM@8b8c84cc20fb3e9fc4885922815e2503105824af: update asset ID references in all diagram cell data properties (pure)
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
  // SEM@8b8c84cc20fb3e9fc4885922815e2503105824af: translate cell data asset IDs to new IDs, migrating legacy format (pure)
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
  // SEM@3521244b81193b9886a9e9b069a05db805528717: pass through a note unchanged; notes have no cross-entity references (pure)
  rewriteNoteReferences(note: ApiNoteInput): ApiNoteInput {
    // No cross-references to rewrite in notes currently
    return { ...note };
  }

  /**
   * Rewrites ID references in an Asset object.
   * Assets don't currently have cross-references to other entities.
   */
  // SEM@3521244b81193b9886a9e9b069a05db805528717: pass through an asset unchanged; assets have no cross-entity references (pure)
  rewriteAssetReferences(asset: ApiAssetInput): ApiAssetInput {
    // No cross-references to rewrite in assets currently
    return { ...asset };
  }

  /**
   * Rewrites ID references in a Document object.
   * Documents don't currently have cross-references to other entities.
   */
  // SEM@3521244b81193b9886a9e9b069a05db805528717: pass through a document unchanged; documents have no cross-entity references (pure)
  rewriteDocumentReferences(document: ApiDocumentInput): ApiDocumentInput {
    // No cross-references to rewrite in documents currently
    return { ...document };
  }

  /**
   * Rewrites ID references in a Repository object.
   * Repositories don't currently have cross-references to other entities.
   */
  // SEM@3521244b81193b9886a9e9b069a05db805528717: pass through a repository unchanged; repositories have no cross-entity references (pure)
  rewriteRepositoryReferences(repository: ApiRepositoryInput): ApiRepositoryInput {
    // No cross-references to rewrite in repositories currently
    return { ...repository };
  }
}
