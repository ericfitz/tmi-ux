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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuTrigger } from '@angular/material/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Cell } from '@antv/x6';
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
import { AppRemoteOperationHandler } from '../../application/services/app-remote-operation-handler.service';
import { AppHistoryService } from '../../application/services/app-history.service';
import { AppCellOperationConverterService } from '../../application/services/app-cell-operation-converter.service';
import { AppGraphOperationManager } from '../../application/services/app-graph-operation-manager.service';
import { AppPersistenceCoordinator } from '../../application/services/app-persistence-coordinator.service';
import { AppDiagramResyncService } from '../../application/services/app-diagram-resync.service';
import { AppWebSocketEventProcessor } from '../../application/services/app-websocket-event-processor.service';
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
import { X6TooltipAdapter } from '../../infrastructure/adapters/infra-x6-tooltip.adapter';
import { UiTooltipService } from '../services/ui-tooltip.service';
import { DfdNodeTypeService } from '../services/dfd-node-type.service';
import { InfraEdgeQueryService } from '../../infrastructure/services/infra-edge-query.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraEmbeddingService } from '../../infrastructure/services/infra-embedding.service';
import { InfraPortStateService } from '../../infrastructure/services/infra-port-state.service';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { InfraX6CoreOperationsService } from '../../infrastructure/services/infra-x6-core-operations.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { InfraVisualEffectsService } from '../../infrastructure/services/infra-visual-effects.service';
import { InfraDfdValidationService } from '../../infrastructure/services/infra-dfd-validation.service';

// Essential v1 components still needed
import { NodeType } from '../../domain/value-objects/node-info';
import { ColorPaletteEntry } from '../../types/color-palette.types';
import { DfdCollaborationComponent } from './collaboration/collaboration.component';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { MatDialog } from '@angular/material/dialog';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { ThreatModelAuthorizationService } from '../../../tm/services/threat-model-authorization.service';
import { MetadataDialogData } from '../../../tm/components/metadata-dialog/metadata-dialog.component';
import { CellPropertiesDialogData } from './cell-properties-dialog/cell-properties-dialog.component';
import { HistoryDialogData } from './history-dialog/history-dialog.component';
import { GraphDataDialogData } from './graph-data-dialog/graph-data-dialog.component';
import { ClipboardDialogData } from './clipboard-dialog/clipboard-dialog.component';
import {
  StylePanelComponent,
  CellStyleInfo,
  StyleChangeEvent,
} from './style-panel/style-panel.component';
import {
  IconPickerPanelComponent,
  IconPickerCellInfo,
  IconSelectedEvent,
  IconRemovedEvent,
  PlacementChangedEvent,
} from './icon-picker-panel/icon-picker-panel.component';
import { ArchIconData, ICON_ELIGIBLE_SHAPES } from '../../types/arch-icon.types';
import { isCellLayoutLocked } from '../../utils/layout-lock.util';
import {
  PortLabelPopoverComponent,
  PortLabelData,
  PortLabelChangeEvent,
  DEFAULT_PORT_LABEL_POSITION,
  PortLabelPosition,
} from './port-label-popover/port-label-popover.component';

import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { InlineEditComponent } from '../../../../shared/components/inline-edit/inline-edit.component';
import { ThreatEditorDialogData } from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { ThreatsDialogData } from '../../../tm/components/threats-dialog/threats-dialog.component';
import { environment } from '../../../../../environments/environment';
import { DfdDialogService } from '../services/dfd-dialog.service';
import { DfdCommandService } from '../services/dfd-command.service';
import { DfdLayoutService } from '../services/dfd-layout.service';
import { DfdIconService } from '../services/dfd-icon.service';
import { DfdStylingService } from '../services/dfd-styling.service';
import { GraphOperation } from '../../types/graph-operation.types';

// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: enumerate supported diagram export image formats (pure)
type ExportFormat = 'png' | 'jpeg' | 'svg';

