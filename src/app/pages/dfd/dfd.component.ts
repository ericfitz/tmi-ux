/**
 * Data Flow Diagram (DFD) Component
 *
 * This is the main component for the Data Flow Diagram editor page.
 * It provides a comprehensive diagram editing environment using the X6 graph library.
 *
 * Key functionality:
 * - Renders interactive data flow diagrams with nodes (actors, processes, stores) and edges
 * - Supports real-time collaboration with multiple users via WebSocket integration
 * - Provides comprehensive toolbar with node creation, editing, and export tools
 * - Implements context menu for cell-specific operations (delete, edit, add threats)
 * - Manages diagram loading from threat models with proper history suppression
 * - Handles keyboard shortcuts for common operations (delete, undo, redo)
 * - Supports drag-and-drop node creation and edge connection validation
 * - Provides port visibility management and visual feedback systems
 * - Implements z-order operations for layering control
 * - Handles window resize events for responsive graph sizing
 * - Manages authentication and access control for diagram operations
 * - Supports metadata editing and threat association for diagram elements
 * - Provides export functionality for multiple formats (PNG, JPG, SVG)
 */

import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Edge } from '@antv/x6';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { NodeType } from './domain/value-objects/node-info';
import { getX6ShapeForNodeType } from './infrastructure/adapters/x6-shape-definitions';
import { NodeConfigurationService } from './infrastructure/services/node-configuration.service';
import { X6GraphAdapter } from './infrastructure/adapters/x6-graph.adapter';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';
import { CollaborativeOperationService } from './services/collaborative-operation.service';
import { WebSocketService } from './services/websocket.service';
import { DfdStateService } from './services/dfd-state.service';
import { DfdStateStore } from './state/dfd.state';
import { CellOperation, Cell as WSCell } from '../../core/types/websocket-message.types';

// Import providers needed for standalone component
import { EdgeQueryService } from './infrastructure/services/edge-query.service';
import { EdgeService } from './infrastructure/services/edge.service';
import { X6KeyboardHandler } from './infrastructure/adapters/x6-keyboard-handler.service';
import { X6ZOrderAdapter } from './infrastructure/adapters/x6-z-order.adapter';
import { X6EmbeddingAdapter } from './infrastructure/adapters/x6-embedding.adapter';
import { X6HistoryManager } from './infrastructure/adapters/x6-history-manager.service';
import { EmbeddingService } from './infrastructure/services/embedding.service';

// Import the facade service and remaining infrastructure
import { DfdFacadeService } from './services/dfd-facade.service';
import { DfdNodeService } from './infrastructure/services/node.service';
import { DfdEdgeService } from './services/dfd-edge.service';
import { DfdEventHandlersService } from './services/dfd-event-handlers.service';
import { DfdExportService } from './services/dfd-export.service';
import { X6EventLoggerService } from './infrastructure/adapters/x6-event-logger.service';
import { DfdDiagramService } from './services/dfd-diagram.service';
import { DfdTooltipService } from './services/dfd-tooltip.service';
import { X6TooltipAdapter } from './infrastructure/adapters/x6-tooltip.adapter';
import { GraphHistoryCoordinator } from './services/graph-history-coordinator.service';
import { DiagramOperationBroadcaster } from './services/diagram-operation-broadcaster.service';
import { X6SelectionAdapter } from './infrastructure/adapters/x6-selection.adapter';
import { PresenterCursorService } from './services/presenter-cursor.service';
import { PresenterCursorDisplayService } from './services/presenter-cursor-display.service';
import { PresenterSelectionService } from './services/presenter-selection.service';
import { PresenterCoordinatorService } from './services/presenter-coordinator.service';
import { ThreatModelService } from '../tm/services/threat-model.service';
import { MatDialog } from '@angular/material/dialog';
import { DfdCollaborationService } from '../../core/services/dfd-collaboration.service';
import { DfdNotificationService } from './services/dfd-notification.service';
import { DiagramResyncService } from './services/diagram-resync.service';
import { DiagramLoadingService } from './services/diagram-loading.service';
import { COLLABORATION_NOTIFICATION_SERVICE } from '../../core/interfaces/collaboration-notification.interface';
import { ThreatModelAuthorizationService } from '../tm/services/threat-model-authorization.service';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../tm/components/metadata-dialog/metadata-dialog.component';
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../tm/components/threats-dialog/threats-dialog.component';
import { CellDataExtractionService } from '../../shared/services/cell-data-extraction.service';
import {
  X6HistoryDialogComponent,
  X6HistoryDialogData,
} from './components/x6-history-dialog/x6-history-dialog.component';
import { Metadata } from '../tm/models/threat-model.model';

type ExportFormat = 'png' | 'jpeg' | 'svg';

