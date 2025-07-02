import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { ICommandHandler } from '../interfaces/command-bus.interface';
import {
  AddNodeCommand,
  UpdateNodePositionCommand,
  UpdateNodeDataCommand,
  RemoveNodeCommand,
  AddEdgeCommand,
  UpdateEdgeDataCommand,
  RemoveEdgeCommand,
  UpdateDiagramMetadataCommand,
  CreateDiagramCommand,
} from '../../domain/commands/diagram-commands';
import { DiagramAggregate } from '../../domain/aggregates/diagram-aggregate';
import { BaseDomainEvent } from '../../domain/events/domain-event';
import { DiagramSnapshot } from '../../domain/aggregates/diagram-aggregate';
import { OperationStateTracker } from '../../infrastructure/services/operation-state-tracker.service';
import { OperationType } from '../../domain/history/history.types';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphAdapter } from '../../infrastructure/adapters/x6-graph.adapter';

/**
 * Command execution result interface
 */
export interface CommandResult {
  success: boolean;
  diagramId: string;
  events: BaseDomainEvent[];
  diagramSnapshot: DiagramSnapshot;
}

/**
 * Repository interface for diagram aggregates
 */
export interface IDiagramRepository {
  findById(id: string): Observable<DiagramAggregate | null>;
  save(aggregate: DiagramAggregate): Observable<DiagramAggregate>;
  create(aggregate: DiagramAggregate): Observable<DiagramAggregate>;
}

/**
 * Injection token for IDiagramRepository
 */
export const DIAGRAM_REPOSITORY_TOKEN = new InjectionToken<IDiagramRepository>(
  'IDiagramRepository',
);

/**
 * Handler for CreateDiagramCommand
 */
@Injectable()
export class CreateDiagramCommandHandler implements ICommandHandler<CreateDiagramCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'CREATE_DIAGRAM';
  }

  handle(command: CreateDiagramCommand): Observable<CommandResult> {
    try {
      const diagram = DiagramAggregate.create(command);

      return this.diagramRepository.create(diagram).pipe(
        map(() => {
          const events = diagram.getUncommittedEvents();
          diagram.markEventsAsCommitted();

          return {
            success: true,
            diagramId: diagram.id,
            events,
            diagramSnapshot: diagram.toSnapshot(),
          };
        }),
        catchError(error =>
          throwError(
            () =>
              new Error(
                `Failed to create diagram: ${error instanceof Error ? error.message : String(error)}`,
              ),
          ),
        ),
      );
    } catch (error) {
      return throwError(() => error);
    }
  }
}

/**
 * Handler for AddNodeCommand
 */
