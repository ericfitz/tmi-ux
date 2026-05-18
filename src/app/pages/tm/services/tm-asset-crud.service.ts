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
export class TmAssetCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of assets for a threat model. */
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
  createAsset(threatModelId: string, asset: Partial<Asset>): Observable<Asset> {
    return this.threatModelService.createAsset(threatModelId, asset);
  }

  /** Update an asset from the asset editor dialog result; emits the updated asset. */
  updateAsset(threatModelId: string, assetId: string, asset: Partial<Asset>): Observable<Asset> {
    return this.threatModelService.updateAsset(threatModelId, assetId, asset);
  }

  /** Delete an asset; emits the success boolean. */
  deleteAsset(threatModelId: string, assetId: string): Observable<boolean> {
    return this.threatModelService.deleteAsset(threatModelId, assetId);
  }

  /** Update an asset's metadata; emits the updated metadata array. */
  updateAssetMetadata(
    threatModelId: string,
    assetId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateAssetMetadata(threatModelId, assetId, metadata);
  }
}
