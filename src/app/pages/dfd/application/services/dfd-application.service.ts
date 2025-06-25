import { Injectable, Inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject, throwError } from 'rxjs';
import { map, catchError, tap, switchMap } from 'rxjs/operators';
import { CommandBusService } from './command-bus.service';
import { DiagramCommandFactory, AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { DiagramSnapshot } from '../../domain/aggregates/diagram-aggregate';
import { BaseDomainEvent } from '../../domain/events/domain-event';
import { Point } from '../../domain/value-objects/point';
import { NodeData } from '../../domain/value-objects/node-data';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { IDiagramRepository, DIAGRAM_REPOSITORY_TOKEN } from '../handlers/diagram-command-handlers';

/**
 * Application service for DFD diagram operations
 * Coordinates between the presentation layer and domain layer
 */
@Injectable({
  providedIn: 'root',
})
export class DfdApplicationService {
  private readonly _diagramEvents$ = new Subject<BaseDomainEvent>();
  private readonly _currentDiagram$ = new BehaviorSubject<DiagramSnapshot | null>(null);
  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);
  private readonly _errors$ = new Subject<Error>();

  constructor(
    private readonly commandBus: CommandBusService,
    @Inject(DIAGRAM_REPOSITORY_TOKEN) private readonly diagramRepository: IDiagramRepository,
  ) {}

  /**
   * Observable of diagram events for real-time updates
   */
  get diagramEvents$(): Observable<BaseDomainEvent> {
    return this._diagramEvents$.asObservable();
  }

  /**
   * Observable of current diagram state
   */
  get currentDiagram$(): Observable<DiagramSnapshot | null> {
    return this._currentDiagram$.asObservable();
  }

  /**
   * Observable of loading state
   */
  get isLoading$(): Observable<boolean> {
    return this._isLoading$.asObservable();
  }

  /**
   * Observable of application errors
   */
  get errors$(): Observable<Error> {
    return this._errors$.asObservable();
  }

  /**
   * Creates a new diagram
   */
  createDiagram(name: string, description: string = '', userId: string): Observable<string> {
    const diagramId = this.generateDiagramId();
    const command = DiagramCommandFactory.createDiagram(diagramId, userId, name, description);

    this._isLoading$.next(true);

    return this.commandBus.execute<DiagramOperationResult>(command).pipe(
      map((result: DiagramOperationResult) => {
        this.emitEvents(result.events);
        this.updateCurrentDiagram(result.diagramSnapshot);
        return result.diagramSnapshot.id;
      }),
      tap(() => this._isLoading$.next(false)),
      catchError((error: unknown) => {
        this._isLoading$.next(false);
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return throwError(() => error);
      }),
    );
  }

  /**
   * Loads an existing diagram
   */
  loadDiagram(diagramId: string): Observable<DiagramSnapshot> {
    this._isLoading$.next(true);

    return this.diagramRepository.findById(diagramId).pipe(
      map((diagram: { toSnapshot(): DiagramSnapshot } | null) => {
        if (!diagram) {
          throw new Error(`Diagram with ID ${diagramId} not found`);
        }
        return diagram.toSnapshot();
      }),
      tap((snapshot: DiagramSnapshot) => {
        this.updateCurrentDiagram(snapshot);
        this._isLoading$.next(false);
      }),
      catchError((error: unknown) => {
        this._isLoading$.next(false);
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return throwError(() => error);
      }),
    );
  }

  /**
   * Adds a node to the diagram
   */
  addNode(
    diagramId: string,
    nodeId: string,
    position: Point,
    nodeType: 'actor' | 'store' | 'process' | 'security-boundary' | 'textbox',
    label: string,
    userId: string,
    width: number = 120,
    height: number = 80,
    metadata: Record<string, string> = {},
  ): Observable<void> {
    const nodeData = new NodeData(nodeId, nodeType, label, position, width, height, metadata);
    const command = DiagramCommandFactory.addNode(diagramId, userId, nodeId, position, nodeData);

    return this.executeCommand(command);
  }

  /**
   * Updates a node's position
   */
  updateNodePosition(
    diagramId: string,
    nodeId: string,
    newPosition: Point,
    oldPosition: Point,
    userId: string,
  ): Observable<void> {
    const command = DiagramCommandFactory.updateNodePosition(
      diagramId,
      userId,
      nodeId,
      newPosition,
      oldPosition,
    );

    return this.executeCommand(command);
  }

  /**
   * Updates a node's data
   */
  updateNodeData(
    diagramId: string,
    nodeId: string,
    newData: NodeData,
    oldData: NodeData,
    userId: string,
  ): Observable<void> {
    const command = DiagramCommandFactory.updateNodeData(
      diagramId,
      userId,
      nodeId,
      newData,
      oldData,
    );

    return this.executeCommand(command);
  }

  /**
   * Removes a node from the diagram
   */
  removeNode(diagramId: string, nodeId: string, userId: string): Observable<void> {
    const command = DiagramCommandFactory.removeNode(diagramId, userId, nodeId);

    return this.executeCommand(command);
  }

  /**
   * Adds an edge to the diagram
   */
  addEdge(
    diagramId: string,
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    userId: string,
    label?: string,
    sourcePortId?: string,
    targetPortId?: string,
    vertices: Point[] = [],
    metadata: Record<string, string> = {},
  ): Observable<void> {
    const edgeData = new EdgeData(
      edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      label,
      vertices,
      metadata,
    );
    const command = DiagramCommandFactory.addEdge(
      diagramId,
      userId,
      edgeId,
      sourceNodeId,
      targetNodeId,
      edgeData,
    );

    return this.executeCommand(command);
  }

  /**
   * Updates an edge's data
   */
  updateEdgeData(
    diagramId: string,
    edgeId: string,
    newData: EdgeData,
    oldData: EdgeData,
    userId: string,
  ): Observable<void> {
    const command = DiagramCommandFactory.updateEdgeData(
      diagramId,
      userId,
      edgeId,
      newData,
      oldData,
    );

    return this.executeCommand(command);
  }

  /**
   * Removes an edge from the diagram
   */
  removeEdge(diagramId: string, edgeId: string, userId: string): Observable<void> {
    const command = DiagramCommandFactory.removeEdge(diagramId, userId, edgeId);

    return this.executeCommand(command);
  }

  /**
   * Updates diagram metadata
   */
  updateDiagramMetadata(
    diagramId: string,
    userId: string,
    name?: string,
    description?: string,
  ): Observable<void> {
    const command = DiagramCommandFactory.updateDiagramMetadata(
      diagramId,
      userId,
      name,
      description,
    );

    return this.executeCommand(command);
  }

  /**
   * Gets the current diagram snapshot
   */
  getCurrentDiagram(): DiagramSnapshot | null {
    return this._currentDiagram$.value;
  }

  /**
   * Clears the current diagram
   */
  clearCurrentDiagram(): void {
    this._currentDiagram$.next(null);
  }

  /**
   * Executes a command through the command bus
   */
  private executeCommand(command: AnyDiagramCommand): Observable<void> {
    this._isLoading$.next(true);

    return this.commandBus.execute<DiagramOperationResult>(command).pipe(
      map((result: DiagramOperationResult) => {
        this.emitEvents(result.events);
        this.updateCurrentDiagram(result.diagramSnapshot);
      }),
      tap(() => this._isLoading$.next(false)),
      catchError((error: unknown) => {
        this._isLoading$.next(false);
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return throwError(() => error);
      }),
    );
  }

  /**
   * Emits domain events
   */
  private emitEvents(events: BaseDomainEvent[]): void {
    events.forEach(event => this._diagramEvents$.next(event));
  }

  /**
   * Updates the current diagram snapshot
   */
  private updateCurrentDiagram(snapshot: DiagramSnapshot): void {
    this._currentDiagram$.next(snapshot);
  }

  /**
   * Handles application errors
   */
  private handleError(error: Error): void {
    // TODO: Replace with LoggerService when available
    // console.error('[DfdApplicationService] Error:', error);
    this._errors$.next(error);
  }

  /**
   * Generates a unique diagram ID
   */
  private generateDiagramId(): string {
    return `diagram_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup method for component destruction
   */
  destroy(): void {
    this._diagramEvents$.complete();
    this._currentDiagram$.complete();
    this._isLoading$.complete();
    this._errors$.complete();
  }
}

/**
 * Interface for diagram operation results
 */
export interface DiagramOperationResult {
  success: boolean;
  events: BaseDomainEvent[];
  diagramSnapshot: DiagramSnapshot;
  error?: Error;
}

/**
 * Interface for diagram creation options
 */
export interface CreateDiagramOptions {
  name: string;
  description?: string;
  userId: string;
  initialNodes?: Array<{
    id: string;
    type: 'actor' | 'store' | 'process' | 'security-boundary' | 'textbox';
    label: string;
    position: Point;
    width?: number;
    height?: number;
    metadata?: Record<string, string>;
  }>;
  initialEdges?: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;
    vertices?: Point[];
    metadata?: Record<string, string>;
  }>;
}

/**
 * Extended application service with batch operations
 */
@Injectable({
  providedIn: 'root',
})
export class DfdApplicationServiceExtended extends DfdApplicationService {
  /**
   * Creates a diagram with initial nodes and edges
   */
  createDiagramWithContent(options: CreateDiagramOptions): Observable<string> {
    return this.createDiagram(options.name, options.description, options.userId).pipe(
      switchMap((diagramId: string) => {
        const operations: Observable<void>[] = [];

        // Add initial nodes
        if (options.initialNodes) {
          options.initialNodes.forEach(node => {
            operations.push(
              this.addNode(
                diagramId,
                node.id,
                node.position,
                node.type,
                node.label,
                options.userId,
                node.width,
                node.height,
                node.metadata,
              ),
            );
          });
        }

        // Add initial edges
        if (options.initialEdges) {
          options.initialEdges.forEach(edge => {
            operations.push(
              this.addEdge(
                diagramId,
                edge.id,
                edge.sourceNodeId,
                edge.targetNodeId,
                options.userId,
                edge.label,
                undefined,
                undefined,
                edge.vertices,
                edge.metadata,
              ),
            );
          });
        }

        // Execute all operations and return diagram ID
        if (operations.length === 0) {
          return [diagramId];
        }

        return operations
          .reduce((acc, op) => acc.pipe(switchMap(() => op)), operations[0])
          .pipe(map(() => diagramId));
      }),
    );
  }

  /**
   * Batch update multiple nodes
   */
  batchUpdateNodes(
    diagramId: string,
    userId: string,
    updates: Array<{
      nodeId: string;
      newData: NodeData;
      oldData: NodeData;
    }>,
  ): Observable<void> {
    const operations = updates.map(update =>
      this.updateNodeData(diagramId, update.nodeId, update.newData, update.oldData, userId),
    );

    return operations.reduce((acc, op) => acc.pipe(switchMap(() => op)), operations[0]);
  }
}
