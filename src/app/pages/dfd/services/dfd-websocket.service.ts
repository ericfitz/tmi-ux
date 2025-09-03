/**
 * DFD WebSocket Service
 *
 * Handles all WebSocket message subscriptions for the DFD module.
 * Transforms WebSocket messages into domain events and provides
 * typed observables for each message type.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../core/services/websocket.adapter';
import {
  DiagramOperationMessage,
  AuthorizationDeniedMessage,
  StateCorrectionMessage,
  HistoryOperationMessage,
  ResyncResponseMessage,
  CurrentPresenterMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  PresenterRequestMessage,
  PresenterDeniedMessage,
} from '../../../core/types/websocket-message.types';

/**
 * Domain events emitted by the WebSocket service
 */
export interface DiagramOperationEvent {
  type: 'diagram-operation';
  message: DiagramOperationMessage;
}

export interface AuthorizationDeniedEvent {
  type: 'authorization-denied';
  operationId: string;
  reason: string;
}

export interface StateCorrectionEvent {
  type: 'state-correction';
  cells: any[];
}

export interface HistoryOperationEvent {
  type: 'history-operation';
  operationType: string;
  message: string;
}

export interface ResyncRequestedEvent {
  type: 'resync-requested';
  method: string;
}

export interface PresenterChangedEvent {
  type: 'presenter-changed';
  presenterEmail: string | null;
}

export interface PresenterCursorEvent {
  type: 'presenter-cursor';
  userId: string;
  position: { x: number; y: number };
}

export interface PresenterSelectionEvent {
  type: 'presenter-selection';
  userId: string;
  selectedCells: string[];
}

export interface PresenterRequestEvent {
  type: 'presenter-request';
  userId: string;
}

export interface PresenterDeniedEvent {
  type: 'presenter-denied';
  userId: string;
  targetUser: string;
}

export interface PresenterUpdateEvent {
  type: 'presenter-update';
  presenterEmail: string | null;
}

export type DfdDomainEvent =
  | DiagramOperationEvent
  | AuthorizationDeniedEvent
  | StateCorrectionEvent
  | HistoryOperationEvent
  | ResyncRequestedEvent
  | PresenterChangedEvent
  | PresenterCursorEvent
  | PresenterSelectionEvent
  | PresenterRequestEvent
  | PresenterDeniedEvent
  | PresenterUpdateEvent;

