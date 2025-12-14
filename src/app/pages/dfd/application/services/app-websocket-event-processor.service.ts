/**
 * AppWebSocketEventProcessor - Processes WebSocket events and emits application-level events
 *
 * This service is responsible for:
 * - Subscribing to WebSocket domain events
 * - Processing and filtering incoming events
 * - Emitting processed events for application layer consumption
 *
 * Extracted from AppStateService to reduce complexity and improve maintainability.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import {
  CellOperation,
  Cell as WSCell,
  DiagramOperationMessage,
} from '../../../../core/types/websocket-message.types';
import {
  InfraDfdWebsocketAdapter,
  StateCorrectionEvent,
  DiagramStateSyncEvent,
  HistoryOperationEvent,
  ResyncRequestedEvent,
  ParticipantsUpdatedEvent,
} from '../../infrastructure/adapters/infra-dfd-websocket.adapter';

/**
 * Processed event types emitted to application layer
 */
export interface ProcessedDiagramOperation {
  userId: string;
  operationId: string;
  operations: CellOperation[];
}

export interface ProcessedStateCorrection {
  updateVector: number;
}

export interface ProcessedDiagramSync {
  diagramId: string;
  updateVector: number | null;
  cells: WSCell[];
}

export interface ProcessedHistoryOperation {
  requiresResync: boolean;
}

export interface ProcessedResyncRequest {
  method: string;
}

export interface ProcessedParticipantsUpdate {
  participants: any[];
  host: any;
  currentPresenter: any;
}

@Injectable()
export class AppWebSocketEventProcessor implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  // Processed event streams
  private readonly _diagramOperation$ = new Subject<ProcessedDiagramOperation>();
  private readonly _stateCorrection$ = new Subject<ProcessedStateCorrection>();
  private readonly _diagramSync$ = new Subject<ProcessedDiagramSync>();
  private readonly _historyOperation$ = new Subject<ProcessedHistoryOperation>();
  private readonly _resyncRequest$ = new Subject<ProcessedResyncRequest>();
  private readonly _participantsUpdate$ = new Subject<ProcessedParticipantsUpdate>();

  public readonly diagramOperations$ = this._diagramOperation$.asObservable();
  public readonly stateCorrections$ = this._stateCorrection$.asObservable();
  public readonly diagramSyncs$ = this._diagramSync$.asObservable();
  public readonly historyOperations$ = this._historyOperation$.asObservable();
  public readonly resyncRequests$ = this._resyncRequest$.asObservable();
  public readonly participantsUpdates$ = this._participantsUpdate$.asObservable();

  constructor(
    private _logger: LoggerService,
    private _webSocketService: InfraDfdWebsocketAdapter,
    private _collaborationService: DfdCollaborationService,
  ) {}

  /**
   * Initialize event processing subscriptions
   */
  initialize(): void {
    this._subscriptions.add(
      this._webSocketService.diagramOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(message => this._processDiagramOperation(message)),
    );

    this._subscriptions.add(
      this._webSocketService.stateCorrections$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processStateCorrection(event)),
    );

    this._subscriptions.add(
      this._webSocketService.diagramStateSyncs$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processDiagramStateSync(event)),
    );

    this._subscriptions.add(
      this._webSocketService.historyOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processHistoryOperation(event)),
    );

    this._subscriptions.add(
      this._webSocketService.resyncRequests$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processResyncRequest(event)),
    );

    this._subscriptions.add(
      this._webSocketService.participantsUpdated$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._processParticipantsUpdate(event)),
    );
  }

  /**
   * Process diagram operation from another user
   */
  private _processDiagramOperation(message: DiagramOperationMessage): void {
    // Skip our own operations
    const currentUserEmail = this._collaborationService.getCurrentUserEmail();
    if (message.initiating_user.email === currentUserEmail) {
      this._logger.debugComponent('AppWebSocketEventProcessor', 'Skipping own operation', {
        operationId: message.operation_id,
      });
      return;
    }

    const userId = message.initiating_user.email || 'unknown';

    this._logger.info('Processing remote diagram operation', {
      userId,
      operationId: message.operation_id,
      operationType: message.operation?.type,
      cellCount: message.operation?.cells?.length || 0,
    });

    if (message.operation?.cells && message.operation.cells.length > 0) {
      this._diagramOperation$.next({
        userId,
        operationId: message.operation_id,
        operations: message.operation.cells,
      });
    }
  }

  /**
   * Process state correction event
   */
  private _processStateCorrection(event: StateCorrectionEvent): void {
    this._logger.warn('Processing state correction', {
      serverUpdateVector: event.update_vector,
    });

    this._stateCorrection$.next({
      updateVector: event.update_vector,
    });
  }

  /**
   * Process diagram state sync event
   */
  private _processDiagramStateSync(event: DiagramStateSyncEvent): void {
    this._logger.info('Processing diagram state sync', {
      diagramId: event.diagram_id,
      serverUpdateVector: event.update_vector,
      cellCount: event.cells.length,
    });

    this._diagramSync$.next({
      diagramId: event.diagram_id,
      updateVector: event.update_vector,
      cells: event.cells,
    });
  }

  /**
   * Process history operation event
   */
  private _processHistoryOperation(event: HistoryOperationEvent): void {
    this._logger.debugComponent(
      'AppWebSocketEventProcessor',
      'Processing history operation',
      event,
    );

    this._historyOperation$.next({
      requiresResync: event.message === 'resync_required',
    });
  }

  /**
   * Process resync request event
   */
  private _processResyncRequest(event: ResyncRequestedEvent): void {
    this._logger.info('Processing resync request', { method: event.method });

    this._resyncRequest$.next({
      method: event.method,
    });
  }

  /**
   * Process participants update event
   */
  private _processParticipantsUpdate(event: ParticipantsUpdatedEvent): void {
    this._logger.debugComponent('AppWebSocketEventProcessor', 'Processing participants update', {
      participantCount: event.participants?.length,
      host: event.host,
      currentPresenter: event.currentPresenter,
    });

    this._participantsUpdate$.next({
      participants: event.participants,
      host: event.host,
      currentPresenter: event.currentPresenter,
    });
  }

  ngOnDestroy(): void {
    this._logger.info('Destroying AppWebSocketEventProcessor');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }
}
