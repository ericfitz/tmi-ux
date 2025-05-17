import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { MaterialModule } from '../../../shared/material/material.module';
import { SharedModule } from '../../../shared/shared.module';
import { CreateDiagramDialogComponent } from '../components/create-diagram-dialog/create-diagram-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../components/threat-editor-dialog/threat-editor-dialog.component';
import { Diagram, DIAGRAMS_BY_ID } from '../models/diagram.model';
import { Threat, ThreatModel } from '../models/threat-model.model';
import { ThreatModelService } from '../services/threat-model.service';

// Define form value interface
interface ThreatModelFormValues {
  name: string;
  description: string;
}

@Component({
  selector: 'app-tm-edit',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    MaterialModule,
    MatListModule,
    TranslocoModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './tm-edit.component.html',
  styleUrls: ['./tm-edit.component.scss'],
})
export class TmEditComponent implements OnInit, OnDestroy {
  threatModel: ThreatModel | undefined;
  threatModelForm: FormGroup;
  isNewThreatModel = false;
  diagrams: Diagram[] = [];
  private _subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private fb: FormBuilder,
    private dialog: MatDialog,
  ) {
    this.threatModelForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/tm']);
      return;
    }

    this._subscriptions.add(
      this.threatModelService.getThreatModelById(id).subscribe(threatModel => {
        if (threatModel) {
          this.threatModel = threatModel;
          this.threatModelForm.patchValue({
            name: threatModel.name,
            description: threatModel.description || '',
          });

          // Populate diagrams array with diagram objects
          this.diagrams =
            threatModel.diagrams?.map(diagramId => {
              // Look up the diagram by ID
              const diagram = DIAGRAMS_BY_ID.get(diagramId);
              if (diagram) {
                return diagram;
              }
              // If diagram not found, create a placeholder with the ID as name
              return {
                id: diagramId,
                name: `Diagram ${diagramId.substring(0, 8)}...`,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
              };
            }) || [];
        } else {
          // Handle case where threat model is not found
          this.isNewThreatModel = true;
          this.threatModel = {
            id,
            name: 'New Threat Model',
            description: '',
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            owner: 'user@example.com',
            authorization: [
              {
                subject: 'user@example.com',
                role: 'owner',
              },
            ],
            metadata: [],
            diagrams: [],
            threats: [],
          };
          this.threatModelForm.patchValue({
            name: this.threatModel.name,
            description: this.threatModel.description || '',
          });
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  saveThreatModel(): void {
    if (this.threatModelForm.invalid || !this.threatModel) {
      return;
    }

    // Get form values with proper typing
    const formValues = this.threatModelForm.getRawValue() as ThreatModelFormValues;

    const updatedThreatModel: ThreatModel = {
      ...this.threatModel,
      name: formValues.name,
      description: formValues.description,
      modified_at: new Date().toISOString(),
    };

    this._subscriptions.add(
      this.threatModelService.updateThreatModel(updatedThreatModel).subscribe(result => {
        this.threatModel = result;
        // Show success message or navigate back
      }),
    );
  }

  /**
   * Opens a dialog to create a new threat
   * If the user confirms, adds the threat to the threat model
   */
  addThreat(): void {
    this.openThreatEditor();
  }

  /**
   * Opens a dialog to create, edit, or view a threat
   * If the user confirms, adds or updates the threat in the threat model
   * @param threat Optional threat to edit or view
   * @param mode Dialog mode: 'create', 'edit', or 'view'
   */
  openThreatEditor(threat?: Threat): void {
    // Determine the mode based on whether a threat is provided
    const mode: 'create' | 'edit' | 'view' = threat ? 'edit' : 'create';
    if (!this.threatModel) {
      return;
    }

    const dialogData: ThreatEditorDialogData = {
      threat,
      threatModelId: this.threatModel.id,
      mode,
    };

    const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe(result => {
        if (result && this.threatModel) {
          const now = new Date().toISOString();

          // Type the result to avoid unsafe assignments
          interface ThreatFormResult {
            name: string;
            description: string;
          }
          const formResult = result as ThreatFormResult;

          if (mode === 'create') {
            // Create a new threat
            const newThreat: Threat = {
              id: uuidv4(),
              threat_model_id: this.threatModel.id,
              name: formResult.name,
              description: formResult.description,
              created_at: now,
              modified_at: now,
              metadata: [],
            };

            // Add the threat to the threat model
            if (!this.threatModel.threats) {
              this.threatModel.threats = [];
            }
            this.threatModel.threats.push(newThreat);
          } else if (mode === 'edit' && threat) {
            // Update an existing threat
            const index = this.threatModel.threats?.findIndex(t => t.id === threat.id) ?? -1;
            if (index !== -1 && this.threatModel.threats) {
              this.threatModel.threats[index] = {
                ...threat,
                name: formResult.name,
                description: formResult.description,
                modified_at: now,
              };
            }
          }

          // Update the threat model
          this._subscriptions.add(
            this.threatModelService.updateThreatModel(this.threatModel).subscribe(updatedModel => {
              if (updatedModel) {
                this.threatModel = updatedModel;
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens a dialog to create a new diagram
   * If the user confirms, adds the new diagram to the threat model
   */
  addDiagram(): void {
    const dialogRef = this.dialog.open(CreateDiagramDialogComponent, {
      width: '400px',
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((diagramName: string | undefined) => {
        if (diagramName && this.threatModel) {
          // Create a new diagram with UUID and name
          const now = new Date().toISOString();
          const newDiagram: Diagram = {
            id: uuidv4(),
            name: diagramName,
            created_at: now,
            modified_at: now,
          };

          // Add the diagram to the DIAGRAMS_BY_ID map
          DIAGRAMS_BY_ID.set(newDiagram.id, newDiagram);

          // Add the diagram ID to the threat model
          if (!this.threatModel.diagrams) {
            this.threatModel.diagrams = [];
          }
          this.threatModel.diagrams.push(newDiagram.id);

          // Update the threat model
          this._subscriptions.add(
            this.threatModelService.updateThreatModel(this.threatModel).subscribe(result => {
              if (result) {
                this.threatModel = result;

                // Add the new diagram to the diagrams array for display
                this.diagrams.push(newDiagram);
              }
            }),
          );
        }
      }),
    );
  }

  cancel(): void {
    void this.router.navigate(['/tm']);
  }
}