@Injectable({
  providedIn: 'root',
})
export class DfdWebSocketService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  // Domain event streams
  private readonly _domainEvents$ = new Subject<DfdDomainEvent>();

  // Typed observables for specific events
  public readonly diagramOperations$ = this._domainEvents$.pipe(
    filter((event): event is DiagramOperationEvent => event.type === 'diagram-operation'),
    map(event => event.message),
  );

  public readonly authorizationDenied$ = this._domainEvents$.pipe(
    filter((event): event is AuthorizationDeniedEvent => event.type === 'authorization-denied'),
  );

  public readonly stateCorrections$ = this._domainEvents$.pipe(
    filter((event): event is StateCorrectionEvent => event.type === 'state-correction'),
  );

  public readonly historyOperations$ = this._domainEvents$.pipe(
    filter((event): event is HistoryOperationEvent => event.type === 'history-operation'),
  );

  public readonly resyncRequests$ = this._domainEvents$.pipe(
    filter((event): event is ResyncRequestedEvent => event.type === 'resync-requested'),
  );

  public readonly presenterChanges$ = this._domainEvents$.pipe(
    filter((event): event is PresenterChangedEvent => event.type === 'presenter-changed'),
  );

  public readonly presenterCursors$ = this._domainEvents$.pipe(
    filter((event): event is PresenterCursorEvent => event.type === 'presenter-cursor'),
  );

  public readonly presenterSelections$ = this._domainEvents$.pipe(
    filter((event): event is PresenterSelectionEvent => event.type === 'presenter-selection'),
  );

  public readonly presenterRequests$ = this._domainEvents$.pipe(
    filter((event): event is PresenterRequestEvent => event.type === 'presenter-request'),
  );

  public readonly presenterDenials$ = this._domainEvents$.pipe(
    filter((event): event is PresenterDeniedEvent => event.type === 'presenter-denied'),
  );

  public readonly presenterUpdates$ = this._domainEvents$.pipe(
    filter((event): event is PresenterUpdateEvent => event.type === 'presenter-update'),
  );

  // General event stream for components that want all events
  public readonly domainEvents$ = this._domainEvents$.asObservable();

  constructor(
    private _logger: LoggerService,
    private _webSocketAdapter: WebSocketAdapter,
  ) {
    this._logger.info('DfdWebSocketService initialized');
  }

  /**
   * Initialize WebSocket subscriptions for DFD-related messages
   */
  initialize(): void {
    this._logger.info('Initializing DFD WebSocket subscriptions');

    // Subscribe to diagram operations
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramOperationMessage>('diagram_operation')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleDiagramOperation(message),
          error: error => this._logger.error('Error in diagram operation subscription', error),
        }),
    );

    // Subscribe to authorization denied messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<AuthorizationDeniedMessage>('authorization_denied')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleAuthorizationDenied(message),
          error: error => this._logger.error('Error in authorization denied subscription', error),
        }),
    );

    // Subscribe to state correction messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<StateCorrectionMessage>('state_correction')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleStateCorrection(message),
          error: error => this._logger.error('Error in state correction subscription', error),
        }),
    );

    // Subscribe to history operation messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<HistoryOperationMessage>('history_operation')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleHistoryOperation(message),
          error: error => this._logger.error('Error in history operation subscription', error),
        }),
    );

    // Subscribe to resync response messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ResyncResponseMessage>('resync_response')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleResyncResponse(message),
          error: error => this._logger.error('Error in resync response subscription', error),
        }),
    );

    // Subscribe to presenter messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<CurrentPresenterMessage>('current_presenter')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleCurrentPresenter(message),
          error: error => this._logger.error('Error in current presenter subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterCursorMessage>('presenter_cursor')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterCursor(message),
          error: error => this._logger.error('Error in presenter cursor subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterSelectionMessage>('presenter_selection')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterSelection(message),
          error: error => this._logger.error('Error in presenter selection subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterRequestMessage>('presenter_request')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterRequest(message),
          error: error => this._logger.error('Error in presenter request subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterDeniedMessage>('presenter_denied')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterDenied(message),
          error: error => this._logger.error('Error in presenter denied subscription', error),
        }),
    );


    this._logger.info('DFD WebSocket subscriptions initialized successfully');
  }

  /**
   * Clean up subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('Destroying DfdWebSocketService');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }

  // Message handlers that transform WebSocket messages to domain events

  private _handleDiagramOperation(message: DiagramOperationMessage): void {
    this._logger.debug('Received diagram operation', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      operationId: message.operation_id,
      operationType: message.operation?.type,
    });

    this._domainEvents$.next({
      type: 'diagram-operation',
      message,
    });
  }

  private _handleAuthorizationDenied(message: AuthorizationDeniedMessage): void {
    this._logger.warn('Authorization denied', {
      operationId: message.original_operation_id,
      reason: message.reason,
    });

    this._domainEvents$.next({
      type: 'authorization-denied',
      operationId: message.original_operation_id,
      reason: message.reason,
    });
  }

  private _handleStateCorrection(message: StateCorrectionMessage): void {
    this._logger.info('State correction received', {
      cellCount: message.cells.length,
    });

    this._domainEvents$.next({
      type: 'state-correction',
      cells: message.cells,
    });
  }

  private _handleHistoryOperation(message: HistoryOperationMessage): void {
    this._logger.debug('History operation', {
      operationType: message.operation_type,
      message: message.message,
    });

    this._domainEvents$.next({
      type: 'history-operation',
      operationType: message.operation_type,
      message: message.message,
    });
  }

  private _handleResyncResponse(message: ResyncResponseMessage): void {
    this._logger.info('Resync response received', {
      method: message.method,
    });

    this._domainEvents$.next({
      type: 'resync-requested',
      method: message.method,
    });
  }

  private _handleCurrentPresenter(message: CurrentPresenterMessage): void {
    this._logger.debug('Current presenter update', {
      presenter: message.current_presenter,
    });

    this._domainEvents$.next({
      type: 'presenter-changed',
      presenterEmail: message.current_presenter || null,
    });
  }

  private _handlePresenterCursor(message: PresenterCursorMessage): void {
    this._logger.debug('Presenter cursor update', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      position: message.cursor_position,
    });

    this._domainEvents$.next({
      type: 'presenter-cursor',
      userId: message.user.user_id,
      position: message.cursor_position,
    });
  }

  private _handlePresenterSelection(message: PresenterSelectionMessage): void {
    this._logger.debug('Presenter selection update', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      cellCount: message.selected_cells.length,
    });

    this._domainEvents$.next({
      type: 'presenter-selection',
      userId: message.user.user_id,
      selectedCells: message.selected_cells,
    });
  }

  private _handlePresenterRequest(message: PresenterRequestMessage): void {
    this._logger.info('Presenter request received', {
      userId: message.user.user_id,
      userEmail: message.user.email,
    });

    this._domainEvents$.next({
      type: 'presenter-request',
      userId: message.user.user_id,
    });
  }

  private _handlePresenterDenied(message: PresenterDeniedMessage): void {
    this._logger.info('Presenter request denied', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      targetUser: message.target_user,
    });

    this._domainEvents$.next({
      type: 'presenter-denied',
      userId: message.user.user_id,
      targetUser: message.target_user,
    });
  }

}
