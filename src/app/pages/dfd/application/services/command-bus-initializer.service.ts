import { Injectable } from '@angular/core';
import {
  CommandBusService,
  CommandValidationMiddleware,
  CommandLoggingMiddleware,
  CommandSerializationMiddleware,
} from './command-bus.service';
import { HistoryMiddleware } from '../middleware/history.middleware';
import {
  CreateDiagramCommandHandler,
  AddNodeCommandHandler,
  UpdateNodePositionCommandHandler,
  UpdateNodeDataCommandHandler,
  RemoveNodeCommandHandler,
  AddEdgeCommandHandler,
  UpdateEdgeDataCommandHandler,
  RemoveEdgeCommandHandler,
  UpdateDiagramMetadataCommandHandler,
} from '../handlers/diagram-command-handlers';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Service responsible for initializing the command bus with all necessary middleware and handlers
 */
@Injectable()
export class CommandBusInitializerService {
  private _initialized = false;

  constructor(
    private readonly _commandBus: CommandBusService,
    private readonly _validationMiddleware: CommandValidationMiddleware,
    private readonly _loggingMiddleware: CommandLoggingMiddleware,
    private readonly _serializationMiddleware: CommandSerializationMiddleware,
    private readonly _historyMiddleware: HistoryMiddleware,
    private readonly _createDiagramHandler: CreateDiagramCommandHandler,
    private readonly _addNodeHandler: AddNodeCommandHandler,
    private readonly _updateNodePositionHandler: UpdateNodePositionCommandHandler,
    private readonly _updateNodeDataHandler: UpdateNodeDataCommandHandler,
    private readonly _removeNodeHandler: RemoveNodeCommandHandler,
    private readonly _addEdgeHandler: AddEdgeCommandHandler,
    private readonly _updateEdgeDataHandler: UpdateEdgeDataCommandHandler,
    private readonly _removeEdgeHandler: RemoveEdgeCommandHandler,
    private readonly _updateDiagramMetadataHandler: UpdateDiagramMetadataCommandHandler,
    private readonly _logger: LoggerService,
  ) {}

  /**
   * Initializes the command bus with all middleware and handlers in the correct order
   */
  initialize(): void {
    if (this._initialized) {
      this._logger.debug('Command bus already initialized');
      return;
    }

    this._logger.info('Initializing command bus with middleware and handlers');

    // Add middleware in priority order (lower priority executes first)
    // 1. Validation (priority 1)
    this._commandBus.addMiddleware(this._validationMiddleware);

    // 2. Logging (priority 2)
    this._commandBus.addMiddleware(this._loggingMiddleware);

    // 3. Serialization (priority 3)
    this._commandBus.addMiddleware(this._serializationMiddleware);

    // 4. History (priority 10) - executes after validation and logging but before handlers
    this._commandBus.addMiddleware(this._historyMiddleware);

    // Register all command handlers
    this.registerCommandHandlers();

    this._initialized = true;
    this._logger.info('Command bus initialization completed', {
      middlewareCount: 4,
      handlerCount: 9,
    });
  }

  /**
   * Registers all command handlers with the command bus
   */
  private registerCommandHandlers(): void {
    // Register each handler individually with proper typing
    this._commandBus.registerHandler(
      this._createDiagramHandler.getCommandType(),
      this._createDiagramHandler,
    );
    this._commandBus.registerHandler(this._addNodeHandler.getCommandType(), this._addNodeHandler);
    this._commandBus.registerHandler(
      this._updateNodePositionHandler.getCommandType(),
      this._updateNodePositionHandler,
    );
    this._commandBus.registerHandler(
      this._updateNodeDataHandler.getCommandType(),
      this._updateNodeDataHandler,
    );
    this._commandBus.registerHandler(
      this._removeNodeHandler.getCommandType(),
      this._removeNodeHandler,
    );
    this._commandBus.registerHandler(this._addEdgeHandler.getCommandType(), this._addEdgeHandler);
    this._commandBus.registerHandler(
      this._updateEdgeDataHandler.getCommandType(),
      this._updateEdgeDataHandler,
    );
    this._commandBus.registerHandler(
      this._removeEdgeHandler.getCommandType(),
      this._removeEdgeHandler,
    );
    this._commandBus.registerHandler(
      this._updateDiagramMetadataHandler.getCommandType(),
      this._updateDiagramMetadataHandler,
    );

    this._logger.debug('Registered all command handlers', {
      handlers: [
        this._createDiagramHandler.getCommandType(),
        this._addNodeHandler.getCommandType(),
        this._updateNodePositionHandler.getCommandType(),
        this._updateNodeDataHandler.getCommandType(),
        this._removeNodeHandler.getCommandType(),
        this._addEdgeHandler.getCommandType(),
        this._updateEdgeDataHandler.getCommandType(),
        this._removeEdgeHandler.getCommandType(),
        this._updateDiagramMetadataHandler.getCommandType(),
      ],
    });
  }

  /**
   * Checks if the command bus has been initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }
}
