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
import { map, takeUntil } from 'rxjs/operators';
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
import { DFD_STYLING, DFD_STYLING_HELPERS } from '../../constants/styling-constants';
import { ColorPaletteEntry } from '../../types/color-palette.types';
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

import { HelpDialogComponent } from './help-dialog/help-dialog.component';
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
import { ArchitectureIconService } from '../../infrastructure/services/architecture-icon.service';
import {
  ArchIconData,
  ICON_ELIGIBLE_SHAPES,
  ICON_HIDEABLE_BORDER_SHAPES,
  ICON_HIDEABLE_BORDER_SELECTORS,
} from '../../types/arch-icon.types';
import {
  ICON_PLACEMENT_ATTRS,
  ICON_SIZE,
  DEFAULT_LABEL_ATTRS_BY_SHAPE,
  getIconPlacementKey,
  getLabelAttrsForIconPlacement,
} from '../../types/icon-placement.types';
import {
  AUTO_LAYOUT_DEFAULTS,
  ChildBox,
  IconColumn,
  Orientation,
  iconOnlyFitGeometry,
  inferOrientation,
  labelLineHeightForFontSize,
  layoutContainer,
  sortChildrenByPorts,
  sortChildrenByPosition,
} from '../../utils/auto-layout.util';
import { isCellLayoutLocked } from '../../utils/layout-lock.util';
import { measureLabelWidth } from '../../utils/text-measurement.util';
import {
  PortLabelPopoverComponent,
  PortLabelData,
  PortLabelChangeEvent,
  DEFAULT_PORT_LABEL_POSITION,
  PortLabelPosition,
} from './port-label-popover/port-label-popover.component';
import { getLabelPositionFromAttrs, LABEL_POSITION_ATTRS } from '../../types/label-position.types';

