import { Injectable } from '@angular/core';
import { Observable, Subject } from '../../../../core/rxjs-imports';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Event types for the diagram editor
 */
export enum DiagramEventType {
  // Cell events
  CELL_SELECTED = 'cell.selected',
  CELL_DESELECTED = 'cell.deselected',
  CELL_CLICKED = 'cell.clicked',
  CELL_DOUBLE_CLICKED = 'cell.doubleClicked',
  CELL_MOVED = 'cell.moved',
  CELL_RESIZED = 'cell.resized',
  CELL_DELETED = 'cell.deleted',
  CELL_CREATED = 'cell.created',
  CELL_UPDATED = 'cell.updated',

  // Vertex events
  VERTEX_CREATED = 'vertex.created',
  VERTEX_UPDATED = 'vertex.updated',
  VERTEX_DELETED = 'vertex.deleted',

  // Edge events
  EDGE_CREATED = 'edge.created',
  EDGE_UPDATED = 'edge.updated',
  EDGE_DELETED = 'edge.deleted',
  EDGE_CREATION_STARTED = 'edge.creationStarted',
  EDGE_CREATION_COMPLETED = 'edge.creationCompleted',
  EDGE_CREATION_CANCELLED = 'edge.creationCancelled',

  // Diagram events
  DIAGRAM_LOADED = 'diagram.loaded',
  DIAGRAM_SAVED = 'diagram.saved',
  DIAGRAM_CLEARED = 'diagram.cleared',
  DIAGRAM_EXPORTED = 'diagram.exported',
  DIAGRAM_IMPORTED = 'diagram.imported',

  // Theme events
  THEME_CHANGED = 'theme.changed',

  // Grid events
  GRID_TOGGLED = 'grid.toggled',

  // Editor state events
  STATE_CHANGED = 'state.changed',

  // Error events
  ERROR_OCCURRED = 'error.occurred',

  // Registry events
  REGISTRY_UPDATED = 'registry.updated',
  REGISTRY_CLEARED = 'registry.cleared',
}

/**
 * Base interface for all diagram events
 */
export interface DiagramEvent {
  type: DiagramEventType;
  timestamp: number;
}

/**
 * Cell-related event interface
 */
export interface CellEvent extends DiagramEvent {
  cellId: string;
  componentId?: string;
}

/**
 * Error event interface
 */
export interface ErrorEvent extends DiagramEvent {
  error: Error;
  context?: any;
}

/**
 * State change event interface
 */
export interface StateChangeEvent extends DiagramEvent {
  previousState: string;
  currentState: string;
}

/**
 * Service for event communication between diagram editor components
 * Implements the Observer pattern using RxJS
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramEventBusService {
  private eventSubject = new Subject<DiagramEvent>();

  constructor(private logger: LoggerService) {
    this.logger.info('DiagramEventBusService initialized');
  }

  /**
   * Publish an event to all subscribers
   * @param event The event to publish
   */
  publish<T extends DiagramEvent>(event: T): void {
    // Add timestamp if not present
    if (!event.timestamp) {
      (event as any).timestamp = Date.now();
    }

    this.logger.debug(`Publishing event: ${event.type}`, event);
    this.eventSubject.next(event);
  }

  /**
   * Subscribe to all events
   * @returns An Observable of all diagram events
   */
  subscribe(): Observable<DiagramEvent> {
    return this.eventSubject.asObservable();
  }

  /**
   * Subscribe to a specific event type
   * @param eventType The event type to subscribe to
   * @returns An Observable of events of the specified type
   */
  on<T extends DiagramEvent>(eventType: DiagramEventType): Observable<T> {
    return this.eventSubject.asObservable().pipe(
      // Filter events by type
      source =>
        new Observable<T>(observer => {
          const subscription = source.subscribe({
            next: event => {
              if (event.type === eventType) {
                observer.next(event as T);
              }
            },
            error: err => observer.error(err),
            complete: () => observer.complete(),
          });

          return subscription;
        }),
    );
  }

  /**
   * Create and publish a cell event
   * @param type The event type
   * @param cellId The cell ID
   * @param componentId Optional component ID
   * @param additionalData Optional additional data
   */
  publishCellEvent(
    type: DiagramEventType,
    cellId: string,
    componentId?: string,
    additionalData?: Record<string, unknown>,
  ): void {
    const event: CellEvent = {
      type,
      cellId,
      componentId,
      timestamp: Date.now(),
      ...additionalData,
    };

    this.publish(event);
  }

  /**
   * Create and publish an error event
   * @param error The error object
   * @param context Optional context information
   */
  publishError(error: Error, context?: any): void {
    const event: ErrorEvent = {
      type: DiagramEventType.ERROR_OCCURRED,
      timestamp: Date.now(),
      error,
      context,
    };

    this.logger.error('Error event published', error);
    this.publish(event);
  }

  /**
   * Create and publish a state change event
   * @param previousState The previous state
   * @param currentState The current state
   */
  publishStateChange(previousState: string, currentState: string): void {
    const event: StateChangeEvent = {
      type: DiagramEventType.STATE_CHANGED,
      timestamp: Date.now(),
      previousState,
      currentState,
    };

    this.publish(event);
  }
}