@Component({
  selector: 'app-dfd',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatMenuModule,
    MatTooltipModule,
    TranslocoModule,
    DfdCollaborationComponent,
  ],
  providers: [
    // Infrastructure adapters
    X6GraphAdapter,
    EdgeQueryService,
    EdgeService,
    NodeConfigurationService,
    X6KeyboardHandler,
    X6ZOrderAdapter,
    X6EmbeddingAdapter,
    X6HistoryManager,
    X6TooltipAdapter,
    X6SelectionAdapter,

    // Infrastructure services
    EmbeddingService,

    // History coordination
    GraphHistoryCoordinator,

    // Collaborative operation broadcasting
    DiagramOperationBroadcaster,

    // New consolidated services
    DfdNodeService,
    DfdEdgeService,
    DfdEventHandlersService,
    DfdExportService,
    DfdDiagramService,
    DfdTooltipService,
    WebSocketService,
    DfdStateService,
    DiagramResyncService,
    DiagramLoadingService,

    // Facade service
    DfdFacadeService,

    // X6 Event Logger
    X6EventLoggerService,

    // Provide DfdNotificationService as implementation of collaboration notification interface
    {
      provide: COLLABORATION_NOTIFICATION_SERVICE,
      useClass: DfdNotificationService,
    },

    // Presenter mode services
    PresenterCursorService,
    PresenterCursorDisplayService,
    PresenterSelectionService,
    PresenterCoordinatorService,
  ],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;
  @ViewChild('contextMenuTrigger') contextMenuTrigger!: MatMenuTrigger;

  private _observer: MutationObserver | null = null;
  private _subscriptions = new Subscription();
  private _resizeTimeout: number | null = null;
  // Graph initialization is now tracked in x6GraphAdapter via isInitialized()
  private _isDestroying = false;

  // Collaborative editing state
  private isApplyingRemoteChange = false;
  private _webSocketHandlersInitialized = false;
  isReadOnlyMode = false;

  // Route parameters
  threatModelId: string | null = null;
  dfdId: string | null = null;

  // Diagram data
  diagramName: string | null = null;
  threatModelName: string | null = null;
  threatModelPermission: 'reader' | 'writer' | null = null;
  private pendingDiagramCells: any[] | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;
  selectedCellIsSecurityBoundary = false;

  // Undo/redo state properties - updated by X6 history addon
  canUndo = false;
  canRedo = false;

  // Private properties to track previous undo/redo states
  private _previousCanUndo = false;
  private _previousCanRedo = false;

  // Expose context menu position from facade service
  get contextMenuPosition(): { x: string; y: string } {
    return this.facade.contextMenuPosition;
  }

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private x6GraphAdapter: X6GraphAdapter,
    private route: ActivatedRoute,
    private facade: DfdFacadeService,
    private tooltipAdapter: X6TooltipAdapter,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private nodeConfigurationService: NodeConfigurationService,
    private translocoService: TranslocoService,
    private collaborativeOperationService: CollaborativeOperationService,
    private webSocketService: WebSocketService,
    private dfdStateService: DfdStateService,
    private dfdStateStore: DfdStateStore,
    private collaborationService: DfdCollaborationService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
    private notificationService: DfdNotificationService,
    private presenterCoordinatorService: PresenterCoordinatorService,
    private x6SelectionAdapter: X6SelectionAdapter,
    private diagramResyncService: DiagramResyncService,
    private diagramLoadingService: DiagramLoadingService,
  ) {
    this.logger.info('DfdComponent constructor called');

    // Initialize X6 cell extensions first
    this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();
  }

  ngOnInit(): void {
    this.logger.info('DfdComponent ngOnInit called');

    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id');
    this.dfdId = this.route.snapshot.paramMap.get('dfdId');

    this.logger.info('DFD Component route parameters extracted', {
      threatModelId: this.threatModelId,
      dfdId: this.dfdId,
      allParams: this.route.snapshot.paramMap.keys,
    });

    // Set collaboration context if we have the required parameters
    if (this.threatModelId && this.dfdId) {
      this.logger.info('Setting collaboration context', {
        threatModelId: this.threatModelId,
        dfdId: this.dfdId,
      });
      this.collaborationService.setDiagramContext(this.threatModelId, this.dfdId);

      // Check for existing collaboration session on startup
      this.collaborationService
        .checkForExistingSession()
        .pipe(take(1))
        .subscribe({
          next: existingSession => {
            if (existingSession) {
              this.logger.info('Found existing collaboration session on startup', {
                sessionId: existingSession.session_id,
                host: existingSession.host,
                isCurrentUserManager:
                  this.collaborationService.isCurrentUserManagerOfExistingSession(),
              });
            }

            // Check for collaboration join request after session check completes
            this.handleJoinCollaborationQueryParam();
          },
          error: error => {
            this.logger.warn('Failed to check for existing session on startup', error);
            // Still try to handle join collaboration in case of error
            this.handleJoinCollaborationQueryParam();
          },
        });
    } else {
      this.logger.warn('Cannot set collaboration context - missing required parameters', {
        threatModelId: this.threatModelId,
        dfdId: this.dfdId,
        url: this.route.snapshot.url,
        queryParams: this.route.snapshot.queryParams,
      });
    }

    // Get threat model from route resolver
    const threatModel = this.route.snapshot.data['threatModel'];
    if (threatModel) {
      this.threatModelName = threatModel.name;
      // The authorization context is already set by the resolver
      // Subscribe to authorization updates
      this._subscriptions.add(
        this.authorizationService.currentUserPermission$.subscribe(permission => {
          this.threatModelPermission = permission === 'owner' ? 'writer' : permission;
          this.isReadOnlyMode = permission === 'reader' || permission === null;

          this.logger.info('DFD Component permission updated', {
            threatModelId: this.threatModelId,
            permission: this.threatModelPermission,
            isReadOnly: this.isReadOnlyMode,
          });

          // Update the collaboration service with new permissions
          if (this.collaborationService && this.threatModelId && this.dfdId) {
            this.collaborationService.setDiagramContext(this.threatModelId, this.dfdId);
          }

          this.cdr.markForCheck();
        }),
      );
    }

    // Load diagram data if we have a dfdId
    if (this.dfdId) {
      this.loadDiagramData(this.dfdId);
    }

    // Join collaboration logic moved to handleJoinCollaborationQueryParam() method
    // which is called after checkForExistingSession() completes

    // Initialize event handlers
    this.facade.initializeEventHandlers(this.x6GraphAdapter);

    // Initialize permission-based UI state
    this.initializePermissions();

    // Subscribe to context menu events from X6GraphAdapter
    this._subscriptions.add(
      this.x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }) => {
        // Direct call to event handlers for component-specific UI operations
        // This is acceptable since it involves component-specific parameters (MatMenuTrigger, ChangeDetectorRef)
        // that shouldn't be exposed through the facade
        this.facade.openCellContextMenu(cell, x, y, this.contextMenuTrigger, this.cdr);
      }),
    );

    // Subscribe to selection state changes from facade
    this._subscriptions.add(
      this.facade.selectedCells$.subscribe(selectedCells => {
        this.hasSelectedCells = selectedCells.length > 0;
        this.hasExactlyOneSelectedCell = selectedCells.length === 1;
        this.selectedCellIsTextBox = selectedCells.some(cell => cell.shape === 'text-box');
        this.selectedCellIsSecurityBoundary = selectedCells.some(
          cell => cell.shape === 'security-boundary',
        );
        this.cdr.markForCheck();
      }),
    );

    // Subscribe to history state changes for undo/redo button states
    this._subscriptions.add(
      this.x6GraphAdapter.historyChanged$.subscribe(({ canUndo, canRedo }) => {
        // Only emit and log if the state has actually changed
        if (canUndo !== this._previousCanUndo || canRedo !== this._previousCanRedo) {
          this.canUndo = canUndo;
          this.canRedo = canRedo;

          // Update previous state tracking
          this._previousCanUndo = canUndo;
          this._previousCanRedo = canRedo;

          this.cdr.markForCheck();
        }
      }),
    );

    // Subscribe to collaboration state changes to initialize collaborative operations
    this._subscriptions.add(
      this.collaborationService.isCollaborating$.subscribe(isCollaborating => {
        // Update history tracking based on collaboration state
        // In collaboration mode, history is managed by the server
        // Only set history state if graph is initialized
        if (this.x6GraphAdapter.isInitialized()) {
          this.x6GraphAdapter.setHistoryEnabled(!isCollaborating);
        }

        if (isCollaborating && this.threatModelId && this.dfdId) {
          // Initialize collaborative operation service when collaboration starts
          const currentUserEmail = this.collaborationService.getCurrentUserEmail();
          if (currentUserEmail) {
            this.collaborativeOperationService.initialize({
              diagramId: this.dfdId,
              threatModelId: this.threatModelId,
              userId: currentUserEmail,
              threatModelPermission: this.threatModelPermission || undefined,
            });
            this.logger.info('Initialized CollaborativeOperationService for active collaboration', {
              diagramId: this.dfdId,
              threatModelId: this.threatModelId,
              userId: currentUserEmail,
            });
          }

          // Initialize WebSocket handlers only when collaboration is active and not already initialized
          if (!this._webSocketHandlersInitialized) {
            this.initializeWebSocketHandlers();
            this._webSocketHandlersInitialized = true;
          }

          // Re-initialize diagram operation broadcaster for collaborative editing
          if (this.x6GraphAdapter.isInitialized()) {
            const broadcaster = this.x6GraphAdapter.getDiagramOperationBroadcaster();
            broadcaster.initializeListeners(this.x6GraphAdapter.getGraph());
            this.logger.info('Re-initialized DiagramOperationBroadcaster for collaboration');
          }
        }
      }),
    );

    // Subscribe to actual history modifications for auto-save
    this._subscriptions.add(
      this.x6GraphAdapter.historyModified$.subscribe({
        next: () => {
          this.logger.info('DFD Component received history modification event');

          // Auto-save diagram when history is actually modified
          if (this.x6GraphAdapter.isInitialized() && this.dfdId && this.threatModelId) {
            this.logger.info('Triggering auto-save after history modification', {
              dfdId: this.dfdId,
              threatModelId: this.threatModelId,
            });
            this.autoSaveDiagram('History modified');
          } else {
            this.logger.warn('Cannot auto-save: missing requirements', {
              isInitialized: this.x6GraphAdapter.isInitialized(),
              dfdId: this.dfdId,
              threatModelId: this.threatModelId,
            });
          }
        },
        error: error => {
          this.logger.error('Error in history modification subscription', error);
        },
      }),
    );

    // Subscribe to edge creation events
    this._subscriptions.add(
      this.x6GraphAdapter.edgeAdded$.subscribe(edge => {
        this.handleEdgeAdded(edge);
      }),
    );

    // Subscribe to edge vertices changes
    this._subscriptions.add(
      this.x6GraphAdapter.edgeVerticesChanged$.subscribe(({ edgeId, vertices }) => {
        this.handleEdgeVerticesChanged(edgeId, vertices);
      }),
    );

    // Subscribe to cell data changes (metadata changes) for auto-save
    this._subscriptions.add(
      this.x6GraphAdapter.nodeInfoChanged$.subscribe(({ nodeId, newData, oldData }) => {
        this.logger.info('Cell metadata changed, auto-saving diagram', {
          nodeId,
          hasNewData: !!newData,
          hasOldData: !!oldData,
        });
        this.autoSaveDiagram('Cell metadata changed');
      }),
    );

    // Subscribe to threat changes for auto-save
    this._subscriptions.add(
      this.facade.threatChanged$.subscribe(({ action, threatId, diagramId }) => {
        this.logger.info('Threat changed, auto-saving diagram', {
          action,
          threatId,
          diagramId,
        });
        this.autoSaveDiagram(`Threat ${action}`);
      }),
    );

    // WebSocket handlers will be initialized when collaboration becomes active
  }

  /**
   * Initialize WebSocket message handlers for collaborative editing
   * Only called when collaboration is active
   */
  private initializeWebSocketHandlers(): void {
    this.logger.info('Initializing WebSocket handlers for collaborative editing');

    // Initialize all TMI message handlers

    // Initialize WebSocket and state services
    this.webSocketService.initialize();
    this.dfdStateService.initialize();

    // Subscribe to state service events for operations that need to be applied to the graph
    this._subscriptions.add(
      this.dfdStateService.applyOperationEvents$.subscribe({
        next: event => this.applyRemoteOperation(event.operation, event.userId, event.operationId),
        error: error => this.logger.error('Error handling apply operation event', error),
      }),
    );

    this._subscriptions.add(
      this.dfdStateService.applyCorrectionEvents$.subscribe({
        next: cells => this.applyCorrectedState(cells),
        error: error => this.logger.error('Error handling apply correction event', error),
      }),
    );

    this._subscriptions.add(
      this.dfdStateService.requestResyncEvents$.subscribe({
        next: event => {
          if (event.method === 'rest_api') {
            void this.performRESTResync();
          }
        },
        error: error => this.logger.error('Error handling resync request event', error),
      }),
    );

    this._subscriptions.add(
      this.dfdStateService.triggerResyncEvents$.subscribe({
        next: () => {
          this.diagramResyncService.triggerResync();
        },
        error: error => this.logger.error('Error handling trigger resync event', error),
      }),
    );

    // Subscribe to WebSocket domain events for UI updates
    this._subscriptions.add(
      this.webSocketService.authorizationDenied$.subscribe({
        next: event => this.showAuthorizationDeniedNotification(event.reason),
        error: error => this.logger.error('Error handling authorization denied', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.historyOperations$.subscribe({
        next: event => this.handleHistoryOperationEvent(event),
        error: error => this.logger.error('Error handling history operation', error),
      }),
    );

    // Subscribe to presenter events for UI updates
    this._subscriptions.add(
      this.webSocketService.presenterChanges$.subscribe({
        next: event => this.handlePresenterChange(event.presenterEmail),
        error: error => this.logger.error('Error handling presenter change', error),
      }),
    );

    // Subscribe to session end events to force resync
    this._subscriptions.add(
      this.collaborationService.sessionEnded$.subscribe({
        next: event => {
          this.logger.info('Collaboration session ended', { reason: event.reason });
          // Only force resync if session ended unexpectedly (not when user intentionally left)
          if (event.reason !== 'user_ended') {
            this.logger.info('Forcing resync due to unexpected session end');
            void this.performRESTResync();
          }
        },
        error: error => this.logger.error('Error handling session end event', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.presenterCursors$.subscribe({
        next: event => this.showPresenterCursor(event.userId, event.position),
        error: error => this.logger.error('Error handling presenter cursor', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.presenterSelections$.subscribe({
        next: event => this.showPresenterSelection(event.userId, event.selectedCells),
        error: error => this.logger.error('Error handling presenter selection', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.presenterRequests$.subscribe({
        next: event => this.handlePresenterRequestEvent(event.userId),
        error: error => this.logger.error('Error handling presenter request', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.presenterDenials$.subscribe({
        next: event => this.handlePresenterDenialEvent(event.userId, event.targetUser),
        error: error => this.logger.error('Error handling presenter denial', error),
      }),
    );

    this._subscriptions.add(
      this.webSocketService.presenterUpdates$.subscribe({
        next: event => this.handlePresenterUpdateEvent(event.presenterEmail),
        error: error => this.logger.error('Error handling presenter update', error),
      }),
    );

    // Subscribe to state changes for UI updates
    this._subscriptions.add(
      this.dfdStateService.isApplyingRemoteChange$.subscribe({
        next: isApplying => {
          this.isApplyingRemoteChange = isApplying;
        },
        error: error => this.logger.error('Error handling remote change state', error),
      }),
    );

    this.logger.info('WebSocket message handlers initialized');
  }

  /**
   * Update read-only mode based on current user permissions and presenter status
   */
  private updateReadOnlyMode(): void {
    if (!this.collaborationService.isCollaborating()) {
      // Not collaborating, use threat model permission
      this.isReadOnlyMode = this.threatModelPermission === 'reader';
    } else {
      // In collaboration: read-only unless user has edit permissions or is presenter
      const hasEditPermission = this.collaborationService.hasPermission('edit');
      const isPresenter = this.collaborationService.isCurrentUserPresenter();
      this.isReadOnlyMode = !hasEditPermission && !isPresenter;

      // Verify collaboration permission matches threat model permission
      const collaborationPermission = this.collaborationService.getCurrentUserPermission();
      if (
        collaborationPermission &&
        this.threatModelPermission &&
        collaborationPermission !== this.threatModelPermission
      ) {
        this.logger.error('Collaboration permission does not match threat model permission', {
          threatModelPermission: this.threatModelPermission,
          collaborationPermission: collaborationPermission,
        });
      }
    }

    // Apply read-only mode to graph if initialized
    if (this.x6GraphAdapter.isInitialized()) {
      this.x6GraphAdapter.setReadOnlyMode(this.isReadOnlyMode);
    }

    this.logger.info('Read-only mode updated', {
      isReadOnlyMode: this.isReadOnlyMode,
      threatModelPermission: this.threatModelPermission,
      isCollaborating: this.collaborationService.isCollaborating(),
      hasEditPermission: this.collaborationService.hasPermission('edit'),
      isPresenter: this.collaborationService.isCurrentUserPresenter(),
    });
  }

  /**
   * Initialize permission-based UI state and read-only mode
   */
  private initializePermissions(): void {
    // Permissions are now handled by the authorization service subscription in ngOnInit
    // This method is kept for backward compatibility but can be removed in the future
    this.cdr.markForCheck();
  }

  /**
   * Loads the diagram data for the given diagram ID using the diagram service
   */
  private loadDiagramData(diagramId: string): void {
    if (!this.threatModelId) {
      this.logger.error('Cannot load diagram data: threat model ID is required');
      return;
    }

    this.logger.info('Loading diagram data', { diagramId, threatModelId: this.threatModelId });

    this._subscriptions.add(
      this.facade.loadDiagram(diagramId, this.threatModelId).subscribe({
        next: result => {
          this.logger.info('Diagram data loaded', {
            success: result.success,
            hasDiagram: !!result.diagram,
            diagramName: result.diagram?.name,
            cellCount: result.diagram?.cells?.length || 0,
          });

          if (result.success && result.diagram) {
            this.diagramName = result.diagram.name;

            // Initialize the resync service with diagram context
            if (this.x6GraphAdapter.isInitialized()) {
              this.diagramResyncService.initialize(
                this.dfdId || 'default-diagram',
                this.threatModelId || '',
                this.x6GraphAdapter.getGraph(),
                this.x6GraphAdapter,
              );
              this.logger.info('DiagramResyncService initialized with context');
            }

            // Load the diagram cells into the graph if available
            if (result.diagram.cells && result.diagram.cells.length > 0) {
              this.logger.info('Found diagram cells to load', {
                cellCount: result.diagram.cells.length,
                isInitialized: this.x6GraphAdapter.isInitialized(),
              });

              if (this.x6GraphAdapter.isInitialized()) {
                this.logger.info('Graph is initialized - loading cells immediately');
                this.loadDiagramCells(result.diagram.cells);
              } else {
                this.logger.info('Graph not yet initialized - storing cells as pending');
                // Store cells to load after graph is initialized
                this.pendingDiagramCells = result.diagram.cells;
              }
            } else {
              this.logger.info('No diagram cells to load');
            }

            this.cdr.markForCheck();
          } else {
            this.logger.warn('Diagram loading failed or diagram not found', result);
            // Handle diagram not found
            this.facade.closeDiagram(this.threatModelId, this.dfdId);
          }
        },
        error: error => {
          this.logger.error('Error loading diagram data', error);
          this.facade.closeDiagram(this.threatModelId, this.dfdId);
        },
      }),
    );
  }

  ngAfterViewInit(): void {
    // Initialize the graph after the view is fully initialized
    this.initializeGraph();

    // Ensure Roboto Condensed font is loaded
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&display=swap';
    document.head.appendChild(fontLink);
  }

  ngOnDestroy(): void {
    // Mark component as destroying to prevent any async operations
    this._isDestroying = true;

    // Skip saving on destroy since we already save manually in closeDiagram()
    // This prevents overwriting with empty graph after disposal
    this.logger.info(
      'Skipping diagram save on destroy - manual save already performed in closeDiagram()',
    );

    // Clear collaboration context when leaving the DFD editor
    this.collaborationService.clearDiagramContext();

    // Disconnect the mutation observer
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    // Clear any pending resize timeout
    if (this._resizeTimeout) {
      window.clearTimeout(this._resizeTimeout);
      this._resizeTimeout = null;
    }

    // Dispose event handlers through facade
    this.facade.disposeEventHandlers();

    // Dispose tooltip adapter
    this.tooltipAdapter.dispose();

    // Cleanup presenter coordinator
    this.presenterCoordinatorService.cleanupPresenterDisplay();

    // Unsubscribe from all subscriptions
    this._subscriptions.unsubscribe();

    // Dispose the graph adapter
    this.x6GraphAdapter.dispose();
  }

  /**
   * Get localized shape name from the raw shape string
   */
  private getLocalizedShapeName(rawShape: string): string {
    // Map node type identifiers to localization keys
    const shapeKeyMap: { [key: string]: string } = {
      actor: 'editor.nodeLabels.actor',
      process: 'editor.nodeLabels.process',
      store: 'editor.nodeLabels.store',
      'security-boundary': 'editor.nodeLabels.securityBoundary',
      'text-box': 'editor.nodeLabels.textbox',
      textbox: 'editor.nodeLabels.textbox', // Alternative form
      // Legacy support for display names (in case some places still use them)
      'External Entity': 'editor.nodeLabels.actor',
      Process: 'editor.nodeLabels.process',
      'Data Store': 'editor.nodeLabels.store',
      'Trust Boundary': 'editor.nodeLabels.securityBoundary',
      Text: 'editor.nodeLabels.textbox',
    };

    const localizationKey = shapeKeyMap[rawShape];
    if (localizationKey) {
      return this.translocoService.translate(localizationKey);
    }

    // Fallback to raw shape name if no mapping found
    return rawShape;
  }

  /**
   * Handle window resize events to update the graph size
   */
  @HostListener('window:resize')
  onWindowResize(): void {
    this._resizeTimeout = this.facade.onWindowResize(
      this.graphContainer,
      this._resizeTimeout,
      this.x6GraphAdapter,
    );
  }

  /**
   * Handle keyboard events for delete functionality and undo/redo
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    this.facade.onKeyDown(
      event,
      this.dfdId || 'default-diagram',
      this.x6GraphAdapter.isInitialized(),
      this.x6GraphAdapter,
    );
  }

  /**
   * Method to add a node at a predictable position
   */
  addGraphNode(shapeType: NodeType = 'actor'): void {
    const container = this.graphContainer.nativeElement as HTMLElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.facade
      .addGraphNode(
        shapeType,
        width,
        height,
        this.dfdId || 'default-diagram',
        this.x6GraphAdapter.isInitialized(),
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.detectChanges();
        },
        error: error => {
          this.logger.error('Error adding node', error);
        },
      });
  }

  /**
   * Initialize the X6 graph and related systems
   */
  private initializeGraph(): void {
    this.logger.info('DfdComponent initializeGraph called');

    try {
      const container = this.graphContainer.nativeElement as HTMLElement;

      // Initialize the graph using X6GraphAdapter (delegates all X6-specific setup)
      this.x6GraphAdapter.initialize(container);

      // Get the initialized graph for other adapters
      const graph = this.x6GraphAdapter.getGraph();

      // Set up additional systems that depend on the graph
      this.setupDomObservation();
      this.tooltipAdapter.initialize(graph);

      // Initialize presenter coordinator for presenter mode functionality
      this.presenterCoordinatorService.initialize(container, graph, this.x6SelectionAdapter);

      this.logger.info('Graph initialization complete');

      // Initialize history tracking based on current collaboration state
      const isCollaborating = this.collaborationService.isCollaborating();
      this.x6GraphAdapter.setHistoryEnabled(!isCollaborating);

      // Apply read-only mode if user lacks edit permissions
      this.initializePermissions();

      // Load any pending diagram cells
      if (this.pendingDiagramCells) {
        this.logger.info('Loading pending diagram cells after graph initialization', {
          cellCount: this.pendingDiagramCells.length,
        });
        this.loadDiagramCells(this.pendingDiagramCells);
        this.pendingDiagramCells = null;
      } else {
        this.logger.info('No pending diagram cells to load');
      }

      this.cdr.detectChanges();
    } catch (error) {
      this.logger.error('Error initializing graph', error);
    }
  }

  /**
   * Load diagram cells into the graph with proper history suppression and port visibility management
   */
  private loadDiagramCells(cells: any[]): void {
    if (!this.x6GraphAdapter.isInitialized()) {
      this.logger.error('Cannot load diagram cells: graph not initialized');
      return;
    }

    try {
      const graph = this.x6GraphAdapter.getGraph();

      // Use the shared diagram loading service for consistent cell loading
      this.diagramLoadingService.loadCellsIntoGraph(
        cells,
        graph,
        this.dfdId || 'default-diagram',
        this.x6GraphAdapter,
        {
          clearExisting: false, // Don't clear for initial load (graph should be empty)
          suppressHistory: true, // Don't create history entries during initial load
          updateEmbedding: true, // Update embedding appearances
          source: 'initial-load', // Mark source for logging
        },
      );

      this.cdr.markForCheck();
    } catch (error) {
      this.logger.error('Error loading diagram cells', error);
    }
  }

  /**
   * Convert mock diagram cell data to proper X6 format with correct styling and ports
   * Handles both nodes and edges
   */
  private convertMockCellToX6Format(mockCell: any): any {
    // Handle edges
    if (mockCell.shape === 'edge' || mockCell.edge === true) {
      return this.convertMockEdgeToX6Format(mockCell);
    }

    // Handle nodes
    return this.convertMockNodeToX6Format(mockCell);
  }

  /**
   * Convert mock node data to proper X6 format
   */
  private convertMockNodeToX6Format(mockCell: any): any {
    // Get the node type from the shape (actor, process, store, security-boundary)
    const nodeType = mockCell.shape as NodeType;

    // Get the correct X6 shape name
    const x6Shape = getX6ShapeForNodeType(nodeType);

    // Extract label from various possible import format locations
    // Note: This is for import/conversion, not live X6 cell manipulation
    const label =
      mockCell.attrs?.text?.text || mockCell.value || this.getDefaultLabelForType(nodeType);

    // Get proper port configuration for this node type
    const portConfig = this.nodeConfigurationService.getNodePorts(nodeType);

    // Handle position from either direct properties or geometry object
    const x = mockCell.x ?? mockCell.geometry?.x ?? 0;
    const y = mockCell.y ?? mockCell.geometry?.y ?? 0;
    const width = mockCell.width ?? mockCell.geometry?.width ?? 80;
    const height = mockCell.height ?? mockCell.geometry?.height ?? 80;

    // Create base configuration with default styling (no custom colors)
    const cellConfig: any = {
      id: mockCell.id,
      shape: x6Shape,
      x,
      y,
      width,
      height,
      label,
      zIndex: mockCell.zIndex || 1,
      ports: portConfig,
    };

    // Add metadata if present (convert from array format to object format)
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      cellConfig.data = { metadata };
    }

    return cellConfig;
  }

  /**
   * Convert mock edge data to proper X6 format
   */
  private convertMockEdgeToX6Format(mockCell: any): any {
    // Handle different source/target formats
    let source: any;
    let target: any;

    if (mockCell.source && typeof mockCell.source === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      source = mockCell.source;
    } else {
      // Legacy format: string IDs or separate properties
      source = {
        cell: mockCell.source || mockCell.sourceNodeId,
        port: mockCell.sourcePortId || 'right', // Default to right port
      };
    }

    if (mockCell.target && typeof mockCell.target === 'object') {
      // New format: { cell: 'id', port?: 'portId' }
      target = mockCell.target;
    } else {
      // Legacy format: string IDs or separate properties
      target = {
        cell: mockCell.target || mockCell.targetNodeId,
        port: mockCell.targetPortId || 'left', // Default to left port
      };
    }

    // Create edge configuration
    const edgeConfig: any = {
      id: mockCell.id,
      shape: 'edge',
      source,
      target,
      zIndex: mockCell.zIndex || 1,
      attrs: {
        line: {
          stroke: '#000000',
          strokeWidth: 2,
          targetMarker: {
            name: 'classic',
            size: 8,
          },
        },
      },
    };

    // Add custom attributes if present
    if (mockCell.attrs) {
      edgeConfig.attrs = { ...edgeConfig.attrs, ...mockCell.attrs };
    }

    // Add vertices if present
    if (mockCell.vertices && Array.isArray(mockCell.vertices)) {
      edgeConfig.vertices = mockCell.vertices;
    }

    // Add labels if present (import/conversion logic)
    // Note: This creates X6 configuration, not live cell manipulation
    if (mockCell.labels && Array.isArray(mockCell.labels)) {
      edgeConfig.labels = mockCell.labels;
    } else if (mockCell.value) {
      // Convert legacy value to label
      edgeConfig.labels = [
        {
          attrs: {
            text: {
              text: mockCell.value,
            },
          },
        },
      ];
    }

    // Add metadata if present
    if (mockCell.data && Array.isArray(mockCell.data)) {
      const metadata: any = {};
      mockCell.data.forEach((item: any) => {
        if (item.key && item.value) {
          metadata[item.key] = item.value;
        }
      });
      edgeConfig.data = { metadata };
    }

    return edgeConfig;
  }

  /**
   * Get default label for node type
   */
  private getDefaultLabelForType(nodeType: NodeType): string {
    switch (nodeType) {
      case 'actor':
        return 'External Entity';
      case 'process':
        return 'Process';
      case 'store':
        return 'Data Store';
      case 'security-boundary':
        return 'Trust Boundary';
      case 'text-box':
        return 'Text';
      default:
        return 'Element';
    }
  }

  /**
   * Sets up observation of DOM changes to add passive event listeners to new elements
   */
  private setupDomObservation(): void {
    if (!this.graphContainer || !this.graphContainer.nativeElement) {
      return;
    }

    const container = this.graphContainer.nativeElement as HTMLElement;

    // Function to safely add passive event listener
    const addPassiveListener = (element: Element): void => {
      const passiveEvents = ['touchstart', 'touchmove', 'wheel', 'mousewheel'];
      passiveEvents.forEach(eventType => {
        element.addEventListener(
          eventType,
          (_e: Event) => {
            // Empty handler with passive: true to prevent browser warnings
          },
          { passive: true, capture: false },
        );
      });
    };

    // Add a mutation observer to handle dynamically added elements
    this._observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node: globalThis.Node) => {
            if (node instanceof Element) {
              // Add passive listeners to newly added elements
              addPassiveListener(node);

              // Also add to any canvas or svg children
              const elements = node.querySelectorAll('canvas, svg');
              elements.forEach(element => addPassiveListener(element));
            }
          });
        }
      });
    });

    // Start observing the container for added nodes
    this._observer.observe(container, { childList: true, subtree: true });
    this.logger.info('DOM observation set up for passive event listeners');
  }

  /**
   * Export the diagram to the specified format
   */
  exportDiagram(format: ExportFormat): void {
    this.facade.exportDiagram(
      format,
      this.threatModelName ?? undefined,
      this.diagramName ?? undefined,
    );
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(): void {
    this.facade.onDeleteSelected(this.x6GraphAdapter.isInitialized(), this.x6GraphAdapter);
    this.cdr.markForCheck();
  }

  /**
   * Shows the cell properties dialog with the serialized JSON object definition
   */
  showCellProperties(): void {
    this.facade.showCellProperties();
  }

  /**
   * Shows the X6 history dialog with the rendered JSON of the graph history
   */
  showHistory(): void {
    if (!this.x6GraphAdapter.isInitialized()) {
      this.logger.warn('Cannot show history: graph not initialized');
      return;
    }
    const graph = this.x6GraphAdapter.getGraph();

    const dialogData: X6HistoryDialogData = {
      graph: graph,
    };

    this.dialog.open(X6HistoryDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(): void {
    this.facade.openThreatEditor(this.threatModelId, this.dfdId, this.diagramName);
  }

  /**
   * Manages threats for the selected cell
   */
  manageThreats(): void {
    const selectedCells = this.x6GraphAdapter.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.warn('Manage threats requires exactly one selected cell');
      return;
    }

    if (!this.threatModelId) {
      this.logger.warn('Cannot manage threats: No threat model ID available');
      return;
    }

    const selectedCell = selectedCells[0];
    const cellShape = selectedCell.shape || 'unknown';
    const localizedShapeName = this.getLocalizedShapeName(cellShape);
    const cellLabel = this.x6GraphAdapter.getCellLabel(selectedCell);
    const cellId = selectedCell.id;

    // Format object name as: <shape>: <label> (id) or <shape>: (id) if no label
    const objectName = cellLabel
      ? `${localizedShapeName}: ${cellLabel} (${cellId})`
      : `${localizedShapeName}: (${cellId})`;

    // Load the threat model to get threats for this cell (force refresh to get latest threats)
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId, true).subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found', { id: this.threatModelId });
            return;
          }

          // Debug: Log all threats and their associations
          this.logger.info('All threats in threat model', {
            totalThreats: threatModel.threats?.length || 0,
            threats:
              threatModel.threats?.map(t => ({
                id: t.id,
                name: t.name,
                cell_id: t.cell_id,
                diagram_id: t.diagram_id,
              })) || [],
          });

          // Filter threats for this specific cell and diagram
          // Workaround: If server is not storing cell_id/diagram_id properly (returns null),
          // fall back to showing all threats for this diagram
          let cellThreats =
            threatModel.threats?.filter(
              threat => threat.cell_id === cellId && threat.diagram_id === this.dfdId,
            ) || [];

          // If no cell-specific threats found and we have threats with null cell_id,
          // show threats associated with this diagram (fallback for server bug)
          if (cellThreats.length === 0) {
            const diagramThreats =
              threatModel.threats?.filter(
                threat =>
                  (threat.diagram_id === this.dfdId || threat.diagram_id === null) &&
                  threat.cell_id === null,
              ) || [];

            if (diagramThreats.length > 0) {
              this.logger.warn(
                'Server bug: cell_id and diagram_id are null, showing diagram threats as fallback',
                {
                  expectedCellId: cellId,
                  expectedDiagramId: this.dfdId,
                  fallbackCount: diagramThreats.length,
                },
              );
              cellThreats = diagramThreats;
            }
          }

          this.logger.info('Found threats for cell', {
            cellId,
            diagramId: this.dfdId,
            threatCount: cellThreats.length,
            filterCriteria: {
              expectedCellId: cellId,
              expectedDiagramId: this.dfdId,
            },
            matchingThreats: cellThreats.map(t => ({
              id: t.id,
              name: t.name,
              cell_id: t.cell_id,
              diagram_id: t.diagram_id,
            })),
          });

          // Extract diagram and cell data for the threat editor dropdowns
          let diagrams: import('../tm/components/threat-editor-dialog/threat-editor-dialog.component').DiagramOption[] =
            [];
          let cells: import('../tm/components/threat-editor-dialog/threat-editor-dialog.component').CellOption[] =
            [];

          if (this.x6GraphAdapter && this.dfdId && this.diagramName) {
            try {
              const graph = this.x6GraphAdapter.getGraph();
              const cellData = this.cellDataExtractionService.extractFromX6Graph(
                graph,
                this.dfdId,
                this.diagramName,
              );
              diagrams = cellData.diagrams;
              cells = cellData.cells;
            } catch (error) {
              this.logger.error('Error extracting cell data for threats dialog', error);
              // Fallback: create basic diagram option
              if (this.dfdId && this.diagramName) {
                diagrams = [{ id: this.dfdId, name: this.diagramName }];
              }
            }
          }

          const dialogData: ThreatsDialogData = {
            threats: cellThreats,
            isReadOnly: false, // Allow editing for now
            objectType: cellShape,
            objectName: objectName,
            threatModelId: this.threatModelId || undefined,
            diagramId: this.dfdId || undefined,
            diagramName: this.diagramName || undefined,
            diagrams: diagrams,
            cells: cells,
          };

          const dialogRef = this.dialog.open(ThreatsDialogComponent, {
            data: dialogData,
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            disableClose: false,
          });

          this._subscriptions.add(
            dialogRef.afterClosed().subscribe(result => {
              if (result?.action === 'openThreatEditor') {
                this.logger.info('Opening threat editor from manage threats dialog');
                // Open the threat editor for this specific cell and reopen manage threats dialog after
                this.openThreatEditorAndReopenManageThreats(cellId, cellShape, objectName);
              } else if (result?.action === 'threatUpdated') {
                this.logger.info('Threat was updated from manage threats dialog', {
                  threatId: result.threat?.id,
                });
                // Handle threat update - the threat editor already saved the changes
                // We could reload the threat model or trigger other updates if needed
              } else if (result) {
                this.logger.info('Manage threats dialog closed with changes');
                // Handle any other updates to threats if needed
              }
            }),
          );
        },
        error: error => {
          this.logger.error('Failed to load threat model for manage threats', error);
        },
      }),
    );
  }

  /**
   * Opens threat editor and then reopens manage threats dialog after threat creation
   */
  private openThreatEditorAndReopenManageThreats(
    cellId: string,
    cellShape: string,
    objectName: string,
  ): void {
    if (!this.threatModelId) {
      this.logger.warn('Cannot open threat editor: No threat model ID available');
      return;
    }

    const originalThreatChangedSubscription = this.facade.threatChanged$.subscribe(
      threatChangeEvent => {
        if (threatChangeEvent.action === 'added') {
          this.logger.info('Threat was added, reopening manage threats dialog');

          // Small delay to allow the threat to be fully saved
          setTimeout(() => {
            this.reopenManageThreatsDialog(cellId, cellShape, objectName);
          }, 100);

          // Unsubscribe from this specific subscription
          originalThreatChangedSubscription.unsubscribe();
        }
      },
    );

    // Store the subscription for cleanup
    this._subscriptions.add(originalThreatChangedSubscription);

    // Open the threat editor
    this.facade.openThreatEditor(this.threatModelId, this.dfdId, this.diagramName);
  }

  /**
   * Reopens the manage threats dialog with fresh data
   */
  private reopenManageThreatsDialog(cellId: string, cellShape: string, objectName: string): void {
    if (!this.threatModelId) {
      return;
    }

    // Reload the threat model and reopen the dialog
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId, true).subscribe({
        // Force refresh
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found during reopen', { id: this.threatModelId });
            return;
          }

          // Filter threats for this specific cell and diagram
          // Workaround: If server is not storing cell_id/diagram_id properly (returns null),
          // fall back to showing all threats for this diagram
          let cellThreats =
            threatModel.threats?.filter(
              threat => threat.cell_id === cellId && threat.diagram_id === this.dfdId,
            ) || [];

          // If no cell-specific threats found and we have threats with null cell_id,
          // show threats associated with this diagram (fallback for server bug)
          if (cellThreats.length === 0) {
            const diagramThreats =
              threatModel.threats?.filter(
                threat =>
                  (threat.diagram_id === this.dfdId || threat.diagram_id === null) &&
                  threat.cell_id === null,
              ) || [];

            if (diagramThreats.length > 0) {
              this.logger.warn(
                'Server bug in reopen: cell_id and diagram_id are null, showing diagram threats as fallback',
                {
                  expectedCellId: cellId,
                  expectedDiagramId: this.dfdId,
                  fallbackCount: diagramThreats.length,
                },
              );
              cellThreats = diagramThreats;
            }
          }

          this.logger.info('Reopening manage threats dialog with updated data', {
            cellId,
            diagramId: this.dfdId,
            threatCount: cellThreats.length,
          });

          // Extract diagram and cell data for the threat editor dropdowns
          let diagrams: import('../tm/components/threat-editor-dialog/threat-editor-dialog.component').DiagramOption[] =
            [];
          let cells: import('../tm/components/threat-editor-dialog/threat-editor-dialog.component').CellOption[] =
            [];

          if (this.x6GraphAdapter && this.dfdId && this.diagramName) {
            try {
              const graph = this.x6GraphAdapter.getGraph();
              const cellData = this.cellDataExtractionService.extractFromX6Graph(
                graph,
                this.dfdId,
                this.diagramName,
              );
              diagrams = cellData.diagrams;
              cells = cellData.cells;
            } catch (error) {
              this.logger.error('Error extracting cell data for reopened threats dialog', error);
              // Fallback: create basic diagram option
              if (this.dfdId && this.diagramName) {
                diagrams = [{ id: this.dfdId, name: this.diagramName }];
              }
            }
          }

          const dialogData: ThreatsDialogData = {
            threats: cellThreats,
            isReadOnly: false,
            objectType: cellShape,
            objectName: objectName,
            threatModelId: this.threatModelId || undefined,
            diagramId: this.dfdId || undefined,
            diagramName: this.diagramName || undefined,
            diagrams: diagrams,
            cells: cells,
          };

          const dialogRef = this.dialog.open(ThreatsDialogComponent, {
            data: dialogData,
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '80vh',
            disableClose: false,
          });

          // Handle the reopened dialog the same way as the original
          this._subscriptions.add(
            dialogRef.afterClosed().subscribe(result => {
              if (result?.action === 'openThreatEditor') {
                this.logger.info('Opening threat editor again from reopened manage threats dialog');
                // Recursively handle opening threat editor again
                this.openThreatEditorAndReopenManageThreats(cellId, cellShape, objectName);
              } else if (result?.action === 'threatUpdated') {
                this.logger.info('Threat was updated from reopened manage threats dialog', {
                  threatId: result.threat?.id,
                });
              } else if (result) {
                this.logger.info('Reopened manage threats dialog closed with changes');
              }
            }),
          );
        },
        error: error => {
          this.logger.error('Failed to reload threat model for manage threats reopen', error);
        },
      }),
    );
  }

  /**
   * Manage metadata for the selected cell
   */
  manageMetadata(): void {
    if (!this.hasExactlyOneSelectedCell) {
      this.logger.warn('Cannot manage metadata: no single cell selected');
      return;
    }

    // Get the selected cell from the graph adapter
    const selectedCells = this.x6GraphAdapter.getSelectedCells();
    if (selectedCells.length !== 1) {
      return;
    }

    const cell = selectedCells[0];
    const cellData = cell.getData() || {};

    // Convert metadata from object format to array format for the dialog
    const metadataArray: Metadata[] = [];
    if (cellData.metadata && typeof cellData.metadata === 'object') {
      Object.entries(cellData.metadata).forEach(([key, value]) => {
        metadataArray.push({ key, value: String(value) });
      });
    }

    // Get cell information for friendly object naming (same as manage threats)
    const cellShape = cell.shape || 'unknown';
    const localizedShapeName = this.getLocalizedShapeName(cellShape);
    const cellLabel = this.x6GraphAdapter.getCellLabel(cell);
    const cellId = cell.id;

    // Format object name as: <shape>: <label> (id) or <shape>: (id) if no label
    const objectName = cellLabel
      ? `${localizedShapeName}: ${cellLabel} (${cellId})`
      : `${localizedShapeName}: (${cellId})`;

    const dialogData: MetadataDialogData = {
      metadata: metadataArray,
      isReadOnly: false,
      objectType: cellShape,
      objectName: objectName,
    };

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: Metadata[] | undefined) => {
        if (result && cell) {
          // Convert metadata from array format back to object format for storage
          const metadataObject: { [key: string]: string } = {};
          result.forEach(item => {
            if (item.key && item.key.trim()) {
              metadataObject[item.key] = item.value || '';
            }
          });

          // Update the cell metadata
          const updatedData = { ...cellData, metadata: metadataObject };
          cell.setData(updatedData);

          this.logger.info('Updated cell metadata', { cellId: cell.id, metadata: metadataObject });
        }
      }),
    );
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(): void {
    // Save diagram changes before closing if we have the necessary IDs
    if (this.threatModelId && this.dfdId && this.x6GraphAdapter.isInitialized()) {
      const graph = this.x6GraphAdapter.getGraph();
      this.logger.info('Saving diagram changes before closing', {
        threatModelId: this.threatModelId,
        dfdId: this.dfdId,
        hasWriterAccess: !this.isReadOnlyMode,
      });

      // Check if we should capture SVG image (autosave enabled + writer access)
      const shouldCaptureImage = !this.isReadOnlyMode; // Writer access check

      if (shouldCaptureImage) {
        this.logger.info('Capturing diagram SVG before closing (user has writer access)');

        // Capture SVG first, then save with image data
        this.captureDiagramSvg()
          .then(base64Svg => {
            // Only include SVG in image data if it was successfully captured
            const imageData = {
              svg: base64Svg || undefined,
              update_vector: this.dfdStateStore.updateVector,
            };

            this._subscriptions.add(
              this.facade
                .saveDiagramChangesWithImage(graph, this.dfdId!, this.threatModelId!, imageData)
                .subscribe({
                  next: success => {
                    if (success) {
                      this.logger.info('Diagram changes and image saved successfully');
                    } else {
                      this.logger.warn('Failed to save diagram changes and image');
                    }
                    // Navigate away regardless of save success/failure
                    this.facade.closeDiagram(this.threatModelId, this.dfdId);
                  },
                  error: error => {
                    this.logger.error('Error saving diagram changes and image', error);
                    // Navigate away even if save failed
                    this.facade.closeDiagram(this.threatModelId, this.dfdId);
                  },
                }),
            );
          })
          .catch(error => {
            this.logger.error('Error capturing SVG, falling back to regular save', error);
            // Fall back to regular save without image
            this._performRegularSave(graph);
          });
      } else {
        // User doesn't have writer access or autosave disabled, use regular save
        this.logger.debug('Skipping SVG capture (read-only mode or autosave disabled)');
        this._performRegularSave(graph);
      }
      return;
    }

    // If we don't have the necessary data or graph is not initialized, just close
    this.facade.closeDiagram(this.threatModelId, this.dfdId);
  }

  /**
   * Perform regular diagram save without image capture
   */
  private _performRegularSave(graph: any): void {
    this._subscriptions.add(
      this.facade.saveDiagramChanges(graph, this.dfdId!, this.threatModelId!).subscribe({
        next: success => {
          if (success) {
            this.logger.info('Diagram changes saved successfully');
          } else {
            this.logger.warn('Failed to save diagram changes');
          }
          // Navigate away regardless of save success/failure
          this.facade.closeDiagram(this.threatModelId, this.dfdId);
        },
        error: error => {
          this.logger.error('Error saving diagram changes', error);
          // Navigate away even if save failed
          this.facade.closeDiagram(this.threatModelId, this.dfdId);
        },
      }),
    );
  }

  /**
   * Handle edge added events from the graph adapter
   */
  private handleEdgeAdded(edge: Edge): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.facade
      .handleEdgeAdded(
        edge,
        graph,
        this.dfdId || 'default-diagram',
        this.x6GraphAdapter.isInitialized(),
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error handling edge added', error);
        },
      });
  }

  /**
   * Handle edge vertices changes from the graph adapter
   */
  private handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
  ): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.facade
      .handleEdgeVerticesChanged(
        edgeId,
        vertices,
        graph,
        this.dfdId || 'default-diagram',
        this.x6GraphAdapter.isInitialized(),
      )
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error handling edge vertices changed', error);
        },
      });
  }

  /**
   * Move selected cells forward in z-order
   */
  moveForward(): void {
    this.facade.moveForward(this.x6GraphAdapter);
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(): void {
    this.facade.moveBackward(this.x6GraphAdapter);
  }

  /**
   * Move selected cells to front
   */
  moveToFront(): void {
    this.facade.moveToFront(this.x6GraphAdapter);
  }

  /**
   * Move selected cells to back
   */
  moveToBack(): void {
    this.facade.moveToBack(this.x6GraphAdapter);
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this.facade.isRightClickedCellEdge();
  }

  /**
   * Edit the text/label of the right-clicked cell by invoking the label editor
   */
  editCellText(): void {
    this.facade.editCellText(this.x6GraphAdapter);
  }

  /**
   * Add an inverse connection for the right-clicked edge using the edge service
   */
  addInverseConnection(): void {
    const rightClickedCell = this.facade.getRightClickedCell();
    if (!rightClickedCell || !rightClickedCell.isEdge()) {
      this.logger.warn('No edge selected for inverse connection');
      return;
    }

    const originalEdge = rightClickedCell;
    const graph = this.x6GraphAdapter.getGraph();

    this.facade
      .addInverseConnection(originalEdge, graph, this.dfdId || 'default-diagram')
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Error adding inverse connection', error);
        },
      });
  }

  /**
   * Auto-save diagram when changes occur
   * Routes to WebSocket for collaborative sessions, REST for solo editing
   */
  private autoSaveDiagram(reason: string): void {
    if (!this.x6GraphAdapter.isInitialized() || !this.dfdId || !this.threatModelId) {
      return;
    }

    // Skip auto-save during collaboration - history is handled by the server
    if (this.collaborationService.isCollaborating()) {
      this.logger.debug('Skipping auto-save during collaboration session - server handles history');
      return;
    }

    // Skip auto-save if applying remote changes to prevent echo loops
    if (this.isApplyingRemoteChange) {
      this.logger.debug('Skipping auto-save during remote change application');
      return;
    }

    if (!this.x6GraphAdapter.isInitialized()) {
      return;
    }
    const graph = this.x6GraphAdapter.getGraph();

    // Both collaborative and solo modes benefit from periodic saves
    // Collaborative mode uses WebSocket with REST fallback for resilience
    this.facade.saveDiagramChanges(graph, this.dfdId, this.threatModelId).subscribe({
      next: success => {
        if (success) {
          const mode = this.collaborationService.isCollaborating() ? 'collaborative' : 'solo';
          this.logger.info(`Auto-saved diagram in ${mode} mode: ${reason}`);
        } else {
          this.logger.warn(`Auto-save failed: ${reason}`);
        }
      },
      error: error => {
        this.logger.error(`Error during auto-save (${reason})`, error);
      },
    });
  }

  /**
   * Undo the last action
   * Uses server-managed history during collaboration, local history for solo editing
   */
  undo(): void {
    if (this.collaborationService.isCollaborating()) {
      // Use server-managed history during collaboration
      this.collaborativeOperationService.requestUndo().subscribe({
        next: () => {
          this.logger.debug('Undo request sent to server');
        },
        error: error => {
          this.logger.error('Failed to send undo request', error);
        },
      });
    } else {
      // Use local X6 history for solo editing
      this.facade.undo(this.x6GraphAdapter.isInitialized(), this.x6GraphAdapter);
    }
  }

  /**
   * Redo the last undone action
   * Uses server-managed history during collaboration, local history for solo editing
   */
  redo(): void {
    if (this.collaborationService.isCollaborating()) {
      // Use server-managed history during collaboration
      this.collaborativeOperationService.requestRedo().subscribe({
        next: () => {
          this.logger.debug('Redo request sent to server');
        },
        error: error => {
          this.logger.error('Failed to send redo request', error);
        },
      });
    } else {
      // Use local X6 history for solo editing
      this.facade.redo(this.x6GraphAdapter.isInitialized(), this.x6GraphAdapter);
    }
  }

  /**
   * Apply remote operation to local graph
   */
  private applyRemoteOperationToGraph(operation: any): void {
    if (!this.x6GraphAdapter.isInitialized()) {
      this.logger.error('Cannot apply remote operation: graph not initialized');
      return;
    }
    const graph = this.x6GraphAdapter.getGraph();

    for (const cellOp of operation.cells) {
      switch (cellOp.operation) {
        case 'add':
          this.applyRemoteCellAdd(cellOp, graph);
          break;
        case 'update':
          this.applyRemoteCellUpdate(cellOp, graph);
          break;
        case 'remove':
          this.applyRemoteCellRemove(cellOp, graph);
          break;
        default:
          this.logger.warn('Unknown remote operation type', cellOp.operation);
      }
    }
  }

  /**
   * Apply remote cell addition
   */
  private applyRemoteCellAdd(cellOp: CellOperation, graph: any): void {
    if (!cellOp.data) {
      this.logger.error('Cannot add cell: no data provided');
      return;
    }

    if (cellOp.data.shape === 'edge') {
      // Handle edge addition
      this.facade.createEdgeFromRemoteOperation(graph, cellOp.data, {
        suppressHistory: true,
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });
    } else {
      // Handle node addition using existing domain service
      this.facade.createNodeFromRemoteOperation(graph, cellOp.data, {
        suppressHistory: true,
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });
    }

    this.logger.debug('Applied remote cell add', { cellId: cellOp.id, shape: cellOp.data.shape });
  }

  /**
   * Apply remote cell update
   */
  private applyRemoteCellUpdate(cellOp: CellOperation, graph: any): void {
    const cell = graph.getCellById(cellOp.id);
    if (!cell) {
      this.logger.warn('Cannot update cell: cell not found', cellOp.id);
      return;
    }

    if (cellOp.data) {
      // Update cell properties
      Object.entries(cellOp.data).forEach(([key, value]) => {
        if (key === 'x' || key === 'y') {
          cell.setPosition({ [key]: value });
        } else if (key === 'width' || key === 'height') {
          cell.setSize({ [key]: value });
        } else if (key === 'label') {
          this.x6GraphAdapter.setCellLabel(cell, value as string);
        } else {
          cell.prop(key, value);
        }
      });
    }

    this.logger.debug('Applied remote cell update', { cellId: cellOp.id });
  }

  /**
   * Apply remote cell removal
   */
  private applyRemoteCellRemove(cellOp: CellOperation, graph: any): void {
    const cell = graph.getCellById(cellOp.id);
    if (!cell) {
      this.logger.debug('Cell already removed or not found', cellOp.id);
      return;
    }

    // Use existing infrastructure service for consistent removal
    if (cell.isNode()) {
      this.facade.removeNodeFromRemoteOperation(graph, cellOp.id, {
        suppressHistory: true,
        updatePortVisibility: true,
      });
    } else if (cell.isEdge()) {
      this.facade.removeEdgeFromRemoteOperation(graph, cellOp.id, {
        suppressHistory: true,
        updatePortVisibility: true,
      });
    }

    this.logger.debug('Applied remote cell remove', { cellId: cellOp.id });
  }

  /**
   * Perform full diagram resync using REST API
   *
   * This is critical when:
   * - User disconnects from collaborative session (intentional or network issue)
   * - Server requests resync due to state conflicts
   * - History operations complete (undo/redo)
   *
   * Forces ThreatModelService to refresh its cache and ensures local diagram
   * state matches the server's authoritative state.
   */
  private async performRESTResync(): Promise<void> {
    if (!this.threatModelId || !this.dfdId) {
      this.logger.error('Cannot resync: missing diagram context');
      return;
    }

    // Skip resync if component is being destroyed
    if (this._isDestroying) {
      this.logger.info('Skipping REST resync - component is being destroyed');
      return;
    }

    try {
      this.logger.info('Performing REST resync');

      // Force refresh from REST API to get authoritative state
      // This will bypass any stale cache in ThreatModelService
      const threatModel = await this.threatModelService
        .getThreatModelById(this.threatModelId, true) // forceRefresh = true
        .toPromise();

      if (!threatModel) {
        this.logger.error('Threat model not found during resync');
        return;
      }

      const diagram = threatModel.diagrams?.find(d => d.id === this.dfdId);

      if (diagram && diagram.cells) {
        // Replace entire local diagram state
        this.isApplyingRemoteChange = true;
        try {
          // Check again before accessing graph in case component was destroyed during async operation
          if (this._isDestroying) {
            this.logger.info('Aborting resync - component is being destroyed');
            return;
          }

          if (this.x6GraphAdapter.isInitialized()) {
            const graph = this.x6GraphAdapter.getGraph();
            // Clear existing graph
            graph.clearCells();

            // Load fresh cells from server
            this.loadDiagramCells(diagram.cells);
          }
        } finally {
          this.isApplyingRemoteChange = false;
        }

        // Notify state service that resync is complete
        this.dfdStateService.resyncComplete();

        this.logger.info('REST resync completed successfully');
        this.notificationService.showSuccess('Diagram synchronized with server').subscribe();
      }
    } catch (error) {
      this.logger.error('REST resync failed', error);
      this.notificationService.showError('Failed to synchronize diagram with server').subscribe();
    }
  }

  /**
   * Apply individual cell correction
   */
  private applyCellCorrection(cellData: WSCell, graph: any): void {
    const existingCell = graph.getCellById(cellData.id);

    if (existingCell) {
      // Update existing cell with corrected data
      Object.entries(cellData).forEach(([key, value]) => {
        if (key === 'x' || key === 'y') {
          existingCell.setPosition({ [key]: value });
        } else if (key === 'width' || key === 'height') {
          existingCell.setSize({ [key]: value });
        } else if (key === 'label') {
          this.x6GraphAdapter.setCellLabel(existingCell, value as string);
        } else {
          existingCell.prop(key, value);
        }
      });
    } else {
      // Cell doesn't exist locally, create it
      if (cellData.shape === 'edge') {
        this.facade.createEdgeFromRemoteOperation(graph, cellData, {
          suppressHistory: true,
          ensureVisualRendering: true,
          updatePortVisibility: true,
        });
      } else {
        this.facade.createNodeFromRemoteOperation(graph, cellData, {
          suppressHistory: true,
          ensureVisualRendering: true,
          updatePortVisibility: true,
        });
      }
    }
  }

  /**
   * Get readable text for authorization denial reasons
   */
  private getReadableAuthorizationReason(reason: string): string {
    switch (reason) {
      case 'insufficient_permissions':
        return 'You do not have permission to edit this diagram';
      case 'read_only_user':
        return 'You have read-only access to this diagram';
      case 'invalid_user':
        return 'User validation failed';
      default:
        return 'Operation not permitted';
    }
  }

  // New event-based handler methods for refactored WebSocket architecture

  /**
   * Apply a remote operation to the graph
   */
  private applyRemoteOperation(
    operation: CellOperation,
    userId: string,
    operationId: string,
  ): void {
    // Skip if this is our own operation (echo prevention)
    if (userId === this.collaborationService.getCurrentUserEmail()) {
      this.logger.debug('Skipping own operation', { operationId });
      return;
    }

    this.logger.info('Applying remote operation', {
      userId,
      operationId,
      cellId: operation.id,
      operationType: operation.operation,
    });

    if (!this.x6GraphAdapter.isInitialized()) {
      this.logger.error('Cannot apply remote operation: graph not initialized');
      return;
    }
    const graph = this.x6GraphAdapter.getGraph();

    this.dfdStateService.setApplyingRemoteChange(true);
    try {
      switch (operation.operation) {
        case 'add':
          this.applyRemoteCellAdd(operation, graph);
          break;
        case 'update':
          this.applyRemoteCellUpdate(operation, graph);
          break;
        case 'remove':
          this.applyRemoteCellRemove(operation, graph);
          break;
        default:
          this.logger.warn('Unknown remote operation type', operation.operation);
      }
    } finally {
      this.dfdStateService.setApplyingRemoteChange(false);
    }
  }

  /**
   * Apply corrected state from server
   */
  private applyCorrectedState(cells: WSCell[]): void {
    this.logger.info('Applying corrected state', { cellCount: cells.length });

    this.dfdStateService.setApplyingRemoteChange(true);
    if (!this.x6GraphAdapter.isInitialized()) {
      this.logger.error('Cannot apply state correction: graph not initialized');
      return;
    }

    try {
      const graph = this.x6GraphAdapter.getGraph();
      // Apply corrected state for each cell
      for (const cell of cells) {
        this.applyCellCorrection(cell, graph);
      }
    } finally {
      this.dfdStateService.setApplyingRemoteChange(false);
    }

    // Mark resync as complete
    this.dfdStateService.resyncComplete();
  }

  /**
   * Show authorization denied notification
   */
  private showAuthorizationDeniedNotification(reason: string): void {
    const reasonText = this.getReadableAuthorizationReason(reason);
    // TODO: Show notification to user
    this.logger.warn(`Operation denied: ${reasonText}`);
  }

  /**
   * Handle history operation event
   */
  private handleHistoryOperationEvent(event: any): void {
    switch (event.message) {
      case 'no_operations_to_undo':
        // TODO: Show notification
        this.logger.info('Nothing to undo');
        break;
      case 'no_operations_to_redo':
        // TODO: Show notification
        this.logger.info('Nothing to redo');
        break;
    }
  }

  /**
   * Handle presenter change
   */
  private handlePresenterChange(presenterEmail: string | null): void {
    this.logger.info('Presenter changed', { presenterEmail });
    this.collaborationService.updatePresenterEmail(presenterEmail);
    this.updateReadOnlyMode();
  }

  /**
   * Show presenter cursor
   */
  private showPresenterCursor(userId: string, position: { x: number; y: number }): void {
    if (userId !== this.collaborationService.getCurrentUserEmail()) {
      // TODO: Show presenter cursor on diagram
      this.logger.debug('Presenter cursor update', { userId, position });
    }
  }

  /**
   * Show presenter selection
   */
  private showPresenterSelection(userId: string, selectedCells: string[]): void {
    if (userId !== this.collaborationService.getCurrentUserEmail()) {
      // TODO: Highlight presenter selection
      this.logger.debug('Presenter selection update', { userId, cells: selectedCells });
    }
  }

  /**
   * Handle presenter request event
   */
  private handlePresenterRequestEvent(userId: string): void {
    if (this.collaborationService.isCurrentUserHost()) {
      this.collaborationService.addPresenterRequest(userId);
      this.logger.info('Presenter request received', { userId });
    }
  }

  /**
   * Handle presenter denial event
   */
  private handlePresenterDenialEvent(userId: string, targetUser: string): void {
    if (targetUser === this.collaborationService.getCurrentUserEmail()) {
      // Show notification to current user
      this.logger.info('Presenter request was denied');
      // TODO: Show user notification
    }
  }

  /**
   * Handle presenter update event
   */
  private handlePresenterUpdateEvent(presenterEmail: string | null): void {
    this.logger.info('Presenter updated', { presenterEmail });
    this.collaborationService.updatePresenterEmail(presenterEmail);
    this.updateReadOnlyMode();
  }

  /**
   * Handle joinCollaboration query parameter after checking for existing session
   */
  private handleJoinCollaborationQueryParam(): void {
    const joinCollaboration = this.route.snapshot.queryParamMap.get('joinCollaboration');
    if (joinCollaboration === 'true' && this.threatModelId && this.dfdId) {
      this.logger.info('Auto-joining collaboration session from navigation', {
        threatModelId: this.threatModelId,
        dfdId: this.dfdId,
      });

      // Join existing collaboration session (existingSessionAvailable should now be set)
      this.collaborationService.joinCollaboration().subscribe({
        next: success => {
          this.logger.info('Collaboration session joined successfully', { success });
        },
        error: error => {
          this.logger.error('Failed to join collaboration session', error);
        },
      });
    }
  }

  /**
   * Capture SVG from the current graph and return as base64 encoded string
   */
  private captureDiagramSvg(): Promise<string | null> {
    return new Promise(resolve => {
      if (!this.x6GraphAdapter.isInitialized()) {
        this.logger.warn('Cannot capture SVG - graph not initialized');
        resolve(null);
        return;
      }

      const graph = this.x6GraphAdapter.getGraph();

      // Cast graph to access export methods added by the plugin
      const exportGraph = graph as {
        toSVG: (callback: (svgString: string) => void) => void;
      };

      try {
        exportGraph.toSVG((svgString: string) => {
          try {
            // Convert SVG string to base64
            const base64Svg = btoa(unescape(encodeURIComponent(svgString)));
            this.logger.debug('Successfully captured diagram SVG', {
              svgLength: svgString.length,
              base64Length: base64Svg.length,
            });
            resolve(base64Svg);
          } catch (error) {
            this.logger.error('Error encoding SVG to base64', error);
            resolve(null);
          }
        });
      } catch (error) {
        this.logger.error('Error capturing SVG from graph', error);
        resolve(null);
      }
    });
  }
}