import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogResult,
} from '../../../../shared/components/confirm-action-dialog/confirm-action-dialog.component';
import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { UserPreferencesService } from '../../../../core/services/user-preferences.service';
import { InlineEditComponent } from '../../../../shared/components/inline-edit/inline-edit.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../../../tm/components/threats-dialog/threats-dialog.component';
import { environment } from '../../../../../environments/environment';

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
    private architectureIconService: ArchitectureIconService,
  ) {
    // this.logger.info('DfdComponent v2 constructor called');

    // Initialize X6 cell extensions first
    // this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();
  }

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
          this.applyIconsOnLoad();
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
          this.applyIconsOnLoad();
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

  onCopy(): void {
    if (!this.hasSelectedCells) return;

    this.logger.debugComponent('DfdComponent', 'Copy operation initiated');
    this.dfdInfrastructure.copy();
    this.updateClipboardState();
  }

  onPaste(): void {
    if (this.isReadOnlyMode) return;

    this.logger.debugComponent('DfdComponent', 'Paste operation initiated');
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
              // this.logger.info('Diagram and thumbnail save completed successfully');
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
            this.logger.debugComponent(
              'DfdComponent',
              'Successfully captured and cleaned diagram SVG thumbnail',
              {
                originalLength: svgString.length,
                base64Length: base64Svg.length,
              },
            );
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
      this.logger.debugComponent('DfdComponent', 'Label editor triggered for cell', {
        cellId: cell.id,
      });
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
    this.logger.debugComponent('DfdComponent', 'Moved cell forward', { cellId: targetCell.id });
  }

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
   * Load data assets from the threat model when the sub-menu opens
   */
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
  private _loadSelectedCellDataAssets(): void {
    this._selectedCellDataAssets.clear();

    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    // Get target cells: either the right-clicked cell or all selected cells
    const targetCells = this._rightClickedCell
      ? [this._rightClickedCell]
      : this.appDfdOrchestrator.getSelectedCells();

    for (const cell of targetCells) {
      const assetIds = this._getCellDataAssets(cell);
      this._selectedCellDataAssets.set(cell.id, new Set(assetIds));
    }
  }

  /**
   * Get data assets from a cell, handling both new and legacy formats
   */
  private _getCellDataAssets(cell: any): string[] {
    const data = cell.getData() || {};

    // New format: data_assets array
    if (data.data_assets && Array.isArray(data.data_assets)) {
      return data.data_assets;
    }

    // Legacy format: single dataAssetId
    if (data.dataAssetId && typeof data.dataAssetId === 'string') {
      return [data.dataAssetId];
    }

    return [];
  }

  /**
   * Set data assets on a cell using the new format
   */
  private _setCellDataAssets(cell: any, assetIds: string[]): void {
    const currentData = cell.getData() || {};
    const updatedData = { ...currentData };

    // Remove legacy format if present
    delete updatedData.dataAssetId;

    // Set new format (or remove if empty)
    if (assetIds.length > 0) {
      updatedData.data_assets = assetIds;
    } else {
      delete updatedData.data_assets;
    }

    cell.setData(updatedData);
  }

  /**
   * Check if a data asset is associated with ALL selected/right-clicked cells
   */
  isDataAssetChecked(assetId: string): boolean {
    if (this._selectedCellDataAssets.size === 0) return false;

    for (const assetSet of this._selectedCellDataAssets.values()) {
      if (!assetSet.has(assetId)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a data asset is associated with SOME (but not all) selected cells
   */
  isDataAssetIndeterminate(assetId: string): boolean {
    if (this._selectedCellDataAssets.size <= 1) return false;

    let hasAsset = false;
    let missingAsset = false;

    for (const assetSet of this._selectedCellDataAssets.values()) {
      if (assetSet.has(assetId)) {
        hasAsset = true;
      } else {
        missingAsset = true;
      }

      // If we found both states, it's indeterminate
      if (hasAsset && missingAsset) {
        return true;
      }
    }

    return false;
  }

  /**
   * Toggle a data asset association for all selected/right-clicked cells
   */
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
      const currentAssets = new Set(this._getCellDataAssets(cell));

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
  private subscribeToAutoLayoutTriggers(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

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
          this.revertAutoFit(oldParent);
        }
      }
    };

    const onMoved = ({ node }: { node: any }): void => {
      if (this._inLayoutCycle) return;
      const parent = node.getParent?.();
      if (!parent) return;
      const parentData = parent.getData?.() ?? {};
      const autoFit = parentData._archAutoFit as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') return;
      this._clearVerticesOfConnectedEdges(graph, node);
      this._runLayoutCycle(parent, 'position');
    };

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

  private _clearVerticesOfConnectedEdges(graph: any, node: any): void {
    const edges = graph.getConnectedEdges?.(node) ?? [];
    for (const edge of edges) {
      if (typeof edge.setVertices === 'function') {
        edge.setVertices([]);
      }
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
      this.logger.debugComponent('DfdComponent', 'Context menu handlers registered');
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

  closePortLabelPopover(): void {
    this.isPortLabelPopoverOpen = false;
    this.cdr.detectChanges();
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
        // Get metadata from the data._metadata field (where it's stored as an array)
        metadata: cell.getData()?._metadata || [],
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
  onWindowResize(_event: Event): void {
    // Delegate to orchestrator for centralized resize handling
    this.appDfdOrchestrator.onWindowResize();
  }

  // Helper Methods

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
          this.applyAutoLayoutToAllEligibleCells();
        } else {
          this.revertAutoFitOnAllAutoFitCells();
          // When borders flip back ON, re-apply the existing border-pref logic
          // (existing applyBorderPreference / restoreBorder per-cell run only at
          // icon-set time, so we need to walk all iconned cells here).
          this.reapplyBorderPreferenceToAllIconnedCells(prefs.showShapeBordersWithIcons);
        }
      } else if (orientationChanged && prefs.autoLayoutEnabled) {
        // Container layout reads orientation; icon-only fit doesn't depend on it.
        // 3a leaves this as a no-op; 3b will iterate container-fit cells.
        this.applyAutoLayoutToAllEligibleCells();
      }

      lastBorders = prefs.showShapeBordersWithIcons;
      lastEnabled = prefs.autoLayoutEnabled;
      lastOrientation = prefs.autoLayoutOrientation;
    });
  }

  private reapplyBorderPreferenceToAllIconnedCells(showBorders: boolean): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;
    for (const node of graph.getNodes()) {
      const data = node.getData();
      if (!data?._arch) continue;
      if (showBorders) {
        this.restoreBorder(node);
      } else {
        this.applyBorderPreference(node);
      }
    }
  }

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
      oldSelectedCellIsSecurityBoundary !== this.selectedCellIsSecurityBoundary
    ) {
      this.cdr.detectChanges();
    }
  }

  // Style panel methods

  toggleStylePanel(): void {
    this.isStylePanelOpen = !this.isStylePanelOpen;
    if (this.isStylePanelOpen) {
      this.updateStylePanelCells();
    }
    this.cdr.detectChanges();
  }

  private updateStylePanelCells(): void {
    const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.stylePanelCells = [];
      return;
    }

    this.stylePanelCells = selectedCellIds
      .map(id => graph.getCellById(id))
      .filter(Boolean)
      .map(cell => {
        const isNode = cell.isNode();
        const isEdge = cell.isEdge();
        const data = cell.getData() || {};
        const nodeType = data.nodeType || cell.shape || null;
        const attrs = cell.getAttrs() || {};

        let strokeColor: string | null = null;
        let fillColor: string | null = null;
        let fillOpacity: number | null = null;

        if (isNode) {
          const body = attrs['body'] || {};
          strokeColor = ((body as Record<string, any>)['stroke'] as string) || null;
          fillColor = ((body as Record<string, any>)['fill'] as string) || null;
          fillOpacity = ((body as Record<string, any>)['fillOpacity'] as number) ?? 1;
        } else if (isEdge) {
          const line = attrs['line'] || {};
          strokeColor = ((line as Record<string, any>)['stroke'] as string) || null;
        }

        let labelPosition = null;
        if (isNode && nodeType !== 'text-box') {
          const textAttrs = (attrs['text'] || {}) as Record<string, unknown>;
          labelPosition = getLabelPositionFromAttrs(textAttrs);
        }

        return {
          cellId: cell.id,
          isNode,
          isEdge,
          nodeType: isNode ? nodeType : null,
          strokeColor,
          fillColor,
          fillOpacity,
          hasCustomStyles: !!data.customStyles,
          labelPosition,
          hasArchIcon: !!data._arch,
        };
      });
  }

  // Icon picker panel methods

  toggleIconPickerPanel(): void {
    this.isIconPickerPanelOpen = !this.isIconPickerPanelOpen;
    if (this.isIconPickerPanelOpen) {
      this.updateIconPickerCells();
    }
    this.cdr.detectChanges();
  }

  private updateIconPickerCells(): void {
    if (!this.isIconPickerPanelOpen) return;
    const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) {
      this.iconPickerCells = [];
      return;
    }
    this.iconPickerCells = selectedCellIds
      .map(id => graph.getCellById(id))
      .filter(cell => cell?.isNode())
      .map(cell => ({
        cellId: cell!.id,
        nodeType: cell!.shape,
        arch: (cell!.getData()?._arch as ArchIconData) ?? null,
      }));
  }

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
      const previousCellState = this._captureCellStateForHistory(cell);

      const previousData = cell.getData() ?? {};
      cell.setData({ ...previousData, _arch: event.arch }, { silent: true });
      this.applyIconToCell(cell, event.arch);
      this.applyBorderPreference(cell);
      this.applyAutoLayout(cell);

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

  onIconRemoved(event: IconRemovedEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell || !cell.isNode()) continue;

      const previousCellState = this._captureCellStateForHistory(cell);

      const previousData = cell.getData() ?? {};
      const restData: Record<string, unknown> = { ...previousData };
      delete restData['_arch'];
      cell.setData(restData, { silent: true, overwrite: true });
      cell.setAttrByPath('icon/href', null);

      this.restoreLabelDefaults(cell);
      this.restoreBorder(cell);
      this.revertAutoFit(cell);

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

      const previousCellState = this._captureCellStateForHistory(cell);

      const newArch: ArchIconData = {
        ...previousArch,
        placement: event.placement as any,
      };
      cell.setData({ ...previousData, _arch: newArch }, { silent: true });
      this.applyIconToCell(cell, newArch);

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

  /**
   * Deep-clone a cell snapshot for history tracking. Used by handlers that
   * mutate cell.data/attrs before calling executeOperation — the executor's
   * own previousState capture runs after the mutation, so it would record
   * the post-mutation state. metadata.previousCellState overrides that.
   */
  private _captureCellStateForHistory(cell: any): unknown {
    const parent = cell.getParent?.();
    return JSON.parse(
      JSON.stringify({
        id: cell.id,
        shape: cell.shape,
        position: cell.getPosition(),
        size: cell.getSize(),
        attrs: cell.getAttrs(),
        ports: cell.getPorts?.(),
        data: cell.getData(),
        visible: cell.isVisible?.(),
        zIndex: cell.getZIndex(),
        parent: parent?.isNode?.() ? parent.id : undefined,
      }),
    );
  }

  private applyIconToCell(cell: any, arch: ArchIconData): void {
    const iconPath = this.architectureIconService.getIconPath(arch);
    const placementKey = getIconPlacementKey(arch.placement);
    const placementAttrs = ICON_PLACEMENT_ATTRS[placementKey];

    cell.setAttrByPath('icon/href', iconPath);
    cell.setAttrByPath('icon/width', ICON_SIZE);
    cell.setAttrByPath('icon/height', ICON_SIZE);
    cell.setAttrByPath('icon/refX', placementAttrs.refX);
    cell.setAttrByPath('icon/refY', placementAttrs.refY);
    cell.setAttrByPath('icon/refX2', -ICON_SIZE / 2);
    cell.setAttrByPath('icon/refY2', -ICON_SIZE / 2);

    // Label is locked to the icon: horizontally centered on it, below with padding,
    // for every placement and every eligible shape (including security-boundary).
    const labelAttrs = getLabelAttrsForIconPlacement(arch.placement);
    cell.setAttrByPath('text/refX', labelAttrs.refX);
    cell.setAttrByPath('text/refY', labelAttrs.refY);
    cell.setAttrByPath('text/refX2', labelAttrs.refX2);
    cell.setAttrByPath('text/refY2', labelAttrs.refY2);
    cell.setAttrByPath('text/textAnchor', labelAttrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', labelAttrs.textVerticalAnchor);
  }

  private restoreLabelDefaults(cell: any): void {
    const defaults = DEFAULT_LABEL_ATTRS_BY_SHAPE[cell.shape];
    if (!defaults) return;
    cell.setAttrByPath('text/refX', defaults.refX);
    cell.setAttrByPath('text/refY', defaults.refY);
    cell.setAttrByPath('text/refX2', 0);
    cell.setAttrByPath('text/refY2', 0);
    cell.setAttrByPath('text/textAnchor', 'middle');
    cell.setAttrByPath('text/textVerticalAnchor', 'middle');
  }

  private applyBorderPreference(cell: any): void {
    const prefs = this.userPreferencesService.getPreferences();
    if (
      !prefs.showShapeBordersWithIcons &&
      (ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(cell.shape)
    ) {
      const selectors = ICON_HIDEABLE_BORDER_SELECTORS[cell.shape] ?? ['body'];
      for (const sel of selectors) {
        cell.setAttrByPath(`${sel}/stroke`, 'transparent');
        cell.setAttrByPath(`${sel}/fill`, 'transparent');
      }
    }
  }

  private restoreBorder(cell: any): void {
    const shape = cell.shape;
    const nodeStyles = DFD_STYLING.NODES as Record<string, any>;
    const shapeKey = shape.toUpperCase().replace(/-/g, '_');
    const config = nodeStyles[shapeKey];
    if (!config) return;
    const stroke = config.STROKE ?? DFD_STYLING.DEFAULT_STROKE;
    const fill = config.FILL ?? DFD_STYLING.DEFAULT_FILL;
    const selectors = ICON_HIDEABLE_BORDER_SELECTORS[shape] ?? ['body'];
    for (const sel of selectors) {
      cell.setAttrByPath(`${sel}/stroke`, stroke);
      cell.setAttrByPath(`${sel}/fill`, fill);
    }
  }

  private applyIconsOnLoad(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const node of graph.getNodes()) {
      const data = node.getData();
      const arch = data?._arch as ArchIconData | undefined;
      if (arch) {
        this.applyIconToCell(node, arch);
        this.applyBorderPreference(node);
      }
      // Auto-layout pass for both iconned cells and security boundaries with
      // embedded children. applyAutoLayout no-ops anything that isn't eligible.
      this.applyAutoLayout(node);
    }
  }

  // -------- Auto-layout (#638, #642) --------

  /**
   * Top-level auto-layout entry point. Returns true if any change was applied.
   *
   * Dispatches to icon-only fit for leaf iconned shapes, or container fit for
   * any auto-layout-eligible shape with embedded non-text-box children.
   *
   * `sortBy` controls how container-fit children are ordered:
   *   - `ports` (default) — by connection-port usage (initial layout)
   *   - `position` — by current (x, y) (after a child drag)
   */
  private applyAutoLayout(cell: any, sortBy: 'ports' | 'position' = 'ports'): boolean {
    if (!this.userPreferencesService.getPreferences().autoLayoutEnabled) return false;
    if (isCellLayoutLocked(cell)) return false;
    const data = cell.getData() ?? {};
    const allChildren = (cell.getChildren?.() ?? []) as any[];
    const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
    if (layoutChildren.length > 0) {
      return this.applyContainerFit(cell, layoutChildren, sortBy);
    }
    if (!data._arch) return false;
    return this.applyIconOnlyFit(cell);
  }

  /**
   * Apply the icon-only fit: 32 × (32 + labelLineHeight). Only fires when:
   *   - shape ∈ {actor, process, store}
   *   - showShapeBordersWithIcons === false (icon-only mode)
   *   - cell has no embedded children
   *   - current size is shape default OR is the size we previously set
   */
  private applyIconOnlyFit(cell: any): boolean {
    if (!(ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(cell.shape)) return false;

    const prefs = this.userPreferencesService.getPreferences();
    if (prefs.showShapeBordersWithIcons) return false;

    const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
    const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
    if (!shapeConfig) return false;
    const defaultWidth = shapeConfig.DEFAULT_WIDTH as number;
    const defaultHeight = shapeConfig.DEFAULT_HEIGHT as number;

    const data = cell.getData() ?? {};
    const previousAutoFit = data._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    const { width: currentWidth, height: currentHeight } = cell.getSize();
    const atDefaultSize = currentWidth === defaultWidth && currentHeight === defaultHeight;
    const stillAtPreviousAutoFit =
      !!previousAutoFit &&
      currentWidth === previousAutoFit.width &&
      currentHeight === previousAutoFit.height;
    if (!atDefaultSize && !stillAtPreviousAutoFit) return false;

    const lineHeight = labelLineHeightForFontSize(DFD_STYLING.DEFAULT_FONT_SIZE);
    const geom = iconOnlyFitGeometry(lineHeight);

    if (currentWidth !== geom.width || currentHeight !== geom.height) {
      cell.resize(geom.width, geom.height);
    }
    this._setAbsoluteIconAttrs(cell, geom.iconAttrs);
    this._setAbsoluteLabelAttrs(cell, geom.labelAttrs);

    cell.setData(
      {
        ...cell.getData(),
        _archAutoFit: { kind: 'icon-only', width: geom.width, height: geom.height },
      },
      { silent: true },
    );
    return true;
  }

  /**
   * Apply container fit. Resizes the cell to fit a grid of layout children
   * plus an optional icon column/row, repositions each child within the grid,
   * and updates icon/label attrs for iconned cells. Returns true if any
   * change was applied.
   *
   * Eligibility: shape ∈ {actor, process, store, security-boundary} AND
   * current size is shape default OR matches the previously-recorded auto-fit
   * size (i.e., the user has not manually resized this cell).
   */
  private applyContainerFit(
    cell: any,
    layoutChildren: any[],
    sortBy: 'ports' | 'position',
  ): boolean {
    if (!(ICON_ELIGIBLE_SHAPES as readonly string[]).includes(cell.shape)) return false;

    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return false;

    const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
    const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
    if (!shapeConfig) return false;
    const defaultWidth = shapeConfig.DEFAULT_WIDTH as number;
    const defaultHeight = shapeConfig.DEFAULT_HEIGHT as number;

    const data = cell.getData() ?? {};
    const previousAutoFit = data._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    const { width: currentWidth, height: currentHeight } = cell.getSize();
    const atDefaultSize = currentWidth === defaultWidth && currentHeight === defaultHeight;
    const stillAtPreviousAutoFit =
      !!previousAutoFit &&
      currentWidth === previousAutoFit.width &&
      currentHeight === previousAutoFit.height;
    if (!atDefaultSize && !stillAtPreviousAutoFit) return false;

    const fontSize = DFD_STYLING.DEFAULT_FONT_SIZE;
    const fontFamily = DFD_STYLING.TEXT_FONT_FAMILY;
    const lineHeight = labelLineHeightForFontSize(fontSize);

    const arch = data._arch as ArchIconData | undefined;
    const iconCol: IconColumn = this._buildIconColumn(cell, arch, fontSize, fontFamily, lineHeight);

    const childBoxes: ChildBox[] = layoutChildren.map(child => this._buildChildBox(graph, child));

    const orientation = this._resolveLayoutOrientation(graph);
    const sorted =
      sortBy === 'position'
        ? sortChildrenByPosition(childBoxes, orientation)
        : sortChildrenByPorts(childBoxes, orientation);

    const padding = {
      outer: AUTO_LAYOUT_DEFAULTS.outerPad,
      iconGap: AUTO_LAYOUT_DEFAULTS.iconGap,
      gap: AUTO_LAYOUT_DEFAULTS.gap,
    };
    const layout = layoutContainer(iconCol, sorted, orientation, padding, lineHeight);

    if (currentWidth !== layout.containerWidth || currentHeight !== layout.containerHeight) {
      cell.resize(layout.containerWidth, layout.containerHeight);
    }

    if (layout.iconAttrs) {
      this._setAbsoluteIconAttrs(cell, layout.iconAttrs);
    }
    if (layout.labelAttrs) {
      this._setAbsoluteLabelAttrs(cell, layout.labelAttrs);
    }

    // layoutContainer returns child positions in container-local coords; x6
    // children use absolute graph coords, so translate by the container's
    // current absolute position.
    const cellPos = cell.getPosition();
    for (const pos of layout.childPositions) {
      const child = graph.getCellById(pos.id);
      if (!child) continue;
      const absX = cellPos.x + pos.x;
      const absY = cellPos.y + pos.y;
      const cur = child.getPosition();
      if (cur.x !== absX || cur.y !== absY) {
        child.setPosition(absX, absY);
      }
    }

    cell.setData(
      {
        ...cell.getData(),
        _archAutoFit: {
          kind: 'container',
          width: layout.containerWidth,
          height: layout.containerHeight,
        },
      },
      { silent: true },
    );

    return true;
  }

  private _buildIconColumn(
    cell: any,
    arch: ArchIconData | undefined,
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
  ): IconColumn {
    if (!arch) {
      return { hasIcon: false, width: 0, height: 0 };
    }
    const labelText = (cell.getAttrs?.()?.text?.text as string | undefined) ?? '';
    const labelWidth = measureLabelWidth(labelText, fontSize, fontFamily);
    return {
      hasIcon: true,
      width: Math.max(ICON_SIZE, Math.ceil(labelWidth)),
      height: ICON_SIZE + AUTO_LAYOUT_DEFAULTS.labelGap + lineHeight,
    };
  }

  private _buildChildBox(graph: any, child: any): ChildBox {
    const { width, height } = child.getSize();
    const ports: { top: boolean; right: boolean; bottom: boolean; left: boolean } = {
      top: false,
      right: false,
      bottom: false,
      left: false,
    };
    const markPort = (portId: unknown): void => {
      if (portId === 'top' || portId === 'right' || portId === 'bottom' || portId === 'left') {
        ports[portId] = true;
      }
    };
    const edges = graph.getConnectedEdges?.(child) ?? [];
    for (const edge of edges) {
      if (edge.getSourceCellId?.() === child.id) {
        markPort(edge.getSourcePortId?.());
      }
      if (edge.getTargetCellId?.() === child.id) {
        markPort(edge.getTargetPortId?.());
      }
    }
    const pos = child.getPosition();
    return { id: child.id, width, height, ports, x: pos.x, y: pos.y };
  }

  private _resolveLayoutOrientation(graph: any): Orientation {
    const prefs = this.userPreferencesService.getPreferences();
    if (prefs.autoLayoutOrientation === 'horizontal') return 'horizontal';
    if (prefs.autoLayoutOrientation === 'vertical') return 'vertical';
    const topLevel = (graph.getNodes() as any[]).filter(n => !n.getParent?.());
    return inferOrientation(
      topLevel.map(n => {
        const p = n.getPosition();
        const s = n.getSize();
        return { x: p.x, y: p.y, width: s.width, height: s.height };
      }),
    );
  }

  /**
   * Walk up the parent chain from `startCell`. For each ancestor that is in
   * container-fit state, re-apply container fit. Stops at the first ancestor
   * without an `_archAutoFit.kind === 'container'` flag.
   */
  private cascadeContainerLayout(startCell: any): void {
    let parent = startCell.getParent?.();
    while (parent) {
      if (isCellLayoutLocked(parent)) break;
      const data = parent.getData?.() ?? {};
      const autoFit = data._archAutoFit as
        | { kind: 'icon-only' | 'container'; width: number; height: number }
        | undefined;
      if (!autoFit || autoFit.kind !== 'container') break;
      const allChildren = (parent.getChildren?.() ?? []) as any[];
      const layoutChildren = allChildren.filter(c => c.shape !== 'text-box');
      if (layoutChildren.length === 0) break;
      this.applyContainerFit(parent, layoutChildren, 'ports');
      parent = parent.getParent?.();
    }
  }

  /**
   * Run a layout cycle triggered by `cell`. Captures pre-state for the cell,
   * its layout children, and any cascade ancestors, applies the layout, then
   * issues a single batched history entry covering every touched cell. The
   * `_inLayoutCycle` guard prevents the handler-fired resize/position events
   * from re-entering this method recursively.
   */
  private _runLayoutCycle(triggerCell: any, sortBy: 'ports' | 'position' = 'ports'): boolean {
    if (this._inLayoutCycle) return false;
    this._inLayoutCycle = true;
    try {
      const previousStates = new Map<string, unknown>();
      const captureCell = (c: any): void => {
        if (!c?.id || previousStates.has(c.id)) return;
        previousStates.set(c.id, this._captureCellStateForHistory(c));
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

      const changed = this.applyAutoLayout(triggerCell, sortBy);
      if (changed) {
        this.cascadeContainerLayout(triggerCell);
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

  /**
   * Reverse a prior auto-fit (icon-only or container). Only acts on cells
   * whose current size still matches the dimensions we recorded — if the
   * user has resized the cell since, leave size alone and just clear the
   * flag.
   */
  private revertAutoFit(cell: any): boolean {
    const data = cell.getData() ?? {};
    const previousAutoFit = data._archAutoFit as
      | { kind: 'icon-only' | 'container'; width: number; height: number }
      | undefined;
    if (!previousAutoFit) return false;

    const { width, height } = cell.getSize();
    const stillAtAutoFitSize = width === previousAutoFit.width && height === previousAutoFit.height;

    if (stillAtAutoFitSize) {
      const shapeKey = cell.shape.toUpperCase().replace(/-/g, '_');
      const shapeConfig = (DFD_STYLING.NODES as Record<string, any>)[shapeKey];
      if (shapeConfig) {
        cell.resize(shapeConfig.DEFAULT_WIDTH as number, shapeConfig.DEFAULT_HEIGHT as number);
      }
      // Restore icon and label to user-chosen placement.
      const arch = data._arch as ArchIconData | undefined;
      if (arch) {
        this.applyIconToCell(cell, arch);
      }
    }

    const next = { ...cell.getData() };
    delete next._archAutoFit;
    cell.setData(next, { silent: true, overwrite: true });
    return true;
  }

  /**
   * Apply auto-layout to every eligible cell. Used when a global preference
   * (showShapeBordersWithIcons, autoLayoutEnabled, autoLayoutOrientation)
   * changes — newly-placed icons handle themselves through onIconSelected.
   *
   * Eligible cells include any iconned shape (icon-only or container fit) plus
   * security boundaries with embedded layout children (container fit, no icon).
   */
  private applyAutoLayoutToAllEligibleCells(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;
    for (const node of graph.getNodes()) {
      if (isCellLayoutLocked(node)) continue;
      const data = node.getData();
      const allChildren = (node.getChildren?.() ?? []) as any[];
      const hasLayoutChildren = allChildren.some(c => c.shape !== 'text-box');
      if (data?._arch || hasLayoutChildren) this.applyAutoLayout(node);
    }
  }

  /**
   * Revert auto-fit on every cell that has an `_archAutoFit` tag.
   * Used when a global preference flips the auto-layout system off.
   */
  private revertAutoFitOnAllAutoFitCells(): void {
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;
    for (const node of graph.getNodes()) {
      if (isCellLayoutLocked(node)) continue;
      const data = node.getData();
      if (data?._archAutoFit) this.revertAutoFit(node);
    }
  }

  private _setAbsoluteIconAttrs(
    cell: any,
    attrs: { refX: number; refY: number; refX2: number; refY2: number },
  ): void {
    cell.setAttrByPath('icon/refX', attrs.refX);
    cell.setAttrByPath('icon/refY', attrs.refY);
    cell.setAttrByPath('icon/refX2', attrs.refX2);
    cell.setAttrByPath('icon/refY2', attrs.refY2);
  }

  private _setAbsoluteLabelAttrs(
    cell: any,
    attrs: {
      refX: number;
      refY: number;
      refX2: number;
      refY2: number;
      textAnchor: 'middle';
      textVerticalAnchor: 'top' | 'middle' | 'bottom';
    },
  ): void {
    cell.setAttrByPath('text/refX', attrs.refX);
    cell.setAttrByPath('text/refY', attrs.refY);
    cell.setAttrByPath('text/refX2', attrs.refX2);
    cell.setAttrByPath('text/refY2', attrs.refY2);
    cell.setAttrByPath('text/textAnchor', attrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', attrs.textVerticalAnchor);
  }

  onStyleChange(event: StyleChangeEvent): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of event.applicableCellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell) continue;

      if (cell.isNode()) {
        this.applyNodeStyleChange(cell, event);
      } else if (cell.isEdge() && event.property === 'strokeColor') {
        this.applyEdgeStyleChange(cell, event);
      }
    }

    this.updateStylePanelCells();
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  private applyNodeStyleChange(cell: Cell, event: StyleChangeEvent): void {
    const previousAttrs = cell.getAttrs() || {};
    const previousBody = previousAttrs['body'] || {};
    const previousText = previousAttrs['text'] || {};
    const previousData = cell.getData() || {};

    // Handle label position changes separately
    if (event.property === 'labelPosition') {
      this.applyLabelPositionChange(cell, event, previousText, previousData);
      return;
    }

    const attrPathMap: Record<string, string> = {
      strokeColor: 'body/stroke',
      fillColor: 'body/fill',
      fillOpacity: 'body/fillOpacity',
    };
    const styleKeyMap: Record<string, string> = {
      strokeColor: 'stroke',
      fillColor: 'fill',
      fillOpacity: 'fillOpacity',
    };

    cell.setAttrByPath(attrPathMap[event.property], event.value);
    cell.setData({ ...previousData, customStyles: true }, { silent: true });

    const operation = {
      id: `style-change-${Date.now()}-${cell.id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cell.id,
      updates: {
        style: { [styleKeyMap[event.property]]: event.value },
        properties: { customStyles: true },
      },
      previousState: {
        style: {
          stroke: previousBody['stroke'],
          fill: previousBody['fill'],
          fillOpacity: previousBody['fillOpacity'] ?? 1,
        },
        properties: { customStyles: previousData['customStyles'] || false },
      },
      includeInHistory: true,
    };

    this.appDfdOrchestrator.executeOperation(operation).subscribe({
      next: result => {
        if (!result.success) {
          this.logger.error('Style change operation failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error applying style change', { error });
      },
    });
  }

  private applyLabelPositionChange(
    cell: Cell,
    event: StyleChangeEvent,
    previousText: Record<string, any>,
    previousData: Record<string, any>,
  ): void {
    const positionKey = event.value as string;
    const posAttrs = LABEL_POSITION_ATTRS[positionKey];
    if (!posAttrs) {
      this.logger.error('Unknown label position key', { positionKey });
      return;
    }

    cell.setAttrByPath('text/refX', posAttrs.refX);
    cell.setAttrByPath('text/refY', posAttrs.refY);
    cell.setAttrByPath('text/textAnchor', posAttrs.textAnchor);
    cell.setAttrByPath('text/textVerticalAnchor', posAttrs.textVerticalAnchor);
    cell.setData({ ...previousData, customStyles: true }, { silent: true });

    const operation = {
      id: `label-position-${Date.now()}-${cell.id}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cell.id,
      updates: {
        style: {
          refX: posAttrs.refX,
          refY: posAttrs.refY,
          textAnchor: posAttrs.textAnchor,
          textVerticalAnchor: posAttrs.textVerticalAnchor,
        },
        properties: { customStyles: true },
      },
      previousState: {
        style: {
          refX: previousText['refX'] ?? '50%',
          refY: previousText['refY'] ?? '50%',
          textAnchor: previousText['textAnchor'] ?? 'middle',
          textVerticalAnchor: previousText['textVerticalAnchor'] ?? 'middle',
        },
        properties: { customStyles: previousData['customStyles'] || false },
      },
      includeInHistory: true,
    };

    this.appDfdOrchestrator.executeOperation(operation).subscribe({
      next: result => {
        if (!result.success) {
          this.logger.error('Label position change failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error applying label position change', { error });
      },
    });
  }

  private applyEdgeStyleChange(cell: Cell, event: StyleChangeEvent): void {
    const previousAttrs = cell.getAttrs() || {};
    const previousLine = previousAttrs['line'] || {};

    cell.setAttrByPath('line/stroke', event.value);

    const operation = {
      id: `style-change-${Date.now()}-${cell.id}`,
      type: 'update-edge' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      edgeId: cell.id,
      updates: {
        style: { stroke: event.value },
      },
      previousState: {
        style: { stroke: previousLine['stroke'] },
      },
      includeInHistory: true,
    };

    this.appDfdOrchestrator.executeOperation(operation).subscribe({
      next: result => {
        if (!result.success) {
          this.logger.error('Edge style change failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error applying edge style change', { error });
      },
    });
  }

  onClearCustomFormatting(cellIds: string[]): void {
    if (this.isReadOnlyMode) return;
    const graph = this.appDfdOrchestrator.getGraph;
    if (!graph) return;

    for (const cellId of cellIds) {
      const cell = graph.getCellById(cellId);
      if (!cell) continue;

      if (cell.isNode()) {
        const data = cell.getData() || {};
        const nodeType = data.nodeType || cell.shape || 'process';
        const defaultFill = DFD_STYLING_HELPERS.getDefaultFill(nodeType as NodeType);
        const defaultStroke = DFD_STYLING_HELPERS.getDefaultStroke(nodeType as NodeType);

        cell.setAttrByPath('body/fill', defaultFill);
        cell.setAttrByPath('body/stroke', defaultStroke);
        cell.setAttrByPath('body/fillOpacity', 1);
        // Reset label position to shape-specific defaults
        const defaultRefY = nodeType === 'store' ? '55%' : '50%';
        cell.setAttrByPath('text/refX', '50%');
        cell.setAttrByPath('text/refY', defaultRefY);
        cell.setAttrByPath('text/textAnchor', 'middle');
        cell.setAttrByPath('text/textVerticalAnchor', 'middle');
        cell.setData({ ...data, customStyles: undefined }, { silent: true });

        const operation = {
          id: `clear-style-${Date.now()}-${cellId}`,
          type: 'update-node' as const,
          source: 'user-interaction' as const,
          priority: 'normal' as const,
          timestamp: Date.now(),
          nodeId: cellId,
          updates: {
            style: {
              fill: defaultFill,
              stroke: defaultStroke,
              fillOpacity: 1,
              refX: '50%',
              refY: defaultRefY,
              textAnchor: 'middle',
              textVerticalAnchor: 'middle',
            },
            properties: { customStyles: undefined },
          },
          includeInHistory: true,
        };

        this.appDfdOrchestrator.executeOperation(operation).subscribe({
          error: error => {
            this.logger.error('Error clearing custom formatting', { error });
          },
        });
      } else if (cell.isEdge()) {
        const defaultStroke = DFD_STYLING.EDGES.DEFAULT_STROKE;
        cell.setAttrByPath('line/stroke', defaultStroke);

        const operation = {
          id: `clear-style-${Date.now()}-${cellId}`,
          type: 'update-edge' as const,
          source: 'user-interaction' as const,
          priority: 'normal' as const,
          timestamp: Date.now(),
          edgeId: cellId,
          updates: {
            style: { stroke: defaultStroke },
          },
          includeInHistory: true,
        };

        this.appDfdOrchestrator.executeOperation(operation).subscribe({
          error: error => {
            this.logger.error('Error clearing edge custom formatting', { error });
          },
        });
      }
    }

    this.updateStylePanelCells();
    this.updateIconPickerCells();
    this.cdr.detectChanges();
  }

  onDiagramPaletteChanged(palette: ColorPaletteEntry[]): void {
    this.diagramColorPalette = palette;
    // TODO: persist palette via REST/WebSocket diagram update using color_palette field
  }

  private updateClipboardState(): void {
    const oldHasClipboardContent = this.hasClipboardContent;
    this.hasClipboardContent = !this.dfdInfrastructure.isClipboardEmpty();

    if (oldHasClipboardContent !== this.hasClipboardContent) {
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

  /**
   * Check if any of the given cells have non-empty _metadata entries.
   * If no cells are provided, checks all currently selected cells.
   */
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
  private _confirmDeletionIfNeeded(cells?: Cell[]): Observable<boolean> {
    if (!this._selectedCellsHaveMetadata(cells)) {
      return of(true);
    }

    const dialogRef = this.dialog.open(ConfirmActionDialogComponent, {
      width: '450px',
      data: {
        title: 'editor.deleteMetadataWarning.title',
        message: 'editor.deleteMetadataWarning.message',
        confirmLabel: 'editor.deleteMetadataWarning.confirm',
        confirmIsDestructive: true,
      },
      disableClose: true,
    });

    return dialogRef
      .afterClosed()
      .pipe(map((result: ConfirmActionDialogResult | undefined) => result?.confirmed ?? false));
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

    // Build the threat data for the API (server assigns id, timestamps)
    const newThreatData = {
      name: threatData.name,
      description: threatData.description,
      diagram_id: threatData.diagram_id,
      cell_id: threatData.cell_id,
      severity: threatData.severity,
      score: threatData.score,
      priority: threatData.priority,
      mitigated: threatData.mitigated,
      status: threatData.status,
      threat_type: threatData.threat_type,
      asset_id: threatData.asset_id,
      issue_uri: threatData.issue_uri,
    };

    // Use the dedicated createThreat endpoint
    this._subscriptions.add(
      this.threatModelService.createThreat(this.threatModelId, newThreatData).subscribe({
        next: newThreat => {
          this.logger.info('Threat created successfully', { threatId: newThreat.id });
        },
        error: error => {
          this.logger.error('Failed to create threat', error);
        },
      }),
    );
  }
}