@Injectable()
export class AddNodeCommandHandler implements ICommandHandler<AddNodeCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _operationTracker: OperationStateTracker,
    private readonly _logger: LoggerService,
    private readonly _x6GraphAdapter: X6GraphAdapter,
  ) {}

  getCommandType(): string {
    return 'ADD_NODE';
  }

  handle(command: AddNodeCommand): Observable<CommandResult> {
    const operationId = command.commandId; // Use command ID as operation ID for direct commands
    this._logger.info('DIAGNOSTIC: AddNodeCommand - Starting operation tracking', {
      operationId,
      commandId: command.commandId,
      nodeId: command.nodeId,
      operationType: OperationType.ADD_NODE,
    });
    this._operationTracker.startOperation(operationId, OperationType.ADD_NODE, {
      entityId: command.nodeId,
      entityType: 'node',
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            this._logger.info('DIAGNOSTIC: AddNodeCommand - Completing operation', {
              operationId,
              commandId: command.commandId,
            });
            this._operationTracker.completeOperation(operationId);

            // Re-add the node to the X6 graph after successful domain model update
            const node = diagram.getNode(command.nodeId);
            if (node) {
              this._logger.info('DIAGNOSTIC: AddNodeCommand - Adding node to X6 graph', {
                nodeId: node.id,
                shapeType: node.data.type,
              });
              this._x6GraphAdapter.addNode(node);
            } else {
              this._logger.warn('DIAGNOSTIC: AddNodeCommand - Node not found in domain after add', {
                nodeId: command.nodeId,
              });
            }
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error('DIAGNOSTIC: AddNodeCommand - Cancelling operation due to error', {
          operationId,
          commandId: command.commandId,
          error: error,
        });
        this._operationTracker.cancelOperation(operationId);
        return throwError(
          () =>
            new Error(
              `Failed to add node: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
      }),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for UpdateNodePositionCommand
 */
@Injectable()
export class UpdateNodePositionCommandHandler
  implements ICommandHandler<UpdateNodePositionCommand>
{
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'UPDATE_NODE_POSITION';
  }

  handle(command: UpdateNodePositionCommand): Observable<CommandResult> {
    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram => this.saveDiagram(diagram)),
      catchError(error =>
        throwError(
          () =>
            new Error(
              `Failed to update node position: ${error instanceof Error ? error.message : String(error)}`,
            ),
        ),
      ),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for UpdateNodeDataCommand
 */
@Injectable()
export class UpdateNodeDataCommandHandler implements ICommandHandler<UpdateNodeDataCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'UPDATE_NODE_DATA';
  }

  handle(command: UpdateNodeDataCommand): Observable<CommandResult> {
    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram => this.saveDiagram(diagram)),
      catchError(error =>
        throwError(
          () =>
            new Error(
              `Failed to update node data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        ),
      ),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for RemoveNodeCommand
 */
@Injectable()
export class RemoveNodeCommandHandler implements ICommandHandler<RemoveNodeCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _x6GraphAdapter: X6GraphAdapter,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'REMOVE_NODE';
  }

  handle(command: RemoveNodeCommand): Observable<CommandResult> {
    this._logger.info('DIAGNOSTIC: RemoveNodeCommand - Handling command', {
      commandId: command.commandId,
      nodeId: command.nodeId,
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            // After successful removal from domain model, remove from X6 graph
            this._logger.info('DIAGNOSTIC: RemoveNodeCommand - Removing node from X6 graph', {
              nodeId: command.nodeId,
            });
            this._x6GraphAdapter.removeNode(command.nodeId);
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error('DIAGNOSTIC: RemoveNodeCommand - Failed to remove node', {
          commandId: command.commandId,
          nodeId: command.nodeId,
          error: error,
        });
        return throwError(
          () =>
            new Error(
              `Failed to remove node: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
      }),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for AddEdgeCommand
 */
@Injectable()
export class AddEdgeCommandHandler implements ICommandHandler<AddEdgeCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _operationTracker: OperationStateTracker,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'ADD_EDGE';
  }

  handle(command: AddEdgeCommand): Observable<CommandResult> {
    const operationId = command.commandId; // Use command ID as operation ID for direct commands
    this._logger.info('DIAGNOSTIC: AddEdgeCommand - Starting operation tracking', {
      operationId,
      commandId: command.commandId,
      edgeId: command.edgeId,
      operationType: OperationType.ADD_EDGE,
    });
    this._operationTracker.startOperation(operationId, OperationType.ADD_EDGE, {
      entityId: command.edgeId,
      entityType: 'edge',
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            this._logger.info('DIAGNOSTIC: AddEdgeCommand - Completing operation', {
              operationId,
              commandId: command.commandId,
            });
            this._operationTracker.completeOperation(operationId);
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error('DIAGNOSTIC: AddEdgeCommand - Cancelling operation due to error', {
          operationId,
          commandId: command.commandId,
          error: error,
        });
        this._operationTracker.cancelOperation(operationId);
        return throwError(
          () =>
            new Error(
              `Failed to add edge: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
      }),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for UpdateEdgeDataCommand
 */
@Injectable()
export class UpdateEdgeDataCommandHandler implements ICommandHandler<UpdateEdgeDataCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'UPDATE_EDGE_DATA';
  }

  handle(command: UpdateEdgeDataCommand): Observable<CommandResult> {
    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram => this.saveDiagram(diagram)),
      catchError(error =>
        throwError(
          () =>
            new Error(
              `Failed to update edge data: ${error instanceof Error ? error.message : String(error)}`,
            ),
        ),
      ),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for RemoveEdgeCommand
 */
@Injectable()
export class RemoveEdgeCommandHandler implements ICommandHandler<RemoveEdgeCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _x6GraphAdapter: X6GraphAdapter,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'REMOVE_EDGE';
  }

  handle(command: RemoveEdgeCommand): Observable<CommandResult> {
    this._logger.info('DIAGNOSTIC: RemoveEdgeCommand - Handling command', {
      commandId: command.commandId,
      edgeId: command.edgeId,
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            // After successful removal from domain model, remove from X6 graph
            this._logger.info('DIAGNOSTIC: RemoveEdgeCommand - Removing edge from X6 graph', {
              edgeId: command.edgeId,
            });
            this._x6GraphAdapter.removeEdge(command.edgeId);
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error('DIAGNOSTIC: RemoveEdgeCommand - Failed to remove edge', {
          commandId: command.commandId,
          edgeId: command.edgeId,
          error: error,
        });
        return throwError(
          () =>
            new Error(
              `Failed to remove edge: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
      }),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Handler for UpdateDiagramMetadataCommand
 */
@Injectable()
export class UpdateDiagramMetadataCommandHandler
  implements ICommandHandler<UpdateDiagramMetadataCommand>
{
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'UPDATE_DIAGRAM_METADATA';
  }

  handle(command: UpdateDiagramMetadataCommand): Observable<CommandResult> {
    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram => this.saveDiagram(diagram)),
      catchError(error =>
        throwError(
          () =>
            new Error(
              `Failed to update diagram metadata: ${error instanceof Error ? error.message : String(error)}`,
            ),
        ),
      ),
    );
  }

  private loadDiagram(diagramId: string): Observable<DiagramAggregate> {
    return this.diagramRepository.findById(diagramId).pipe(
      map(diagram => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram;
      }),
    );
  }

  private saveDiagram(diagram: DiagramAggregate): Observable<CommandResult> {
    const events = diagram.getUncommittedEvents();

    return this.diagramRepository.save(diagram).pipe(
      map(() => {
        diagram.markEventsAsCommitted();
        return {
          success: true,
          diagramId: diagram.id,
          events,
          diagramSnapshot: diagram.toSnapshot(),
        };
      }),
    );
  }
}

/**
 * Command handler registry service
 */
@Injectable()
export class CommandHandlerRegistry {
  private readonly _handlers: ICommandHandler[] = [];

  constructor(
    private readonly createDiagramHandler: CreateDiagramCommandHandler,
    private readonly addNodeHandler: AddNodeCommandHandler,
    private readonly updateNodePositionHandler: UpdateNodePositionCommandHandler,
    private readonly updateNodeDataHandler: UpdateNodeDataCommandHandler,
    private readonly removeNodeHandler: RemoveNodeCommandHandler,
    private readonly addEdgeHandler: AddEdgeCommandHandler,
    private readonly updateEdgeDataHandler: UpdateEdgeDataCommandHandler,
    private readonly removeEdgeHandler: RemoveEdgeCommandHandler,
    private readonly updateDiagramMetadataHandler: UpdateDiagramMetadataCommandHandler,
  ) {
    this.registerHandlers();
  }

  /**
   * Gets all registered handlers
   */
  getHandlers(): ICommandHandler[] {
    return [...this._handlers];
  }

  /**
   * Registers all command handlers
   */
  private registerHandlers(): void {
    this._handlers.push(
      this.createDiagramHandler,
      this.addNodeHandler,
      this.updateNodePositionHandler,
      this.updateNodeDataHandler,
      this.removeNodeHandler,
      this.addEdgeHandler,
      this.updateEdgeDataHandler,
      this.removeEdgeHandler,
      this.updateDiagramMetadataHandler,
    );
  }
}
