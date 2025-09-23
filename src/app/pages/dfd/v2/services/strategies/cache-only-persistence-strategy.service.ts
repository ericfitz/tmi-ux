/**
 * Cache-only persistence strategy
 * Handles save/load operations using only local cache (offline mode)
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import { LoggerService } from '../../../../../core/services/logger.service';
import {
  PersistenceStrategy,
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
} from '../persistence-coordinator.service';

@Injectable({
  providedIn: 'root',
})
export class CacheOnlyPersistenceStrategy implements PersistenceStrategy {
  readonly type = 'cache-only' as const;
  readonly priority = 50; // Lower priority than network strategies

  private readonly _cache = new Map<string, any>();

  constructor(private readonly logger: LoggerService) {
    this.logger.debug('CacheOnlyPersistenceStrategy initialized');
  }


  save(operation: SaveOperation): Observable<SaveResult> {
    this.logger.debug('Cache-only save operation started', {
      diagramId: operation.diagramId,
    });

    try {
      // Store the diagram data in cache
      const cacheKey = this._getCacheKey(operation.diagramId);
      const cacheData = {
        diagramId: operation.diagramId,
        data: operation.data,
        timestamp: new Date().toISOString(),
        version: this._getNextVersion(operation.diagramId),
        metadata: operation.metadata,
      };

      this._cache.set(cacheKey, cacheData);

      this.logger.debug('Cache-only save completed successfully', {
        diagramId: operation.diagramId,
        cacheSize: this._cache.size,
      });

      return of({
        success: true,
        operationId: `cache-save-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
      });
    } catch (error) {
      const errorMessage = `Cache-only save failed: ${String(error)}`;
      this.logger.error(errorMessage, {
        diagramId: operation.diagramId,
        error,
      });

      return of({
        success: false,
        operationId: `cache-save-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
        error: errorMessage,
      });
    }
  }

  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debug('Cache-only load operation started', {
      diagramId: operation.diagramId,
      forceRefresh: operation.forceRefresh,
    });

    const cacheKey = this._getCacheKey(operation.diagramId);
    const cachedData = this._cache.get(cacheKey);

    if (cachedData) {
      this.logger.debug('Cache-only load completed successfully (cache hit)', {
        diagramId: operation.diagramId,
        version: cachedData.version,
      });

      return of({
        success: true,
        diagramId: operation.diagramId,
        data: cachedData.data,
        source: 'cache' as const,
        timestamp: Date.now(),
      });
    } else {
      // No cached data - return empty diagram
      this.logger.debug('Cache-only load completed (cache miss - creating empty diagram)', {
        diagramId: operation.diagramId,
      });

      return of({
        success: true,
        diagramId: operation.diagramId,
        data: {
          nodes: [],
          edges: [],
          metadata: {
            diagramId: operation.diagramId,
            version: 1,
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
          },
        },
        source: 'cache' as const,
        timestamp: Date.now(),
      });
    }
  }

  sync(operation: SyncOperation): Observable<SyncResult> {
    this.logger.debug('Cache-only sync operation started', { diagramId: operation.diagramId });

    // Cache-only strategy doesn't actually sync, just reports current cache status
    return of({
      success: true,
      diagramId: operation.diagramId,
      conflicts: 0,
      timestamp: Date.now(),
    });
  }

  // Cache management methods
  getCacheSize(): number {
    return this._cache.size;
  }

  clearAllCache(): void {
    this.logger.debug('Clearing all cache data');
    this._cache.clear();
  }

  getCachedDiagrams(): string[] {
    return Array.from(this._cache.keys()).map(key => key.replace('diagram-', ''));
  }

  private _getCacheKey(diagramId: string): string {
    return `diagram-${diagramId}`;
  }

  private _getNextVersion(diagramId: string): number {
    const cacheKey = this._getCacheKey(diagramId);
    const existing = this._cache.get(cacheKey);
    return existing ? (existing.version || 1) + 1 : 1;
  }

}