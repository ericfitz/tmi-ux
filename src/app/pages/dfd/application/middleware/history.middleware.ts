import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { ICommandMiddleware } from '../interfaces/command-bus.interface';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { HistoryService } from '../services/history.service';
import { OperationStateTracker } from '../../infrastructure/services/operation-state-tracker.service';
import { InverseCommandFactory } from '../../domain/commands/inverse-command-factory';
import { DiagramState } from '../../domain/history/history.types';
import { X6GraphAdapter } from '../../infrastructure/adapters/x6-graph.adapter';
import { Point } from '../../domain/value-objects/point';

/**
 * Middleware that handles history recording for diagram commands
 * Integrates with the command bus to capture commands and their inverses
 */
@Injectable({
  providedIn: 'root',
})
export class HistoryMiddleware implements ICommandMiddleware {
  readonly priority = 10; // Execute after validation and logging but before serialization

  constructor(
    private readonly _logger: LoggerService,
    private readonly _historyService: HistoryService,
    private readonly _operationTracker: OperationStateTracker,
    private readonly _inverseFactory: InverseCommandFactory,
    private readonly _x6GraphAdapter: X6GraphAdapter,
  ) {}

  /**
   * Executes the middleware logic for history recording
   */
  execute<T = unknown>(
    command: AnyDiagramCommand,
    next: (command: AnyDiagramCommand) => Observable<T>,
  ): Observable<T> {
    // Check if this command should be recorded in history
    if (!this._shouldRecordCommand(command)) {
      this._logger.debug('Command will not be recorded in history', {
        commandType: command.type,
        isLocalUserInitiated: command.isLocalUserInitiated,
        reason: 'not in final state, not recordable, or not local user initiated',
      });
      return next(command);
    }

    // Capture state before execution
    const beforeState = this._captureCurrentState();

    this._logger.debug('Recording command in history', {
      commandType: command.type,
      commandId: command.commandId,
    });

    return next(command).pipe(
      tap(() => {
        try {
          // Create inverse command
          if (this._inverseFactory.canCreateInverse(command)) {
            const inverse = this._inverseFactory.createInverse(command, beforeState);

            // Validate the inverse
            if (this._inverseFactory.validateInverse(command, inverse)) {
              // Record in history
              this._historyService.recordCommand(command, inverse, this._getOperationId(command));

              // Clear redo stack since we're executing a new command
              this._historyService.clearRedoStack();

              this._logger.debug('Command successfully recorded in history', {
                commandType: command.type,
                inverseType: inverse.type,
              });
            } else {
              this._logger.warn('Invalid inverse command generated, not recording in history', {
                commandType: command.type,
              });
            }
          } else {
            this._logger.debug('Cannot create inverse for command type, not recording in history', {
              commandType: command.type,
            });
          }
        } catch (error: unknown) {
          this._logger.error('Failed to record command in history', {
            error,
            commandType: command.type,
            commandId: command.commandId,
          });
          // Don't throw the error - history recording failure shouldn't break command execution
        }
      }),
      catchError((error: unknown) => {
        this._logger.error('Command execution failed, not recording in history', {
          error,
          commandType: command.type,
          commandId: command.commandId,
        });
        return throwError(() => error);
      }),
    );
  }

  /**
   * Determines if a command should be recorded in history
   */
  private _shouldRecordCommand(command: AnyDiagramCommand): boolean {
    // Only record commands that are initiated by local user interactions
    if (!command.isLocalUserInitiated) {
      return false;
    }

    // Check if the command type is recordable
    if (!this._isRecordableCommandType(command.type)) {
      return false;
    }

    // Check if the operation is in final state
    const operationId = this._getOperationId(command);
    if (operationId && !this._operationTracker.isFinalState(operationId)) {
      return false;
    }

    return true;
  }

  /**
   * Checks if a command type should be recorded in history
   */
  private _isRecordableCommandType(commandType: string): boolean {
    const recordableTypes = [
      'ADD_NODE',
      'REMOVE_NODE',
      'UPDATE_NODE_POSITION',
      'UPDATE_NODE_DATA',
      'ADD_EDGE',
      'REMOVE_EDGE',
      'UPDATE_EDGE_DATA',
      'UPDATE_DIAGRAM_METADATA',
    ];

    return recordableTypes.includes(commandType);
  }

  /**
   * Gets the operation ID from a command
   */
  private _getOperationId(command: AnyDiagramCommand): string {
    // For now, use the command ID as the operation ID
    // In the future, this might be a separate field for tracking multi-command operations
    return command.commandId;
  }

  /**
   * Captures the current state of the diagram before command execution
   */
  private _captureCurrentState(): DiagramState {
    this._logger.debug('Capturing current diagram state');

    try {
      const graph = this._x6GraphAdapter.getGraph();
      if (!graph) {
        this._logger.warn('No graph available for state capture');
        return {
          nodes: [],
          edges: [],
          metadata: {
            capturedAt: new Date().toISOString(),
            version: '1.0.0',
          },
        };
      }

      // Capture all nodes with their essential state for history
      const nodes = graph.getNodes().map(node => ({
        id: node.id,
        position: new Point(node.position().x, node.position().y),
        data: node.getData(),
      }));

      // Capture all edges with their essential state for history
      const edges = graph.getEdges().map(edge => {
        const source = edge.getSource();
        const target = edge.getTarget();

        // Extract node IDs from source and target terminals
        // X6 TerminalData can have a 'cell' property for node connections
        const sourceNodeId = this._extractNodeIdFromTerminal(source);
        const targetNodeId = this._extractNodeIdFromTerminal(target);

        return {
          id: edge.id,
          sourceNodeId,
          targetNodeId,
          data: edge.getData(),
        };
      });

      // Capture diagram metadata including graph state
      const translate = graph.translate();
      const metadata = {
        capturedAt: new Date().toISOString(),
        version: '1.0.0',
        zoom: graph.zoom(),
        translateX: translate.tx,
        translateY: translate.ty,
        gridSize: graph.getGridSize(),
        // Store background as unknown since we don't know the exact type
        background: graph.background as unknown,
      };

      this._logger.debug('Successfully captured diagram state', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
      });

      return {
        nodes,
        edges,
        metadata,
      };
    } catch (error) {
      this._logger.error('Failed to capture diagram state', { error });
      // Return empty state as fallback
      return {
        nodes: [],
        edges: [],
        metadata: {
          capturedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      };
    }
  }

  /**
   * Extracts node ID from X6 terminal data
   * Handles the type-unsafe access to X6's terminal structure
   */
  private _extractNodeIdFromTerminal(terminal: unknown): string {
    // X6 terminal data structure varies, but typically has a 'cell' property for node connections
    if (terminal && typeof terminal === 'object' && 'cell' in terminal) {
      const cellValue = (terminal as { cell: unknown }).cell;
      return typeof cellValue === 'string' ? cellValue : '';
    }
    return '';
  }
}
