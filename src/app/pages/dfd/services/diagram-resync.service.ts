/**
 * Diagram Resynchronization Service
 *
 * Handles debounced state correction events and performs full diagram
 * resynchronization by fetching the latest diagram data from the server
 * via REST API and updating the local diagram without triggering
 * outbound WebSocket operations.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, timer, of, throwError } from 'rxjs';
import { debounceTime, switchMap, catchError, tap, takeUntil } from 'rxjs/operators';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../core/services/logger.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import { DfdFacadeService } from './dfd-facade.service';
import { DfdStateService } from './dfd-state.service';
import { NodeConfigurationService } from '../infrastructure/services/node-configuration.service';

/**
 * Configuration for resynchronization behavior
 */
export interface ResyncConfig {
  debounceMs: number; // How long to wait before triggering resync
  maxRetries: number; // Maximum number of retry attempts
  retryDelayMs: number; // Delay between retry attempts
}

/**
 * Result of a resynchronization operation
 */
export interface ResyncResult {
  success: boolean;
  error?: string;
  cellsUpdated?: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class DiagramResyncService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _resyncTrigger$ = new Subject<void>();
  private _isResyncInProgress = false;
  private _currentDiagramId: string | null = null;
  private _currentThreatModelId: string | null = null;
  private _currentGraph: Graph | null = null;

  private readonly _config: ResyncConfig = {
    debounceMs: 1000, // 1 second debounce
    maxRetries: 3,
    retryDelayMs: 2000, // 2 seconds between retries
  };

  // Events for external observation
  private readonly _resyncStarted$ = new Subject<void>();
  private readonly _resyncCompleted$ = new Subject<ResyncResult>();

  public readonly resyncStarted$ = this._resyncStarted$.asObservable();
  public readonly resyncCompleted$ = this._resyncCompleted$.asObservable();

  constructor(
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
    private dfdFacadeService: DfdFacadeService,
    private dfdStateService: DfdStateService,
    private nodeConfigurationService: NodeConfigurationService,
  ) {
    this._setupDebouncedResync();
    this.logger.info('DiagramResyncService initialized');
  }

  /**
   * Initialize the service with diagram context
   */
  initialize(diagramId: string, threatModelId: string, graph: Graph): void {
    this._currentDiagramId = diagramId;
    this._currentThreatModelId = threatModelId;
    this._currentGraph = graph;

    this.logger.info('DiagramResyncService initialized with context', {
      diagramId,
      threatModelId,
    });
  }

  /**
   * Trigger a debounced resynchronization
   * Multiple calls within the debounce window will be collapsed into a single resync
   */
  triggerResync(): void {
    if (!this._currentDiagramId || !this._currentThreatModelId || !this._currentGraph) {
      this.logger.warn('Cannot trigger resync - service not properly initialized');
      return;
    }

    this.logger.debug('Resync triggered - will be debounced');
    this._resyncTrigger$.next();
  }

  /**
   * Get current resync configuration
   */
  getConfig(): ResyncConfig {
    return { ...this._config };
  }

  /**
   * Update resync configuration
   */
  updateConfig(config: Partial<ResyncConfig>): void {
    Object.assign(this._config, config);
    this.logger.debug('Resync configuration updated', this._config);
  }

  /**
   * Check if resync is currently in progress
   */
  isResyncInProgress(): boolean {
    return this._isResyncInProgress;
  }

