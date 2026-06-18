import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { LoggerService } from '../../../../core/services/logger.service';
import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { Threat } from '../../models/threat-model.model';
import type { components } from '@app/generated/api-types';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
  DiagramOption,
  CellOption,
} from '../threat-editor-dialog/threat-editor-dialog.component';
import { ThreatModelService } from '../../services/threat-model.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { FrameworkModel } from '../../../../shared/models/framework.model';
import { getFieldLabel } from '../../../../shared/utils/field-value-helpers';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: alias the generated API ThreatInput schema type for local use (pure)
type ApiThreatInput = components['schemas']['ThreatInput'];

interface ThreatUpdateResult {
  name: string;
  description: string;
  severity: string | null;
  threat_type: string[];
  diagram_id?: string;
  cell_id?: string;
  score?: number;
  priority?: string | null;
  mitigated?: boolean;
  status?: string | null;
  issue_uri?: string;
  metadata?: Array<{ key: string; value: string }>;
}

export interface ThreatsDialogData {
  threats: Threat[];
  isReadOnly?: boolean;
  objectType?: string;
  objectName?: string;
  threatModelId?: string;
  diagramId?: string;
  diagramName?: string;
  diagrams?: DiagramOption[];
  cells?: CellOption[];
}

@Component({
  selector: 'app-threats-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './threats-dialog.component.html',
  styleUrls: ['./threats-dialog.component.scss'],
})
// SEM@0c2bd0b0fb53372a6287ea6eadbe0b56824bab8f: dialog component listing, editing, adding, and deleting threats for a threat model
export class ThreatsDialogComponent implements OnInit {
  dataSource = new MatTableDataSource<Threat>([]);
  displayedColumns: string[] = ['severity', 'description', 'actions'];

  @ViewChild('threatsTable') threatsTable!: MatTable<Threat>;
  @ViewChild('threatsSort') threatsSort!: MatSort;

  // SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: inject dialog, logger, threat model, framework, and translation dependencies (pure)
  constructor(
    public dialogRef: MatDialogRef<ThreatsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ThreatsDialogData,
    private logger: LoggerService,
    private dialog: MatDialog,
    private threatModelService: ThreatModelService,
    private frameworkService: FrameworkService,
    private translocoService: TranslocoService,
  ) {}

  // SEM@c0b3625d48d32e00b3fb423f9bff36b5fa8f93e1: initialize threat table data source and configure columns based on read-only mode (mutates shared state)
  ngOnInit(): void {
    this.dataSource.data = [...this.data.threats];
    if (this.data.isReadOnly) {
      this.displayedColumns = ['severity', 'description'];
    }
  }

  /**
   * Gets the severity label for display
   * @param severity The threat severity camelCase key
   * @returns Localized severity label
   */
  // SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: convert a threat severity key to its localized display label (pure)
  getSeverityLabel(severity: string | null): string {
    if (!severity) {
      return this.translocoService.translate('common.none');
    }
    return getFieldLabel(severity, 'threatEditor.threatSeverity', this.translocoService);
  }

  /**
   * Gets the severity color class for display
   * @param severity The threat severity camelCase key
   * @returns CSS class name for the severity
   */
  // SEM@d47739de2acf5e281b60be208f2dfa034ea03423: map a threat severity value to its CSS class name (pure)
  getSeverityClass(severity: string | null): string {
    return 'severity-' + (severity ?? 'unknown');
  }

  /**
   * Handles row click to open threat for editing
   * @param threat The threat to edit
   */
  // SEM@0f5b46881ccb144e2325cc70ec1c369253dc4aff: handle table row click to open threat editor, guarded by read-only mode
  onThreatRowClick(threat: Threat): void {
    if (this.data.isReadOnly) {
      return; // Don't allow editing in read-only mode
    }
    this.editThreat(threat);
  }

