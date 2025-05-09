import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Cell, Node } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * DFD event types
 */
export enum DfdEventType {
  NodeSelected = 'nodeSelected',
  NodeDeselected = 'nodeDeselected',
  NodeDeleted = 'nodeDeleted',
  NodeMoved = 'nodeMoved',
  NodeResized = 'nodeResized',
  EdgeCreated = 'edgeCreated',
  EdgeRemoved = 'edgeRemoved',
  GraphChanged = 'graphChanged',
  CanUndoChanged = 'canUndoChanged',
  CanRedoChanged = 'canRedoChanged',
  PortVisibilityChanged = 'portVisibilityChanged',
  Error = 'error',
}

/**
 * Base DFD event interface
 */
export interface DfdEvent {
  type: DfdEventType;
  timestamp: number;
}

/**
 * Node-related events
 */
export interface NodeEvent extends DfdEvent {
  node: Node;
}

/**
 * Edge-related events
 */
export interface EdgeEvent extends DfdEvent {
  edge: Cell;
  source?: Node;
  target?: Node;
}

/**
 * Error event
 */
export interface ErrorEvent extends DfdEvent {
  error: Error;
  message: string;
  context?: unknown;
}

/**
 * History-related events
 */
export interface HistoryEvent extends DfdEvent {
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Port visibility events
 */
export interface PortVisibilityEvent extends DfdEvent {
  node: Node;
  visible: boolean;
  portId?: string;
}

/**
 * Graph change events
 */
export interface GraphChangedEvent extends DfdEvent {
  cells: Cell[];
  added?: Cell[];
  removed?: Cell[];
}

/**
 * Node deleted event
 */
export interface NodeDeletedEvent extends DfdEvent {
  nodeId: string;
}

/**
 * Union type for all possible events
 */
export type DfdEventPayload = 
  | NodeEvent 
  | EdgeEvent 
  | ErrorEvent
  | HistoryEvent
  | PortVisibilityEvent
  | GraphChangedEvent
  | NodeDeletedEvent;

/**
 * Event bus service for DFD component
 * Centralized event management using RxJS
 */
@Injectable({
  providedIn: 'root',
})
export class DfdEventBusService {
  // Subject for all events
  private _events = new Subject<DfdEventPayload>();
  
  // Selected node state
  private _selectedNode = new BehaviorSubject<Node | null>(null);
  
  // History state
  private _canUndo = new BehaviorSubject<boolean>(false);
  private _canRedo = new BehaviorSubject<boolean>(false);
  
  // Graph state
  private _isGraphReady = new BehaviorSubject<boolean>(false);

  constructor(private logger: LoggerService) {
    this.logger.info('DfdEventBusService initialized');
    
    // Log all events for debugging
    this._events.subscribe(event => {
      this.logger.debug(`Event: ${event.type}`, event);
      
      // Update selected node state
      if (event.type === DfdEventType.NodeSelected && 'node' in event) {
        this._selectedNode.next(event.node);
      } else if (event.type === DfdEventType.NodeDeselected) {
        this._selectedNode.next(null);
      }
      
      // Update history state
      if (event.type === DfdEventType.CanUndoChanged && 'canUndo' in event) {
        this._canUndo.next(event.canUndo);
        this._canRedo.next(event.canRedo);
      }
    });
  }

  /**
   * Publish an event to the event bus
   * @param event The event to publish
   */
  publish(event: DfdEventPayload): void {
    this._events.next({
      ...event,
      timestamp: Date.now(),
    });
  }

  /**
   * Publish a node selected event
   * @param node The selected node
   */
  publishNodeSelected(node: Node): void {
    this.publish({
      type: DfdEventType.NodeSelected,
      node,
      timestamp: Date.now(),
    });
  }

  /**
   * Publish a node deselected event
   */
  publishNodeDeselected(): void {
    // Create a basic deselection event that works with our type system
    // We need to add a dummy cells array to satisfy the GraphChangedEvent interface
    this.publish({
      type: DfdEventType.NodeDeselected,
      timestamp: Date.now(),
      cells: [], // Empty cells array to satisfy the type system
    } as DfdEventPayload);
  }

  /**
   * Publish a history state change event (without adding to history)
   * @param canUndo Whether undo is available
   * @param canRedo Whether redo is available
   */
  publishHistoryChange(canUndo: boolean, canRedo: boolean): void {
    // Update internal state directly without going through the event system
    this._canUndo.next(canUndo);
    this._canRedo.next(canRedo);
    
    // Only log this at debug level
    this.logger.debug('History state changed', {
      canUndo,
      canRedo,
      timestamp: Date.now()
    });
  }

  /**
   * Publish an error event
   * @param error The error object
   * @param message A human-readable error message
   * @param context Optional context information
   */
  publishError(error: Error, message: string, context?: unknown): void {
    this.publish({
      type: DfdEventType.Error,
      error,
      message,
      context,
      timestamp: Date.now(),
    });
  }

  /**
   * Subscribe to all events
   * @returns An observable of all events
   */
  onEvents(): Observable<DfdEventPayload> {
    return this._events.asObservable();
  }

  /**
   * Subscribe to a specific event type
   * @param eventType The event type to subscribe to
   * @returns An observable of events of the specified type
   */
  onEventType<T extends DfdEventPayload>(eventType: DfdEventType): Observable<T> {
    return new Observable<T>(observer => {
      const subscription = this._events.subscribe(event => {
        if (event.type === eventType) {
          observer.next(event as T);
        }
      });
      
      return () => subscription.unsubscribe();
    });
  }

  /**
   * Get the currently selected node
   * @returns An observable of the selected node
   */
  get selectedNode$(): Observable<Node | null> {
    return this._selectedNode.asObservable();
  }

  /**
   * Get the current value of the selected node
   */
  get selectedNode(): Node | null {
    return this._selectedNode.value;
  }

  /**
   * Set the graph ready state
   * @param isReady Whether the graph is ready
   */
  setGraphReady(isReady: boolean): void {
    this._isGraphReady.next(isReady);
  }

  /**
   * Get the graph ready state
   * @returns An observable of the graph ready state
   */
  get isGraphReady$(): Observable<boolean> {
    return this._isGraphReady.asObservable();
  }

  /**
   * Get the undo availability state
   * @returns An observable of the undo availability
   */
  get canUndo$(): Observable<boolean> {
    return this._canUndo.asObservable();
  }

  /**
   * Get the redo availability state
   * @returns An observable of the redo availability
   */
  get canRedo$(): Observable<boolean> {
    return this._canRedo.asObservable();
  }

  /**
   * Get the current undo availability
   */
  get canUndo(): boolean {
    return this._canUndo.value;
  }

  /**
   * Get the current redo availability
   */
  get canRedo(): boolean {
    return this._canRedo.value;
  }
}