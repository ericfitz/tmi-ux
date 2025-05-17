import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { LanguageService } from '../../../i18n/language.service';
import { LoggerService } from '../../../core/services/logger.service';

import { MaterialModule } from '../../../shared/material/material.module';
import { SharedModule } from '../../../shared/shared.module';
import { CreateDiagramDialogComponent } from '../components/create-diagram-dialog/create-diagram-dialog.component';
import { RenameDiagramDialogComponent } from '../components/rename-diagram-dialog/rename-diagram-dialog.component';
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
    MatGridListModule,
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
  currentLocale: string = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';
  private _subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private languageService: LanguageService,
    private logger: LoggerService,
  ) {
    this.threatModelForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
    });
  }

  /**
   * Copy text to clipboard
   * @param text Text to copy
   */
  copyToClipboard(text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Could add a snackbar notification here if desired
        this.logger.info('Text copied to clipboard');
      })
      .catch(err => {
        this.logger.error('Could not copy text: ', err);
      });
  }

  ngOnInit(): void {
    // Subscribe to language changes
    this._subscriptions.add(
      this.languageService.currentLanguage$.subscribe(language => {
        this.currentLocale = language.code;
        this.currentDirection = language.rtl ? 'rtl' : 'ltr';
      }),
    );

    // Also subscribe to direction changes
    this._subscriptions.add(
      this.languageService.direction$.subscribe(direction => {
        this.currentDirection = direction;
      }),
    );
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
   * Deletes a threat from the threat model
   * @param threat The threat to delete
   * @param event The click event
   */
  deleteThreat(threat: Threat, event: Event): void {
    // Prevent event propagation to avoid opening the threat editor
    event.stopPropagation();

    if (!this.threatModel || !this.threatModel.threats) {
      return;
    }

    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the threat "${threat.name}"? This action cannot be undone.`,
    );

    if (confirmDelete) {
      // Remove the threat from the threat model
      const index = this.threatModel.threats.findIndex(t => t.id === threat.id);
      if (index !== -1) {
        this.threatModel.threats.splice(index, 1);

        // Update the threat model
        this._subscriptions.add(
          this.threatModelService.updateThreatModel(this.threatModel).subscribe(result => {
            if (result) {
              this.threatModel = result;
            }
          }),
        );
      }
    }
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

  /**
   * Opens a dialog to rename a diagram
   * If the user confirms, updates the diagram name
   * @param diagram The diagram to rename
   * @param event The click event
   */
  renameDiagram(diagram: Diagram, event: Event): void {
    // Prevent event propagation to avoid navigating to the diagram
    event.stopPropagation();

    if (!this.threatModel) {
      return;
    }

    const dialogRef = this.dialog.open(RenameDiagramDialogComponent, {
      width: '400px',
      data: {
        id: diagram.id,
        name: diagram.name,
      },
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((newName: string | undefined) => {
        if (newName && this.threatModel) {
          // Update the diagram name
          const diagramToUpdate = DIAGRAMS_BY_ID.get(diagram.id);
          if (diagramToUpdate) {
            diagramToUpdate.name = newName;
            diagramToUpdate.modified_at = new Date().toISOString();

            // Update the diagram in the map
            DIAGRAMS_BY_ID.set(diagram.id, diagramToUpdate);

            // Update the diagram in the local array
            const index = this.diagrams.findIndex(d => d.id === diagram.id);
            if (index !== -1) {
              this.diagrams[index] = diagramToUpdate;
            }

            // Update the threat model
            this._subscriptions.add(
              this.threatModelService.updateThreatModel(this.threatModel).subscribe(result => {
                if (result) {
                  this.threatModel = result;
                }
              }),
            );
          }
        }
      }),
    );
  }

  /**
   * Deletes a diagram from the threat model
   * @param diagram The diagram to delete
   * @param event The click event
   */
  deleteDiagram(diagram: Diagram, event: Event): void {
    // Prevent event propagation to avoid navigating to the diagram
    event.stopPropagation();

    if (!this.threatModel || !this.threatModel.diagrams) {
      return;
    }

    // Confirm deletion
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the diagram "${diagram.name}"? This action cannot be undone.`,
    );

    if (confirmDelete) {
      // Remove the diagram ID from the threat model
      const index = this.threatModel.diagrams.indexOf(diagram.id);
      if (index !== -1) {
        this.threatModel.diagrams.splice(index, 1);

        // Remove the diagram from the local array
        const diagramIndex = this.diagrams.findIndex(d => d.id === diagram.id);
        if (diagramIndex !== -1) {
          this.diagrams.splice(diagramIndex, 1);
        }

        // Update the threat model
        this._subscriptions.add(
          this.threatModelService.updateThreatModel(this.threatModel).subscribe(result => {
            if (result) {
              this.threatModel = result;
            }
          }),
        );
      }
    }
  }

  cancel(): void {
    void this.router.navigate(['/tm']);
  }

  /**
   * Adds a new metadata item to the threat model
   */
  addMetadataItem(): void {
    if (!this.threatModel) {
      return;
    }

    // Initialize metadata array if it doesn't exist
    if (!this.threatModel.metadata) {
      this.threatModel.metadata = [];
    }

    // Add a new empty metadata item
    this.threatModel.metadata.push({
      key: '',
      value: '',
    });
  }

  /**
   * Updates the key of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new key value
   */
  updateMetadataKey(index: number, event: Event): void {
    if (!this.threatModel || !this.threatModel.metadata) {
      return;
    }

    const input = event.target as HTMLInputElement;
    if (index >= 0 && index < this.threatModel.metadata.length) {
      this.threatModel.metadata[index].key = input.value;
      this.threatModel.modified_at = new Date().toISOString();
    }
  }

  /**
   * Updates the value of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new value
   */
  updateMetadataValue(index: number, event: Event): void {
    if (!this.threatModel || !this.threatModel.metadata) {
      return;
    }

    const input = event.target as HTMLInputElement;
    if (index >= 0 && index < this.threatModel.metadata.length) {
      this.threatModel.metadata[index].value = input.value;
      this.threatModel.modified_at = new Date().toISOString();
    }
  }

  /**
   * Deletes a metadata item from the threat model
   * @param index The index of the metadata item to delete
   */
  deleteMetadataItem(index: number): void {
    if (!this.threatModel || !this.threatModel.metadata) {
      return;
    }

    if (index >= 0 && index < this.threatModel.metadata.length) {
      this.threatModel.metadata.splice(index, 1);
      this.threatModel.modified_at = new Date().toISOString();
    }
  }
}
