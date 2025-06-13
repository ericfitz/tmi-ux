import { Injectable, Inject } from '@angular/core';
import {
  CommandBusService,
  CommandValidationMiddleware,
  CommandLoggingMiddleware,
  CommandSerializationMiddleware,
} from './command-bus.service';
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
  DIAGRAM_REPOSITORY_TOKEN,
  IDiagramRepository,
} from '../handlers/diagram-command-handlers';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Service responsible for initializing the CommandBus with all handlers and middleware
 */
@Injectable()
export class CommandBusInitializerService {
  private _isInitialized = false;

  constructor(
    private readonly commandBus: CommandBusService,
    private readonly logger: LoggerService,

    // Middleware
    private readonly validationMiddleware: CommandValidationMiddleware,
    private readonly loggingMiddleware: CommandLoggingMiddleware,
    private readonly serializationMiddleware: CommandSerializationMiddleware,

    // Command Handlers
    private readonly createDiagramHandler: CreateDiagramCommandHandler,
    private readonly addNodeHandler: AddNodeCommandHandler,
    private readonly updateNodePositionHandler: UpdateNodePositionCommandHandler,
    private readonly updateNodeDataHandler: UpdateNodeDataCommandHandler,
    private readonly removeNodeHandler: RemoveNodeCommandHandler,
    private readonly addEdgeHandler: AddEdgeCommandHandler,
    private readonly updateEdgeDataHandler: UpdateEdgeDataCommandHandler,
    private readonly removeEdgeHandler: RemoveEdgeCommandHandler,
    private readonly updateDiagramMetadataHandler: UpdateDiagramMetadataCommandHandler,

    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {
    this.logger.info('CommandBusInitializerService constructor called');
    // Initialize immediately in constructor to ensure handlers are available
    this.initialize();
  }

  /**
   * Initialize the CommandBus with all handlers and middleware
   */
  initialize(): void {
    if (this._isInitialized) {
      this.logger.warn('CommandBus already initialized, skipping initialization');
      return;
    }

    this.logger.info('Initializing CommandBus with handlers and middleware');

    try {
      // Register middleware (in order of priority)
      this.commandBus.addMiddleware(this.validationMiddleware);
      this.commandBus.addMiddleware(this.loggingMiddleware);
      this.commandBus.addMiddleware(this.serializationMiddleware);

      // Register command handlers
      this.commandBus.registerHandler(
        this.createDiagramHandler.getCommandType(),
        this.createDiagramHandler,
      );
      this.commandBus.registerHandler(this.addNodeHandler.getCommandType(), this.addNodeHandler);
      this.commandBus.registerHandler(
        this.updateNodePositionHandler.getCommandType(),
        this.updateNodePositionHandler,
      );
      this.commandBus.registerHandler(
        this.updateNodeDataHandler.getCommandType(),
        this.updateNodeDataHandler,
      );
      this.commandBus.registerHandler(
        this.removeNodeHandler.getCommandType(),
        this.removeNodeHandler,
      );
      this.commandBus.registerHandler(this.addEdgeHandler.getCommandType(), this.addEdgeHandler);
      this.commandBus.registerHandler(
        this.updateEdgeDataHandler.getCommandType(),
        this.updateEdgeDataHandler,
      );
      this.commandBus.registerHandler(
        this.removeEdgeHandler.getCommandType(),
        this.removeEdgeHandler,
      );
      this.commandBus.registerHandler(
        this.updateDiagramMetadataHandler.getCommandType(),
        this.updateDiagramMetadataHandler,
      );

      this._isInitialized = true;

      this.logger.info('CommandBus initialization completed successfully', {
        handlerCount: 9,
        middlewareCount: 3,
        repositoryType: this.diagramRepository.constructor.name,
      });
    } catch (error) {
      this.logger.error('Failed to initialize CommandBus', error);
      throw error;
    }
  }

  /**
   * Check if the CommandBus has been initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get registered handler types for debugging
   */
  getRegisteredHandlerTypes(): string[] {
    return [
      this.createDiagramHandler.getCommandType(),
      this.addNodeHandler.getCommandType(),
      this.updateNodePositionHandler.getCommandType(),
      this.updateNodeDataHandler.getCommandType(),
      this.removeNodeHandler.getCommandType(),
      this.addEdgeHandler.getCommandType(),
      this.updateEdgeDataHandler.getCommandType(),
      this.removeEdgeHandler.getCommandType(),
      this.updateDiagramMetadataHandler.getCommandType(),
    ];
  }
}
