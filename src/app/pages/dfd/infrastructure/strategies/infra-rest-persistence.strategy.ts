/**
 * REST API persistence strategy
 * Handles save/load operations via HTTP API
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { AppDiagramService } from '../../application/services/app-diagram.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import {
  PersistenceStrategy,
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
} from '../../application/services/app-persistence-coordinator.service';

@Injectable()
export class InfraRestPersistenceStrategy implements PersistenceStrategy {
  readonly type = 'rest' as const;
  readonly priority = 100;

  constructor(
    private readonly http: HttpClient,
    private readonly logger: LoggerService,
    private readonly diagramService: AppDiagramService,
    private readonly threatModelService: ThreatModelService,
  ) {
    this.logger.debug('InfraRestPersistenceStrategy initialized');
  }

  save(operation: SaveOperation): Observable<SaveResult> {
    this.logger.debug('REST save operation started', {
      diagramId: operation.diagramId,
    });

    // Extract threatModelId from metadata
    const threatModelId = operation.metadata?.['threatModelId'];
    if (!threatModelId) {
      const errorMessage = 'Threat model ID is required for saving diagram';
      this.logger.error(errorMessage, { diagramId: operation.diagramId });
      return of({
        success: false,
        operationId: `save-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
        error: errorMessage,
      });
    }

    // Convert the diagram data to cells format
    // operation.data should already be in the format { nodes: [], edges: [] }
    const cells = this._convertDataToCells(operation.data);

    // Use the threatModelService to save via PATCH
    return this.threatModelService
      .patchDiagramCells(threatModelId, operation.diagramId, cells)
      .pipe(
        map(() => {
          this.logger.debug('REST save completed successfully', {
            diagramId: operation.diagramId,
          });
          return {
            success: true,
            operationId: `save-${Date.now()}`,
            diagramId: operation.diagramId,
            timestamp: Date.now(),
          };
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

  private _convertDataToCells(data: any): any[] {
    // Convert from { nodes: [], edges: [] } to cells array format
    const nodes = (data.nodes || []).map((node: any) => ({
      ...node,
      type: 'node',
    }));
    const edges = (data.edges || []).map((edge: any) => ({
      ...edge,
      type: 'edge',
    }));
    return [...nodes, ...edges];
  }

  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debug('REST load operation started', {
      diagramId: operation.diagramId,
      threatModelId: operation.threatModelId,
      forceRefresh: operation.forceRefresh,
    });

    if (!operation.threatModelId) {
      const errorMessage = 'Threat model ID is required for loading diagram';
      this.logger.error(errorMessage, { diagramId: operation.diagramId });
      return of({
        success: false,
        diagramId: operation.diagramId,
        source: 'api' as const,
        timestamp: Date.now(),
        error: errorMessage,
      });
    }

    // Use AppDiagramService to load diagram data from the API
    return this.diagramService.loadDiagram(operation.diagramId, operation.threatModelId).pipe(
      map(loadResult => {
        if (loadResult.success && loadResult.diagram) {
          this.logger.debug('REST load completed successfully', {
            diagramId: operation.diagramId,
            cellCount: loadResult.diagram.cells?.length || 0,
          });

          // Return diagram cells in the expected format
          return {
            success: true,
            diagramId: operation.diagramId,
            data: {
              cells: loadResult.diagram.cells || [],
              name: loadResult.diagram.name,
              threatModelId: loadResult.diagram.threatModelId,
            },
            source: 'api' as const,
            timestamp: Date.now(),
          };
        } else {
          const errorMessage = loadResult.error || 'Failed to load diagram';
          this.logger.error('REST load failed', {
            diagramId: operation.diagramId,
            error: errorMessage,
          });
          return {
            success: false,
            diagramId: operation.diagramId,
            source: 'api' as const,
            timestamp: Date.now(),
            error: errorMessage,
          };
        }
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