  /**
   * Opens threat for editing in the threat editor dialog
   * @param threat The threat to edit
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: fetch threat model and framework then open threat editor dialog for editing (reads DB)
  editThreat(threat: Threat): void {
    if (!this.data.threatModelId) {
      this.logger.warn('Cannot edit threat: No threat model ID available');
      return;
    }

    this.logger.info('Opening threat editor for editing', { threatId: threat.id });

    // Load the threat model to get the framework information
    this.threatModelService
      .getThreatModelById(this.data.threatModelId)
      .pipe(take(1))
      .subscribe({
        next: threatModel => {
          if (!threatModel) {
            this.logger.error('Threat model not found for edit', { id: this.data.threatModelId });
            return;
          }

          const currentFrameworkName = threatModel.threat_model_framework;

          // Load frameworks to find the matching one
          this.frameworkService
            .loadAllFrameworks()
            .pipe(take(1))
            .subscribe({
              next: frameworks => {
                const framework = frameworks.find(f => f.name === currentFrameworkName);

                if (!framework) {
                  this.logger.warn('Framework not found for threat model', {
                    threatModelFramework: currentFrameworkName,
                    availableFrameworks: frameworks.map(f => f.name),
                  });
                } else {
                  this.logger.info('Using framework for threat editor', {
                    framework: framework.name,
                    frameworkThreatTypes: framework.threatTypes.map(tt => tt.name),
                  });
                }

                // Open the threat editor with framework information
                this.openThreatEditorDialog(threat, framework);
              },
              error: error => {
                this.logger.error('Failed to load frameworks for threat edit', error);
                // Fallback: open without framework
                this.openThreatEditorDialog(threat);
              },
            });
        },
        error: error => {
          this.logger.error('Failed to load threat model for edit', error);
        },
      });
  }

  /**
   * Opens the threat editor dialog with the provided data
   */
  // SEM@0c2bd0b0fb53372a6287ea6eadbe0b56824bab8f: open threat editor dialog and persist accepted changes via API (reads DB)
  private openThreatEditorDialog(threat: Threat, framework?: FrameworkModel): void {
    const dialogData: ThreatEditorDialogData = {
      threat: threat,
      threatModelId: this.data.threatModelId!,
      mode: 'edit',
      diagramId: this.data.diagramId,
      cellId: threat.cell_id,
      diagrams: this.data.diagrams || [],
      cells: this.data.cells || [],
      framework: framework,
    };

    const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
      width: '650px',
      maxHeight: '90vh',
      panelClass: 'threat-editor-dialog-650',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result: ThreatUpdateResult | null) => {
      if (result) {
        this.logger.info('Threat editor closed with changes, updating threat');

        // Update the threat with new data — pass through empty values
        // so the server can clear fields the user emptied
        const updatedThreatData: Partial<ApiThreatInput> = {
          name: result.name,
          description: result.description,
          severity: result.severity ?? '',
          threat_type: result.threat_type,
          diagram_id: result.diagram_id,
          cell_id: result.cell_id,
          score: result.score,
          priority: result.priority ?? '',
          mitigated: result.mitigated,
          status: result.status ?? '',
          issue_uri: result.issue_uri,
          metadata: result.metadata || threat.metadata || [],
        };

        // Update the threat via the API
        this.threatModelService
          .updateThreat(this.data.threatModelId!, threat.id, updatedThreatData)
          .pipe(take(1))
          .subscribe({
            next: updatedThreat => {
              this.logger.info('Threat updated successfully', { threatId: threat.id });

              // Update the local data source
              const localIndex = this.dataSource.data.findIndex(t => t.id === threat.id);
              if (localIndex !== -1) {
                this.dataSource.data[localIndex] = updatedThreat;
                this.dataSource.data = [...this.dataSource.data]; // Trigger change detection
              }
            },
            error: error => {
              this.logger.error('Failed to update threat', error);
            },
          });
      }
    });
  }

  /**
   * Deletes a threat from the list
   * @param index The index of the threat to delete
   */
  // SEM@c0b3625d48d32e00b3fb423f9bff36b5fa8f93e1: remove a threat from the local table data source by index (mutates shared state)
  deleteThreat(index: number): void {
    if (index >= 0 && index < this.dataSource.data.length) {
      const newData = [...this.dataSource.data];
      newData.splice(index, 1);
      this.dataSource.data = newData;
    }
  }

  /**
   * Opens the threat editor to add a new threat
   */
  // SEM@c0b3625d48d32e00b3fb423f9bff36b5fa8f93e1: close dialog signaling the caller to open the threat editor for a new threat
  addThreat(): void {
    // Close this dialog and signal that we want to open the threat editor
    this.dialogRef.close({ action: 'openThreatEditor' });
  }

  /**
   * Closes the dialog without saving (cancel)
   */
  // SEM@c0b3625d48d32e00b3fb423f9bff36b5fa8f93e1: close the threats dialog without saving changes
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Gets the tabindex for the add button
   * @returns The tabindex value after all delete buttons
   */
  // SEM@135fa8eb21fe2891960ebea73eb878df8790d442: compute tab index for the add button after all threat row actions (pure)
  getAddButtonTabIndex(): number {
    return this.dataSource.data.length + 1;
  }

  /**
   * Gets the tabindex for the close button
   * @returns The tabindex value after the add button
   */
  // SEM@135fa8eb21fe2891960ebea73eb878df8790d442: compute tab index for the close button after all threat rows (pure)
  getCloseButtonTabIndex(): number {
    return this.dataSource.data.length + 2;
  }
}
