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
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
} from '../../application/services/app-persistence-coordinator.service';

@Injectable()
export class InfraRestPersistenceStrategy {
  readonly type = 'rest' as const;

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

    // Get threatModelId from operation
    const threatModelId = operation.threatModelId;
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
    // operation.data is in format { nodes: [], edges: [] } from X6's toJSON()
    // Just combine them into a single cells array
    const cells = [...(operation.data.nodes || []), ...(operation.data.edges || [])];

    this.logger.debug('REST save: cells prepared', {
      diagramId: operation.diagramId,
      totalCells: cells.length,
      nodes: operation.data.nodes?.length || 0,
      edges: operation.data.edges?.length || 0,
    });

    // Use the threatModelService to save via PATCH
    return this.threatModelService
      .patchDiagramCells(threatModelId, operation.diagramId, cells)
      .pipe(
        map(response => {
          this.logger.debug('REST save completed successfully', {
            diagramId: operation.diagramId,
            updateVector: response.update_vector,
          });
          return {
            success: true,
            operationId: `save-${Date.now()}`,
            diagramId: operation.diagramId,
            timestamp: Date.now(),
            metadata: {
              update_vector: response.update_vector, // Pass to auto-save manager
              cellsSaved: cells.length,
            },
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

  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debug('REST load operation started', {
      diagramId: operation.diagramId,
      threatModelId: operation.threatModelId,
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
              threatModelName: loadResult.diagram.threatModelName,
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
}
