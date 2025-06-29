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
        reason: 'not in final state or not recordable',
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

    // TODO: This will be properly implemented when we integrate with the DFD state store
    // For now, we'll return a basic state structure that can be extended
    // In Phase 3, this will connect to the actual DfdStateStore

    try {
      // Placeholder implementation - will be replaced with actual state capture
      // from DfdStateStore or X6GraphAdapter in Phase 3
      return {
        nodes: [],
        edges: [],
        metadata: {
          capturedAt: new Date().toISOString(),
          version: '1.0.0',
        },
      };
    } catch (error) {
      this._logger.error('Failed to capture diagram state', { error });
      // Return empty state as fallback
      return {
        nodes: [],
        edges: [],
        metadata: {},
      };
    }
  }
}
