/**
 * Data Flow Diagram (DFD) Component - v2 Architecture
 *
 * This is the main component for the Data Flow Diagram editor page using the new DFD v2 architecture.
 * It provides a comprehensive diagram editing environment with centralized operation management.
 *
 * Key functionality:
 * - Centralized operation management via AppDfdOrchestrator
 * - Intelligent auto-save with configurable policies
 * - Unified persistence coordination
 * - Complete graph operation support (nodes, edges, batches, diagram loading)
 * - Real-time collaboration with WebSocket integration
 * - Event-driven architecture with reactive patterns
 * - Comprehensive error handling and recovery
 * - Export functionality for multiple formats (PNG, JPG, SVG)
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
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { AuthService } from '../../../../auth/services/auth.service';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

// DFD v2 Architecture
import { AppDfdOrchestrator } from '../../application/services/app-dfd-orchestrator.service';
import { AppDfdFacade } from '../../application/facades/app-dfd.facade';
import { AppEdgeService } from '../../application/services/app-edge.service';
import { AppOperationStateManager } from '../../application/services/app-operation-state-manager.service';
import { AppDiagramService } from '../../application/services/app-diagram.service';
import { AppDiagramLoadingService } from '../../application/services/app-diagram-loading.service';
import { AppDiagramOperationBroadcaster } from '../../application/services/app-diagram-operation-broadcaster.service';
import { AppRemoteOperationHandler } from '../../application/services/app-remote-operation-handler.service';
import { AppHistoryService } from '../../application/services/app-history.service';
import { AppGraphOperationManager } from '../../application/services/app-graph-operation-manager.service';
import { AppPersistenceCoordinator } from '../../application/services/app-persistence-coordinator.service';
import { AppDiagramResyncService } from '../../application/services/app-diagram-resync.service';
import { AppStateService } from '../../application/services/app-state.service';
import { AppOperationRejectionHandler } from '../../application/services/app-operation-rejection-handler.service';

// Persistence strategies
import { InfraRestPersistenceStrategy } from '../../infrastructure/strategies/infra-rest-persistence.strategy';
import { WebSocketPersistenceStrategy } from '../../infrastructure/strategies/infra-websocket-persistence.strategy';
import { InfraWebsocketCollaborationAdapter } from '../../infrastructure/adapters/infra-websocket-collaboration.adapter';

// Infrastructure adapters and services
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { InfraX6ZOrderAdapter } from '../../infrastructure/adapters/infra-x6-z-order.adapter';
import { InfraX6SelectionAdapter } from '../../infrastructure/adapters/infra-x6-selection.adapter';
import { InfraX6EmbeddingAdapter } from '../../infrastructure/adapters/infra-x6-embedding.adapter';
import { InfraX6KeyboardAdapter } from '../../infrastructure/adapters/infra-x6-keyboard.adapter';
import { InfraX6EventLoggerAdapter } from '../../infrastructure/adapters/infra-x6-event-logger.adapter';
import { InfraEdgeQueryService } from '../../infrastructure/services/infra-edge-query.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraEmbeddingService } from '../../infrastructure/services/infra-embedding.service';
import { InfraPortStateService } from '../../infrastructure/services/infra-port-state.service';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { InfraX6CoreOperationsService } from '../../infrastructure/services/infra-x6-core-operations.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { InfraVisualEffectsService } from '../../infrastructure/services/infra-visual-effects.service';

// Essential v1 components still needed
import { NodeType } from '../../domain/value-objects/node-info';
import { DfdCollaborationComponent } from './collaboration/collaboration.component';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { MatDialog } from '@angular/material/dialog';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { ThreatModelAuthorizationService } from '../../../tm/services/threat-model-authorization.service';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../../../tm/components/metadata-dialog/metadata-dialog.component';
import {
  CellPropertiesDialogComponent,
  CellPropertiesDialogData,
} from './cell-properties-dialog/cell-properties-dialog.component';
import {
  HistoryDialogComponent,
  HistoryDialogData,
} from './history-dialog/history-dialog.component';
import {
  GraphDataDialogComponent,
  GraphDataDialogData,
} from './graph-data-dialog/graph-data-dialog.component';
import {
  ClipboardDialogComponent,
  ClipboardDialogData,
} from './clipboard-dialog/clipboard-dialog.component';
import {
  DataAssetDialogComponent,
  DataAssetDialogData,
} from './data-asset-dialog/data-asset-dialog.component';
import { HelpDialogComponent } from './help-dialog/help-dialog.component';

import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../../../tm/components/threats-dialog/threats-dialog.component';
import { environment } from '../../../../../environments/environment';
import { AppNotificationService } from '../../application/services/app-notification.service';
import { COLLABORATION_NOTIFICATION_SERVICE } from '../../../../core/interfaces/collaboration-notification.interface';

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
    // DFD v2 Architecture - Component-scoped services
    AppDfdOrchestrator, // Main coordination service
    AppDfdFacade, // Facade encapsulates all infrastructure dependencies
    AppEdgeService, // Application edge service
    AppOperationStateManager, // Operation state management service
    AppDiagramService, // Diagram data management service
    AppDiagramLoadingService, // Diagram loading service
    AppDiagramOperationBroadcaster, // Operation broadcaster service
    AppRemoteOperationHandler, // Remote operation handler service
    AppHistoryService, // Custom history service for undo/redo
    AppGraphOperationManager, // Operation manager service
    AppPersistenceCoordinator, // Simplified persistence coordination service
    AppDiagramResyncService, // Diagram resync service (changed from root to component-scoped)
    AppStateService, // State service (changed from root to component-scoped)
    AppOperationRejectionHandler, // Operation rejection handler service
    AppNotificationService, // Notification service for collaboration events
    // Provide AppNotificationService for the COLLABORATION_NOTIFICATION_SERVICE injection token
    { provide: COLLABORATION_NOTIFICATION_SERVICE, useExisting: AppNotificationService },
    // Persistence strategies (changed from root to component-scoped)
    InfraRestPersistenceStrategy,
    WebSocketPersistenceStrategy,
    InfraVisualEffectsService, // Visual effects service
    // Infrastructure adapters and services required by InfraX6GraphAdapter
    InfraX6GraphAdapter,
    InfraX6ZOrderAdapter,
    InfraX6SelectionAdapter,
    InfraX6EmbeddingAdapter,
    InfraX6KeyboardAdapter,
    InfraX6EventLoggerAdapter,
    InfraEdgeQueryService,
    InfraNodeConfigurationService,
    InfraEmbeddingService,
    InfraPortStateService,
    InfraNodeService,
    InfraX6CoreOperationsService,
    InfraEdgeService,
  ],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DfdComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;
  @ViewChild('contextMenuTrigger') contextMenuTrigger!: MatMenuTrigger;

  private readonly _destroy$ = new Subject<void>();
  private _subscriptions = new Subscription();

  // Collaborative editing state
  isReadOnlyMode = false;
  isCollaborating = false;

  // Route parameters
  threatModelId: string | null = null;
  dfdId: string | null = null;
  joinCollaboration = false;

  // Diagram data
  diagramName: string | null = null;
  threatModelName: string | null = null;
  threatModelPermission: 'reader' | 'writer' | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;
  selectedCellIsSecurityBoundary = false;
  isSystemInitialized = false;

  // Undo/redo state properties
  canUndo = false;
  canRedo = false;

  // Context menu state
  contextMenuPosition = { x: '0px', y: '0px' };
  private _rightClickedCell: any = null;

  // Environment flags for dev-only features
  isProduction = environment.production;

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private appDfdOrchestrator: AppDfdOrchestrator,
    private appPersistenceCoordinator: AppPersistenceCoordinator,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private translocoService: TranslocoService,
    private collaborationService: DfdCollaborationService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
    private dfdInfrastructure: AppDfdFacade,
    private frameworkService: FrameworkService,
    private websocketCollaborationAdapter: InfraWebsocketCollaborationAdapter,
    private authService: AuthService,
  ) {
    // this.logger.info('DfdComponent v2 constructor called');

    // Initialize X6 cell extensions first
    // this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();
  }

  ngOnInit(): void {
    // this.logger.info('DfdComponent v2 ngOnInit called');

    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id');
    this.dfdId = this.route.snapshot.paramMap.get('dfdId');

    // Get query parameters for collaboration intent
    this.joinCollaboration = this.route.snapshot.queryParamMap.get('joinCollaboration') === 'true';

    // this.logger.info('DFD Component v2 route parameters extracted', {
    //   threatModelId: this.threatModelId,
    //   dfdId: this.dfdId,
    //   joinCollaboration: this.joinCollaboration,
    // });

    // Set collaboration context if we have the required parameters
    if (this.threatModelId && this.dfdId) {
      this.collaborationService.setDiagramContext(this.threatModelId, this.dfdId);
    }

    // Get threat model from route resolver
    const threatModel = this.route.snapshot.data['threatModel'];
    this.logger.debug('Threat model data from route resolver', {
      threatModel: threatModel
        ? {
            id: threatModel.id,
            name: threatModel.name,
            authorizationCount: threatModel.authorization?.length || 0,
          }
        : null,
      routeData: this.route.snapshot.data,
    });

    if (threatModel) {
      this.threatModelName = threatModel.name;
    } else {
      this.logger.warn('No threat model data available from route resolver');
    }

    // Configure auto-save policies based on user permission
    this.configureAutoSave();
  }

  ngAfterViewInit(): void {
    // this.logger.info('DfdComponent v2 ngAfterViewInit called - starting initialization sequence');

    // First check if authorization is already loaded synchronously
    const currentPermission = this.authorizationService.getCurrentUserPermission();
    const currentThreatModelId = this.authorizationService.currentThreatModelId;

    this.logger.debug('Authorization service state check', {
      currentPermission,
      currentThreatModelId,
      expectedThreatModelId: this.threatModelId,
    });

    if (currentPermission !== null) {
      // Authorization is already loaded, initialize immediately
      this.logger.info('Authorization already loaded, initializing immediately', {
        permission: currentPermission,
      });
      this.initializeWithPermission(currentPermission);
    } else {
      // Authorization not yet loaded - check if we need to manually load the threat model
      this.logger.debug(
        'Authorization not yet loaded, checking if we need to load threat model manually',
      );

      if (this.threatModelId && !this.authorizationService.currentThreatModelId) {
        // No authorization and threat model ID doesn't match - manually load threat model
        this.logger.info('Manually loading threat model due to missing authorization', {
          threatModelId: this.threatModelId,
          currentAuthThreatModelId: this.authorizationService.currentThreatModelId,
        });

        this._subscriptions.add(
          this.threatModelService.getThreatModelById(this.threatModelId, true).subscribe({
            next: threatModel => {
              if (threatModel) {
                this.logger.info('Manually loaded threat model successfully', {
                  id: threatModel.id,
                  name: threatModel.name,
                });
                // The service should have called setAuthorization, check again
                const permission = this.authorizationService.getCurrentUserPermission();
                if (permission) {
                  this.initializeWithPermission(permission);
                } else {
                  this.logger.error('Threat model loaded but authorization still null');
                }
              } else {
                this.logger.error('Failed to manually load threat model - received null');
              }
            },
            error: error => {
              this.logger.error('Error manually loading threat model', { error });
            },
          }),
        );
      } else {
        // Wait for authorization updates via subscription
        this.logger.debug('Subscribing for authorization updates');
        this._subscriptions.add(
          this.authorizationService.currentUserPermission$.subscribe(permission => {
            // Skip initialization if permission is null (not yet loaded)
            if (permission === null) {
              this.logger.debug('DFD still waiting for authorization data to be loaded');
              return;
            }

            this.logger.info('Authorization loaded via subscription', {
              permission,
            });
            this.initializeWithPermission(permission);
          }),
        );
      }
    }
  }

  private initializeWithPermission(permission: 'reader' | 'writer' | 'owner'): void {
    // Update component state
    this.threatModelPermission = permission === 'owner' ? 'writer' : permission;
    this.isReadOnlyMode = permission === 'reader';

    this.logger.info('DFD permission determined for orchestrator initialization', {
      permission,
      threatModelPermission: this.threatModelPermission,
      isReadOnlyMode: this.isReadOnlyMode,
    });

    // Check if orchestrator is already initialized to avoid re-initialization
    if (this.appDfdOrchestrator.getState().initialized) {
      // Update existing orchestrator read-only mode
      this.appDfdOrchestrator.setReadOnlyMode(this.isReadOnlyMode);
      this.configureAutoSave();
      this.cdr.detectChanges();
      return;
    }

    // Initialize the DFD Orchestrator with proper initialization parameters
    const initParams = {
      diagramId: this.dfdId || 'new-diagram',
      threatModelId: this.threatModelId || 'unknown',
      containerElement: this.graphContainer.nativeElement,
      readOnly: this.isReadOnlyMode,
      autoSaveMode: this.isReadOnlyMode ? ('manual' as const) : ('auto' as const),
      joinCollaboration: this.joinCollaboration,
    };

    this.logger.debug('Attempting to initialize DFD Orchestrator', initParams);
    this.appDfdOrchestrator.initialize(initParams).subscribe({
      next: success => {
        this.logger.debugComponent('DfdComponent', 'DFD Orchestrator initialization result', {
          success,
        });
        if (success) {
          this.logger.info('DFD Orchestrator initialized successfully');

          // Force immediate UI update after successful initialization
          this.isSystemInitialized = this.appDfdOrchestrator.getState().initialized;
          this.cdr.detectChanges();

          // Special handling for joinCollaboration flow
          if (this.joinCollaboration) {
            this.logger.info(
              'Auto-joining collaboration session (joinCollaboration=true from query param)',
            );
            // Automatically start/join collaboration which will establish WebSocket
            // and then load the diagram
            this._subscriptions.add(
              this.collaborationService.startOrJoinCollaboration().subscribe({
                next: success => {
                  if (success) {
                    this.logger.info(
                      'Successfully joined collaboration session, now loading diagram',
                    );

                    // Note: Collaboration services (broadcaster and WebSocket adapter) are
                    // initialized automatically via the isCollaborating$ subscription
                    // in setupOrchestratorSubscriptions()

                    // Now that WebSocket is connected, load the diagram
                    if (this.dfdId) {
                      this.loadDiagramData(this.dfdId);
                    }
                  } else {
                    this.logger.error('Failed to join collaboration session');
                  }
                },
                error: error => {
                  this.logger.error('Error joining collaboration session', { error });
                  // Fall back to loading without collaboration
                  if (this.dfdId) {
                    this.logger.info('Falling back to non-collaborative load');
                    this.loadDiagramData(this.dfdId);
                  }
                },
              }),
            );
          } else {
            // Normal flow: Load diagram data if we have a dfdId
            if (this.dfdId) {
              this.loadDiagramData(this.dfdId);
            }
          }
        } else {
          this.logger.error('Failed to initialize DFD Orchestrator');
        }
      },
      error: error => {
        this.logger.error('Error initializing DFD Orchestrator', { error });
      },
    });

    // Subscribe to DFD Orchestrator events
    this.setupOrchestratorSubscriptions();
  }

  ngOnDestroy(): void {
    // this.logger.info('DfdComponent v2 ngOnDestroy called');

    // Save diagram with SVG thumbnail before destroying component
    if (this.appDfdOrchestrator.getState().hasUnsavedChanges && !this.isReadOnlyMode) {
      this.logger.info('Saving diagram with SVG thumbnail on component destroy');

      this._captureDiagramSvgThumbnail()
        .then(base64Svg => {
          const imageData = {
            svg: base64Svg || undefined,
          };

          // Fire-and-forget save (component is already being destroyed)
          this.appDfdOrchestrator.saveManuallyWithImage(imageData).subscribe({
            next: () => {
              this.logger.info('Diagram and thumbnail saved on destroy');
            },
            error: (error: unknown) => {
              this.logger.error('Failed to save diagram with thumbnail on destroy', { error });
            },
          });
        })
        .catch((error: unknown) => {
          this.logger.error('Error capturing SVG thumbnail on destroy', error);
        });
    }

    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();

    // Clean up orchestrator
    // AppDfdOrchestrator doesn't have dispose method, handle cleanup via subscriptions
  }

  private configureAutoSave(): void {
    // Configure auto-save based on user permission
    const autoSaveMode = this.isReadOnlyMode ? 'manual' : 'auto';

    if (this.isReadOnlyMode) {
      this.appDfdOrchestrator.disableAutoSave();
    } else {
      this.appDfdOrchestrator.enableAutoSave();
    }

    this.logger.info('Auto-save configured', {
      enabled: !this.isReadOnlyMode,
      mode: autoSaveMode,
      isReadOnlyMode: this.isReadOnlyMode,
      threatModelPermission: this.threatModelPermission,
    });
  }

  private setupOrchestratorSubscriptions(): void {
    // Subscribe to collaboration state changes to initialize services when collaboration starts
    this._subscriptions.add(
      this.collaborationService.isCollaborating$
        .pipe(takeUntil(this._destroy$))
        .subscribe(isCollaborating => {
          this.isCollaborating = isCollaborating;
          this.cdr.detectChanges(); // Update UI when collaboration state changes

          if (isCollaborating) {
            this.logger.info('Collaboration became active - initializing collaboration services');

            // Initialize the diagram operation broadcaster
            this.appDfdOrchestrator.initializeCollaborationBroadcaster();

            // Initialize the WebSocket collaboration adapter for cursor/selection broadcasting
            if (this.threatModelId && this.dfdId && this.authService.userId) {
              this.websocketCollaborationAdapter.initialize({
                diagramId: this.dfdId,
                threatModelId: this.threatModelId,
                userId: this.authService.userId,
                threatModelPermission: this.threatModelPermission || 'reader',
              });
              this.logger.info('WebSocket collaboration adapter initialized', {
                diagramId: this.dfdId,
                threatModelId: this.threatModelId,
              });
            }
          }
        }),
    );

    // Subscribe to auto-save events - now handled by orchestrator state
    this._subscriptions.add(
      this.appPersistenceCoordinator.saveStatus$
        .pipe(takeUntil(this._destroy$))
        .subscribe(status => {
          if (status.status === 'saved') {
            this.logger.debug('Auto-save completed successfully');
          } else if (status.status === 'error') {
            this.logger.warn('Auto-save failed', { error: status.error });
          }
        }),
    );

    // Subscribe to orchestrator state changes
    this._subscriptions.add(
      this.appDfdOrchestrator.state$.pipe(takeUntil(this._destroy$)).subscribe(state => {
        // Update component state based on orchestrator state
        this.logger.debug('DFD orchestrator state changed', {
          initialized: state.initialized,
          loading: state.loading,
          error: state.error,
          diagramName: state.diagramName,
          threatModelName: state.threatModelName,
        });

        // Set up edge event handlers when orchestrator becomes initialized
        if (state.initialized && !this.isSystemInitialized) {
          this.logger.debugComponent(
            'DfdComponent',
            'DFD orchestrator just became initialized - setting up edge handlers',
          );
          this.setupEdgeObservableSubscriptions();
        }

        this.isSystemInitialized = state.initialized;

        // Update diagram name and threat model name from orchestrator state
        if (state.diagramName) {
          this.diagramName = state.diagramName;
        }
        if (state.threatModelName) {
          this.threatModelName = state.threatModelName;
        }

        this.cdr.detectChanges();
        this.logger.debug('Updated system initialization state and triggered change detection', {
          isSystemInitialized: this.isSystemInitialized,
          isReadOnlyMode: this.isReadOnlyMode,
          diagramName: this.diagramName,
          threatModelName: this.threatModelName,
        });
      }),
    );

    // Ensure UI state is in sync with current orchestrator state immediately
    const currentState = this.appDfdOrchestrator.getState();
    this.isSystemInitialized = currentState.initialized;
    this.cdr.detectChanges();
    this.logger.debug('Initial state sync completed', {
      isSystemInitialized: this.isSystemInitialized,
      orchestratorInitialized: currentState.initialized,
    });

    // Subscribe to selection changes from orchestrator
    this._subscriptions.add(
      this.appDfdOrchestrator.selectionChanged$.pipe(takeUntil(this._destroy$)).subscribe(() => {
        this.updateSelectionState();
      }),
    );

    // Subscribe to history changes from orchestrator
    this._subscriptions.add(
      this.appDfdOrchestrator.historyChanged$
        .pipe(takeUntil(this._destroy$))
        .subscribe(({ canUndo, canRedo }) => {
          this.canUndo = canUndo;
          this.canRedo = canRedo;
          this.logger.debug('History state changed', { canUndo, canRedo });
          this.cdr.detectChanges();
        }),
    );

    // Subscribe to orchestrator state changes for initialization tracking
    this._subscriptions.add(
      this.appDfdOrchestrator.state$.pipe(takeUntil(this._destroy$)).subscribe(state => {
        if (this.isSystemInitialized !== state.initialized) {
          this.logger.debug('System initialization state changed', {
            componentState: this.isSystemInitialized,
            orchestratorState: state.initialized,
          });
          this.isSystemInitialized = state.initialized;
          this.cdr.detectChanges();
        }
      }),
    );

    // Remove the inline edge event handler setup - it will now be done when orchestrator is initialized

    // Set up context menu handlers
    this.setupContextMenuHandlers();
  }

  private handleNodeAdded(node: any): void {
    this.logger.info('DFD Component: handleNodeAdded called', {
      nodeId: node?.id,
      hasNode: !!node,
      hasDfdId: !!this.dfdId,
      isSystemInitialized: this.isSystemInitialized,
    });

    if (!node || !this.dfdId) {
      this.logger.warn('Cannot handle node added - missing node or diagram ID', {
        hasNode: !!node,
        hasDfdId: !!this.dfdId,
      });
      return;
    }

    this.logger.debug('Handling node added', { nodeId: node.id });

    this.dfdInfrastructure.handleNodeAdded(node, this.dfdId, this.isSystemInitialized).subscribe({
      next: () => {
        this.logger.debug('Node added successfully', { nodeId: node.id });
      },
      error: error => {
        this.logger.error('Error handling node added', { error, nodeId: node.id });
      },
    });
  }

  private handleEdgeAdded(edge: any): void {
    this.logger.info('DFD Component: handleEdgeAdded called', {
      edgeId: edge?.id,
      hasEdge: !!edge,
      hasDfdId: !!this.dfdId,
      isSystemInitialized: this.isSystemInitialized,
    });

    if (!edge || !this.dfdId) {
      this.logger.warn('Cannot handle edge added - missing edge or diagram ID', {
        hasEdge: !!edge,
        hasDfdId: !!this.dfdId,
      });
      return;
    }

    this.logger.debug('Handling edge added', { edgeId: edge.id });

    this.dfdInfrastructure.handleEdgeAdded(edge, this.dfdId, this.isSystemInitialized).subscribe({
      next: () => {
        this.logger.debug('Edge added successfully', { edgeId: edge.id });
      },
      error: error => {
        this.logger.error('Error handling edge added', { error, edgeId: edge.id });
      },
    });
  }

  private handleLabelChange(change: any): void {
    this.logger.info('DFD Component: handleLabelChange called', {
      cellId: change?.cellId,
      cellType: change?.cellType,
      hasDfdId: !!this.dfdId,
    });

    if (!change || !this.dfdId) {
      this.logger.warn('Cannot handle label change - missing change data or diagram ID', {
        hasChange: !!change,
        hasDfdId: !!this.dfdId,
      });
      return;
    }

    this.logger.debug('Handling label change', {
      cellId: change.cellId,
      cellType: change.cellType,
      oldLabel: change.oldLabel,
      newLabel: change.newLabel,
    });

    this.dfdInfrastructure.handleLabelChange(change, this.dfdId).subscribe({
      next: () => {
        this.logger.debug('Label change recorded successfully', {
          cellId: change.cellId,
          cellType: change.cellType,
        });
      },
      error: error => {
        this.logger.error('Error handling label change', { error, change });
      },
    });
  }

  private handleEdgeReconnection(reconnection: any): void {
    this.logger.info('DFD Component: handleEdgeReconnection called', {
      edgeId: reconnection?.edgeId,
      changeType: reconnection?.changeType,
      hasDfdId: !!this.dfdId,
    });

    if (!reconnection || !this.dfdId) {
      this.logger.warn(
        'Cannot handle edge reconnection - missing reconnection data or diagram ID',
        {
          hasReconnection: !!reconnection,
          hasDfdId: !!this.dfdId,
        },
      );
      return;
    }

    this.logger.debug('Handling edge reconnection', {
      edgeId: reconnection.edgeId,
      changeType: reconnection.changeType,
      oldNodeId: reconnection.oldNodeId,
      newNodeId: reconnection.newNodeId,
    });

    this.dfdInfrastructure.handleEdgeReconnection(reconnection, this.dfdId).subscribe({
      next: () => {
        this.logger.debug('Edge reconnection recorded successfully', {
          edgeId: reconnection.edgeId,
          changeType: reconnection.changeType,
        });
      },
      error: error => {
        this.logger.error('Error handling edge reconnection', { error, reconnection });
      },
    });
  }

  private handleNodeParentChange(change: any): void {
    this.logger.info('DFD Component: handleNodeParentChange called', {
      nodeId: change?.nodeId,
      oldParentId: change?.oldParentId,
      newParentId: change?.newParentId,
      hasDfdId: !!this.dfdId,
    });

    if (!change || !this.dfdId) {
      this.logger.warn('Cannot handle node parent change - missing change data or diagram ID', {
        hasChange: !!change,
        hasDfdId: !!this.dfdId,
      });
      return;
    }

    this.logger.debug('Handling node parent change', {
      nodeId: change.nodeId,
      oldParentId: change.oldParentId,
      newParentId: change.newParentId,
    });

    this.dfdInfrastructure.handleNodeParentChange(change, this.dfdId).subscribe({
      next: () => {
        this.logger.debug('Node parent change recorded successfully', {
          nodeId: change.nodeId,
          oldParentId: change.oldParentId,
          newParentId: change.newParentId,
        });
      },
      error: error => {
        this.logger.error('Error handling node parent change', { error, change });
      },
    });
  }

  private handleEdgeVerticesChanged(edge: any): void {
    if (!edge || !this.dfdId) {
      this.logger.warn('Cannot handle edge vertices changed - missing edge or diagram ID');
      return;
    }

    const vertices = edge.getVertices();
    this.logger.debug('Handling edge vertices changed', { edgeId: edge.id, vertices });

    this.dfdInfrastructure
      .handleEdgeVerticesChanged(edge.id, vertices, this.dfdId, this.isSystemInitialized)
      .subscribe({
        next: () => {
          this.logger.debug('Edge vertices changed successfully', { edgeId: edge.id });
        },
        error: error => {
          this.logger.error('Error handling edge vertices changed', { error, edgeId: edge.id });
        },
      });
  }

  private loadDiagramData(dfdId: string): void {
    // Use AppDfdOrchestrator to load diagram
    this.appDfdOrchestrator.loadDiagram(dfdId).subscribe({
      next: result => {
        if (result.success) {
          this.logger.debugComponent(
            'DfdComponent',
            'Diagram loaded successfully via AppDfdOrchestrator',
          );

          // Clear selection and clipboard after successful diagram load
          // Note: History is already cleared by AppDiagramLoadingService before re-enabling history recording
          const graphAdapter = this.dfdInfrastructure.graphAdapter;
          if (graphAdapter) {
            // Clear selection
            const graph = this.appDfdOrchestrator.getGraph;
            if (graph) {
              graph.unselect(graph.getSelectedCells());
              this.logger.debug('Cleared selection after diagram load');
            }

            // Clear clipboard
            graphAdapter.clearClipboard();
            this.logger.debug('Cleared clipboard after diagram load');
          }
        } else {
          this.logger.error('Failed to load diagram', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error loading diagram', { error });
      },
    });
  }

  // Toolbar Methods - Using AppDfdOrchestrator

  addGraphNode(nodeType: string): void {
    // Map string nodeType to NodeType enum
    const mappedNodeType = this.mapStringToNodeType(nodeType);
    this.onAddNode(mappedNodeType);
  }

  deleteSelected(): void {
    this.onDeleteSelected();
  }

  showHistory(): void {
    // Get custom history state from orchestrator
    const historyState = this.appDfdOrchestrator.getHistoryState();
    if (!historyState) {
      this.logger.warn('Cannot show history: History state not available');
      return;
    }

    // Open the history dialog with custom history data
    const dialogData: HistoryDialogData = {
      historyState: historyState,
      historyService: this.appDfdOrchestrator.getHistoryService(),
    };

    this.dialog.open(HistoryDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this.logger.info('Opened history dialog');
  }

  showGraphData(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.warn('Cannot show graph data: Graph not available');
      return;
    }

    // Open the graph data dialog
    const dialogData: GraphDataDialogData = {
      graph: graph,
    };

    this.dialog.open(GraphDataDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this.logger.info('Opened graph data dialog');
  }

  showHelp(): void {
    this.dialog.open(HelpDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
    });

    this.logger.info('Opened help dialog');
  }

  showClipboard(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.warn('Cannot show clipboard: Graph not available');
      return;
    }

    // Open the clipboard dialog
    const dialogData: ClipboardDialogData = {
      graph: graph,
    };

    this.dialog.open(ClipboardDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this.logger.info('Opened clipboard dialog');
  }

  onAddNode(nodeType: NodeType): void {
    if (this.isReadOnlyMode) return;

    // Check if DFD system is initialized before attempting to add node
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot add node: DFD system not yet initialized');
      return;
    }

    this.appDfdOrchestrator
      .addNode(nodeType) // Use InfraNodeService intelligent positioning algorithm
      .subscribe({
        next: result => {
          if (result.success) {
            this.logger.debug('Node added successfully using intelligent positioning', {
              nodeType,
              usedIntelligentPositioning: result.metadata?.['usedIntelligentPositioning'],
              method: result.metadata?.['method'],
            });
          } else {
            this.logger.error('Failed to add node', { error: result.error });
          }
        },
        error: error => {
          this.logger.error('Error adding node', { error });
        },
      });
  }

  onDeleteSelected(): void {
    if (this.isReadOnlyMode || !this.hasSelectedCells) return;

    // Check if DFD system is initialized before attempting to delete
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot delete cells: DFD system not yet initialized');
      return;
    }

    this.appDfdOrchestrator.deleteSelectedCells().subscribe({
      next: result => {
        if (result.success) {
          this.logger.debug('Selected cells deleted successfully');
        } else {
          this.logger.error('Failed to delete selected cells', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error deleting selected cells', { error });
      },
    });
  }

  onUndo(): void {
    if (!this.canUndo || this.isReadOnlyMode) return;

    // Use orchestrator's undo functionality (custom history system)
    this.appDfdOrchestrator.undo().subscribe({
      next: result => {
        if (result.success) {
          this.logger.debug('Undo operation completed successfully');
        } else {
          this.logger.error('Undo operation failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error during undo operation', { error });
      },
    });
  }

  onRedo(): void {
    if (!this.canRedo || this.isReadOnlyMode) return;

    // Use orchestrator's redo functionality (custom history system)
    this.appDfdOrchestrator.redo().subscribe({
      next: result => {
        if (result.success) {
          this.logger.debug('Redo operation completed successfully');
        } else {
          this.logger.error('Redo operation failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error during redo operation', { error });
      },
    });
  }

  onCut(): void {
    if (!this.hasSelectedCells || this.isReadOnlyMode) return;

    this.logger.debug('Cut operation initiated');
    this.dfdInfrastructure.cut().subscribe({
      next: result => {
        if (result.success) {
          this.logger.info('Cut operation completed', { cutCount: result.cutCount });
        } else {
          this.logger.error('Cut operation failed');
        }
      },
      error: error => {
        this.logger.error('Error during cut operation', { error });
      },
    });
  }

  onCopy(): void {
    if (!this.hasSelectedCells) return;

    this.logger.debug('Copy operation initiated');
    this.dfdInfrastructure.copy();
  }

  onPaste(): void {
    if (this.isReadOnlyMode) return;

    this.logger.debug('Paste operation initiated');
    this.dfdInfrastructure.paste();
  }

  // Template compatibility methods
  undo(): void {
    this.onUndo();
  }

  redo(): void {
    this.onRedo();
  }

  cut(): void {
    this.onCut();
  }

  copy(): void {
    this.onCopy();
  }

  paste(): void {
    this.onPaste();
  }

  onSelectAll(): void {
    this.appDfdOrchestrator.selectAll();
  }

  onClearSelection(): void {
    this.appDfdOrchestrator.clearSelection();
  }

  zoomToFit(): void {
    this.appDfdOrchestrator.zoomToFit();
  }

  onSaveManually(): void {
    if (this.isReadOnlyMode) return;

    // Check if DFD system is initialized before attempting to save
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot save manually: DFD system not yet initialized');
      return;
    }

    // Generate thumbnail SVG before saving
    this._captureDiagramSvgThumbnail()
      .then(base64Svg => {
        const imageData = {
          svg: base64Svg || undefined,
        };

        // Save with thumbnail
        this.appDfdOrchestrator.saveManuallyWithImage(imageData).subscribe({
          next: () => {
            this.logger.info('Manual save with thumbnail completed successfully');
          },
          error: error => {
            this.logger.error('Error during manual save with thumbnail', { error });
          },
        });
      })
      .catch(error => {
        this.logger.error('Error capturing SVG thumbnail, saving without image', error);
        // Fall back to save without thumbnail
        this.appDfdOrchestrator.saveManually().subscribe({
          next: result => {
            if (result.success) {
              this.logger.info('Manual save completed successfully (without thumbnail)');
            } else {
              this.logger.error('Manual save failed', { error: result.error });
            }
          },
          error: saveError => {
            this.logger.error('Error during manual save', { error: saveError });
          },
        });
      });
  }

  onExport(format: ExportFormat): void {
    // Check if DFD system is initialized before attempting to export
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot export diagram: DFD system not yet initialized');
      return;
    }

    this.appDfdOrchestrator.exportDiagram(format).subscribe({
      next: blob => {
        // Create download link
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.diagramName || 'diagram'}.${format}`;
        link.click();
        URL.revokeObjectURL(url);

        this.logger.info('Diagram exported successfully', { format });
      },
      error: error => {
        this.logger.error('Error exporting diagram', { error, format });
      },
    });
  }

  // Template compatibility methods
  exportDiagram(format: ExportFormat): void {
    this.onExport(format);
  }

  manageMetadata(): void {
    this.onEditMetadata();
  }

  openThreatEditor(): void {
    if (!this.threatModelId) {
      this.logger.warn('Cannot open threat editor: No threat model ID available');
      return;
    }

    // Get the target cell (right-clicked or selected)
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    const cellId = targetCell?.id;

    this.logger.info('Opening threat editor dialog for new threat creation on DFD page', {
      threatModelId: this.threatModelId,
      dfdId: this.dfdId,
      cellId,
      cellType: targetCell?.isNode?.() ? 'node' : targetCell?.isEdge?.() ? 'edge' : 'unknown',
    });

    // Load threat model to get framework information
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId).subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found', { id: this.threatModelId });
            return;
          }

          const frameworkName = threatModel.threat_model_framework;

          // Load framework to get threat types
          this._subscriptions.add(
            this.frameworkService.loadFramework(frameworkName).subscribe({
              next: framework => {
                if (!framework) {
                  this.logger.warn('Framework not found, proceeding without framework', {
                    frameworkName,
                  });
                }

                // Extract diagram and cell data from X6 graph
                const graph = this.appDfdOrchestrator.getGraph;
                let cellData;

                if (graph && this.dfdId && this.diagramName) {
                  cellData = this.cellDataExtractionService.extractFromX6Graph(
                    graph,
                    this.dfdId,
                    this.diagramName,
                  );
                } else {
                  cellData = { diagrams: [], cells: [] };
                }

                // Determine shape type for threat type filtering
                let shapeType: string | undefined;
                if (targetCell?.isNode?.()) {
                  const cellData = targetCell.getData();
                  shapeType = cellData?.nodeType || targetCell.shape;
                }

                // Open the threat editor dialog
                const dialogData: ThreatEditorDialogData = {
                  threatModelId: this.threatModelId!,
                  mode: 'create',
                  diagramId: this.dfdId || undefined,
                  cellId: cellId,
                  diagrams: cellData.diagrams,
                  cells: cellData.cells,
                  assets:
                    threatModel.assets?.map(a => ({ id: a.id, name: a.name, type: a.type })) || [],
                  framework: framework || undefined,
                  shapeType: shapeType,
                };

                const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
                  width: '650px',
                  maxHeight: '90vh',
                  panelClass: 'threat-editor-dialog-650',
                  data: dialogData,
                });

                dialogRef.afterClosed().subscribe(result => {
                  if (result) {
                    this.logger.info('Threat editor closed with result, creating threat');
                    this._createThreat(result);
                  }
                });
              },
              error: error => {
                this.logger.error('Failed to load framework', error);
              },
            }),
          );
        },
        error: error => {
          this.logger.error('Failed to load threat model', error);
        },
      }),
    );
  }

  manageThreats(): void {
    // Get the target cell (right-clicked or selected)
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.warn('Manage threats requires a cell');
      return;
    }

    if (!this.threatModelId) {
      this.logger.warn('Cannot manage threats: No threat model ID available');
      return;
    }

    const cellId = targetCell.id;
    this.logger.info('Managing threats for cell', {
      cellId,
      threatModelId: this.threatModelId,
      cellType: targetCell.isNode() ? 'node' : 'edge',
    });

    // Load threat model to get threats associated with this cell
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId).subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found', { id: this.threatModelId });
            return;
          }

          // Filter threats for this specific cell
          const cellThreats = (threatModel.threats || []).filter(
            threat => threat.cell_id === cellId,
          );

          this.logger.info('Found threats for cell', {
            cellId,
            threatCount: cellThreats.length,
          });

          // Extract diagram and cell data from X6 graph
          const graph = this.appDfdOrchestrator.getGraph;
          let cellData;

          if (graph && this.dfdId && this.diagramName) {
            cellData = this.cellDataExtractionService.extractFromX6Graph(
              graph,
              this.dfdId,
              this.diagramName,
            );
          } else {
            cellData = { diagrams: [], cells: [] };
          }

          // Get cell label for display
          const cellLabel = targetCell.getLabel?.() || cellId;

          // Open the threats dialog
          const dialogData: ThreatsDialogData = {
            threats: cellThreats,
            isReadOnly: this.isReadOnlyMode,
            objectType: targetCell.isNode() ? 'node' : 'edge',
            objectName: cellLabel,
            threatModelId: this.threatModelId || undefined,
            diagramId: this.dfdId || undefined,
            diagramName: this.diagramName || undefined,
            diagrams: cellData.diagrams,
            cells: cellData.cells,
          };

          this.dialog.open(ThreatsDialogComponent, {
            width: '800px',
            maxHeight: '90vh',
            data: dialogData,
          });
        },
        error: error => {
          this.logger.error('Failed to load threat model', error);
        },
      }),
    );
  }

  closeDiagram(): void {
    this.logger.info('Closing diagram');

    // Always save with SVG thumbnail before closing (for better diagram previews)
    // Save even if no unsaved changes to ensure thumbnail is up-to-date
    if (!this.isReadOnlyMode) {
      this.logger.info('Saving diagram with SVG thumbnail before closing');

      // Capture SVG thumbnail then save
      this._captureDiagramSvgThumbnail()
        .then(base64Svg => {
          const imageData = {
            svg: base64Svg || undefined,
          };

          // Start save request (fire-and-forget - navigate immediately after request is sent)
          this.appDfdOrchestrator.saveManuallyWithImage(imageData).subscribe({
            next: () => {
              this.logger.info('Diagram and thumbnail save completed successfully');
            },
            error: (error: unknown) => {
              this.logger.error('Failed to save diagram with thumbnail', { error });
            },
          });

          // Navigate away immediately after starting the save request
          this.logger.info('Save request initiated, navigating away');
          this._navigateAway();
        })
        .catch((error: unknown) => {
          this.logger.error('Error capturing SVG thumbnail, saving without image', error);
          // Fall back to save without thumbnail
          this._fallbackSaveAndNavigate();
        });
    } else {
      this._navigateAway();
    }
  }

  /**
   * Fallback save without thumbnail (used when thumbnail capture fails)
   */
  private _fallbackSaveAndNavigate(): void {
    // Start save request (fire-and-forget - navigate immediately after request is sent)
    this.appDfdOrchestrator.saveManually().subscribe({
      next: () => {
        this.logger.info('Diagram save completed successfully (without thumbnail)');
      },
      error: (error: unknown) => {
        this.logger.error('Failed to save diagram', { error });
      },
    });

    // Navigate away immediately after starting the save request
    this.logger.info('Save request initiated (no thumbnail), navigating away');
    this._navigateAway();
  }

  /**
   * Capture SVG from the current graph and return as base64 encoded string (for thumbnails)
   */
  private _captureDiagramSvgThumbnail(): Promise<string | null> {
    return new Promise(resolve => {
      const graphAdapter = this.dfdInfrastructure.graphAdapter;
      if (!graphAdapter || !graphAdapter.isInitialized()) {
        this.logger.warn('Cannot capture SVG - graph not initialized');
        resolve(null);
        return;
      }

      const graph = graphAdapter.getGraph();
      if (!graph) {
        this.logger.warn('Cannot capture SVG - graph is null');
        resolve(null);
        return;
      }

      // Get export service from infrastructure
      const exportService = this.dfdInfrastructure.exportService;
      if (!exportService) {
        this.logger.warn('Cannot capture SVG - export service not available');
        resolve(null);
        return;
      }

      const exportPrep = exportService.prepareImageExport(graph);
      if (!exportPrep) {
        resolve(null);
        return; // prepareImageExport handles logging
      }

      // Clear selection before capturing thumbnail to avoid highlighting selected cells
      this.appDfdOrchestrator.clearSelection();

      // Cast graph to access export methods added by the X6 export plugin
      const exportGraph = graph as {
        toSVG: (
          callback: (svgString: string) => void,
          options?: {
            padding?: number;
            viewBox?: string;
            preserveAspectRatio?: string;
            copyStyles?: boolean;
          },
        ) => void;
      };

      try {
        exportGraph.toSVG((svgString: string) => {
          try {
            const base64Svg = exportService.processSvg(svgString, true, exportPrep.viewBox);
            this.logger.debug('Successfully captured and cleaned diagram SVG thumbnail', {
              originalLength: svgString.length,
              base64Length: base64Svg.length,
            });
            resolve(base64Svg);
          } catch (error: unknown) {
            this.logger.error('Error encoding SVG to base64', error);
            resolve(null);
          }
        }, exportPrep.exportOptions);
      } catch (error: unknown) {
        this.logger.error('Error capturing SVG', error);
        resolve(null);
      }
    });
  }

  editCellText(): void {
    const cell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!cell) {
      this.logger.info('Edit cell text requires a selected cell');
      return;
    }

    this.logger.info('Edit cell text requested', { cellId: cell.id });

    // Use the graph adapter's label editing functionality
    const graphAdapter = this.dfdInfrastructure.graphAdapter;
    if (graphAdapter && graphAdapter.startLabelEditing) {
      // Create a synthetic double-click event for the label editor
      const syntheticEvent = new MouseEvent('dblclick', {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      });

      // Trigger the label editor directly
      graphAdapter.startLabelEditing(cell, syntheticEvent);
      this.logger.debug('Label editor triggered for cell', { cellId: cell.id });
    } else {
      this.logger.warn('Label editing not available - graph adapter or method not found');
    }
  }

  private getFirstSelectedCell(): any {
    const selectedCells = this.appDfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) return null;

    const graph = this.appDfdOrchestrator.getGraph;
    return graph ? graph.getCellById(selectedCells[0]) : null;
  }

  // Z-order methods
  moveForward(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move forward');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedForward();
    this.logger.debug('Moved cell forward', { cellId: targetCell.id });
  }

  moveBackward(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move backward');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedBackward();
    this.logger.debug('Moved cell backward', { cellId: targetCell.id });
  }

  moveToFront(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move to front');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedToFront();
    this.logger.debug('Moved cell to front', { cellId: targetCell.id });
  }

  moveToBack(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move to back');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedToBack();
    this.logger.debug('Moved cell to back', { cellId: targetCell.id });
  }

  // Edge methods
  addInverseConnection(): void {
    const edge = this._rightClickedCell || this.getFirstSelectedCell();
    if (!edge || !edge.isEdge()) {
      this.logger.info('Add inverse connection requires an edge');
      return;
    }

    const diagramId = this.dfdId || 'default-diagram';

    // Use facade service for proper business logic and error handling
    this.dfdInfrastructure.addInverseConnection(edge, diagramId).subscribe({
      next: () => {
        this.logger.info('Successfully added inverse connection', {
          originalEdgeId: edge.id,
          diagramId,
        });
      },
      error: error => {
        this.logger.error('Failed to add inverse connection', {
          error,
          originalEdgeId: edge.id,
          diagramId,
        });
      },
    });
  }

  /**
   * Open the data asset selection dialog for the right-clicked edge
   */
  selectDataAsset(): void {
    const edge = this._rightClickedCell;
    if (!edge || !edge.isEdge()) {
      this.logger.info('Select data asset requires an edge');
      return;
    }

    if (!this.threatModelId) {
      this.logger.warn('Cannot open data asset dialog: No threat model ID available');
      return;
    }

    // Get current data asset ID from cell data
    const cellData = edge.getData() || {};
    const currentDataAssetId = cellData.dataAssetId;

    // Load threat model to get assets
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId).subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found', { id: this.threatModelId });
            return;
          }

          const assets = threatModel.assets || [];

          // Determine if dialog should be read-only based on authorization
          const isReadOnly = this.isReadOnlyMode;

          const dialogData: DataAssetDialogData = {
            cellId: edge.id,
            currentDataAssetId: currentDataAssetId,
            assets: assets,
            isReadOnly: isReadOnly,
          };

          const dialogRef = this.dialog.open(DataAssetDialogComponent, {
            width: '500px',
            data: dialogData,
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result !== undefined) {
              this._updateCellDataAsset(edge.id, result);
            }
          });
        },
        error: error => {
          this.logger.error('Failed to load threat model for data asset dialog', error);
        },
      }),
    );
  }

  /**
   * Update the data asset ID for a cell
   * @param cellId The ID of the cell to update
   * @param dataAssetId The new data asset ID (null to remove)
   */
  private _updateCellDataAsset(cellId: string, dataAssetId: string | null): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Cannot update cell data asset: graph not available');
      return;
    }

    const cell = graph.getCellById(cellId);
    if (!cell) {
      this.logger.error('Cannot update cell data asset: cell not found', { cellId });
      return;
    }

    const currentData = cell.getData() || {};
    const updatedData = { ...currentData };

    // If dataAssetId is null, delete the property; otherwise set it
    if (dataAssetId === null) {
      delete updatedData.dataAssetId;
    } else {
      updatedData.dataAssetId = dataAssetId;
    }

    cell.setData(updatedData);

    this.logger.info('Updated cell data asset', {
      cellId,
      dataAssetId: dataAssetId || 'none',
    });

    // The existing auto-save mechanism will handle persistence
  }

  isRightClickedCellEdge(): boolean {
    return (
      this._rightClickedCell && this._rightClickedCell.isEdge && this._rightClickedCell.isEdge()
    );
  }

  getRightClickedCell(): any {
    return this._rightClickedCell;
  }

  showCellProperties(): void {
    // Get the target cell (right-clicked or selected)
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('Show cell properties requires a cell');
      return;
    }

    // Log cell properties for debugging
    this.logger.info('Cell properties', {
      id: targetCell.id,
      shape: targetCell.shape,
      position: targetCell.getPosition?.() || 'N/A',
      size: targetCell.getSize?.() || 'N/A',
      attrs: targetCell.getAttrs(),
      data: targetCell.getData(),
    });

    // Open the cell properties dialog
    const dialogData: CellPropertiesDialogData = {
      cell: targetCell,
    };

    this.dialog.open(CellPropertiesDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });
  }

  // Edge Observable Subscriptions

  private setupEdgeObservableSubscriptions(): void {
    this.logger.debugComponent(
      'DfdComponent',
      'Setting up edge and history observable subscriptions',
    );

    // Subscribe to node and edge added events from the graph adapter
    const graphAdapter = this.dfdInfrastructure.graphAdapter;
    if (graphAdapter) {
      // Subscribe to node added events for history tracking
      this._subscriptions.add(
        graphAdapter.nodeAdded$.pipe(takeUntil(this._destroy$)).subscribe(node => {
          this.logger.info('DFD Component: nodeAdded$ observable fired', {
            nodeId: node.id,
          });
          this.handleNodeAdded(node);
        }),
      );

      // Subscribe to edge added events for history tracking
      this._subscriptions.add(
        graphAdapter.edgeAdded$.pipe(takeUntil(this._destroy$)).subscribe(edge => {
          this.logger.info('DFD Component: edgeAdded$ observable fired', {
            edgeId: edge.id,
          });
          this.handleEdgeAdded(edge);
        }),
      );

      // Drag completion is now handled by the orchestrator service directly
      // which subscribes to dragCompletions$ and creates history entries
      // No need for component-level handling

      // Subscribe to cell label change events for history tracking
      this._subscriptions.add(
        this.dfdInfrastructure.cellLabelChanged$
          .pipe(takeUntil(this._destroy$))
          .subscribe(change => {
            this.logger.info('DFD Component: cellLabelChanged$ observable fired', {
              cellId: change.cellId,
              cellType: change.cellType,
            });
            this.handleLabelChange(change);
          }),
      );

      // Subscribe to edge reconnection events for history tracking
      this._subscriptions.add(
        this.dfdInfrastructure.edgeReconnected$
          .pipe(takeUntil(this._destroy$))
          .subscribe(reconnection => {
            this.logger.info('DFD Component: edgeReconnected$ observable fired', {
              edgeId: reconnection.edgeId,
              changeType: reconnection.changeType,
            });
            this.handleEdgeReconnection(reconnection);
          }),
      );

      // Subscribe to node parent change events for history tracking (embedding/unembedding)
      this._subscriptions.add(
        this.dfdInfrastructure.nodeParentChanged$
          .pipe(takeUntil(this._destroy$))
          .subscribe(change => {
            this.logger.info('DFD Component: nodeParentChanged$ observable fired', {
              nodeId: change.nodeId,
              oldParentId: change.oldParentId,
              newParentId: change.newParentId,
            });
            this.handleNodeParentChange(change);
          }),
      );

      this.logger.debugComponent(
        'DfdComponent',
        'Edge and history observable subscriptions set up successfully',
      );
    } else {
      this.logger.warn('Graph adapter not available for edge and history subscriptions');
    }
  }

  // Context Menu Methods

  private setupContextMenuHandlers(): void {
    // Get the graph adapter's context menu observable through the facade
    const graphAdapter = this.dfdInfrastructure.graphAdapter;
    if (graphAdapter && graphAdapter.cellContextMenu$) {
      this._subscriptions.add(
        graphAdapter.cellContextMenu$
          .pipe(takeUntil(this._destroy$))
          .subscribe(({ cell, x, y }: { cell: any; x: number; y: number }) => {
            this.openCellContextMenu(cell, x, y);
          }),
      );
      this.logger.debug('Context menu handlers registered');
    } else {
      this.logger.warn('Context menu observable not available from graph adapter');
    }
  }

  private openCellContextMenu(cell: any, x: number, y: number): void {
    // Store the right-clicked cell for context menu actions
    this._rightClickedCell = cell;

    // Update context menu position
    this.contextMenuPosition = {
      x: `${x}px`,
      y: `${y}px`,
    };

    // Select the cell that was right-clicked
    const graph = this.appDfdOrchestrator.getGraph;
    if (graph && cell) {
      graph.select(cell);
      this.updateSelectionState();
    }

    // Open the context menu
    if (this.contextMenuTrigger) {
      this.contextMenuTrigger.openMenu();
      this.cdr.detectChanges();
    }

    this.logger.debug('Context menu opened for cell', {
      cellId: cell?.id,
      cellType: cell?.isNode?.() ? 'node' : cell?.isEdge?.() ? 'edge' : 'unknown',
      position: { x, y },
    });
  }

  onContextMenu(event: MouseEvent): void {
    // This method is kept for any manual context menu triggers
    event.preventDefault();
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`,
    };
    this.contextMenuTrigger.openMenu();
  }

  onEditMetadata(): void {
    if (!this.hasExactlyOneSelectedCell) return;

    // Check if DFD system is initialized before attempting to edit metadata
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot edit metadata: DFD system not yet initialized');
      return;
    }

    const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
    if (selectedCellIds.length === 0) return;

    // Get the actual cell object from the graph
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    const cell = graph.getCellById(selectedCellIds[0]);
    if (!cell) return;

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '600px',
      data: {
        threatModelId: this.threatModelId,
        cellId: cell.id,
        // Get metadata from the data.metadata field (where it's stored as an array)
        metadata: cell.getData()?.metadata || [],
      } as MetadataDialogData,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Determine if cell is a node or edge and use the appropriate operation type
        const isEdge = cell.isEdge();

        // Update cell metadata through orchestrator
        const operation = isEdge
          ? {
              id: `update-metadata-${Date.now()}`,
              type: 'update-edge' as const,
              source: 'user-interaction' as const,
              priority: 'high' as const,
              timestamp: Date.now(),
              edgeId: cell.id,
              updates: {
                properties: { metadata: result },
              },
            }
          : {
              id: `update-metadata-${Date.now()}`,
              type: 'update-node' as const,
              source: 'user-interaction' as const,
              priority: 'high' as const,
              timestamp: Date.now(),
              nodeId: cell.id,
              updates: {
                properties: { metadata: result },
              },
            };

        this.appDfdOrchestrator.executeOperation(operation as any).subscribe({
          next: operationResult => {
            if (operationResult.success) {
              this.logger.debug('Cell metadata updated successfully');
            } else {
              this.logger.error('Failed to update cell metadata', {
                error: operationResult.error,
              });
            }
          },
          error: error => {
            this.logger.error('Error updating cell metadata', { error });
          },
        });
      }
    });
  }

  // Keyboard Shortcuts

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Handle Ctrl+S/Cmd+S for manual save with thumbnail
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault(); // Prevent browser save dialog
      this.onSaveManually();
      return;
    }

    // Delegate other keyboard events to orchestrator for centralized keyboard handling
    this.appDfdOrchestrator.onKeyDown(event);
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(_event: Event): void {
    // Delegate to orchestrator for centralized resize handling
    this.appDfdOrchestrator.onWindowResize();
  }

  // Helper Methods

  private updateSelectionState(): void {
    if (!this.appDfdOrchestrator.getState().initialized) {
      return;
    }

    const selectedCells = this.appDfdOrchestrator.getSelectedCells();
    const oldHasSelectedCells = this.hasSelectedCells;
    const oldHasExactlyOneSelectedCell = this.hasExactlyOneSelectedCell;
    const oldSelectedCellIsTextBox = this.selectedCellIsTextBox;
    const oldSelectedCellIsSecurityBoundary = this.selectedCellIsSecurityBoundary;

    this.hasSelectedCells = selectedCells.length > 0;
    this.hasExactlyOneSelectedCell = selectedCells.length === 1;

    if (this.hasExactlyOneSelectedCell) {
      const graph = this.appDfdOrchestrator.getGraph;
      if (graph) {
        const cell = graph.getCellById(selectedCells[0]);
        if (cell) {
          const cellData = cell.getData();
          this.selectedCellIsTextBox =
            cellData?.nodeType === 'text-box' || cell.shape === 'text-box';
          this.selectedCellIsSecurityBoundary =
            cellData?.nodeType === 'security-boundary' || cell.shape === 'security-boundary';
        } else {
          this.selectedCellIsTextBox = false;
          this.selectedCellIsSecurityBoundary = false;
        }
      }
    } else {
      this.selectedCellIsTextBox = false;
      this.selectedCellIsSecurityBoundary = false;
    }

    // Only trigger change detection if state actually changed
    if (
      oldHasSelectedCells !== this.hasSelectedCells ||
      oldHasExactlyOneSelectedCell !== this.hasExactlyOneSelectedCell ||
      oldSelectedCellIsTextBox !== this.selectedCellIsTextBox ||
      oldSelectedCellIsSecurityBoundary !== this.selectedCellIsSecurityBoundary
    ) {
      this.cdr.detectChanges();
    }
  }

  private mapStringToNodeType(nodeType: string): NodeType {
    switch (nodeType) {
      case 'actor':
        return 'actor';
      case 'process':
        return 'process';
      case 'store':
        return 'store';
      case 'security-boundary':
        return 'security-boundary';
      case 'text-box':
        return 'text-box'; // Fix: Use correct text-box node type
      default:
        return 'process';
    }
  }

  private _navigateAway(): void {
    if (this.threatModelId) {
      this.logger.info('Navigating back to threat model', { threatModelId: this.threatModelId });
      this.router
        .navigate(['/tm', this.threatModelId], { queryParams: { refresh: 'true' } })
        .catch(error => {
          this.logger.error('Failed to navigate back to threat model', { error });
          // Fallback: navigate to TM list
          this.router.navigate(['/dashboard']).catch(fallbackError => {
            this.logger.error('Failed to navigate to TM list as fallback', { fallbackError });
          });
        });
    } else {
      this.logger.warn('Cannot navigate: No threat model ID available, navigating to TM list');
      this.router.navigate(['/dashboard']).catch(error => {
        this.logger.error('Failed to navigate to TM list', { error });
      });
    }
  }

  /**
   * Helper method to create a new threat in the threat model
   */
  private _createThreat(threatData: any): void {
    if (!this.threatModelId) {
      this.logger.error('Cannot create threat: No threat model ID available');
      return;
    }

    this._subscriptions.add(
      this.threatModelService.getThreatModelById(this.threatModelId).subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found for threat creation', {
              id: this.threatModelId,
            });
            return;
          }

          // Generate a unique ID for the new threat
          const newThreat = {
            id: `threat-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            threat_model_id: this.threatModelId!,
            name: threatData.name,
            description: threatData.description,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            diagram_id: threatData.diagram_id,
            cell_id: threatData.cell_id,
            severity: threatData.severity,
            score: threatData.score,
            priority: threatData.priority,
            mitigated: threatData.mitigated,
            status: threatData.status,
            threat_type: threatData.threat_type,
            issue_uri: threatData.issue_uri,
            metadata: threatData.metadata || [],
          };

          // Add the new threat to the threat model
          const updatedThreats = [...(threatModel.threats || []), newThreat];
          const updatedThreatModel = { ...threatModel, threats: updatedThreats };

          // Save the updated threat model
          this._subscriptions.add(
            this.threatModelService.updateThreatModel(updatedThreatModel).subscribe({
              next: () => {
                this.logger.info('Threat created successfully', { threatId: newThreat.id });
              },
              error: error => {
                this.logger.error('Failed to create threat', error);
              },
            }),
          );
        },
        error: error => {
          this.logger.error('Failed to load threat model for threat creation', error);
        },
      }),
    );
  }
}