  /**
   * Setup the debounced resync pipeline
   */
  private _setupDebouncedResync(): void {
    this._resyncTrigger$
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(this._config.debounceMs),
        switchMap(() => this._performResyncWithRetries()),
      )
      .subscribe({
        next: result => {
          this.logger.info('Resynchronization completed', result);
          this._resyncCompleted$.next(result);
        },
        error: error => {
          this.logger.error('Resynchronization pipeline error', error);
          this._resyncCompleted$.next({
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });
        },
      });
  }

  /**
   * Perform resynchronization with retry logic
   */
  private _performResyncWithRetries(): Observable<ResyncResult> {
    if (this._isResyncInProgress) {
      this.logger.debug('Resync already in progress, skipping duplicate request');
      return of({
        success: false,
        error: 'Resync already in progress',
        timestamp: Date.now(),
      });
    }

    return this._performResync().pipe(catchError(error => this._retryResync(error, 0)));
  }

  /**
   * Retry resync operation with exponential backoff
   */
  private _retryResync(error: any, attempt: number): Observable<ResyncResult> {
    if (attempt >= this._config.maxRetries) {
      this.logger.error('Resync failed after maximum retries', {
        attempts: attempt,
        error: error.message,
      });
      return of({
        success: false,
        error: `Failed after ${this._config.maxRetries} attempts: ${error.message}`,
        timestamp: Date.now(),
      });
    }

    const delayMs = this._config.retryDelayMs * Math.pow(2, attempt);
    this.logger.warn(`Resync attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
      error: error.message,
    });

    return timer(delayMs).pipe(
      switchMap(() => this._performResync()),
      catchError(retryError => this._retryResync(retryError, attempt + 1)),
    );
  }

  /**
   * Perform the actual resynchronization
   */
  private _performResync(): Observable<ResyncResult> {
    if (!this._currentDiagramId || !this._currentThreatModelId || !this._currentGraph) {
      return throwError(() => new Error('Resync service not properly initialized'));
    }

    this._isResyncInProgress = true;
    this._resyncStarted$.next();

    this.logger.info('Starting diagram resynchronization', {
      diagramId: this._currentDiagramId,
      threatModelId: this._currentThreatModelId,
    });

    // Fetch the latest diagram data from the server
    return this.threatModelService
      .getDiagramById(this._currentThreatModelId, this._currentDiagramId)
      .pipe(
        switchMap(diagram => {
          if (!diagram) {
            throw new Error(`Diagram ${this._currentDiagramId} not found`);
          }

          this.logger.info('Fetched latest diagram data from server', {
            diagramName: diagram.name,
            cellCount: diagram.cells?.length || 0,
          });

          return this._updateLocalDiagram(diagram);
        }),
        tap(() => {
          // Mark resync as complete in the state service
          this.dfdStateService.resyncComplete();
        }),
        catchError(error => {
          this.logger.error('Resync operation failed', error);
          throw error;
        }),
        tap({
          finalize: () => {
            this._isResyncInProgress = false;
          },
        }),
      );
  }

  /**
   * Update the local diagram with fetched data without triggering WebSocket operations
   */
  private _updateLocalDiagram(diagram: any): Observable<ResyncResult> {
    return new Observable<ResyncResult>(observer => {
      try {
        if (!this._currentGraph) {
          throw new Error('Graph reference not available');
        }

        const graph = this._currentGraph;
        const cells = diagram.cells || [];

        this.logger.info('Updating local diagram with server data', {
          cellCount: cells.length,
          diagramName: diagram.name,
        });

        // Set flag to prevent triggering outbound operations
        this.dfdStateService.setApplyingRemoteChange(true);

        try {
          // Use the facade service's batch loading mechanism
          // This will handle proper conversion and loading without triggering history/collaboration
          this.dfdFacadeService.loadDiagramCellsBatch(
            cells,
            graph,
            this._currentDiagramId!,
            this.nodeConfigurationService,
          );

          const result: ResyncResult = {
            success: true,
            cellsUpdated: cells.length,
            timestamp: Date.now(),
          };

          this.logger.info('Local diagram updated successfully', result);
          observer.next(result);
          observer.complete();
        } catch (updateError) {
          this.logger.error('Error updating local diagram', updateError);
          observer.error(updateError);
        } finally {
          // Always clear the flag
          this.dfdStateService.setApplyingRemoteChange(false);
        }
      } catch (error) {
        this.logger.error('Error in updateLocalDiagram', error);
        observer.error(error);
      }
    });
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this._currentDiagramId = null;
    this._currentThreatModelId = null;
    this._currentGraph = null;
    this._isResyncInProgress = false;
    this.logger.debug('DiagramResyncService reset');
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this.logger.info('Destroying DiagramResyncService');
    this._destroy$.next();
    this._destroy$.complete();
  }
}
