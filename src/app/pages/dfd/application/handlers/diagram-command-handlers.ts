import { Injectable, InjectionToken, Inject } from '@angular/core';
import { Observable, throwError, from } from 'rxjs';
import { map, catchError, switchMap, concatMap, reduce } from 'rxjs/operators';
import { ICommandHandler, ICommandBus } from '../interfaces/command-bus.interface';
import {
  AddNodeCommand,
  UpdateNodePositionCommand,
  UpdateNodeSnapshotCommand,
  RemoveNodeCommand,
  AddEdgeCommand,
  UpdateEdgeSnapshotCommand,
  RemoveEdgeCommand,
  UpdateDiagramMetadataCommand,
  CreateDiagramCommand,
  CompositeCommand,
  RestoreEmbeddingCommand,
  AnyDiagramCommand,
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
    this._logger.info(' AddNodeCommand - Starting operation tracking', {
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
            this._logger.info(' AddNodeCommand - Completing operation', {
              operationId,
              commandId: command.commandId,
            });
            this._operationTracker.completeOperation(operationId);

            // Re-add the node to the X6 graph after successful domain model update
            const node = diagram.getNode(command.nodeId);
            if (node) {
              this._logger.info(' AddNodeCommand - Adding node to X6 graph', {
                nodeId: node.id,
                shapeType: node.data.type,
                hasSnapshot: !!command.nodeSnapshot,
              });

              // Use isLocalUserInitiated flag to distinguish between new creation vs restoration
              // - true: user-initiated command (new creation) → use regular addNode()
              // - false/undefined: system-generated command (undo/redo) → use addNodeFromSnapshot()
              if (!command.isLocalUserInitiated && command.nodeSnapshot) {
                this._logger.info(
                  ' AddNodeCommand - Using snapshot-based restoration for undo/redo',
                  {
                    nodeId: node.id,
                    snapshotPorts: command.nodeSnapshot.ports,
                    isLocalUserInitiated: command.isLocalUserInitiated,
                  },
                );
                this._x6GraphAdapter.addNodeFromSnapshot(command.nodeSnapshot);
              } else {
                this._logger.info(' AddNodeCommand - Using regular node creation', {
                  nodeId: node.id,
                  isLocalUserInitiated: command.isLocalUserInitiated,
                  hasSnapshot: !!command.nodeSnapshot,
                });
                this._x6GraphAdapter.addNode(node);
              }
            } else {
              this._logger.warn(' AddNodeCommand - Node not found in domain after add', {
                nodeId: command.nodeId,
              });
            }
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error(' AddNodeCommand - Cancelling operation due to error', {
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
    private readonly _x6GraphAdapter: X6GraphAdapter,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'UPDATE_NODE_POSITION';
  }

  handle(command: UpdateNodePositionCommand): Observable<CommandResult> {
    this._logger.info(' UpdateNodePositionCommand - Handling command', {
      commandId: command.commandId,
      nodeId: command.nodeId,
      newPosition: command.newPosition,
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            // After successful update in domain model, update X6 graph
            const node = diagram.getNode(command.nodeId);
            if (node) {
              this._logger.info(' UpdateNodePositionCommand - Moving node in X6 graph', {
                nodeId: node.id,
                newPosition: node.position,
              });
              this._x6GraphAdapter.moveNode(node.id, node.position);
            } else {
              this._logger.warn(
                ' UpdateNodePositionCommand - Node not found in domain after update',
                {
                  nodeId: command.nodeId,
                },
              );
            }
            return result;
          }),
        ),
      ),
      catchError((error: unknown) =>
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
 * Handler for UpdateNodeSnapshotCommand
 */
@Injectable()
export class UpdateNodeSnapshotCommandHandler
  implements ICommandHandler<UpdateNodeSnapshotCommand>
{
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _x6GraphAdapter: X6GraphAdapter,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'UPDATE_NODE_SNAPSHOT';
  }

  handle(command: UpdateNodeSnapshotCommand): Observable<CommandResult> {
    this._logger.info(' UpdateNodeSnapshotCommand - Handling command', {
      commandId: command.commandId,
      nodeId: command.nodeId,
      newSnapshot: command.newSnapshot,
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        diagram.processCommand(command);
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            // After successful update in domain model, update X6 graph
            const node = diagram.getNode(command.nodeId);
            if (node) {
              this._logger.info(' UpdateNodeSnapshotCommand - Updating node snapshot in X6 graph', {
                nodeId: node.id,
                newData: node.data,
              });
              // Update label
              if (node.data.label !== undefined) {
                const x6Node = this._x6GraphAdapter.getNode(node.id);
                if (x6Node) {
                  this._x6GraphAdapter.setCellLabel(x6Node, node.data.label);
                }
              }
              // Update size
              if (node.data.width !== undefined && node.data.height !== undefined) {
                const x6Node = this._x6GraphAdapter.getNode(node.id);
                if (x6Node) {
                  x6Node.setSize(node.data.width, node.data.height);
                }
              }
            } else {
              this._logger.warn(
                ' UpdateNodeSnapshotCommand - Node not found in domain after update',
                {
                  nodeId: command.nodeId,
                },
              );
            }
            return result;
          }),
        ),
      ),
      catchError((error: unknown) =>
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
    this._logger.info(' RemoveNodeCommand - Handling command', {
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
            this._logger.info(' RemoveNodeCommand - Removing node from X6 graph', {
              nodeId: command.nodeId,
            });
            this._x6GraphAdapter.removeNode(command.nodeId);
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error(' RemoveNodeCommand - Failed to remove node', {
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
    private readonly _x6GraphAdapter: X6GraphAdapter,
  ) {}

  getCommandType(): string {
    return 'ADD_EDGE';
  }

  handle(command: AddEdgeCommand): Observable<CommandResult> {
    const operationId = command.commandId; // Use command ID as operation ID for direct commands
    this._logger.info(' AddEdgeCommand - Starting operation tracking', {
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
            this._logger.info(' AddEdgeCommand - Completing operation', {
              operationId,
              commandId: command.commandId,
            });
            this._operationTracker.completeOperation(operationId);

            // Re-add the edge to the X6 graph after successful domain model update
            const edge = diagram.getEdge(command.edgeId);
            if (edge) {
              this._logger.info(' AddEdgeCommand - Adding edge to X6 graph', {
                edgeId: edge.id,
                sourceNodeId: edge.sourceNodeId,
                targetNodeId: edge.targetNodeId,
                hasSnapshot: !!command.edgeSnapshot,
              });

              // Use X6GraphAdapter which now uses consolidated EdgeService internally
              this._logger.info(' AddEdgeCommand - Adding edge via X6GraphAdapter', {
                edgeId: edge.id,
                isLocalUserInitiated: command.isLocalUserInitiated,
                hasSnapshot: !!command.edgeSnapshot,
                isRestoration: !command.isLocalUserInitiated,
              });
              this._x6GraphAdapter.addEdge(edge);
            } else {
              this._logger.warn(' AddEdgeCommand - Edge not found in domain after add', {
                edgeId: command.edgeId,
              });
            }
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error(' AddEdgeCommand - Cancelling operation due to error', {
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
 * Handler for UpdateEdgeSnapshotCommand
 */
@Injectable()
export class UpdateEdgeSnapshotCommandHandler
  implements ICommandHandler<UpdateEdgeSnapshotCommand>
{
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  getCommandType(): string {
    return 'UPDATE_EDGE_SNAPSHOT';
  }

  handle(command: UpdateEdgeSnapshotCommand): Observable<CommandResult> {
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
    this._logger.info(' RemoveEdgeCommand - Handling command', {
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
            this._logger.info(
              ' RemoveEdgeCommand - Removing edge from X6 graph via consolidated service',
              {
                edgeId: command.edgeId,
              },
            );
            this._x6GraphAdapter.removeEdge(command.edgeId);
            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error(' RemoveEdgeCommand - Failed to remove edge', {
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
 * Handler for RestoreEmbeddingCommand
 */
@Injectable()
export class RestoreEmbeddingCommandHandler implements ICommandHandler<RestoreEmbeddingCommand> {
  constructor(
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
    private readonly _x6GraphAdapter: X6GraphAdapter,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'RESTORE_EMBEDDING';
  }

  handle(command: RestoreEmbeddingCommand): Observable<CommandResult> {
    this._logger.info(' RestoreEmbeddingCommand - Handling command', {
      commandId: command.commandId,
      embeddingRelationships: command.embeddingRelationships,
    });

    return this.loadDiagram(command.diagramId).pipe(
      map(diagram => {
        // No domain model changes needed - this is purely an X6 graph operation
        return diagram;
      }),
      switchMap(diagram =>
        this.saveDiagram(diagram).pipe(
          map(result => {
            // Apply embedding relationships to X6 graph
            this._logger.info(
              ' RestoreEmbeddingCommand - Applying embedding relationships to X6 graph',
              {
                relationshipCount: command.embeddingRelationships.length,
                relationships: command.embeddingRelationships,
              },
            );

            for (const relationship of command.embeddingRelationships) {
              const parentNode = this._x6GraphAdapter.getNode(relationship.parentId);
              const childNode = this._x6GraphAdapter.getNode(relationship.childId);

              if (parentNode && childNode) {
                this._logger.info(' RestoreEmbeddingCommand - Restoring embedding relationship', {
                  parentId: relationship.parentId,
                  childId: relationship.childId,
                });
                parentNode.addChild(childNode);
              } else {
                this._logger.warn(
                  ' RestoreEmbeddingCommand - Missing nodes for embedding relationship',
                  {
                    parentId: relationship.parentId,
                    childId: relationship.childId,
                    parentExists: !!parentNode,
                    childExists: !!childNode,
                  },
                );
              }
            }

            return result;
          }),
        ),
      ),
      catchError((error: unknown) => {
        this._logger.error(' RestoreEmbeddingCommand - Failed to restore embedding relationships', {
          commandId: command.commandId,
          error: error,
        });
        return throwError(
          () =>
            new Error(
              `Failed to restore embedding relationships: ${error instanceof Error ? error.message : String(error)}`,
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
 * Handler for CompositeCommand
 */
@Injectable()
export class CompositeCommandHandler implements ICommandHandler<CompositeCommand> {
  constructor(
    @Inject('ICommandBus') private readonly _commandBus: ICommandBus,
    private readonly _logger: LoggerService,
  ) {}

  getCommandType(): string {
    return 'COMPOSITE';
  }

  handle(command: CompositeCommand): Observable<CommandResult> {
    this._logger.info(' CompositeCommand - Starting execution', {
      commandId: command.commandId,
      description: command.description,
      subCommandCount: command.commands.length,
      subCommands: command.commands.map(cmd => ({ type: cmd.type, id: cmd.commandId })),
    });

    // Validate sub-commands before execution
    if (!command.commands || command.commands.length === 0) {
      this._logger.error(' CompositeCommand - No sub-commands to execute', {
        commandId: command.commandId,
      });
      return throwError(() => new Error('CompositeCommand has no sub-commands to execute'));
    }

    // Execute all sub-commands sequentially
    return from(command.commands).pipe(
      concatMap((subCommand: AnyDiagramCommand, index: number) => {
        this._logger.info(' CompositeCommand - About to execute sub-command', {
          compositeCommandId: command.commandId,
          subCommandIndex: index,
          subCommandType: subCommand.type,
          subCommandId: subCommand.commandId,
          subCommandData: subCommand,
        });

        return this._commandBus.execute(subCommand).pipe(
          map((result: unknown) => {
            const commandResult = result as CommandResult;
            this._logger.info(' CompositeCommand - Sub-command completed successfully', {
              compositeCommandId: command.commandId,
              subCommandIndex: index,
              subCommandType: subCommand.type,
              subCommandId: subCommand.commandId,
              resultSuccess: commandResult.success,
              resultType: typeof result,
            });
            return commandResult;
          }),
          catchError((error: unknown) => {
            this._logger.error(' CompositeCommand - Sub-command execution failed', {
              compositeCommandId: command.commandId,
              subCommandIndex: index,
              subCommandType: subCommand.type,
              subCommandId: subCommand.commandId,
              error: error,
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            });
            // Re-throw the error to stop composite execution
            throw error;
          }),
        );
      }),
      reduce((acc: CommandResult[], result: CommandResult) => {
        this._logger.info(' CompositeCommand - Accumulating result', {
          commandId: command.commandId,
          accumulatedCount: acc.length,
          currentResultSuccess: result.success,
        });
        acc.push(result);
        return acc;
      }, [] as CommandResult[]),
      map((results: CommandResult[]) => {
        this._logger.info(' CompositeCommand - All sub-commands completed successfully', {
          commandId: command.commandId,
          description: command.description,
          totalResults: results.length,
          allSuccessful: results.every(r => r.success),
        });

        // Use the last result's diagram snapshot and combine events
        const lastResult = results[results.length - 1];
        const allEvents = results.flatMap(r => r.events);

        return {
          success: true,
          diagramId: command.diagramId,
          events: allEvents,
          diagramSnapshot: lastResult?.diagramSnapshot || ({} as DiagramSnapshot),
        } as CommandResult;
      }),
      catchError((error: unknown) => {
        this._logger.error(' CompositeCommand - Composite execution failed completely', {
          commandId: command.commandId,
          description: command.description,
          error: error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
        });
        // Re-throw the error instead of returning a failed result
        return throwError(
          () =>
            new Error(
              `CompositeCommand execution failed: ${error instanceof Error ? error.message : String(error)}`,
            ),
        );
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
    private readonly updateNodeSnapshotHandler: UpdateNodeSnapshotCommandHandler,
    private readonly removeNodeHandler: RemoveNodeCommandHandler,
    private readonly addEdgeHandler: AddEdgeCommandHandler,
    private readonly updateEdgeSnapshotHandler: UpdateEdgeSnapshotCommandHandler,
    private readonly removeEdgeHandler: RemoveEdgeCommandHandler,
    private readonly updateDiagramMetadataHandler: UpdateDiagramMetadataCommandHandler,
    private readonly restoreEmbeddingHandler: RestoreEmbeddingCommandHandler,
    private readonly compositeHandler: CompositeCommandHandler,
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
      this.updateNodeSnapshotHandler,
      this.removeNodeHandler,
      this.addEdgeHandler,
      this.updateEdgeSnapshotHandler,
      this.removeEdgeHandler,
      this.updateDiagramMetadataHandler,
      this.restoreEmbeddingHandler,
      this.compositeHandler,
    );
  }
}
