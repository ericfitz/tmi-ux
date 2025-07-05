import { Injectable, Inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { CommandBusService } from './command-bus.service';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { EdgeDataFactory } from '../../domain/factories/edge-data.factory';
import { IDiagramRepository, DIAGRAM_REPOSITORY_TOKEN } from '../handlers/diagram-command-handlers';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Parameters for edge creation
 */
export interface EdgeCreationParams {
  diagramId: string;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  userId: string;
  label?: string;
  sourcePortId?: string;
  targetPortId?: string;
  vertices?: Array<{ x: number; y: number }>;
  metadata?: Record<string, string>;
}

/**
 * Parameters for edge updates
 */
export interface EdgeUpdateParams {
  diagramId: string;
  edgeId: string;
  userId: string;
  newData: EdgeData;
  oldData: EdgeData;
}

/**
 * Parameters for edge deletion
 */
export interface EdgeDeletionParams {
  diagramId: string;
  edgeId: string;
  userId: string;
}

/**
 * Command execution result interface
 */
export interface CommandResult {
  success: boolean;
  diagramId: string;
  events: any[];
  diagramSnapshot: any;
}

/**
 * Consolidated service for edge operations
 * Reduces application layer edge methods from 17+ to 3 core methods
 *
 * Phase 3 of Edge Method Consolidation Plan:
 * - createEdge(): Unified edge creation with proper domain model integration
 * - updateEdge(): Unified edge updates with validation and history tracking
 * - deleteEdge(): Unified edge deletion with cleanup and history tracking
 */
@Injectable({
  providedIn: 'root',
})
export class EdgeOperationService {
  constructor(
    private readonly commandBus: CommandBusService,
    private readonly edgeDataFactory: EdgeDataFactory,
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Creates a new edge in the diagram
   * Consolidates: addEdge() from DfdApplicationService + edge creation logic
   */
  createEdge(params: EdgeCreationParams): Observable<CommandResult> {
    this.logger.info('EdgeOperationService.createEdge - Starting edge creation', {
      edgeId: params.edgeId,
      sourceNodeId: params.sourceNodeId,
      targetNodeId: params.targetNodeId,
      diagramId: params.diagramId,
    });

    try {
      // Create domain edge data using EdgeDataFactory
      const edgeData = this.edgeDataFactory.createFromNodes({
        id: params.edgeId,
        sourceNodeId: params.sourceNodeId,
        targetNodeId: params.targetNodeId,
        sourcePortId: params.sourcePortId,
        targetPortId: params.targetPortId,
        label: params.label || 'Data Flow',
      });

      // Create command using factory
      const command = DiagramCommandFactory.addEdge(
        params.diagramId,
        params.userId,
        params.edgeId,
        params.sourceNodeId,
        params.targetNodeId,
        edgeData,
      );

      // Execute command through command bus
      return this.commandBus.execute<CommandResult>(command).pipe(
        map((result: CommandResult) => {
          this.logger.info('EdgeOperationService.createEdge - Edge creation completed', {
            edgeId: params.edgeId,
            success: result.success,
          });
          return result;
        }),
        catchError((error: unknown) => {
          this.logger.error('EdgeOperationService.createEdge - Edge creation failed', {
            edgeId: params.edgeId,
            error: error instanceof Error ? error.message : String(error),
          });
          return throwError(() => error);
        }),
      );
    } catch (error) {
      this.logger.error('EdgeOperationService.createEdge - Failed to create edge data', {
        edgeId: params.edgeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return throwError(() => error);
    }
  }

  /**
   * Updates an existing edge in the diagram
   * Consolidates: updateEdgeData() from DfdApplicationService + edge update logic
   */
  updateEdge(params: EdgeUpdateParams): Observable<CommandResult> {
    this.logger.info('EdgeOperationService.updateEdge - Starting edge update', {
      edgeId: params.edgeId,
      diagramId: params.diagramId,
    });

    try {
      // Create command using factory
      const command = DiagramCommandFactory.updateEdgeData(
        params.diagramId,
        params.userId,
        params.edgeId,
        params.newData,
        params.oldData,
      );

      // Execute command through command bus
      return this.commandBus.execute<CommandResult>(command).pipe(
        map((result: CommandResult) => {
          this.logger.info('EdgeOperationService.updateEdge - Edge update completed', {
            edgeId: params.edgeId,
            success: result.success,
          });
          return result;
        }),
        catchError((error: unknown) => {
          this.logger.error('EdgeOperationService.updateEdge - Edge update failed', {
            edgeId: params.edgeId,
            error: error instanceof Error ? error.message : String(error),
          });
          return throwError(() => error);
        }),
      );
    } catch (error) {
      this.logger.error('EdgeOperationService.updateEdge - Failed to create update command', {
        edgeId: params.edgeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return throwError(() => error);
    }
  }

  /**
   * Deletes an edge from the diagram
   * Consolidates: removeEdge() from DfdApplicationService + edge deletion logic
   */
  deleteEdge(params: EdgeDeletionParams): Observable<CommandResult> {
    this.logger.info('EdgeOperationService.deleteEdge - Starting edge deletion', {
      edgeId: params.edgeId,
      diagramId: params.diagramId,
    });

    try {
      // Create command using factory
      const command = DiagramCommandFactory.removeEdge(
        params.diagramId,
        params.userId,
        params.edgeId,
      );

      // Execute command through command bus
      return this.commandBus.execute<CommandResult>(command).pipe(
        map((result: CommandResult) => {
          this.logger.info('EdgeOperationService.deleteEdge - Edge deletion completed', {
            edgeId: params.edgeId,
            success: result.success,
          });
          return result;
        }),
        catchError((error: unknown) => {
          this.logger.error('EdgeOperationService.deleteEdge - Edge deletion failed', {
            edgeId: params.edgeId,
            error: error instanceof Error ? error.message : String(error),
          });
          return throwError(() => error);
        }),
      );
    } catch (error) {
      this.logger.error('EdgeOperationService.deleteEdge - Failed to create deletion command', {
        edgeId: params.edgeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return throwError(() => error);
    }
  }

  /**
   * Gets the current diagram to validate edge operations
   * Helper method for edge validation and context
   */
  private getCurrentDiagram(diagramId: string): Observable<any> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  /**
   * Validates edge creation parameters
   * Helper method for edge validation
   */
  private validateEdgeCreation(params: EdgeCreationParams): void {
    if (!params.diagramId) {
      throw new Error('Diagram ID is required for edge creation');
    }
    if (!params.edgeId) {
      throw new Error('Edge ID is required for edge creation');
    }
    if (!params.sourceNodeId) {
      throw new Error('Source node ID is required for edge creation');
    }
    if (!params.targetNodeId) {
      throw new Error('Target node ID is required for edge creation');
    }
    if (!params.userId) {
      throw new Error('User ID is required for edge creation');
    }
  }

  /**
   * Validates edge update parameters
   * Helper method for edge validation
   */
  private validateEdgeUpdate(params: EdgeUpdateParams): void {
    if (!params.diagramId) {
      throw new Error('Diagram ID is required for edge update');
    }
    if (!params.edgeId) {
      throw new Error('Edge ID is required for edge update');
    }
    if (!params.userId) {
      throw new Error('User ID is required for edge update');
    }
    if (!params.newData) {
      throw new Error('New edge data is required for edge update');
    }
    if (!params.oldData) {
      throw new Error('Old edge data is required for edge update');
    }
  }

  /**
   * Validates edge deletion parameters
   * Helper method for edge validation
   */
  private validateEdgeDeletion(params: EdgeDeletionParams): void {
    if (!params.diagramId) {
      throw new Error('Diagram ID is required for edge deletion');
    }
    if (!params.edgeId) {
      throw new Error('Edge ID is required for edge deletion');
    }
    if (!params.userId) {
      throw new Error('User ID is required for edge deletion');
    }
  }
}
