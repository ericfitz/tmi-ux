import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';
import { take } from 'rxjs';

import { LoggerService } from '../../../../core/services/logger.service';
import { MaterialModule } from '../../../../shared/material/material.module';
import { Threat } from '../../models/threat-model.model';
import { ThreatEditorDialogComponent, ThreatEditorDialogData } from '../threat-editor-dialog/threat-editor-dialog.component';
import { ThreatModelService } from '../../services/threat-model.service';
import { FrameworkService } from '../../../../shared/services/framework.service';

interface ThreatUpdateResult {
  name: string;
  description: string;
  severity: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  threat_type: string;
  score?: number;
  priority?: string;
  mitigated?: boolean;
  status?: string;
  issue_url?: string;
  metadata?: Array<{ key: string; value: string }>;
}

export interface ThreatsDialogData {
  threats: Threat[];
  isReadOnly?: boolean;
  objectType?: string;
  objectName?: string;
  threatModelId?: string;
  diagramId?: string;
}

@Component({
  selector: 'app-threats-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslocoModule],
  templateUrl: './threats-dialog.component.html',
  styleUrls: ['./threats-dialog.component.scss'],
})
export class ThreatsDialogComponent implements OnInit {
  dataSource = new MatTableDataSource<Threat>([]);
  displayedColumns: string[] = ['severity', 'description', 'actions'];

  @ViewChild('threatsTable') threatsTable!: MatTable<Threat>;
  @ViewChild('threatsSort') threatsSort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<ThreatsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ThreatsDialogData,
    private logger: LoggerService,
    private dialog: MatDialog,
    private threatModelService: ThreatModelService,
    private frameworkService: FrameworkService,
  ) {}

  ngOnInit(): void {
    this.dataSource.data = [...this.data.threats];
    if (this.data.isReadOnly) {
      this.displayedColumns = ['severity', 'description'];
    }
  }

  /**
   * Gets the severity color class for display
   * @param severity The threat severity
   * @returns CSS class name for the severity
   */
  getSeverityClass(severity: string): string {
    switch (severity.toLowerCase()) {
      case 'critical':
        return 'severity-critical';
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return 'severity-unknown';
    }
  }

  /**
   * Opens threat for editing in the threat editor dialog
   * @param threat The threat to edit
   */
  editThreat(threat: Threat): void {
    if (!this.data.threatModelId) {
      this.logger.warn('Cannot edit threat: No threat model ID available');
      return;
    }

    this.logger.info('Opening threat editor for editing', { threatId: threat.id });

    // Load the threat model to get the framework information
    this.threatModelService.getThreatModelById(this.data.threatModelId).pipe(take(1)).subscribe({
      next: threatModel => {
        if (!threatModel) {
          this.logger.error('Threat model not found for edit', { id: this.data.threatModelId });
          return;
        }

        const currentFrameworkName = threatModel.threat_model_framework;

        // Load frameworks to find the matching one
        this.frameworkService.loadAllFrameworks().pipe(take(1)).subscribe({
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
          }
        });
      },
      error: error => {
        this.logger.error('Failed to load threat model for edit', error);
      }
    });
  }

  /**
   * Opens the threat editor dialog with the provided data
   */
  private openThreatEditorDialog(threat: Threat, framework?: Record<string, unknown>): void {
    const dialogData: ThreatEditorDialogData = {
      threat: threat,
      threatModelId: this.data.threatModelId!,
      mode: 'edit',
      diagramId: this.data.diagramId,
      cellId: threat.cell_id,
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
        
        // Update the threat with new data
        const updatedThreat: Threat = {
          ...threat,
          name: result.name,
          description: result.description,
          severity: result.severity,
          threat_type: result.threat_type,
          score: result.score,
          priority: result.priority,
          mitigated: result.mitigated,
          status: result.status,
          issue_url: result.issue_url,
          modified_at: new Date().toISOString(),
          metadata: result.metadata || threat.metadata || [],
        };

        // Update the threat in the threat model
        this.threatModelService.getThreatModelById(this.data.threatModelId!).pipe(take(1)).subscribe({
          next: threatModel => {
            if (!threatModel) {
              this.logger.error('Threat model not found for update', { id: this.data.threatModelId });
              return;
            }

            // Find and update the threat in the model
            const threatIndex = threatModel.threats?.findIndex(t => t.id === threat.id) ?? -1;
            if (threatIndex !== -1 && threatModel.threats) {
              threatModel.threats[threatIndex] = updatedThreat;
              
              // Save the updated threat model
              this.threatModelService.updateThreatModel(threatModel).pipe(take(1)).subscribe({
                next: () => {
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
                }
              });
            }
          },
          error: error => {
            this.logger.error('Failed to load threat model for update', error);
          }
        });
      }
    });
  }

  /**
   * Deletes a threat from the list
   * @param index The index of the threat to delete
   */
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
  addThreat(): void {
    // Close this dialog and signal that we want to open the threat editor
    this.dialogRef.close({ action: 'openThreatEditor' });
  }

  /**
   * Closes the dialog without saving (cancel)
   */
  close(): void {
    this.dialogRef.close();
  }
}