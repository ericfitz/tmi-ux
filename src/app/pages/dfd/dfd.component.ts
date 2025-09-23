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
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LoggerService } from '../../core/services/logger.service';
import { initializeX6CellExtensions } from './utils/x6-cell-extensions';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

// DFD v2 Architecture
import { DfdOrchestrator } from './v2/services/dfd-orchestrator.service';
import { AutoSaveManager } from './v2/services/auto-save-manager.service';
import { PersistenceCoordinator } from './v2/services/persistence-coordinator.service';
import { GraphOperationManager } from './v2/services/graph-operation-manager.service';

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
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../tm/components/threats-dialog/threats-dialog.component';
import { CellDataExtractionService } from '../../shared/services/cell-data-extraction.service';
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
    // DFD v2 Architecture - Core Services
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

  // Diagram data
  diagramName: string | null = null;
  threatModelName: string | null = null;
  threatModelPermission: 'reader' | 'writer' | null = null;

  // State properties - exposed as public properties for template binding
  hasSelectedCells = false;
  hasExactlyOneSelectedCell = false;
  selectedCellIsTextBox = false;
  selectedCellIsSecurityBoundary = false;

  // Undo/redo state properties
  canUndo = false;
  canRedo = false;

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private dfdOrchestrator: DfdOrchestrator,
    private autoSaveManager: AutoSaveManager,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private translocoService: TranslocoService,
    private collaborationService: DfdCollaborationService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
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

    this.logger.info('DFD Component v2 route parameters extracted', {
      threatModelId: this.threatModelId,
      dfdId: this.dfdId,
    });

    // Set collaboration context if we have the required parameters
    if (this.threatModelId && this.dfdId) {
      this.collaborationService.setDiagramContext(this.threatModelId, this.dfdId);
    }

    // Get threat model from route resolver
    const threatModel = this.route.snapshot.data['threatModel'];
    if (threatModel) {
      this.threatModelName = threatModel.name;
      
      // Subscribe to authorization updates
      this._subscriptions.add(
        this.authorizationService.currentUserPermission$.subscribe(permission => {
          this.threatModelPermission = permission === 'owner' ? 'writer' : permission;
          this.isReadOnlyMode = permission === 'reader' || permission === null;
          
          // Reconfigure auto-save when permissions change
          this.configureAutoSave();
          
          this.cdr.markForCheck();
        }),
      );
    }

    // Configure auto-save policies based on user permission
    this.configureAutoSave();
  }

  ngAfterViewInit(): void {
    this.logger.info('DfdComponent v2 ngAfterViewInit called');

    // Initialize the DFD Orchestrator with the graph container
    this.dfdOrchestrator.initialize(this.graphContainer.nativeElement);

    // Load diagram data if we have a dfdId
    if (this.dfdId) {
      this.loadDiagramData(this.dfdId);
    }

    // Subscribe to DFD Orchestrator events
    this.setupOrchestratorSubscriptions();
  }

  ngOnDestroy(): void {
    this.logger.info('DfdComponent v2 ngOnDestroy called');
    
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
    
    // Dispose orchestrator
    this.dfdOrchestrator.dispose();
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
    });
  }

  private setupOrchestratorSubscriptions(): void {
    // Subscribe to orchestrator state changes
    this._subscriptions.add(
      this.dfdOrchestrator.selectedCells$.pipe(takeUntil(this._destroy$)).subscribe(cells => {
        this.hasSelectedCells = cells.length > 0;
        this.hasExactlyOneSelectedCell = cells.length === 1;
        this.selectedCellIsTextBox = cells.some(cell => cell.shape === 'text-box');
        this.selectedCellIsSecurityBoundary = cells.some(cell => cell.shape === 'security-boundary');
        this.cdr.markForCheck();
      }),
    );

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

    // Subscribe to undo/redo state changes
    this._subscriptions.add(
      this.dfdOrchestrator.historyChanged$.pipe(takeUntil(this._destroy$)).subscribe(({ canUndo, canRedo }) => {
        this.canUndo = canUndo;
        this.canRedo = canRedo;
        this.cdr.markForCheck();
      }),
    );
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
    // Placeholder for history dialog
    this.logger.info('Show history requested - feature to be implemented');
  }
  
  onAddNode(nodeType: NodeType): void {
    if (this.isReadOnlyMode) return;
    
    this.dfdOrchestrator.addNode({
      nodeType,
      position: { x: 100, y: 100 }, // Default position, user can drag
      label: this.getDefaultNodeLabel(nodeType),
    }).subscribe({
      next: result => {
        if (result.success) {
          this.logger.debug('Node added successfully', { nodeType });
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
    this.dfdOrchestrator.undo();
  }

  onRedo(): void {
    if (!this.canRedo || this.isReadOnlyMode) return;
    this.dfdOrchestrator.redo();
  }

  onSelectAll(): void {
    this.dfdOrchestrator.selectAll();
  }

  onClearSelection(): void {
    this.dfdOrchestrator.clearSelection();
  }

  onSaveManually(): void {
    if (this.isReadOnlyMode) return;
    
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
    this.dfdOrchestrator.exportDiagram(format).subscribe({
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
    
    const selectedCells = this.dfdOrchestrator.getSelectedCells();
    const cell = selectedCells[0];
    
    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '600px',
      data: {
        threatModelId: this.threatModelId,
        cellId: cell.id,
        currentMetadata: cell.getData()?.metadata || {},
      } as MetadataDialogData,
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Update cell metadata through orchestrator
        this.dfdOrchestrator.executeOperation({
          id: `update-metadata-${Date.now()}`,
          type: 'update-node',
          source: 'user',
          priority: 100,
          nodeId: cell.id,
          updates: {
            properties: { metadata: result },
          },
        }).subscribe({
          next: operationResult => {
            if (operationResult.success) {
              this.logger.debug('Cell metadata updated successfully');
            } else {
              this.logger.error('Failed to update cell metadata', { error: operationResult.error });
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
  onWindowResize(event: Event): void {
    // Delegate to orchestrator for centralized resize handling
    this.dfdOrchestrator.onWindowResize(event);
  }

  // Helper Methods

  private mapStringToNodeType(nodeType: string): NodeType {
    switch (nodeType) {
      case 'actor':
        return 'external-entity';
      case 'process':
        return 'process';
      case 'store':
        return 'datastore';
      case 'security-boundary':
        return 'trust-boundary';
      case 'text-box':
        return 'process'; // Default to process for text boxes
      default:
        return 'process';
    }
  }

  private getDefaultNodeLabel(nodeType: NodeType): string {
    switch (nodeType) {
      case 'process':
        return 'New Process';
      case 'datastore':
        return 'New Data Store';
      case 'external-entity':
        return 'New External Entity';
      case 'trust-boundary':
        return 'Trust Boundary';
      default:
        return 'New Node';
    }
  }
}