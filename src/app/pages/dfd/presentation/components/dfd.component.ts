/**
 * Data Flow Diagram (DFD) Component - v2 Architecture
 *
 * This is the main component for the Data Flow Diagram editor page using the new DFD v2 architecture.
 * It provides a comprehensive diagram editing environment with centralized operation management.
 *
 * Key functionality:
 * - Centralized operation management via DfdOrchestrator
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
import { Subject, Subscription, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

// DFD v2 Architecture
import { DfdOrchestrator } from './services/dfd-orchestrator.service';
import { AutoSaveManager } from './services/auto-save-manager.service';
import { GraphOperationManager } from './services/graph-operation-manager.service';
import { PersistenceCoordinator } from './services/persistence-coordinator.service';
import { DfdInfrastructureFacade } from './services/dfd-infrastructure.facade';

// Essential v1 components still needed
import { NodeType } from './domain/value-objects/node-info';
import { DfdCollaborationComponent } from './components/collaboration/collaboration.component';
import { ThreatModelService } from '../tm/services/threat-model.service';
import { MatDialog } from '@angular/material/dialog';
import { DfdCollaborationService } from '../../core/services/dfd-collaboration.service';
import { ThreatModelAuthorizationService } from '../tm/services/threat-model-authorization.service';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../tm/components/metadata-dialog/metadata-dialog.component';

import { CellDataExtractionService } from '../../shared/services/cell-data-extraction.service';

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
    // DFD v2 Architecture - Core Services with Facade
    DfdInfrastructureFacade, // Facade encapsulates all infrastructure dependencies
    DfdOrchestrator,
    GraphOperationManager,
    AutoSaveManager,
    PersistenceCoordinator,
    // Essential services still needed
    ThreatModelService,
    ThreatModelAuthorizationService,
    DfdCollaborationService,
    CellDataExtractionService,
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

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private dfdOrchestrator: DfdOrchestrator,
    private autoSaveManager: AutoSaveManager,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private translocoService: TranslocoService,
    private collaborationService: DfdCollaborationService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
    private dfdInfrastructure: DfdInfrastructureFacade,
  ) {
    this.logger.info('DfdComponent v2 constructor called');

    // Initialize X6 cell extensions first
    this.logger.info('Initializing X6 cell extensions');
    initializeX6CellExtensions();
  }

  ngOnInit(): void {
    this.logger.info('DfdComponent v2 ngOnInit called');

    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id');
    this.dfdId = this.route.snapshot.paramMap.get('dfdId');

    // Get query parameters for collaboration intent
    this.joinCollaboration = this.route.snapshot.queryParamMap.get('joinCollaboration') === 'true';

    this.logger.info('DFD Component v2 route parameters extracted', {
      threatModelId: this.threatModelId,
      dfdId: this.dfdId,
      joinCollaboration: this.joinCollaboration,
    });

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

      // Note: Permission handling moved to ngAfterViewInit to properly coordinate with orchestrator initialization
    } else {
      this.logger.warn('No threat model data available from route resolver');
    }

    // Configure auto-save policies based on user permission
    this.configureAutoSave();
  }

  ngAfterViewInit(): void {
    this.logger.info('DfdComponent v2 ngAfterViewInit called');

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
    if (this.dfdOrchestrator.getState().initialized) {
      // Update existing orchestrator read-only mode
      this.dfdOrchestrator.setReadOnlyMode(this.isReadOnlyMode);
      this.configureAutoSave();
      this.cdr.markForCheck();
      return;
    }

    // Initialize the DFD Orchestrator with proper initialization parameters
    const initParams = {
      diagramId: this.dfdId || 'new-diagram',
      threatModelId: this.threatModelId || 'unknown',
      containerElement: this.graphContainer.nativeElement,
      collaborationEnabled: true,
      readOnly: this.isReadOnlyMode,
      autoSaveMode: this.isReadOnlyMode ? ('manual' as const) : ('normal' as const),
      joinCollaboration: this.joinCollaboration,
    };

    this.logger.debug('Attempting to initialize DFD Orchestrator', initParams);
    this.dfdOrchestrator.initialize(initParams).subscribe({
      next: success => {
        this.logger.info('DFD Orchestrator initialization result', { success });
        if (success) {
          this.logger.info('DFD Orchestrator initialized successfully');

          // Load diagram data if we have a dfdId
          if (this.dfdId) {
            this.loadDiagramData(this.dfdId);
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
    this.logger.info('DfdComponent v2 ngOnDestroy called');

    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();

    // Clean up orchestrator
    // DfdOrchestrator doesn't have dispose method, handle cleanup via subscriptions
  }

  private configureAutoSave(): void {
    // Configure auto-save based on user permission
    const autoSavePolicy = this.isReadOnlyMode ? 'manual' : 'normal';

    this.autoSaveManager.configure({
      enabled: !this.isReadOnlyMode,
      policy: autoSavePolicy,
      debounceMs: autoSavePolicy === 'normal' ? 5000 : 30000,
    });

    this.logger.info('Auto-save configured', {
      enabled: !this.isReadOnlyMode,
      policy: autoSavePolicy,
      isReadOnlyMode: this.isReadOnlyMode,
      threatModelPermission: this.threatModelPermission,
    });
  }

  private setupOrchestratorSubscriptions(): void {
    // Subscribe to auto-save events
    this._subscriptions.add(
      this.autoSaveManager.saveCompleted$.pipe(takeUntil(this._destroy$)).subscribe(result => {
        if (result.success) {
          this.logger.debug('Auto-save completed successfully');
        } else {
          this.logger.warn('Auto-save failed', { error: result.error });
        }
      }),
    );

    // Subscribe to orchestrator state changes
    this._subscriptions.add(
      this.dfdOrchestrator.state$.pipe(takeUntil(this._destroy$)).subscribe(state => {
        // Update component state based on orchestrator state
        this.logger.debug('DFD orchestrator state changed', {
          initialized: state.initialized,
          loading: state.loading,
          error: state.error,
        });
        this.isSystemInitialized = state.initialized;
        this.cdr.markForCheck();
      }),
    );

    // Set up interval to update selection and history state
    // TODO: Replace with proper observables when available from DfdOrchestrator
    this._subscriptions.add(
      // Poll selection state every 100ms
      new Observable(_observer => {
        const interval = setInterval(() => {
          this.updateSelectionState();
          this.updateHistoryState();
        }, 100);
        return () => clearInterval(interval);
      })
        .pipe(takeUntil(this._destroy$))
        .subscribe(),
    );

    // Set up edge event handlers for drag-and-drop edge creation
    const graph = this.dfdOrchestrator.getGraph();
    if (graph) {
      // Handle edge added events (when user drags from port to port)
      graph.on('edge:added', (data: { edge: any }) => {
        this.handleEdgeAdded(data.edge);
      });

      // Handle edge vertices changed events (when user moves edge vertices)
      graph.on('edge:change:vertices', (data: { edge: any }) => {
        this.handleEdgeVerticesChanged(data.edge);
      });

      this.logger.debug('Edge event handlers registered');
    } else {
      this.logger.warn('Graph not available for setting up edge event handlers');
    }
  }

  private handleEdgeAdded(edge: any): void {
    if (!edge || !this.dfdId) {
      this.logger.warn('Cannot handle edge added - missing edge or diagram ID');
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
    // Use DfdOrchestrator to load diagram
    this.dfdOrchestrator.loadDiagram(dfdId).subscribe({
      next: result => {
        if (result.success) {
          this.logger.info('Diagram loaded successfully via DfdOrchestrator');
        } else {
          this.logger.error('Failed to load diagram', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error loading diagram', { error });
      },
    });
  }

  // Toolbar Methods - Using DfdOrchestrator

  addGraphNode(nodeType: string): void {
    // Map string nodeType to NodeType enum
    const mappedNodeType = this.mapStringToNodeType(nodeType);
    this.onAddNode(mappedNodeType);
  }

  deleteSelected(): void {
    this.onDeleteSelected();
  }

  showHistory(): void {
    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.warn('Cannot show history: Graph not available');
      return;
    }

    // Get the X6 history information
    const history = graph.history;
    if (!history) {
      this.logger.warn('Cannot show history: History not available on graph');
      return;
    }

    // Create a simple alert dialog showing history info
    const undoStackLength = history.undoStack ? history.undoStack.length : 0;
    const redoStackLength = history.redoStack ? history.redoStack.length : 0;

    const message = `History Information:\n\nUndo Stack: ${undoStackLength} operations\nRedo Stack: ${redoStackLength} operations\n\nTotal History Length: ${undoStackLength + redoStackLength}`;

    // Use simple alert for now - can be replaced with a proper dialog later
    alert(message);

    this.logger.info('Showed X6 history information', {
      undoStackLength,
      redoStackLength,
      totalHistory: undoStackLength + redoStackLength,
    });
  }

  onAddNode(nodeType: NodeType): void {
    if (this.isReadOnlyMode) return;

    // Check if DFD system is initialized before attempting to add node
    if (!this.dfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot add node: DFD system not yet initialized');
      return;
    }

    this.dfdOrchestrator
      .addNode(nodeType) // Use DfdNodeService intelligent positioning algorithm
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
    if (!this.dfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot delete cells: DFD system not yet initialized');
      return;
    }

    this.dfdOrchestrator.deleteSelectedCells().subscribe({
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

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.warn('Cannot undo: Graph not available');
      return;
    }

    // Use X6's built-in undo functionality
    const history = graph.history;
    if (history && history.undo) {
      history.undo();
      this.logger.debug('Undo operation completed');
      this.updateHistoryState();
    } else {
      this.logger.warn('Undo not available: History plugin not found');
    }
  }

  onRedo(): void {
    if (!this.canRedo || this.isReadOnlyMode) return;

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.warn('Cannot redo: Graph not available');
      return;
    }

    // Use X6's built-in redo functionality
    const history = graph.history;
    if (history && history.redo) {
      history.redo();
      this.logger.debug('Redo operation completed');
      this.updateHistoryState();
    } else {
      this.logger.warn('Redo not available: History plugin not found');
    }
  }

  // Template compatibility methods
  undo(): void {
    this.onUndo();
  }

  redo(): void {
    this.onRedo();
  }

  onSelectAll(): void {
    this.dfdOrchestrator.selectAll();
  }

  onClearSelection(): void {
    this.dfdOrchestrator.clearSelection();
  }

  onSaveManually(): void {
    if (this.isReadOnlyMode) return;

    // Check if DFD system is initialized before attempting to save
    if (!this.dfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot save manually: DFD system not yet initialized');
      return;
    }

    this.dfdOrchestrator.saveManually().subscribe({
      next: result => {
        if (result.success) {
          this.logger.info('Manual save completed successfully');
        } else {
          this.logger.error('Manual save failed', { error: result.error });
        }
      },
      error: error => {
        this.logger.error('Error during manual save', { error });
      },
    });
  }

  onExport(format: ExportFormat): void {
    // Check if DFD system is initialized before attempting to export
    if (!this.dfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot export diagram: DFD system not yet initialized');
      return;
    }

    this.dfdOrchestrator.exportDiagram(format).subscribe({
      next: blob => {
        // Create download link
        const url = URL.createObjectURL(blob as Blob);
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

    this.logger.info('Opening threat editor dialog for new threat creation on DFD page');

    // Get selected cell information for context
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    const cellId = selectedCells.length === 1 ? selectedCells[0] : null;

    if (cellId) {
      const graph = this.dfdOrchestrator.getGraph;
      if (graph) {
        const cell = graph.getCellById(cellId);
        if (cell) {
          this.logger.info('Opening threat editor with cell context', {
            cellId,
            cellType: cell.isNode() ? 'node' : 'edge',
          });
        }
      }
    }

    // TODO: Implement threat editor dialog integration with DFD v2
    // This should open the threat editor dialog directly on the DFD page
    // and pass the threat model ID and selected cell context
    this.logger.info('Threat editor dialog integration needed for v2 architecture', {
      threatModelId: this.threatModelId,
      selectedCellId: cellId,
    });
  }

  manageThreats(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.warn('Manage threats requires exactly one selected cell');
      return;
    }

    if (!this.threatModelId) {
      this.logger.warn('Cannot manage threats: No threat model ID available');
      return;
    }

    const cellId = selectedCells[0];
    this.logger.info('Managing threats for selected cell', {
      cellId,
      threatModelId: this.threatModelId,
    });

    // Get the actual cell object from the graph to extract cell data
    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for threat management');
      return;
    }

    const cell = graph.getCellById(cellId);
    if (!cell) {
      this.logger.error('Selected cell not found in graph');
      return;
    }

    // For now, just log the cell information - the threat management dialog integration
    // will be implemented when the v2 architecture is complete
    this.logger.info('Opening threat management dialog for cell', {
      cellId,
      cellType: cell.isNode() ? 'node' : 'edge',
    });

    // TODO: Implement threat management dialog integration with DFD v2
    // This should open the existing threats management dialog and populate it with threats for this cell
    // The dialog should be filtered to show only threats associated with this specific cell
  }

  closeDiagram(): void {
    this.logger.info('Closing diagram');

    // Save any pending changes before closing
    if (this.dfdOrchestrator.getState().hasUnsavedChanges && !this.isReadOnlyMode) {
      this.dfdOrchestrator.saveManually().subscribe({
        next: () => {
          this.logger.info('Diagram saved before closing');
          this._navigateAway();
        },
        error: error => {
          this.logger.error('Failed to save diagram before closing', { error });
          // Navigate away even if save failed
          this._navigateAway();
        },
      });
    } else {
      this._navigateAway();
    }
  }

  editCellText(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.info('Edit cell text requires exactly one selected cell');
      return;
    }

    this.logger.info('Edit cell text requested', { cellId: selectedCells[0] });
    // TODO: Implement inline text editing for DFD v2
    // This would involve getting the cell from the graph and enabling text editing
    this.logger.info('Text editing integration needed for v2 architecture');
  }

  // Z-order methods
  moveForward(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move forward');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for move forward operation');
      return;
    }

    selectedCells.forEach(cellId => {
      const cell = graph.getCellById(cellId);
      if (cell) {
        cell.toFront();
        this.logger.debug('Moved cell forward', { cellId });
      }
    });
  }

  moveBackward(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move backward');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for move backward operation');
      return;
    }

    selectedCells.forEach(cellId => {
      const cell = graph.getCellById(cellId);
      if (cell) {
        cell.toBack();
        this.logger.debug('Moved cell backward', { cellId });
      }
    });
  }

  moveToFront(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to front');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for move to front operation');
      return;
    }

    selectedCells.forEach(cellId => {
      const cell = graph.getCellById(cellId);
      if (cell) {
        cell.toFront();
        this.logger.debug('Moved cell to front', { cellId });
      }
    });
  }

  moveToBack(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to back');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for move to back operation');
      return;
    }

    selectedCells.forEach(cellId => {
      const cell = graph.getCellById(cellId);
      if (cell) {
        cell.toBack();
        this.logger.debug('Moved cell to back', { cellId });
      }
    });
  }

  // Edge methods
  addInverseConnection(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.info('Add inverse connection requires exactly one selected edge');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph();
    if (!graph) {
      this.logger.error('Graph not available for add inverse connection');
      return;
    }

    const cell = graph.getCellById(selectedCells[0]);
    if (!cell || !cell.isEdge()) {
      this.logger.info('Selected cell is not an edge');
      return;
    }

    const edge = cell;
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

  isRightClickedCellEdge(): boolean {
    // For now, we don't have a context menu system in v2, so return false
    // TODO: Implement context menu tracking for v2 architecture
    return false;
  }

  showCellProperties(): void {
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    if (selectedCells.length !== 1) {
      this.logger.info('Show cell properties requires exactly one selected cell');
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.logger.error('Graph not available for show cell properties');
      return;
    }

    const cell = graph.getCellById(selectedCells[0]);
    if (!cell) {
      this.logger.error('Selected cell not found in graph');
      return;
    }

    // Log cell properties for debugging
    this.logger.info('Cell properties', {
      id: cell.id,
      shape: cell.shape,
      position: cell.getPosition?.() || 'N/A',
      size: cell.getSize?.() || 'N/A',
      attrs: cell.getAttrs(),
      data: cell.getData(),
    });

    // TODO: Implement cell properties dialog for v2 architecture
    this.logger.info('Cell properties dialog integration needed for v2 architecture');
  }

  // Context Menu Methods

  onContextMenu(event: MouseEvent): void {
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
    if (!this.dfdOrchestrator.getState().initialized) {
      this.logger.warn('Cannot edit metadata: DFD system not yet initialized');
      return;
    }

    const selectedCellIds = this.dfdOrchestrator.getSelectedCells();
    if (selectedCellIds.length === 0) return;

    // Get the actual cell object from the graph
    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) return;

    const cell = graph.getCellById(selectedCellIds[0]);
    if (!cell) return;

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '600px',
      data: {
        threatModelId: this.threatModelId,
        cellId: cell.id,
        currentMetadata: cell.getData()?.metadata || {},
        metadata: [], // Required by MetadataDialogData interface
      } as MetadataDialogData,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Update cell metadata through orchestrator
        this.dfdOrchestrator
          .executeOperation({
            id: `update-metadata-${Date.now()}`,
            type: 'update-node',
            source: 'user-interaction' as const,
            priority: 'high' as const,
            timestamp: Date.now(),
            nodeId: cell.id,
            updates: {
              properties: { metadata: result },
            },
          } as any)
          .subscribe({
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
    // Delegate to orchestrator for centralized keyboard handling
    this.dfdOrchestrator.onKeyDown(event);
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(_event: Event): void {
    // Delegate to orchestrator for centralized resize handling
    this.dfdOrchestrator.onWindowResize();
  }

  // Helper Methods

  private updateSelectionState(): void {
    if (!this.dfdOrchestrator.getState().initialized) {
      return;
    }

    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    const oldHasSelectedCells = this.hasSelectedCells;
    const oldHasExactlyOneSelectedCell = this.hasExactlyOneSelectedCell;
    const oldSelectedCellIsTextBox = this.selectedCellIsTextBox;
    const oldSelectedCellIsSecurityBoundary = this.selectedCellIsSecurityBoundary;

    this.hasSelectedCells = selectedCells.length > 0;
    this.hasExactlyOneSelectedCell = selectedCells.length === 1;

    if (this.hasExactlyOneSelectedCell) {
      const graph = this.dfdOrchestrator.getGraph;
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
      this.cdr.markForCheck();
    }
  }

  private updateHistoryState(): void {
    if (!this.dfdOrchestrator.getState().initialized) {
      this.canUndo = false;
      this.canRedo = false;
      return;
    }

    const graph = this.dfdOrchestrator.getGraph;
    if (!graph) {
      this.canUndo = false;
      this.canRedo = false;
      return;
    }

    const history = graph.history;
    const oldCanUndo = this.canUndo;
    const oldCanRedo = this.canRedo;

    if (history) {
      this.canUndo = history.canUndo ? history.canUndo() : false;
      this.canRedo = history.canRedo ? history.canRedo() : false;
    } else {
      this.canUndo = false;
      this.canRedo = false;
    }

    // Only trigger change detection if state actually changed
    if (oldCanUndo !== this.canUndo || oldCanRedo !== this.canRedo) {
      this.cdr.markForCheck();
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
      this.router.navigate(['/tm', this.threatModelId]).catch(error => {
        this.logger.error('Failed to navigate back to threat model', { error });
        // Fallback: navigate to TM list
        this.router.navigate(['/tm']).catch(fallbackError => {
          this.logger.error('Failed to navigate to TM list as fallback', { fallbackError });
        });
      });
    } else {
      this.logger.warn('Cannot navigate: No threat model ID available, navigating to TM list');
      this.router.navigate(['/tm']).catch(error => {
        this.logger.error('Failed to navigate to TM list', { error });
      });
    }
  }
}