@Component({
  selector: 'app-dfd',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatCheckboxModule,
    MatMenuModule,
    MatTooltipModule,
    TranslocoModule,
    DfdCollaborationComponent,
    InlineEditComponent,
    StylePanelComponent,
    PortLabelPopoverComponent,
    IconPickerPanelComponent,
  ],
  providers: [
    // DFD v2 Architecture - Component-scoped services
    AppDfdOrchestrator, // Main coordination service
    AppDfdFacade, // Facade encapsulates all infrastructure dependencies
    AppEdgeService, // Application edge service
    AppOperationStateManager, // Operation state management service
    AppDiagramService, // Diagram data management service
    AppDiagramLoadingService, // Diagram loading service
    AppRemoteOperationHandler, // Remote operation handler service
    AppHistoryService, // Custom history service for undo/redo
    AppCellOperationConverterService, // Cell-to-operation converter service
    AppGraphOperationManager, // Operation manager service
    AppPersistenceCoordinator, // Simplified persistence coordination service
    AppDiagramResyncService, // Diagram resync service (changed from root to component-scoped)
    AppWebSocketEventProcessor, // WebSocket event processor service
    AppStateService, // State service (changed from root to component-scoped)
    AppOperationRejectionHandler, // Operation rejection handler service
    // Note: AppNotificationService is provided at root level via app.config.ts
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
    X6TooltipAdapter,
    UiTooltipService,
    InfraEdgeQueryService,
    InfraNodeConfigurationService,
    InfraEmbeddingService,
    InfraPortStateService,
    InfraNodeService,
    InfraX6CoreOperationsService,
    InfraEdgeService,
    InfraDfdValidationService,
  ],
  templateUrl: './dfd.component.html',
  styleUrls: ['./dfd.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: root component orchestrating the interactive data flow diagram editor page
export class DfdComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef;
  @ViewChild('contextMenuTrigger') contextMenuTrigger!: MatMenuTrigger;

  private readonly _destroy$ = new Subject<void>();
  private _subscriptions = new Subscription();
  // Suppress auto-layout trigger handlers while a cycle is in progress
  // (cell.resize / child.position calls during layout would otherwise re-fire
  // the same handler and recurse).
  private _inLayoutCycle = false;

  // Collaborative editing state
  isReadOnlyMode = false;
  isCollaborating = false;

  // Route parameters
  threatModelId: string | null = null;
  dfdId: string | null = null;
  joinCollaboration = false;

  // Diagram data
  diagramName: string | null = null;
  diagramDescription: string | null = null;
  includeInReport = true;
  timmyEnabled = true;
  threatModelName: string | null = null;
  threatModelPermission: 'reader' | 'writer' | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;
  selectedCellIsSecurityBoundary = false;
  selectedCellIsLockEligible = false;
  rightClickedCellIsLocked = false;
  isSystemInitialized = false;

  // Undo/redo state properties
  canUndo = false;
  canRedo = false;

  // Clipboard state
  hasClipboardContent = false;

  // Style panel state
  isStylePanelOpen = false;
  stylePanelCells: CellStyleInfo[] = [];
  diagramColorPalette: ColorPaletteEntry[] = [];

  // Icon picker panel state
  isIconPickerPanelOpen = false;
  iconPickerCells: IconPickerCellInfo[] = [];

  // Context menu state
  contextMenuPosition = { x: '0px', y: '0px' };
  private _rightClickedCell: any = null;

  // Port label popover state
  isPortLabelPopoverOpen = false;
  portLabelPopoverPosition = { x: 0, y: 0 };
  portLabelData: PortLabelData = {
    nodeId: '',
    portId: '',
    text: '',
    position: DEFAULT_PORT_LABEL_POSITION,
  };

  // Data assets sub-menu state
  dataAssets: Array<{ id: string; name: string }> = [];
  private _selectedCellDataAssets: Map<string, Set<string>> = new Map(); // cellId -> assetIds

  // Environment flags for dev-only features
  isProduction = environment.production;

  // User preference for showing developer tools
  showDeveloperTools = false;

  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: inject diagram services and initialize X6 cell extensions (mutates shared state)
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
    private userPreferencesService: UserPreferencesService,
    private dfdNodeType: DfdNodeTypeService,
    private dfdDialog: DfdDialogService,
    private dfdCommand: DfdCommandService,
    private dfdLayout: DfdLayoutService,
    private dfdIcon: DfdIconService,
    private dfdStyling: DfdStylingService,
  ) {
    // this.logger.info('DfdComponent v2 constructor called');

    // Initialize X6 cell extensions first
    // this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();
  }

  // SEM@f27ffdf4b41e57e775742a3de7caa83658a4af47: extract route params, set diagram context, and configure auto-save on init (mutates shared state)
  ngOnInit(): void {
    // this.logger.info('DfdComponent v2 ngOnInit called');

    // Load user preferences for developer tools visibility
    this.loadDeveloperToolsPreference();
    this.subscribeToAutoLayoutPreferences();

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
    this.logger.debugComponent('DfdComponent', 'Threat model data from route resolver', {
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

  // SEM@2de9acd9c0f615f9127954482ca522837ca91618: initialize the diagram graph after resolving the user's authorization permission (mutates shared state)
  ngAfterViewInit(): void {
    // this.logger.info('DfdComponent v2 ngAfterViewInit called - starting initialization sequence');

    // First check if authorization is already loaded synchronously
    const currentPermission = this.authorizationService.getCurrentUserPermission();
    const currentThreatModelId = this.authorizationService.currentThreatModelId;

    this.logger.debugComponent('DfdComponent', 'Authorization service state check', {
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
      this.logger.debugComponent(
        'DfdComponent',
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
        this.logger.debugComponent('DfdComponent', 'Subscribing for authorization updates');
        this._subscriptions.add(
          this.authorizationService.currentUserPermission$.subscribe(permission => {
            // Skip initialization if permission is null (not yet loaded)
            if (permission === null) {
              this.logger.debugComponent(
                'DfdComponent',
                'DFD still waiting for authorization data to be loaded',
              );
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

    // Expose E2E testing bridge when enabled
    if (environment.enableE2eTools) {
      const facade = this.dfdInfrastructure;
      const dfdBridge: Record<string, unknown> = {
        orchestrator: this.appDfdOrchestrator,
      };
      // Use a getter so the graph reference is always current
      // (the graph initializes after diagram loading, not at ngAfterViewInit time)
      Object.defineProperty(dfdBridge, 'graph', {
        get: () => {
          const adapter = facade.graphAdapter;
          return adapter?.isInitialized() ? adapter.getGraph() : null;
        },
        enumerable: true,
      });
      (window as any).__e2e = {
        ...(window as any).__e2e,
        dfd: dfdBridge,
      };
    }
  }

  // SEM@99432db5bab9519af796a5c794b160d0fbad7d0a: initialize or reconfigure the DFD orchestrator given the resolved user permission (mutates shared state)
  private initializeWithPermission(permission: 'reader' | 'writer' | 'owner'): void {
    // Update component state
    this.threatModelPermission = permission === 'owner' ? 'writer' : permission;
    this.isReadOnlyMode = permission === 'reader';

    this.logger.debugComponent(
      'AppDfdOrchestratorService',
      'DFD permission determined for orchestrator initialization',
      {
        permission,
        threatModelPermission: this.threatModelPermission,
        isReadOnlyMode: this.isReadOnlyMode,
      },
    );

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

    this.logger.debugComponent(
      'DfdComponent',
      'Attempting to initialize DFD Orchestrator',
      initParams,
    );
    this.appDfdOrchestrator.initialize(initParams).subscribe({
      next: success => {
        this.logger.debugComponent('DfdComponent', 'DFD Orchestrator initialization result', {
          success,
        });
        if (success) {
          // this.logger.info('DFD Orchestrator initialized successfully');

          // Force immediate UI update after successful initialization
          this.isSystemInitialized = this.appDfdOrchestrator.getState().initialized;
          this.cdr.detectChanges();

          // Special handling for joinCollaboration flow
          if (this.joinCollaboration) {
            this.logger.info(
              'Auto-joining collaboration session (joinCollaboration=true from query param)',
            );
            // Automatically start/join collaboration which will establish WebSocket
            // The diagram will be loaded via diagram_state_sync WebSocket message
            this._subscriptions.add(
              this.collaborationService.startOrJoinCollaboration().subscribe({
                next: success => {
                  if (success) {
                    this.logger.info(
                      'Successfully joined collaboration session - waiting for diagram_state_sync',
                    );

                    // Note: Collaboration services (broadcaster and WebSocket adapter) are
                    // initialized automatically via the isCollaborating$ subscription
                    // in setupOrchestratorSubscriptions()

                    // Note: The diagram will be loaded automatically when the server sends
                    // a diagram_state_sync message. We must NOT call loadDiagramData() here
                    // to avoid duplicate cell creation.
                  } else {
                    this.logger.error('Failed to join collaboration session');
                    // Fall back to loading via REST API if collaboration fails
                    if (this.dfdId) {
                      this.logger.info('Falling back to non-collaborative load via REST API');
                      this.loadDiagramData(this.dfdId);
                    }
                  }
                },
                error: error => {
                  this.logger.error('Error joining collaboration session', { error });
                  // Fall back to loading without collaboration
                  if (this.dfdId) {
                    this.logger.info('Falling back to non-collaborative load via REST API');
                    this.loadDiagramData(this.dfdId);
                  }
                },
              }),
            );
          }
          // Note: For normal flow (not joinCollaboration), the orchestrator's initialize()
          // method already loads the diagram via _continueInitialization() -> load()
          // so we don't need to call loadDiagramData() here to avoid double-loading
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

  // SEM@d09d726f6e5e0a8865bd0ad25acc5215ba4b8896: flush unsaved diagram changes and clean up all subscriptions on destroy (mutates shared state)
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

    // Clean up E2E testing bridge
    if (environment.enableE2eTools && (window as any).__e2e?.dfd) {
      delete (window as any).__e2e.dfd;
    }

    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();

    // Clean up orchestrator
    // AppDfdOrchestrator doesn't have dispose method, handle cleanup via subscriptions
  }

  // SEM@7e88e7cc5409cc02f33bcb81201e40a431315c47: enable or disable the orchestrator auto-save based on the user's write permission (mutates shared state)
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

  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: subscribe to orchestrator, collaboration, and selection streams to sync component state (mutates shared state)
  private setupOrchestratorSubscriptions(): void {
    // Subscribe to collaboration state changes to initialize services when collaboration starts
    this._subscriptions.add(
      this.collaborationService.isCollaborating$
        .pipe(takeUntil(this._destroy$))
        .subscribe(isCollaborating => {
          this.isCollaborating = isCollaborating;
          this.cdr.detectChanges(); // Update UI when collaboration state changes

          if (isCollaborating) {
            this.logger.debugComponent(
              'DFD',
              'Collaboration became active - initializing collaboration services',
            );

            // Initialize the WebSocket collaboration adapter for cursor/selection broadcasting
            if (this.threatModelId && this.dfdId && this.authService.providerId) {
              this.websocketCollaborationAdapter.initialize({
                diagramId: this.dfdId,
                threatModelId: this.threatModelId,
                providerId: this.authService.providerId,
                threatModelPermission: this.threatModelPermission || 'reader',
              });
              this.logger.debugComponent('DFD', 'WebSocket collaboration adapter initialized', {
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
            this.logger.debugComponent('DfdComponent', 'Auto-save completed successfully');
          } else if (status.status === 'error') {
            this.logger.warn('Auto-save failed', { error: status.error });
          }
        }),
    );

    // Subscribe to orchestrator state changes
    this._subscriptions.add(
      this.appDfdOrchestrator.state$.pipe(takeUntil(this._destroy$)).subscribe(state => {
        // Update component state based on orchestrator state
        this.logger.debugComponent('DfdComponent', 'DFD orchestrator state changed', {
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
          const graph = this.appDfdOrchestrator.getGraph;
          if (graph) this.dfdIcon.applyIconsOnLoad(graph);
        }

        this.isSystemInitialized = state.initialized;

        // Update diagram name, description, and threat model name from orchestrator state
        if (state.diagramName) {
          this.diagramName = state.diagramName;
        }
        // Description can be empty string, so check for undefined specifically
        if (state.diagramDescription !== undefined) {
          this.diagramDescription = state.diagramDescription ?? null;
        }
        if (state.includeInReport !== undefined) {
          this.includeInReport = state.includeInReport;
        }
        if (state.timmyEnabled !== undefined) {
          this.timmyEnabled = state.timmyEnabled;
        }
        if (state.threatModelName) {
          this.threatModelName = state.threatModelName;
        }

        this.cdr.detectChanges();
        this.logger.debugComponent(
          'DfdComponent',
          'Updated system initialization state and triggered change detection',
          {
            isSystemInitialized: this.isSystemInitialized,
            isReadOnlyMode: this.isReadOnlyMode,
            diagramName: this.diagramName,
            diagramDescription: this.diagramDescription,
            threatModelName: this.threatModelName,
          },
        );
      }),
    );

    // Ensure UI state is in sync with current orchestrator state immediately
    const currentState = this.appDfdOrchestrator.getState();
    this.isSystemInitialized = currentState.initialized;
    this.cdr.detectChanges();
    this.logger.debugComponent('DfdComponent', 'Initial state sync completed', {
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
          this.logger.debugComponent('DfdComponent', 'History state changed', { canUndo, canRedo });
          this.cdr.detectChanges();
        }),
    );

    // Subscribe to orchestrator state changes for initialization tracking
    this._subscriptions.add(
      this.appDfdOrchestrator.state$.pipe(takeUntil(this._destroy$)).subscribe(state => {
        if (this.isSystemInitialized !== state.initialized) {
          this.logger.debugComponent('DfdComponent', 'System initialization state changed', {
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

    // Set up port click handlers for port label editing
    this.setupPortClickHandlers();
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: delegate a newly added graph node to the infrastructure facade for persistence (mutates shared state)
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

    this.logger.debugComponent('DfdComponent', 'Handling node added', { nodeId: node.id });

    this.dfdInfrastructure.handleNodeAdded(node, this.dfdId, this.isSystemInitialized).subscribe({
      next: () => {
        this.logger.debugComponent('DfdComponent', 'Node added successfully', { nodeId: node.id });
      },
      error: error => {
        this.logger.error('Error handling node added', { error, nodeId: node.id });
      },
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: delegate a newly added graph edge to the infrastructure facade for persistence (mutates shared state)
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

    this.logger.debugComponent('DfdComponent', 'Handling edge added', { edgeId: edge.id });

    this.dfdInfrastructure.handleEdgeAdded(edge, this.dfdId, this.isSystemInitialized).subscribe({
      next: () => {
        this.logger.debugComponent('DfdComponent', 'Edge added successfully', { edgeId: edge.id });
      },
      error: error => {
        this.logger.error('Error handling edge added', { error, edgeId: edge.id });
      },
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch a diagram cell label change to infrastructure for persistence (mutates shared state)
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

    this.logger.debugComponent('DfdComponent', 'Handling label change', {
      cellId: change.cellId,
      cellType: change.cellType,
      oldLabel: change.oldLabel,
      newLabel: change.newLabel,
    });

    this.dfdInfrastructure.handleLabelChange(change, this.dfdId).subscribe({
      next: () => {
        this.logger.debugComponent('DfdComponent', 'Label change recorded successfully', {
          cellId: change.cellId,
          cellType: change.cellType,
        });
      },
      error: error => {
        this.logger.error('Error handling label change', { error, change });
      },
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch an edge reconnection event to infrastructure for persistence (mutates shared state)
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

    this.logger.debugComponent('DfdComponent', 'Handling edge reconnection', {
      edgeId: reconnection.edgeId,
      changeType: reconnection.changeType,
      oldNodeId: reconnection.oldNodeId,
      newNodeId: reconnection.newNodeId,
    });

    this.dfdInfrastructure.handleEdgeReconnection(reconnection, this.dfdId).subscribe({
      next: () => {
        this.logger.debugComponent('DfdComponent', 'Edge reconnection recorded successfully', {
          edgeId: reconnection.edgeId,
          changeType: reconnection.changeType,
        });
      },
      error: error => {
        this.logger.error('Error handling edge reconnection', { error, reconnection });
      },
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch a node parent change to infrastructure for persistence (mutates shared state)
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

    this.logger.debugComponent('DfdComponent', 'Handling node parent change', {
      nodeId: change.nodeId,
      oldParentId: change.oldParentId,
      newParentId: change.newParentId,
    });

    this.dfdInfrastructure.handleNodeParentChange(change, this.dfdId).subscribe({
      next: () => {
        this.logger.debugComponent('DfdComponent', 'Node parent change recorded successfully', {
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

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: dispatch edge vertex geometry updates to infrastructure for persistence (mutates shared state)
  private handleEdgeVerticesChanged(edge: any): void {
    if (!edge || !this.dfdId) {
      this.logger.warn('Cannot handle edge vertices changed - missing edge or diagram ID');
      return;
    }

    const vertices = edge.getVertices();
    this.logger.debugComponent('DfdComponent', 'Handling edge vertices changed', {
      edgeId: edge.id,
      vertices,
    });

    this.dfdInfrastructure
      .handleEdgeVerticesChanged(edge.id, vertices, this.dfdId, this.isSystemInitialized)
      .subscribe({
        next: () => {
          this.logger.debugComponent('DfdComponent', 'Edge vertices changed successfully', {
            edgeId: edge.id,
          });
        },
        error: error => {
          this.logger.error('Error handling edge vertices changed', { error, edgeId: edge.id });
        },
      });
  }

  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: fetch and render a diagram, then clear selection and apply icons (mutates shared state)
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
              this.logger.debugComponent('DfdComponent', 'Cleared selection after diagram load');
            }

            // Clear clipboard
            graphAdapter.clearClipboard();
            this.logger.debugComponent('DfdComponent', 'Cleared clipboard after diagram load');
          }

          // Apply architecture icons to nodes that have icon data
          const graph = this.appDfdOrchestrator.getGraph;
          if (graph) this.dfdIcon.applyIconsOnLoad(graph);
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

  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: convert a string node type and delegate node creation to the orchestrator (mutates shared state)
  addGraphNode(nodeType: string): void {
    // Map string nodeType to NodeType enum
    const mappedNodeType = this.dfdNodeType.mapStringToNodeType(nodeType);
    this.onAddNode(mappedNodeType);
  }

  // SEM@1706f3be4a28e5816fc47b3548744f8a64b1e5af: delegate deletion of selected diagram cells to the handler (mutates shared state)
  deleteSelected(): void {
    this.onDeleteSelected();
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the diagram edit history dialog for review
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

    this.dfdDialog.openHistory(dialogData);

    this.logger.info('Opened history dialog');
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open a dialog displaying the raw graph data for inspection
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

    this.dfdDialog.openGraphData(dialogData);

    this.logger.info('Opened graph data dialog');
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the diagram editor help dialog
  showHelp(): void {
    this.dfdDialog.openHelp();

    this.logger.info('Opened help dialog');
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open a dialog displaying the current clipboard contents
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

    this.dfdDialog.openClipboard(dialogData);

    this.logger.info('Opened clipboard dialog');
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: add a new node of the given type to the diagram if not read-only (mutates shared state)
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
            this.logger.debugComponent(
              'DfdComponent',
              'Node added successfully using intelligent positioning',
              {
                nodeType,
                usedIntelligentPositioning: result.metadata?.['usedIntelligentPositioning'],
                method: result.metadata?.['method'],
              },
            );
          } else {
            this.logger.error('Failed to add node', { error: result.error });
          }
        },
        error: error => {
          this.logger.error('Error adding node', { error });
        },
      });
  }

  // SEM@122e52ca325567fc2739e6fd80b2bb4f4ad97c25: delete selected diagram cells after optional confirmation if not read-only (mutates shared state)
  onDeleteSelected(): void {
    if (this.isReadOnlyMode || !this.hasSelectedCells) return;

    // Check if DFD system is initialized before attempting to delete
    if (!this.appDfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot delete cells: DFD system not yet initialized');
      return;
    }

    this._confirmDeletionIfNeeded().subscribe(confirmed => {
      if (!confirmed) return;

      this.appDfdOrchestrator.deleteSelectedCells().subscribe({
        next: result => {
          if (result.success) {
            this.logger.debugComponent('DfdComponent', 'Selected cells deleted successfully');
          } else {
            this.logger.error('Failed to delete selected cells', { error: result.error });
          }
        },
        error: error => {
          this.logger.error('Error deleting selected cells', { error });
        },
      });
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: revert the last diagram edit if undo is available and not read-only (mutates shared state)
  onUndo(): void {
    if (!this.canUndo || this.isReadOnlyMode) return;

    // Use orchestrator's undo functionality (custom history system)
    this.appDfdOrchestrator.undo().subscribe({
      next: result => {
        if (result.success) {
          this.logger.debugComponent('DfdComponent', 'Undo operation completed successfully');
        } else {
          this.logger.error('Undo operation failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error during undo operation', { error });
      },
    });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: reapply the last undone diagram edit if redo is available and not read-only (mutates shared state)
  onRedo(): void {
    if (!this.canRedo || this.isReadOnlyMode) return;

    // Use orchestrator's redo functionality (custom history system)
    this.appDfdOrchestrator.redo().subscribe({
      next: result => {
        if (result.success) {
          this.logger.debugComponent('DfdComponent', 'Redo operation completed successfully');
        } else {
          this.logger.error('Redo operation failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error during redo operation', { error });
      },
    });
  }

  // SEM@122e52ca325567fc2739e6fd80b2bb4f4ad97c25: cut selected diagram cells to clipboard after optional confirmation if not read-only (mutates shared state)
  onCut(): void {
    if (!this.hasSelectedCells || this.isReadOnlyMode) return;

    this._confirmDeletionIfNeeded().subscribe(confirmed => {
      if (!confirmed) return;

      this.logger.debugComponent('DfdComponent', 'Cut operation initiated');
      this.dfdInfrastructure.cut().subscribe({
        next: result => {
          if (result.success) {
            this.logger.info('Cut operation completed', { cutCount: result.cutCount });
            this.updateClipboardState();
          } else {
            this.logger.error('Cut operation failed');
          }
        },
        error: error => {
          this.logger.error('Error during cut operation', { error });
        },
      });
    });
  }

  // SEM@b71c37e6ebaadf734d302ac51ca182bd0b5482b8: copy selected diagram cells to clipboard if any are selected (mutates shared state)
  onCopy(): void {
    if (!this.hasSelectedCells) return;

    this.logger.debugComponent('DfdComponent', 'Copy operation initiated');
    this.dfdInfrastructure.copy();
    this.updateClipboardState();
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: paste clipboard contents into the diagram if not read-only (mutates shared state)
  onPaste(): void {
    if (this.isReadOnlyMode) return;

    this.logger.debugComponent('DfdComponent', 'Paste operation initiated');
    this.dfdInfrastructure.paste();
  }

  // Template compatibility methods
  // SEM@ae89d605380655be047b26e5033cc5b0a62302f6: delegate undo to the canonical handler for template compatibility (mutates shared state)
  undo(): void {
    this.onUndo();
  }

  // SEM@ae89d605380655be047b26e5033cc5b0a62302f6: delegate redo to the canonical handler for template compatibility (mutates shared state)
  redo(): void {
    this.onRedo();
  }

  // SEM@6465757ffb4bb55e54153b12a4bb58e0ca0d9a05: delegate cut to the canonical handler for template compatibility (mutates shared state)
  cut(): void {
    this.onCut();
  }

  // SEM@6465757ffb4bb55e54153b12a4bb58e0ca0d9a05: delegate copy to the canonical handler for template compatibility (mutates shared state)
  copy(): void {
    this.onCopy();
  }

  // SEM@6465757ffb4bb55e54153b12a4bb58e0ca0d9a05: delegate paste to the canonical handler for template compatibility (mutates shared state)
  paste(): void {
    this.onPaste();
  }

  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: select all diagram cells via the orchestrator (mutates shared state)
  onSelectAll(): void {
    this.appDfdOrchestrator.selectAll();
  }

  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: clear all selected diagram cells via the orchestrator (mutates shared state)
  onClearSelection(): void {
    this.appDfdOrchestrator.clearSelection();
  }

  // SEM@95fe89a8e4d1743d0c2bac75e2efd95ce4b2c2f5: scale the diagram viewport to fit all cells
  zoomToFit(): void {
    this.appDfdOrchestrator.zoomToFit();
  }

  // SEM@c89dfe72536d141f71b7471de3e72bd7b08e9ff2: save the diagram with an SVG thumbnail, falling back to thumbnail-less save (mutates shared state)
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

  // SEM@d53da449952ce06ea3620d522f180dc4f090349f: persist a new diagram name to the API and update local metadata (mutates shared state)
  onDiagramNameChange(newName: string): void {
    if (!this.threatModelId || !this.dfdId || this.isReadOnlyMode || this.isCollaborating) {
      return;
    }

    // Don't save if name is empty or unchanged
    if (!newName || newName === this.diagramName) {
      return;
    }

    this.logger.info('Updating diagram name', { oldName: this.diagramName, newName });

    this.threatModelService
      .patchDiagramProperties(this.threatModelId, this.dfdId, { name: newName })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: updatedDiagram => {
          this.diagramName = updatedDiagram.name;
          this.appDfdOrchestrator.updateDiagramMetadata({
            diagramName: updatedDiagram.name,
          });
          this.cdr.detectChanges();
          this.logger.info('Diagram name updated successfully', { name: updatedDiagram.name });
        },
        error: error => {
          this.logger.error('Failed to update diagram name', { error });
        },
      });
  }

  // SEM@d53da449952ce06ea3620d522f180dc4f090349f: persist a new diagram description to the API and update local metadata (mutates shared state)
  onDiagramDescriptionChange(newDescription: string): void {
    if (!this.threatModelId || !this.dfdId || this.isReadOnlyMode || this.isCollaborating) {
      return;
    }

    // Don't save if description is unchanged
    if (newDescription === (this.diagramDescription ?? '')) {
      return;
    }

    this.logger.info('Updating diagram description', {
      oldDescription: this.diagramDescription,
      newDescription,
    });

    this.threatModelService
      .patchDiagramProperties(this.threatModelId, this.dfdId, { description: newDescription })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: updatedDiagram => {
          this.diagramDescription = updatedDiagram.description ?? null;
          this.appDfdOrchestrator.updateDiagramMetadata({
            diagramDescription: updatedDiagram.description,
          });
          this.cdr.detectChanges();
          this.logger.info('Diagram description updated successfully', {
            description: updatedDiagram.description,
          });
        },
        error: error => {
          this.logger.error('Failed to update diagram description', { error });
        },
      });
  }

  // SEM@d53da449952ce06ea3620d522f180dc4f090349f: update the diagram report-inclusion flag via the API (mutates shared state)
  onIncludeInReportChange(event: { checked: boolean }): void {
    if (!this.threatModelId || !this.dfdId || this.isReadOnlyMode || this.isCollaborating) {
      return;
    }

    this.threatModelService
      .patchDiagramProperties(this.threatModelId, this.dfdId, {
        include_in_report: event.checked,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: updatedDiagram => {
          this.includeInReport = updatedDiagram.include_in_report ?? event.checked;
          this.appDfdOrchestrator.updateDiagramMetadata({
            includeInReport: this.includeInReport,
          });
          this.cdr.detectChanges();
          this.logger.info('Diagram include_in_report updated', {
            include_in_report: this.includeInReport,
          });
        },
        error: error => {
          this.logger.error('Failed to update diagram include_in_report', { error });
        },
      });
  }

  // SEM@a5d47afbe751f0027d056ced66949574212e626e: update the Timmy AI-assistant enabled flag for the diagram via the API (mutates shared state)
  onTimmyEnabledChange(event: { checked: boolean }): void {
    if (!this.threatModelId || !this.dfdId || this.isReadOnlyMode || this.isCollaborating) {
      return;
    }

    this.threatModelService
      .patchDiagramProperties(this.threatModelId, this.dfdId, {
        timmy_enabled: event.checked,
      })
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: updatedDiagram => {
          this.timmyEnabled = updatedDiagram.timmy_enabled ?? event.checked;
          this.appDfdOrchestrator.updateDiagramMetadata({
            timmyEnabled: this.timmyEnabled,
          });
          this.cdr.detectChanges();
          this.logger.info('Diagram timmy_enabled updated', {
            timmy_enabled: this.timmyEnabled,
          });
        },
        error: error => {
          this.logger.error('Failed to update diagram timmy_enabled', { error });
        },
      });
  }

  // SEM@e727b5931f6efd6cf61c25837601eff84c732dac: export the diagram in the given format and trigger a browser download
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
  // SEM@ae89d605380655be047b26e5033cc5b0a62302f6: delegate diagram export in the given format to the export handler
  exportDiagram(format: ExportFormat): void {
    this.onExport(format);
  }

  // SEM@ae89d605380655be047b26e5033cc5b0a62302f6: open the diagram metadata editor dialog
  manageMetadata(): void {
    this.onEditMetadata();
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the threat creation dialog for the selected cell, loading framework context (reads DB)
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

                const dialogRef = this.dfdDialog.openThreatEditor(dialogData);

                dialogRef.afterClosed().subscribe(result => {
                  if (result) {
                    this.logger.info('Threat editor closed with result, creating threat');
                    this.dfdCommand.createThreat(this.threatModelId!, result);
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

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the threat management dialog for the selected cell's threats (reads DB)
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

          this.dfdDialog.openThreats(dialogData);
        },
        error: error => {
          this.logger.error('Failed to load threat model', error);
        },
      }),
    );
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: save the diagram with an SVG thumbnail then navigate away (mutates shared state)
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
              // this.logger.info('Diagram and thumbnail save completed successfully');
            },
            error: (error: unknown) => {
              this.logger.error('Failed to save diagram with thumbnail', { error });
            },
          });

          // Navigate away immediately after starting the save request
          this.logger.info('Save request initiated, navigating away');
          this.dfdCommand.navigateAway(this.threatModelId);
        })
        .catch((error: unknown) => {
          this.logger.error('Error capturing SVG thumbnail, saving without image', error);
          // Fall back to save without thumbnail
          this._fallbackSaveAndNavigate();
        });
    } else {
      this.dfdCommand.navigateAway(this.threatModelId);
    }
  }

  /**
   * Fallback save without thumbnail (used when thumbnail capture fails)
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: save the diagram without a thumbnail then navigate away as a fallback (mutates shared state)
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
    this.dfdCommand.navigateAway(this.threatModelId);
  }

  /**
   * Capture an SVG thumbnail of the current graph via DfdCommandService,
   * supplying the live graph adapter, export service, and a selection-clearing
   * callback so the command service stays graph-agnostic.
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: capture a base64 SVG thumbnail of the current diagram graph (pure)
  private _captureDiagramSvgThumbnail(): Promise<string | null> {
    return this.dfdCommand.captureDiagramSvgThumbnail(
      this.dfdInfrastructure.graphAdapter,
      this.dfdInfrastructure.exportService,
      () => this.appDfdOrchestrator.clearSelection(),
    );
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: activate inline label editing for the selected or right-clicked cell (mutates shared state)
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
      this.logger.debugComponent('DfdComponent', 'Label editor triggered for cell', {
        cellId: cell.id,
      });
    } else {
      this.logger.warn('Label editing not available - graph adapter or method not found');
    }
  }

  // SEM@f67099f69f85603be7f4b71b3f0a1ca63d704ee0: return the first currently selected diagram cell, or null if none (pure)
  private getFirstSelectedCell(): any {
    const selectedCells = this.appDfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) return null;

    const graph = this.appDfdOrchestrator.getGraph;
    return graph ? graph.getCellById(selectedCells[0]) : null;
  }

  // Z-order methods
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: raise the selected cell one z-order step (mutates shared state)
  moveForward(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move forward');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedForward();
    this.logger.debugComponent('DfdComponent', 'Moved cell forward', { cellId: targetCell.id });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: lower the selected cell one z-order step (mutates shared state)
  moveBackward(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move backward');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedBackward();
    this.logger.debugComponent('DfdComponent', 'Moved cell backward', { cellId: targetCell.id });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: raise the selected cell to the top z-order (mutates shared state)
  moveToFront(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move to front');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedToFront();
    this.logger.debugComponent('DfdComponent', 'Moved cell to front', { cellId: targetCell.id });
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: lower the selected cell to the bottom z-order (mutates shared state)
  moveToBack(): void {
    const targetCell = this._rightClickedCell || this.getFirstSelectedCell();
    if (!targetCell) {
      this.logger.info('No cell available for move to back');
      return;
    }

    // Use the facade's z-order functionality
    this.dfdInfrastructure.moveSelectedToBack();
    this.logger.debugComponent('DfdComponent', 'Moved cell to back', { cellId: targetCell.id });
  }

  /**
   * Toggle the per-cell layout lock on the right-clicked cell (#641).
   *
   * - Lock applied: capture pre-state, set `_layoutLocked: true`, show badge,
   *   emit a single update-node history op. No layout pass.
   * - Lock removed: capture pre-state for the cell, its children, and any
   *   container-fit ancestors; clear `_layoutLocked`; hide badge; run a layout
   *   cycle (applyAutoLayout + cascade); emit one batched history op covering
   *   every touched cell. Single undo step per toggle.
   *
   * No-op if the right-clicked cell is missing, not lock-eligible, or in
   * read-only mode (the menu item is also disabled in that case).
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: toggle per-cell layout lock, running a layout cycle on unlock (mutates shared state)
  toggleLayoutLock(): void {
    if (this.isReadOnlyMode) return;
    const cell = this._rightClickedCell;
    if (!cell) return;
    if (!(ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape)) return;

    const wasLocked = isCellLayoutLocked(cell);

    if (!wasLocked) {
      // Lock applied: data change only, single history op.
      const previousState = this.dfdIcon.captureCellStateForHistory(cell);
      const next = { ...cell.getData() };
      next._layoutLocked = true;
      cell.setData(next, { silent: true, overwrite: true });
      this.dfdIcon.applyLockBadge(cell);

      const ts = Date.now();
      const op = {
        id: `layout-lock-${ts}-${cell.id}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: ts,
        nodeId: cell.id,
        updates: {},
        includeInHistory: true,
        metadata: { previousCellState: previousState },
      };
      this.appDfdOrchestrator.executeOperation(op).subscribe();

      this.rightClickedCellIsLocked = true;
      return;
    }

    // Lock removed: capture pre-state for cell + children + cascade ancestors,
    // clear the flag, run a layout cycle inside one batched history entry.
    const previousStates = new Map<string, unknown>();
    // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: record a cell's pre-change state into the history snapshot map (mutates shared state)
    const captureCell = (c: any): void => {
      if (!c?.id || previousStates.has(c.id)) return;
      if (!c.isNode?.()) return;
      previousStates.set(c.id, this.dfdIcon.captureCellStateForHistory(c));
    };

    captureCell(cell);
    for (const child of (cell.getChildren?.() ?? []) as any[]) {
      captureCell(child);
    }
    let ancestor = cell.getParent?.();
    while (ancestor) {
      if (isCellLayoutLocked(ancestor)) break;
      const ancData = ancestor.getData?.() ?? {};
      const autoFit = ancData._archAutoFit as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') break;
      captureCell(ancestor);
      for (const child of (ancestor.getChildren?.() ?? []) as any[]) {
        captureCell(child);
      }
      ancestor = ancestor.getParent?.();
    }

    // Clear the flag and update the badge before running the layout cycle —
    // applyAutoLayout checks isCellLayoutLocked at entry.
    const next = { ...cell.getData() };
    delete next._layoutLocked;
    cell.setData(next, { silent: true, overwrite: true });
    this.dfdIcon.applyLockBadge(cell);

    // Run a layout cycle on the now-unlocked cell. Re-uses the existing
    // applyAutoLayout + cascadeContainerLayout path.
    this._runInlineLayoutCycle(cell);

    const ts = Date.now();
    const ops = Array.from(previousStates.entries()).map(([id, prev], i) => ({
      id: `layout-unlock-${ts}-${i}-${id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: ts,
      nodeId: id,
      updates: {},
      includeInHistory: true,
      metadata: { previousCellState: prev },
    }));

    if (ops.length === 1) {
      this.appDfdOrchestrator.executeOperation(ops[0]).subscribe();
    } else if (ops.length > 1) {
      const batch = {
        id: `layout-unlock-batch-${ts}`,
        type: 'batch-operation' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: ts,
        operations: ops,
        description: 'Unlock layout',
        includeInHistory: true,
      };
      this.appDfdOrchestrator.executeOperation(batch).subscribe();
    }

    this.rightClickedCellIsLocked = false;
  }

  // Edge methods
  // SEM@f67099f69f85603be7f4b71b3f0a1ca63d704ee0: add a reverse-direction edge for the selected diagram edge (mutates shared state)
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
   * Load data assets from the threat model when the sub-menu opens
   */
  // SEM@54e7d611dc1f2c8ef1c351a57a5968d8be72defc: fetch data assets for the context menu and current cell associations (reads DB)
  loadDataAssetsForMenu(): void {
    if (!this.threatModelId) {
      this.logger.warn('Cannot load data assets: No threat model ID available');
      this.dataAssets = [];
      return;
    }

    // Load current data asset associations for selected/right-clicked cells
    this._loadSelectedCellDataAssets();

    // Fetch assets directly from the assets endpoint
    // (the GET /threat_models/{id} endpoint does not include assets)
    this._subscriptions.add(
      this.threatModelService.getAssetsForThreatModel(this.threatModelId).subscribe({
        next: response => {
          // Filter to only data assets and sort alphabetically
          this.dataAssets = response.assets
            .filter(asset => asset.type === 'data')
            .map(asset => ({ id: asset.id, name: asset.name }))
            .sort((a, b) => a.name.localeCompare(b.name));

          this.cdr.markForCheck();
          this.cdr.detectChanges();
        },
        error: error => {
          this.logger.error('Failed to load assets for data assets menu', error);
          this.dataAssets = [];
        },
      }),
    );
  }

  /**
   * Load current data asset associations for selected/right-clicked cells
   */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: populate the selected-cell data-asset association map from cell metadata (mutates shared state)
  private _loadSelectedCellDataAssets(): void {
    this._selectedCellDataAssets.clear();

    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    // Get target cells: either the right-clicked cell or all selected cells
    const targetCells = this._rightClickedCell
      ? [this._rightClickedCell]
      : this.appDfdOrchestrator.getSelectedCells();

    for (const cell of targetCells) {
      const assetIds = this.dfdNodeType.getCellDataAssets(cell);
      this._selectedCellDataAssets.set(cell.id, new Set(assetIds));
    }
  }

  /**
   * Check if a data asset is associated with ALL selected/right-clicked cells
   */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: check if a data asset is associated with all selected cells (pure)
  isDataAssetChecked(assetId: string): boolean {
    return this.dfdNodeType.isDataAssetChecked(this._selectedCellDataAssets, assetId);
  }

  /**
   * Check if a data asset is associated with SOME (but not all) selected cells
   */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: check if a data asset is associated with some but not all selected cells (pure)
  isDataAssetIndeterminate(assetId: string): boolean {
    return this.dfdNodeType.isDataAssetIndeterminate(this._selectedCellDataAssets, assetId);
  }

  /**
   * Toggle a data asset association for all selected/right-clicked cells
   */
  // SEM@78ec1e38fde70c14588b63411f0defa8fe691543: toggle data asset association on selected or right-clicked diagram cells (mutates shared state)
  toggleDataAsset(assetId: string, event: Event): void {
    event.stopPropagation();

    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Cannot toggle data asset: graph not available');
      return;
    }

    // Determine if we should add or remove the asset
    // If checked (associated with all), remove it; otherwise add it
    const shouldAdd = !this.isDataAssetChecked(assetId);

    // Get target cells
    const targetCells = this._rightClickedCell
      ? [this._rightClickedCell]
      : this.appDfdOrchestrator.getSelectedCells();

    for (const cell of targetCells) {
      const currentAssets = new Set(this.dfdNodeType.getCellDataAssets(cell));

      if (shouldAdd) {
        currentAssets.add(assetId);
      } else {
        currentAssets.delete(assetId);
      }

      const newAssetIds = Array.from(currentAssets);

      // Update our tracking map
      this._selectedCellDataAssets.set(cell.id, currentAssets);

      // Use executeOperation to properly trigger history and auto-save
      const isEdge = cell.isEdge && cell.isEdge();
      const operation = isEdge
        ? {
            id: `update-data-assets-${Date.now()}-${cell.id}`,
            type: 'update-edge' as const,
            source: 'user-interaction' as const,
            priority: 'high' as const,
            timestamp: Date.now(),
            edgeId: cell.id,
            updates: {
              properties: { data_assets: newAssetIds.length > 0 ? newAssetIds : undefined },
            },
          }
        : {
            id: `update-data-assets-${Date.now()}-${cell.id}`,
            type: 'update-node' as const,
            source: 'user-interaction' as const,
            priority: 'high' as const,
            timestamp: Date.now(),
            nodeId: cell.id,
            updates: {
              properties: { data_assets: newAssetIds.length > 0 ? newAssetIds : undefined },
            },
          };

      this.appDfdOrchestrator.executeOperation(operation).subscribe({
        next: operationResult => {
          if (operationResult.success) {
            this.logger.debugComponent(
              'DfdComponent',
              'Data asset association updated successfully',
              {
                cellId: cell.id,
                assetId,
                action: shouldAdd ? 'added' : 'removed',
              },
            );
          } else {
            this.logger.error('Failed to update data asset association', {
              error: operationResult.error,
            });
          }
        },
        error: error => {
          this.logger.error('Error updating data asset association', { error });
        },
      });
    }

    this.logger.info('Toggled data asset association', {
      assetId,
      action: shouldAdd ? 'added' : 'removed',
      cellCount: targetCells.length,
    });

    this.cdr.detectChanges();
  }

  // SEM@f67099f69f85603be7f4b71b3f0a1ca63d704ee0: check if the context-menu target cell is an edge (pure)
  isRightClickedCellEdge(): boolean {
    return (
      this._rightClickedCell && this._rightClickedCell.isEdge && this._rightClickedCell.isEdge()
    );
  }

  // SEM@f67099f69f85603be7f4b71b3f0a1ca63d704ee0: return the diagram cell that was most recently right-clicked (pure)
  getRightClickedCell(): any {
    return this._rightClickedCell;
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the cell properties dialog for the target or selected cell
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

    this.dfdDialog.openCellProperties(dialogData);
  }

  // Edge Observable Subscriptions

  // SEM@5d3839af4d23487f5d92aed58214fc0dabaf9d1d: subscribe to graph adapter events for node, edge, label, reconnection, and deletion (mutates shared state)
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

      // Subscribe to cell deletion requests from the button-remove tool
      this._subscriptions.add(
        this.dfdInfrastructure.cellDeletionRequested$
          .pipe(takeUntil(this._destroy$))
          .subscribe((cell: Cell) => {
            this._confirmDeletionIfNeeded([cell]).subscribe(confirmed => {
              if (confirmed) {
                this.dfdInfrastructure.executeDirectCellDeletion(cell);
              }
            });
          }),
      );

      this.subscribeToAutoLayoutTriggers();

      this.logger.debugComponent(
        'DfdComponent',
        'Edge and history observable subscriptions set up successfully',
      );
    } else {
      this.logger.warn('Graph adapter not available for edge and history subscriptions');
    }
  }

  /**
   * Bind to raw graph events for auto-layout triggers (#642).
   *
   * `node:moved` and `node:resized` are drag-end events (one fire per
   * interaction), avoiding the relayout-during-drag jitter that
   * `node:change:position` / `node:change:size` would cause if subscribed
   * directly.
   *
   * The `_inLayoutCycle` flag short-circuits these handlers when the layout
   * itself calls `cell.resize()` / `child.position()`.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: subscribe to graph drag-end events to trigger auto-layout on parent containers (mutates shared state)
  private subscribeToAutoLayoutTriggers(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: handle node parent-change event by re-running layout on new and old parent containers
    const onParent = ({ node, previous }: { node: any; previous: any }): void => {
      if (this._inLayoutCycle) return;
      const newParent = node.getParent?.();
      if (newParent) {
        this._runLayoutCycle(newParent, 'ports');
      }
      // Also re-evaluate the previous parent in case it became empty (revert
      // from container fit) or now has fewer children (re-pack). x6 hands us
      // the previous parent as a Node reference, not an ID.
      const oldParent = previous ?? null;
      if (oldParent && oldParent !== newParent) {
        const oldData = oldParent.getData?.() ?? {};
        const remainingLayoutChildren = ((oldParent.getChildren?.() ?? []) as any[]).filter(
          c => c.shape !== 'text-box',
        );
        if (remainingLayoutChildren.length > 0) {
          this._runLayoutCycle(oldParent, 'ports');
        } else if (oldData._archAutoFit) {
          this.dfdIcon.revertAutoFit(oldParent);
        }
      }
    };

    // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: handle node-moved event by re-running position layout on auto-fit container parent
    const onMoved = ({ node }: { node: any }): void => {
      if (this._inLayoutCycle) return;
      const parent = node.getParent?.();
      if (!parent) return;
      const parentData = parent.getData?.() ?? {};
      const autoFit = parentData._archAutoFit as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') return;
      this.dfdLayout.clearVerticesOfConnectedEdges(graph, node);
      this._runLayoutCycle(parent, 'position');
    };

    // SEM@5d3839af4d23487f5d92aed58214fc0dabaf9d1d: handle node-resized event by re-running port layout on auto-fit container parent
    const onResized = ({ node }: { node: any }): void => {
      if (this._inLayoutCycle) return;
      const parent = node.getParent?.();
      if (!parent) return;
      const parentData = parent.getData?.() ?? {};
      const autoFit = parentData._archAutoFit as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') return;
      this._runLayoutCycle(parent, 'ports');
    };

    graph.on('node:change:parent', onParent);
    graph.on('node:moved', onMoved);
    graph.on('node:resized', onResized);

    this._destroy$.subscribe(() => {
      graph.off('node:change:parent', onParent);
      graph.off('node:moved', onMoved);
      graph.off('node:resized', onResized);
    });
  }

  // Context Menu Methods

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: subscribe to graph adapter context-menu events and route them to the cell context menu (mutates shared state)
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
      this.logger.debugComponent('DfdComponent', 'Context menu handlers registered');
    } else {
      this.logger.warn('Context menu observable not available from graph adapter');
    }
  }

  // SEM@473768aa561d287a179c19a1ab908f4eb0b93188: store the right-clicked cell, position the context menu, and open it (mutates shared state)
  private openCellContextMenu(cell: any, x: number, y: number): void {
    // Store the right-clicked cell for context menu actions
    this._rightClickedCell = cell;
    this.rightClickedCellIsLocked = isCellLayoutLocked(cell);

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

    // Pre-load data assets for the sub-menu (the menuOpened event on nested menus is unreliable)
    this.loadDataAssetsForMenu();

    // Open the context menu
    if (this.contextMenuTrigger) {
      this.contextMenuTrigger.openMenu();
      this.cdr.detectChanges();
    }

    this.logger.debugComponent('DfdComponent', 'Context menu opened for cell', {
      cellId: cell?.id,
      cellType: cell?.isNode?.() ? 'node' : cell?.isEdge?.() ? 'edge' : 'unknown',
      position: { x, y },
    });
  }

  // SEM@f67099f69f85603be7f4b71b3f0a1ca63d704ee0: handle a browser context-menu event by positioning and opening the diagram context menu
  onContextMenu(event: MouseEvent): void {
    // This method is kept for any manual context menu triggers
    event.preventDefault();
    this.contextMenuPosition = {
      x: `${event.clientX}px`,
      y: `${event.clientY}px`,
    };
    this.contextMenuTrigger.openMenu();
  }

  // Port Label Popover Methods

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: subscribe to port-click events from the graph adapter and open the port label popover (mutates shared state)
  private setupPortClickHandlers(): void {
    const graphAdapter = this.dfdInfrastructure.graphAdapter;
    if (graphAdapter && graphAdapter.portClicked$) {
      this._subscriptions.add(
        graphAdapter.portClicked$
          .pipe(takeUntil(this._destroy$))
          .subscribe(({ node, portId, x, y }) => {
            this.openPortLabelPopover(node, portId, x, y);
          }),
      );
      this.logger.debugComponent('DfdComponent', 'Port click handlers registered');
    }
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: populate port label state and display the port label popover at the given position (mutates shared state)
  private openPortLabelPopover(node: any, portId: string, x: number, y: number): void {
    if (this.isReadOnlyMode) return;

    // Read current port label data from the node
    const ports = node.getPorts();
    const port = ports.find((p: any) => p.id === portId);

    let currentText = '';
    let currentPosition: PortLabelPosition = DEFAULT_PORT_LABEL_POSITION;

    if (port?.label) {
      currentText = port.label.text || '';
      const posName =
        typeof port.label.position === 'string' ? port.label.position : port.label.position?.name;
      if (posName && ['outside', 'inside', 'top', 'bottom', 'left', 'right'].includes(posName)) {
        currentPosition = posName as PortLabelPosition;
      }
    }

    this.portLabelData = {
      nodeId: node.id,
      portId,
      text: currentText,
      position: currentPosition,
    };

    this.portLabelPopoverPosition = { x, y };
    this.isPortLabelPopoverOpen = true;
    this.cdr.detectChanges();
  }

  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: update a port label on the node and persist the change with undo history (mutates shared state)
  onPortLabelChanged(event: PortLabelChangeEvent): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    const node = graph.getCellById(event.nodeId);
    if (!node || !node.isNode()) return;

    // Read previous port label state
    const ports = node.getPorts();
    const port = ports.find((p: any) => p.id === event.portId);
    const previousText = port?.label?.text || '';
    const previousPosition =
      (typeof port?.label?.position === 'string'
        ? port.label.position
        : port?.label?.position?.name) || DEFAULT_PORT_LABEL_POSITION;

    // Apply port label via X6 API
    node.setPortProp(event.portId, 'label', {
      text: event.text,
      position: { name: event.position },
    });

    // Create operation for persistence and undo/redo
    const operation = {
      id: `port-label-${Date.now()}-${event.nodeId}-${event.portId}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: event.nodeId,
      updates: {
        properties: {
          portLabels: {
            [event.portId]: { text: event.text, position: event.position },
          },
        },
      },
      previousState: {
        properties: {
          portLabels: {
            [event.portId]: { text: previousText, position: previousPosition },
          },
        },
      },
      includeInHistory: true,
    };

    this.appDfdOrchestrator.executeOperation(operation).subscribe({
      next: result => {
        if (!result.success) {
          this.logger.error('Port label change operation failed', { error: result.error });
        }
      },
      error: err => this.logger.error('Failed to persist port label change', { error: err }),
    });

    this.logger.debugComponent('DfdComponent', 'Port label updated', {
      nodeId: event.nodeId,
      portId: event.portId,
      text: event.text,
      position: event.position,
    });
  }

  // SEM@60a5d6c9a7aa5e7316c4f81f4222ad8ae5e332bd: dismiss the port label popover (mutates shared state)
  closePortLabelPopover(): void {
    this.isPortLabelPopoverOpen = false;
    this.cdr.detectChanges();
  }

  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: open the metadata dialog for the selected cell and persist edits via the orchestrator
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

    const dialogRef = this.dfdDialog.openMetadata({
      threatModelId: this.threatModelId,
      cellId: cell.id,
      // Get metadata from the data._metadata field (where it's stored as an array)
      metadata: cell.getData()?._metadata || [],
    } as MetadataDialogData);

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
                properties: { _metadata: result },
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
                properties: { _metadata: result },
              },
            };

        this.appDfdOrchestrator.executeOperation(operation).subscribe({
          next: operationResult => {
            if (operationResult.success) {
              this.logger.debugComponent('DfdComponent', 'Cell metadata updated successfully');
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
  // SEM@122e52ca325567fc2739e6fd80b2bb4f4ad97c25: handle global keydown events for save, delete, and delegated diagram shortcuts
  onKeyDown(event: KeyboardEvent): void {
    // Handle Ctrl+S/Cmd+S for manual save with thumbnail
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault(); // Prevent browser save dialog
      this.onSaveManually();
      return;
    }

    // Intercept Delete/Backspace at the presentation layer for metadata confirmation
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (this.dialog.openDialogs.length > 0) return;
      if (this.isReadOnlyMode || !this.hasSelectedCells) return;
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true');
      if (isInputFocused) return;
      event.preventDefault();
      this.onDeleteSelected();
      return;
    }

    // Delegate other keyboard events to orchestrator for centralized keyboard handling
    this.appDfdOrchestrator.onKeyDown(event);
  }

  @HostListener('window:resize', ['$event'])
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: handle window resize events by delegating to the orchestrator
  onWindowResize(_event: Event): void {
    // Delegate to orchestrator for centralized resize handling
    this.appDfdOrchestrator.onWindowResize();
  }

  // Helper Methods

  // SEM@8e3b401a9132a5eba91fd80043ac0e6ff4c5b355: subscribe to user preferences and sync the developer-tools visibility flag (mutates shared state)
  private loadDeveloperToolsPreference(): void {
    this.userPreferencesService.preferences$.pipe(takeUntil(this._destroy$)).subscribe(prefs => {
      this.showDeveloperTools = prefs.showDeveloperTools;
      this.cdr.markForCheck();
    });
  }

  /**
   * Track preference changes that affect auto-layout and re-apply across the
   * graph when any of: `showShapeBordersWithIcons`, `autoLayoutEnabled`,
   * `autoLayoutOrientation` toggles. The first emission only seeds state.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: subscribe to layout preference changes and re-apply auto-layout or border settings across all graph cells (mutates shared state)
  private subscribeToAutoLayoutPreferences(): void {
    let lastBorders: boolean | undefined;
    let lastEnabled: boolean | undefined;
    let lastOrientation: string | undefined;
    this.userPreferencesService.preferences$.pipe(takeUntil(this._destroy$)).subscribe(prefs => {
      const bordersChanged =
        lastBorders !== undefined && lastBorders !== prefs.showShapeBordersWithIcons;
      const enabledChanged = lastEnabled !== undefined && lastEnabled !== prefs.autoLayoutEnabled;
      const orientationChanged =
        lastOrientation !== undefined && lastOrientation !== prefs.autoLayoutOrientation;

      if (bordersChanged || enabledChanged) {
        if (prefs.autoLayoutEnabled && !prefs.showShapeBordersWithIcons) {
          const graph = this.appDfdOrchestrator.getGraph;
          if (graph) this.dfdLayout.applyAutoLayoutToAllEligibleCells(graph);
        } else {
          const graph = this.appDfdOrchestrator.getGraph;
          if (graph) {
            this.dfdIcon.revertAutoFitOnAllAutoFitCells(graph);
            // When borders flip back ON, re-apply the existing border-pref logic
            // (existing applyBorderPreference / restoreBorder per-cell run only at
            // icon-set time, so we need to walk all iconned cells here).
            this.dfdIcon.reapplyBorderPreferenceToAllIconnedCells(
              graph,
              prefs.showShapeBordersWithIcons,
            );
          }
        }
      } else if (orientationChanged && prefs.autoLayoutEnabled) {
        // Container layout reads orientation; icon-only fit doesn't depend on it.
        // 3a leaves this as a no-op; 3b will iterate container-fit cells.
        const graph = this.appDfdOrchestrator.getGraph;
        if (graph) this.dfdLayout.applyAutoLayoutToAllEligibleCells(graph);
      }

      lastBorders = prefs.showShapeBordersWithIcons;
      lastEnabled = prefs.autoLayoutEnabled;
      lastOrientation = prefs.autoLayoutOrientation;
    });
  }

  // SEM@473768aa561d287a179c19a1ab908f4eb0b93188: recompute selection flags from the current graph selection and trigger change detection (mutates shared state)
  private updateSelectionState(): void {
    if (!this.appDfdOrchestrator.getState().initialized) {
      return;
    }

    const selectedCells = this.appDfdOrchestrator.getSelectedCells();
    const oldHasSelectedCells = this.hasSelectedCells;
    const oldHasExactlyOneSelectedCell = this.hasExactlyOneSelectedCell;
    const oldSelectedCellIsTextBox = this.selectedCellIsTextBox;
    const oldSelectedCellIsSecurityBoundary = this.selectedCellIsSecurityBoundary;
    const oldSelectedCellIsLockEligible = this.selectedCellIsLockEligible;

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
          this.selectedCellIsLockEligible = (ICON_ELIGIBLE_SHAPES as readonly string[]).includes(
            cell.shape,
          );
        } else {
          this.selectedCellIsTextBox = false;
          this.selectedCellIsSecurityBoundary = false;
          this.selectedCellIsLockEligible = false;
        }
      }
    } else {
      this.selectedCellIsTextBox = false;
      this.selectedCellIsSecurityBoundary = false;
      this.selectedCellIsLockEligible = false;
    }

    // Update style panel cell info if panel is open
    if (this.isStylePanelOpen) {
      this.updateStylePanelCells();
    }
    this.updateIconPickerCells();

    // Only trigger change detection if state actually changed
    if (
      oldHasSelectedCells !== this.hasSelectedCells ||
      oldHasExactlyOneSelectedCell !== this.hasExactlyOneSelectedCell ||
      oldSelectedCellIsTextBox !== this.selectedCellIsTextBox ||
      oldSelectedCellIsSecurityBoundary !== this.selectedCellIsSecurityBoundary ||
      oldSelectedCellIsLockEligible !== this.selectedCellIsLockEligible
    ) {
      this.cdr.detectChanges();
    }
  }

  // Style panel methods

  // SEM@22214a6ac6e2459278c73fec5fcf23b69f95dae8: toggle the style panel open or closed, refreshing selected cells when opening (mutates shared state)
  toggleStylePanel(): void {
    this.isStylePanelOpen = !this.isStylePanelOpen;
    if (this.isStylePanelOpen) {
      this.updateStylePanelCells();
    }
    this.cdr.detectChanges();
  }

  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: update style panel cell list from current graph selection (mutates shared state)
  private updateStylePanelCells(): void {
    const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.stylePanelCells = [];
      return;
    }
    this.stylePanelCells = this.dfdStyling.buildStylePanelCells(graph, selectedCellIds);
  }

  // Icon picker panel methods

  // SEM@5b6850126e0e1bc9cf6da18cb7fb77e18f818caa: toggle icon picker panel open/closed and refresh its cell list (mutates shared state)
  toggleIconPickerPanel(): void {
    this.isIconPickerPanelOpen = !this.isIconPickerPanelOpen;
    if (this.isIconPickerPanelOpen) {
      this.updateIconPickerCells();
    }
    this.cdr.detectChanges();
  }

  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: refresh icon picker cell list from current graph selection (mutates shared state)
  private updateIconPickerCells(): void {
    if (!this.isIconPickerPanelOpen) return;
    const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.iconPickerCells = [];
      return;
    }
    this.iconPickerCells = this.dfdStyling.buildIconPickerCells(graph, selectedCellIds);
  }

  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: apply selected icon to diagram nodes and record undo history (mutates shared state)
  onIconSelected(event: IconSelectedEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell || !cell.isNode()) continue;

      // Snapshot before mutating: handler mutates cell.data in place below,
      // and the executor captures previousState AFTER the handler runs, so
      // history would otherwise see no diff. metadata.previousCellState
      // overrides the executor's capture.
      const previousCellState = this.dfdIcon.captureCellStateForHistory(cell);

      const previousData = cell.getData() ?? {};
      cell.setData({ ...previousData, _arch: event.arch }, { silent: true });
      this.dfdIcon.applyIconToCell(cell, event.arch);
      this.dfdIcon.applyBorderPreference(cell);
      this.dfdLayout.applyAutoLayout(cell, graph);

      const operation = {
        id: `icon-set-${Date.now()}-${cellId}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
        nodeId: cellId,
        updates: { properties: { _arch: event.arch } },
        previousState: { properties: { _arch: previousData._arch ?? null } },
        includeInHistory: true,
        metadata: { previousCellState },
      };
      this.appDfdOrchestrator.executeOperation(operation).subscribe();
    }
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: remove icon from diagram nodes and restore label defaults with undo history (mutates shared state)
  onIconRemoved(event: IconRemovedEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell || !cell.isNode()) continue;

      const previousCellState = this.dfdIcon.captureCellStateForHistory(cell);

      const previousData = cell.getData() ?? {};
      const restData: Record<string, unknown> = { ...previousData };
      delete restData['_arch'];
      cell.setData(restData, { silent: true, overwrite: true });
      cell.setAttrByPath('icon/href', null);

      this.dfdIcon.restoreLabelDefaults(cell);
      this.dfdIcon.restoreBorder(cell);
      this.dfdIcon.revertAutoFit(cell);

      const operation = {
        id: `icon-remove-${Date.now()}-${cellId}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
        nodeId: cellId,
        updates: { properties: { _arch: null } },
        previousState: { properties: { _arch: previousData._arch ?? null } },
        includeInHistory: true,
        metadata: { previousCellState },
      };
      this.appDfdOrchestrator.executeOperation(operation).subscribe();
    }
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: update icon placement on diagram nodes and record undo history (mutates shared state)
  onIconPlacementChanged(event: PlacementChangedEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell || !cell.isNode()) continue;

      const previousData = cell.getData() ?? {};
      const previousArch = previousData._arch as ArchIconData | undefined;
      if (!previousArch) continue;

      const previousCellState = this.dfdIcon.captureCellStateForHistory(cell);

      const newArch: ArchIconData = {
        ...previousArch,
        placement: event.placement as any,
      };
      cell.setData({ ...previousData, _arch: newArch }, { silent: true });
      this.dfdIcon.applyIconToCell(cell, newArch);

      const operation = {
        id: `icon-placement-${Date.now()}-${cellId}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: Date.now(),
        nodeId: cellId,
        updates: { properties: { _arch: newArch } },
        previousState: { properties: { _arch: previousArch } },
        includeInHistory: true,
        metadata: { previousCellState },
      };
      this.appDfdOrchestrator.executeOperation(operation).subscribe();
    }
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  // -------- Auto-layout (#638, #642) --------

  /**
   * Apply auto-layout to `cell` and cascade to its container ancestors,
   * guarded by `_inLayoutCycle` so the resulting resize/position events do not
   * re-enter `_runLayoutCycle`. Caller owns history capture/dispatch; this
   * helper performs only the cell mutations.
   */
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: apply auto-layout to a cell and cascade to ancestors, guarded against re-entry (mutates shared state)
  private _runInlineLayoutCycle(cell: any): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;
    this._inLayoutCycle = true;
    try {
      const changed = this.dfdLayout.applyAutoLayout(cell, graph);
      if (changed) {
        this.dfdLayout.cascadeContainerLayout(cell, graph);
      }
    } finally {
      this._inLayoutCycle = false;
    }
  }

  /**
   * Run a layout cycle triggered by `cell`. Captures pre-state for the cell,
   * its layout children, and any cascade ancestors, applies the layout, then
   * issues a single batched history entry covering every touched cell. The
   * `_inLayoutCycle` guard prevents the handler-fired resize/position events
   * from re-entering this method recursively.
   */
  // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: run auto-layout for a trigger cell and emit batched undo history, re-entry guarded (mutates shared state)
  private _runLayoutCycle(triggerCell: any, sortBy: 'ports' | 'position' = 'ports'): boolean {
    if (this._inLayoutCycle) return false;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return false;
    this._inLayoutCycle = true;
    try {
      const previousStates = new Map<string, unknown>();
      // SEM@01f9ff2e5d302f59de9518564209654d345d9b8d: capture a node cell's state into the pre-layout snapshot map (mutates shared state)
      const captureCell = (c: any): void => {
        if (!c?.id || previousStates.has(c.id)) return;
        if (!c.isNode?.()) return;
        previousStates.set(c.id, this.dfdIcon.captureCellStateForHistory(c));
      };

      captureCell(triggerCell);
      for (const child of (triggerCell.getChildren?.() ?? []) as any[]) {
        captureCell(child);
      }
      let ancestor = triggerCell.getParent?.();
      while (ancestor) {
        if (isCellLayoutLocked(ancestor)) break;
        const ancData = ancestor.getData?.() ?? {};
        const autoFit = ancData._archAutoFit as
          | { kind: 'icon-only' | 'container'; width: number; height: number }
          | undefined;
        if (!autoFit || autoFit.kind !== 'container') break;
        captureCell(ancestor);
        for (const child of (ancestor.getChildren?.() ?? []) as any[]) {
          captureCell(child);
        }
        ancestor = ancestor.getParent?.();
      }

      const changed = this.dfdLayout.applyAutoLayout(triggerCell, graph, sortBy);
      if (changed) {
        this.dfdLayout.cascadeContainerLayout(triggerCell, graph);
      }

      if (!changed || previousStates.size === 0) return changed;

      const ts = Date.now();
      const ops = Array.from(previousStates.entries()).map(([id, prev], i) => ({
        id: `auto-layout-${ts}-${i}-${id}`,
        type: 'update-node' as const,
        source: 'user-interaction' as const,
        priority: 'normal' as const,
        timestamp: ts,
        nodeId: id,
        updates: {},
        includeInHistory: true,
        metadata: { previousCellState: prev },
      }));

      if (ops.length === 1) {
        this.appDfdOrchestrator.executeOperation(ops[0]).subscribe();
      } else {
        const batch = {
          id: `auto-layout-batch-${ts}`,
          type: 'batch-operation' as const,
          source: 'user-interaction' as const,
          priority: 'normal' as const,
          timestamp: ts,
          operations: ops,
          description: 'Auto-layout',
          includeInHistory: true,
        };
        this.appDfdOrchestrator.executeOperation(batch).subscribe();
      }

      return changed;
    } finally {
      this._inLayoutCycle = false;
    }
  }

  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: apply a style property change to selected diagram cells and update style panel (mutates shared state)
  onStyleChange(event: StyleChangeEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.applicableCellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell) continue;

      let operation: GraphOperation | null = null;
      if (cell.isNode()) {
        operation = this.dfdStyling.applyNodeStyleChange(cell, event);
      } else if (cell.isEdge() && event.property === 'strokeColor') {
        operation = this.dfdStyling.applyEdgeStyleChange(cell, event);
      }

      if (!operation) {
        // A node label-position change with an unrecognized position key:
        // the service performs no mutation and returns null.
        if (cell.isNode() && event.property === 'labelPosition') {
          this.logger.error('Unknown label position key', { positionKey: event.value });
        }
        continue;
      }

      const failureMessage =
        operation.type === 'update-edge'
          ? 'Edge style change failed'
          : 'Style change operation failed';

      this.appDfdOrchestrator.executeOperation(operation).subscribe({
        next: result => {
          if (!result.success) {
            this.logger.error(failureMessage, { error: result.error });
          }
        },
        error: error => {
          this.logger.error('Error applying style change', { error });
        },
      });
    }

    this.updateStylePanelCells();
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  // SEM@6ef84cf8f4f3d4682964be0a4ae2cb3f180bf27d: clear custom formatting from specified diagram cells and refresh style panel (mutates shared state)
  onClearCustomFormatting(cellIds: string[]): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell) continue;

      const operation = this.dfdStyling.clearCustomFormatting(cell);
      if (!operation) continue;

      const isEdge = operation.type === 'update-edge';
      this.appDfdOrchestrator.executeOperation(operation).subscribe({
        error: error => {
          this.logger.error(
            isEdge ? 'Error clearing edge custom formatting' : 'Error clearing custom formatting',
            { error },
          );
        },
      });
    }

    this.updateStylePanelCells();
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  // SEM@2c555798bd2125fe80100290956defed1b05474e: store updated diagram color palette in component state (mutates shared state)
  onDiagramPaletteChanged(palette: ColorPaletteEntry[]): void {
    this.diagramColorPalette = palette;
    // TODO: persist palette via REST/WebSocket diagram update using color_palette field
  }

  // SEM@b71c37e6ebaadf734d302ac51ca182bd0b5482b8: sync clipboard content flag from infrastructure and trigger change detection if changed (mutates shared state)
  private updateClipboardState(): void {
    const oldHasClipboardContent = this.hasClipboardContent;
    this.hasClipboardContent = !this.dfdInfrastructure.isClipboardEmpty();

    if (oldHasClipboardContent !== this.hasClipboardContent) {
      this.cdr.detectChanges();
    }
  }

  /**
   * Check if any of the given cells have non-empty _metadata entries.
   * If no cells are provided, checks all currently selected cells.
   */
  // SEM@122e52ca325567fc2739e6fd80b2bb4f4ad97c25: check whether any selected or given cells carry non-empty metadata entries (pure)
  private _selectedCellsHaveMetadata(cells?: Cell[]): boolean {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return false;

    const cellsToCheck =
      cells ||
      this.appDfdOrchestrator
        .getSelectedCells()
        .map((id: string) => graph.getCellById(id))
        .filter(Boolean);

    return cellsToCheck.some((cell: Cell) => (cell.getData()?._metadata?.length ?? 0) > 0);
  }

  /**
   * Show metadata loss confirmation dialog if any target cells have metadata.
   * Returns Observable<boolean> — true if deletion should proceed.
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: show deletion confirmation dialog if target cells have metadata; return proceed signal (pure)
  private _confirmDeletionIfNeeded(cells?: Cell[]): Observable<boolean> {
    if (!this._selectedCellsHaveMetadata(cells)) {
      return of(true);
    }

    return this.dfdDialog.confirmDeletion();
  }
}
