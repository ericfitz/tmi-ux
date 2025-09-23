/**
 * REST API persistence strategy
 * Handles save/load operations via HTTP API
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
export class RestPersistenceStrategy implements PersistenceStrategy {
  readonly type = 'rest' as const;
  readonly priority = 100;

  constructor(
    private readonly http: HttpClient,
    private readonly logger: LoggerService,
  ) {
    this.logger.debug('RestPersistenceStrategy initialized');
  }

  save(operation: SaveOperation): Observable<SaveResult> {
    this.logger.debug('REST save operation started', {
      diagramId: operation.diagramId,
    });

    // For now, simulate a successful save since we don't have the actual API endpoint
    // In a real implementation, this would POST to /api/diagrams/{id}
    return of({
      success: true,
      operationId: `save-${Date.now()}`,
      diagramId: operation.diagramId,
      timestamp: Date.now(),
    }).pipe(
      map(result => {
        this.logger.debug('REST save completed successfully', {
          diagramId: operation.diagramId,
        });
        return result;
      }),
      catchError(error => {
        const errorMessage = `REST save failed: ${error.message || 'Unknown error'}`;
        this.logger.error(errorMessage, {
          diagramId: operation.diagramId,
          error,
        });
        return of({
          success: false,
          operationId: `save-${Date.now()}`,
          diagramId: operation.diagramId,
          timestamp: Date.now(),
          error: errorMessage,
        });
      }),
    );
  }

  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debug('REST load operation started', {
      diagramId: operation.diagramId,
      forceRefresh: operation.forceRefresh,
    });

    // For now, return empty diagram data since we don't have the actual API endpoint
    // In a real implementation, this would GET from /api/diagrams/{id}
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
      source: 'api' as const,
      timestamp: Date.now(),
    }).pipe(
      map(result => {
        this.logger.debug('REST load completed successfully', {
          diagramId: operation.diagramId,
          hasData: !!result.data,
        });
        return result;
      }),
      catchError(error => {
        const errorMessage = `REST load failed: ${error.message || 'Unknown error'}`;
        this.logger.error(errorMessage, {
          diagramId: operation.diagramId,
          error,
        });
        return of({
          success: false,
          diagramId: operation.diagramId,
          source: 'api' as const,
          timestamp: Date.now(),
          error: errorMessage,
        });
      }),
    );
  }

  sync(operation: SyncOperation): Observable<SyncResult> {
    this.logger.debug('REST sync operation started', { diagramId: operation.diagramId });

    // For now, simulate successful sync
    return of({
      success: true,
      diagramId: operation.diagramId,
      conflicts: 0,
      timestamp: Date.now(),
    });
  }
}
