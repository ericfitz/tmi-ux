import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Asset, Metadata } from '../models/threat-model.model';

/** Assets loaded for one page of the assets sub-table. */
export interface AssetsPage {
  assets: Asset[];
  total: number;
}

/**
 * Asset CRUD orchestration extracted from TmEditComponent. The asset editor
 * dialog emits a Partial<Asset> directly, so there is no form-mapping step.
 * Does NOT touch assetsDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
// SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: delegate asset CRUD and metadata operations for a threat model to ThreatModelService
export class TmAssetCrudService {
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: inject ThreatModelService dependency (pure)
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of assets for a threat model. */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: fetch one page of assets for a threat model with offset pagination
  loadAssets(threatModelId: string, pageIndex: number, pageSize: number): Observable<AssetsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService.getAssetsForThreatModel(threatModelId, pageSize, offset).pipe(
      map(response => ({
        assets: response.assets ?? [],
        total: response.total ?? 0,
      })),
    );
  }

  /** Create an asset from the asset editor dialog result. */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: store a new asset for a threat model via the API
  createAsset(threatModelId: string, asset: Partial<Asset>): Observable<Asset> {
    return this.threatModelService.createAsset(threatModelId, asset);
  }

  /** Update an asset from the asset editor dialog result; emits the updated asset. */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: update an existing asset for a threat model via the API
  updateAsset(threatModelId: string, assetId: string, asset: Partial<Asset>): Observable<Asset> {
    return this.threatModelService.updateAsset(threatModelId, assetId, asset);
  }

  /** Delete an asset; emits the success boolean. */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: delete an asset from a threat model via the API
  deleteAsset(threatModelId: string, assetId: string): Observable<boolean> {
    return this.threatModelService.deleteAsset(threatModelId, assetId);
  }

  /** Update an asset's metadata; emits the updated metadata array. */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: update metadata key-value pairs for a threat model asset via the API
  updateAssetMetadata(
    threatModelId: string,
    assetId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateAssetMetadata(threatModelId, assetId, metadata);
  }
}
