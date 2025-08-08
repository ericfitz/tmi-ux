import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { LanguageService } from '../../../i18n/language.service';
import { LoggerService } from '../../../core/services/logger.service';
import { environment } from '../../../../environments/environment';
import { MockDataService } from '../../../mocks/mock-data.service';

import { MaterialModule } from '../../../shared/material/material.module';
import { SharedModule } from '../../../shared/shared.module';
import { CreateDiagramDialogComponent } from '../components/create-diagram-dialog/create-diagram-dialog.component';
import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
} from '../components/document-editor-dialog/document-editor-dialog.component';
import {
  SourceCodeEditorDialogComponent,
  SourceCodeEditorDialogData,
} from '../components/source-code-editor-dialog/source-code-editor-dialog.component';
import {
  PermissionsDialogComponent,
  PermissionsDialogData,
} from '../components/permissions-dialog/permissions-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../components/metadata-dialog/metadata-dialog.component';
import { RenameDiagramDialogComponent } from '../components/rename-diagram-dialog/rename-diagram-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../components/threat-editor-dialog/threat-editor-dialog.component';
import { Diagram, DIAGRAMS_BY_ID } from '../models/diagram.model';
import {
  Authorization,
  Document,
  Metadata,
  Source,
  Threat,
  ThreatModel,
} from '../models/threat-model.model';
import { ThreatModelService } from '../services/threat-model.service';
import { ThreatModelReportService } from '../services/threat-model-report.service';
import { FrameworkService } from '../../../shared/services/framework.service';
import { FrameworkModel } from '../../../shared/models/framework.model';

// Define form value interface
interface ThreatModelFormValues {
  name: string;
  description: string;
  threat_model_framework: string;
  issue_url?: string;
}

// Define document form result interface
interface DocumentFormResult {
  name: string;
  url: string;
  description?: string;
}

// Define source code form result interface
interface SourceCodeFormResult {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  url: string;
  parameters?: {
    refType: 'branch' | 'tag' | 'commit';
    refValue: string;
    subPath?: string;
  };
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
  isEditingIssueUrl = false;
  initialIssueUrlValue = '';
  frameworks: FrameworkModel[] = [];

  private _subscriptions = new Subscription();
  private _autoSaveSubject = new Subject<void>();
  private _isLoadingInitialData = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private threatModelReportService: ThreatModelReportService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private languageService: LanguageService,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private frameworkService: FrameworkService,
    private mockDataService: MockDataService,
  ) {
    this.threatModelForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      threat_model_framework: ['STRIDE', Validators.required],
      issue_url: [''],
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

  /**
   * Enter edit mode for issue URL
   */
  editIssueUrl(): void {
    this.isEditingIssueUrl = true;
    // Focus the input field after the view updates
    setTimeout(() => {
      const input = document.querySelector(
        'input[formControlName="issue_url"]',
      ) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  }

  /**
   * Handle blur event on issue URL input
   */
  onIssueUrlBlur(): void {
    // Update the initial value with the current form value
    const currentValue = (this.threatModelForm.get('issue_url')?.value as string) || '';
    this.initialIssueUrlValue = currentValue;
    // Exit edit mode when user clicks away from the input
    this.isEditingIssueUrl = false;
  }

  /**
   * Check if we should show the hyperlink view for issue URL
   */
  shouldShowIssueUrlHyperlink(): boolean {
    return (
      !this.isEditingIssueUrl &&
      !!this.initialIssueUrlValue &&
      this.initialIssueUrlValue.trim() !== ''
    );
  }

  /**
   * Opens URL in new tab when clicked
   */
  openUrlInNewTab(url: string): void {
    if (url && url.trim()) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  ngOnInit(): void {
    // Disable auto-save during initial data loading - MUST be set before form subscriptions
    this._isLoadingInitialData = true;

    // Set up auto-save subscription with debouncing
    this._subscriptions.add(
      this._autoSaveSubject
        .pipe(
          debounceTime(1000), // Wait 1 second after last change
          // Remove distinctUntilChanged() since we're emitting void values
        )
        .subscribe(() => {
          this.logger.debugComponent('TmEdit', 'Auto-save debounce completed, calling performAutoSave');
          this.performAutoSave();
        })
    );

    // Load frameworks from JSON files
    this._subscriptions.add(
      this.frameworkService.loadAllFrameworks().subscribe({
        next: frameworks => {
          this.frameworks = frameworks;
          this.logger.info('Loaded frameworks for threat model editor', {
            count: frameworks.length,
            frameworks: frameworks.map(f => f.name),
          });
          this.logger.debugComponent('TmEdit', 'Framework details loaded', {
            frameworks: frameworks.map(f => ({
              name: f.name,
              threatTypeCount: f.threatTypes.length,
              threatTypes: f.threatTypes.map(tt => tt.name),
            })),
          });
        },
        error: error => {
          this.logger.error('Failed to load frameworks', error);
          // Set empty array as fallback
          this.frameworks = [];
        },
      }),
    );

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

    // Subscribe to framework changes to handle threat type updates
    const frameworkControl = this.threatModelForm.get('threat_model_framework');
    if (frameworkControl) {
      this._subscriptions.add(
        frameworkControl.valueChanges.subscribe(newFramework => {
          if (
            !this._isLoadingInitialData &&
            newFramework &&
            this.threatModel &&
            newFramework !== this.threatModel.threat_model_framework
          ) {
            this.handleFrameworkChange(
              this.threatModel.threat_model_framework,
              newFramework as string,
            );
            // Auto-save when framework changes
            this.autoSaveThreatModel();
          }
        }),
      );
    }

    // Subscribe to name and description changes for auto-save
    const nameControl = this.threatModelForm.get('name');
    const descriptionControl = this.threatModelForm.get('description');
    const issueUrlControl = this.threatModelForm.get('issue_url');

    if (nameControl) {
      this._subscriptions.add(
        nameControl.valueChanges.subscribe(newName => {
          if (!this._isLoadingInitialData && newName && this.threatModel && newName !== this.threatModel.name) {
            this.autoSaveThreatModel();
          }
        }),
      );
    }

    if (descriptionControl) {
      this._subscriptions.add(
        descriptionControl.valueChanges.subscribe(newDescription => {
          if (!this._isLoadingInitialData && this.threatModel && newDescription !== this.threatModel.description) {
            this.autoSaveThreatModel();
          }
        }),
      );
    }

    if (issueUrlControl) {
      this._subscriptions.add(
        issueUrlControl.valueChanges.subscribe(newIssueUrl => {
          if (!this._isLoadingInitialData && this.threatModel && newIssueUrl !== this.threatModel.issue_url) {
            this.autoSaveThreatModel();
          }
        }),
      );
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/tm']);
      return;
    }
    
    this._subscriptions.add(
      this.threatModelService.getThreatModelById(id).subscribe(threatModel => {
        if (threatModel) {
          this.threatModel = threatModel;
          // Store the initial issue URL value
          this.initialIssueUrlValue = threatModel.issue_url || '';

          this.threatModelForm.patchValue({
            name: threatModel.name,
            description: threatModel.description || '',
            threat_model_framework: threatModel.threat_model_framework || 'STRIDE',
            issue_url: this.initialIssueUrlValue,
          });

          // Update framework control disabled state based on threats
          this.updateFrameworkControlState();

          // Load diagrams separately
          this.loadDiagrams(id);
          
          // Load documents separately  
          this.loadDocuments(id);
          
          // Load source code separately
          this.loadSourceCode(id);
          
          // Re-enable auto-save after initial population is complete
          setTimeout(() => {
            this._isLoadingInitialData = false;
          }, 100);
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
            created_by: 'user@example.com',
            threat_model_framework: 'STRIDE',
            authorization: [
              {
                subject: 'user@example.com',
                role: 'owner',
              },
            ],
            metadata: [],
            documents: [],
            sourceCode: [],
            diagrams: [],
            threats: [],
          };
          this.threatModelForm.patchValue({
            name: this.threatModel.name,
            description: this.threatModel.description || '',
            threat_model_framework: this.threatModel.threat_model_framework,
            issue_url: this.threatModel.issue_url || '',
          });

          // Store the initial issue URL value for new models
          this.initialIssueUrlValue = this.threatModel.issue_url || '';

          // Update framework control disabled state based on threats
          this.updateFrameworkControlState();
          
          // Re-enable auto-save after initial population is complete for new models
          setTimeout(() => {
            this._isLoadingInitialData = false;
          }, 100);
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

    // Use PATCH to update only the basic fields that changed
    const updates = {
      name: formValues.name,
      description: formValues.description,
      threat_model_framework: formValues.threat_model_framework,
      issue_url: formValues.issue_url
    };

    this._subscriptions.add(
      this.threatModelService.patchThreatModel(this.threatModel.id, updates).subscribe(result => {
        // Update only the basic fields from the result, preserve entities
        if (this.threatModel) {
          this.threatModel.name = result.name;
          this.threatModel.description = result.description;
          this.threatModel.threat_model_framework = result.threat_model_framework;
          this.threatModel.issue_url = result.issue_url;
          this.threatModel.modified_at = result.modified_at;
        }
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
   * @param shapeType Optional shape type to filter applicable threat types
   */
  openThreatEditor(threat?: Threat, shapeType?: string): void {
    // Determine the mode based on whether a threat is provided
    const mode: 'create' | 'edit' | 'view' = threat ? 'edit' : 'create';
    if (!this.threatModel) {
      return;
    }

    // Get the current framework from the form (which may be different from saved model)
    const currentFrameworkName =
      (this.threatModelForm.get('threat_model_framework')?.value as string) ||
      this.threatModel?.threat_model_framework;

    // Find the framework model that matches the current framework selection
    const framework = this.frameworks.find(f => f.name === currentFrameworkName);

    if (!framework) {
      this.logger.warn('Framework not found for current selection', {
        currentFrameworkName,
        savedFramework: this.threatModel.threat_model_framework,
        availableFrameworks: this.frameworks.map(f => f.name),
      });
    } else {
      this.logger.info('Using framework for threat editor', {
        currentFrameworkName,
        frameworkThreatTypes: framework.threatTypes.map(tt => tt.name),
        shapeType: shapeType || 'none',
      });
    }

    const dialogData: ThreatEditorDialogData = {
      threat,
      threatModelId: this.threatModel.id,
      mode,
      framework,
      shapeType,
    };

    const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
      width: '650px',
      maxHeight: '90vh',
      panelClass: 'threat-editor-dialog-650',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe(result => {
        if (result && this.threatModel) {

          // Type the result to avoid unsafe assignments
          interface ThreatFormResult {
            name: string;
            description: string;
            severity: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
            threat_type: string;
            diagram_id?: string;
            cell_id?: string;
            score?: number;
            priority?: string;
            mitigated?: boolean;
            status?: string;
            issue_url?: string;
          }
          const formResult = result as ThreatFormResult;

          if (mode === 'create') {
            // Create a new threat via API
            const newThreatData: Partial<Threat> = {
              name: formResult.name,
              description: formResult.description,
              severity: formResult.severity || 'High',
              threat_type: formResult.threat_type || 'Information Disclosure',
              diagram_id: formResult.diagram_id,
              cell_id: formResult.cell_id,
              score: formResult.score,
              priority: formResult.priority,
              mitigated: formResult.mitigated || false,
              status: formResult.status || 'Open',
              issue_url: formResult.issue_url,
              metadata: [
                { key: 'CVSS', value: formResult.score?.toString() || '7.3' },
                { key: 'Issue ID', value: 'jira-10881' },
              ],
            };

            this._subscriptions.add(
              this.threatModelService.createThreat(this.threatModel.id, newThreatData).subscribe(newThreat => {
                // Add the new threat to local state
                if (!this.threatModel?.threats) {
                  this.threatModel!.threats = [];
                }
                this.threatModel!.threats.push(newThreat);
                
                // Update framework control state since we added a threat
                this.updateFrameworkControlState();
              }),
            );
          } else if (mode === 'edit' && threat) {
            // Update an existing threat via API
            const updatedThreatData: Partial<Threat> = {
              name: formResult.name,
              description: formResult.description,
              severity: formResult.severity || threat.severity,
              threat_type: formResult.threat_type || threat.threat_type,
              diagram_id: formResult.diagram_id,
              cell_id: formResult.cell_id,
              score: formResult.score,
              priority: formResult.priority,
              mitigated: formResult.mitigated,
              status: formResult.status,
              issue_url: formResult.issue_url,
            };

            this._subscriptions.add(
              this.threatModelService.updateThreat(this.threatModel.id, threat.id, updatedThreatData).subscribe(updatedThreat => {
                // Update the threat in local state
                const index = this.threatModel?.threats?.findIndex(t => t.id === threat.id) ?? -1;
                if (index !== -1 && this.threatModel?.threats) {
                  this.threatModel.threats[index] = updatedThreat;
                }
              }),
            );
          }
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
      // Delete the threat via API
      this._subscriptions.add(
        this.threatModelService.deleteThreat(this.threatModel.id, threat.id).subscribe(success => {
          if (success) {
            // Remove the threat from local state
            const index = this.threatModel!.threats!.findIndex(t => t.id === threat.id);
            if (index !== -1) {
              this.threatModel!.threats!.splice(index, 1);
              
              // Update framework control state since we removed a threat
              this.updateFrameworkControlState();
            }
          }
        }),
      );
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
      dialogRef
        .afterClosed()
        .subscribe((diagramData: { name: string; type: string } | undefined) => {
          if (diagramData && this.threatModel) {
            // Create a new diagram via API
            const newDiagramData: Partial<Diagram> = {
              name: diagramData.name,
              type: diagramData.type,
            };

            this._subscriptions.add(
              this.threatModelService.createDiagram(this.threatModel.id, newDiagramData).subscribe({
                next: newDiagram => {
                  // Add the diagram to the DIAGRAMS_BY_ID map for backward compatibility
                  DIAGRAMS_BY_ID.set(newDiagram.id, newDiagram);

                  // Add the new diagram to local state
                  if (!this.threatModel?.diagrams) {
                    this.threatModel!.diagrams = [];
                  }
                  
                  // The API returns diagram objects, but threat model stores IDs or objects
                  if (this.threatModel && this.threatModel.diagrams && 
                      Array.isArray(this.threatModel.diagrams) && 
                      this.threatModel.diagrams.length > 0 && 
                      typeof this.threatModel.diagrams[0] === 'string') {
                    (this.threatModel.diagrams as unknown as string[]).push(newDiagram.id);
                  } else if (this.threatModel && this.threatModel.diagrams) {
                    (this.threatModel.diagrams as unknown as Diagram[]).push(newDiagram);
                  }

                  // Add the new diagram to the diagrams array for display
                  this.diagrams.push(newDiagram);
                },
                error: error => {
                  this.logger.error('Failed to create diagram', error);
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
          // Create updated diagram object
          const updatedDiagram: Diagram = {
            ...diagram,
            name: newName,
            modified_at: new Date().toISOString()
          };

          // Update the diagram in the local array
          const index = this.diagrams.findIndex(d => d.id === diagram.id);
          if (index !== -1) {
            this.diagrams[index] = updatedDiagram;
            // Force change detection by creating a new array reference
            this.diagrams = [...this.diagrams];
          }

          // Update the diagram in the threat model's diagrams array
          if (this.threatModel.diagrams) {
            const tmIndex = this.threatModel.diagrams.findIndex(d => d.id === diagram.id);
            if (tmIndex !== -1) {
              this.threatModel.diagrams[tmIndex] = updatedDiagram;
            }
          }

          // Update the diagram in the map for backward compatibility
          DIAGRAMS_BY_ID.set(diagram.id, updatedDiagram);

          // Update the diagram using the direct diagram API
          this._subscriptions.add(
            this.threatModelService.updateDiagram(this.threatModel.id, diagram.id, {
              name: newName
            }).subscribe({
              next: result => {
                if (result) {
                  // Update all references to the diagram with server response
                  const index = this.diagrams.findIndex(d => d.id === result.id);
                  if (index !== -1) {
                    this.diagrams[index] = result;
                    this.diagrams = [...this.diagrams];
                  }
                  
                  // Update the diagram in the threat model's diagrams array
                  if (this.threatModel?.diagrams) {
                    const tmIndex = this.threatModel.diagrams.findIndex(d => d.id === result.id);
                    if (tmIndex !== -1) {
                      this.threatModel.diagrams[tmIndex] = result;
                    }
                  }
                  
                  // Update the map with server response data
                  DIAGRAMS_BY_ID.set(result.id, result);
                }
              },
              error: error => {
                this.logger.error('Failed to update diagram', error);
              }
            }),
          );
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
      // Delete the diagram via API
      this._subscriptions.add(
        this.threatModelService.deleteDiagram(this.threatModel.id, diagram.id).subscribe(success => {
          if (success && this.threatModel && this.threatModel.diagrams) {
            // Remove the diagram from local state
            const index = this.threatModel.diagrams.findIndex((d: string | Diagram) => 
              (typeof d === 'string' ? d : d.id) === diagram.id
            );
            if (index !== -1) {
              this.threatModel.diagrams.splice(index, 1);
            }

            // Remove the diagram from the local array
            const diagramIndex = this.diagrams.findIndex(d => d.id === diagram.id);
            if (diagramIndex !== -1) {
              this.diagrams.splice(diagramIndex, 1);
            }

            // Remove from DIAGRAMS_BY_ID map
            DIAGRAMS_BY_ID.delete(diagram.id);
          }
        }),
      );
    }
  }

  /**
   * Opens a dialog to create a new document
   * If the user confirms, adds the new document to the threat model
   */
  addDocument(): void {
    const dialogData: DocumentEditorDialogData = {
      mode: 'create',
    };

    const dialogRef = this.dialog.open(DocumentEditorDialogComponent, {
      width: '600px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: DocumentFormResult | undefined) => {
        if (result && this.threatModel) {
          // Create a new document via API
          const newDocumentData: Partial<Document> = {
            name: result.name,
            url: result.url,
            description: result.description || undefined,
          };

          this._subscriptions.add(
            this.threatModelService.createDocument(this.threatModel.id, newDocumentData).subscribe(newDocument => {
              // Add the new document to local state
              if (!this.threatModel?.documents) {
                this.threatModel!.documents = [];
              }
              this.threatModel!.documents.push(newDocument);
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens a dialog to edit a document
   * If the user confirms, updates the document in the threat model
   * @param document The document to edit
   * @param event The click event
   */
  editDocument(document: Document, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();

    if (!this.threatModel) {
      return;
    }

    const dialogData: DocumentEditorDialogData = {
      document,
      mode: 'edit',
    };

    const dialogRef = this.dialog.open(DocumentEditorDialogComponent, {
      width: '600px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: DocumentFormResult | undefined) => {
        if (result && this.threatModel) {
          // Update the document via API
          const updatedDocumentData: Partial<Document> = {
            name: result.name,
            url: result.url,
            description: result.description || undefined,
          };

          this._subscriptions.add(
            this.threatModelService.updateDocument(this.threatModel.id, document.id, updatedDocumentData).subscribe(updatedDocument => {
              // Update the document in local state
              if (this.threatModel && this.threatModel.documents) {
                const index = this.threatModel.documents.findIndex(d => d.id === document.id);
                if (index !== -1) {
                  this.threatModel.documents[index] = updatedDocument;
                }
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Deletes a document from the threat model
   * @param document The document to delete
   * @param event The click event
   */
  deleteDocument(document: Document, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();

    if (!this.threatModel || !this.threatModel.documents) {
      return;
    }

    // Confirm deletion
    const confirmMessage = this.transloco.translate('common.confirmDelete', {
      item: this.transloco.translate('threatModels.documents').toLowerCase(),
      name: document.name,
    });
    const confirmDelete = window.confirm(confirmMessage);

    if (confirmDelete) {
      // Delete the document via API
      this._subscriptions.add(
        this.threatModelService.deleteDocument(this.threatModel.id, document.id).subscribe(success => {
          if (success && this.threatModel && this.threatModel.documents) {
            // Remove the document from local state
            const index = this.threatModel.documents.findIndex(d => d.id === document.id);
            if (index !== -1) {
              this.threatModel.documents.splice(index, 1);
            }
          }
        }),
      );
    }
  }

  /**
   * Generates tooltip text for document list items
   * @param document The document to generate tooltip for
   * @returns Formatted tooltip text with URL and description
   */
  getDocumentTooltip(document: Document): string {
    let tooltip = document.url;
    if (document.description) {
      tooltip += `\n\n${document.description}`;
    }
    return tooltip;
  }

  /**
   * Opens a dialog to create a new source code repository reference
   * If the user confirms, adds the new source code to the threat model
   */
  addSourceCode(): void {
    const dialogData: SourceCodeEditorDialogData = {
      mode: 'create',
    };

    const dialogRef = this.dialog.open(SourceCodeEditorDialogComponent, {
      width: '700px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: SourceCodeFormResult | undefined) => {
        if (result && this.threatModel) {
          // Create a new source code via API
          const newSourceData: Partial<Source> = {
            name: result.name,
            description: result.description || undefined,
            type: result.type,
            url: result.url,
            parameters: result.parameters,
          };

          this._subscriptions.add(
            this.threatModelService.createSource(this.threatModel.id, newSourceData).subscribe(newSource => {
              // Add the new source to local state
              if (!this.threatModel?.sourceCode) {
                this.threatModel!.sourceCode = [];
              }
              this.threatModel!.sourceCode.push(newSource);
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens a dialog to edit a source code repository reference
   * If the user confirms, updates the source code in the threat model
   * @param sourceCode The source code to edit
   * @param event The click event
   */
  editSourceCode(sourceCode: Source, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();

    if (!this.threatModel) {
      return;
    }

    const dialogData: SourceCodeEditorDialogData = {
      sourceCode,
      mode: 'edit',
    };

    const dialogRef = this.dialog.open(SourceCodeEditorDialogComponent, {
      width: '700px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: SourceCodeFormResult | undefined) => {
        if (result && this.threatModel) {
          // Update the source code via API
          const updatedSourceData: Partial<Source> = {
            name: result.name,
            description: result.description || undefined,
            type: result.type,
            url: result.url,
            parameters: result.parameters,
          };

          this._subscriptions.add(
            this.threatModelService.updateSource(this.threatModel.id, sourceCode.id, updatedSourceData).subscribe(updatedSource => {
              // Update the source in local state
              if (this.threatModel && this.threatModel.sourceCode) {
                const index = this.threatModel.sourceCode.findIndex(sc => sc.id === sourceCode.id);
                if (index !== -1) {
                  this.threatModel.sourceCode[index] = updatedSource;
                }
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Deletes a source code repository reference from the threat model
   * @param sourceCode The source code to delete
   * @param event The click event
   */
  deleteSourceCode(sourceCode: Source, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();

    if (!this.threatModel || !this.threatModel.sourceCode) {
      return;
    }

    // Confirm deletion
    const confirmMessage = this.transloco.translate('common.confirmDelete', {
      item: this.transloco.translate('threatModels.sourceCode').toLowerCase(),
      name: sourceCode.name,
    });
    const confirmDelete = window.confirm(confirmMessage);

    if (confirmDelete) {
      // Delete the source code via API
      this._subscriptions.add(
        this.threatModelService.deleteSource(this.threatModel.id, sourceCode.id).subscribe(success => {
          if (success && this.threatModel && this.threatModel.sourceCode) {
            // Remove the source from local state
            const index = this.threatModel.sourceCode.findIndex(sc => sc.id === sourceCode.id);
            if (index !== -1) {
              this.threatModel.sourceCode.splice(index, 1);
            }
          }
        }),
      );
    }
  }

  /**
   * Generates tooltip text for source code list items
   * @param sourceCode The source code to generate tooltip for
   * @returns Formatted tooltip text with URL and description
   */
  getSourceCodeTooltip(sourceCode: Source): string {
    let tooltip = sourceCode.url;
    if (sourceCode.description) {
      tooltip += `\n\n${sourceCode.description}`;
    }
    if (sourceCode.parameters) {
      tooltip += `\n\n${sourceCode.parameters.refType}: ${sourceCode.parameters.refValue}`;
      if (sourceCode.parameters.subPath) {
        tooltip += `\nPath: ${sourceCode.parameters.subPath}`;
      }
    }
    return tooltip;
  }

  /**
   * Opens the metadata dialog for a specific source code repository
   */
  openSourceCodeMetadataDialog(sourceCode: Source, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const dialogData: MetadataDialogData = {
      metadata: sourceCode.metadata || [],
      isReadOnly: false,
      objectType: 'SourceCode',
      objectName: `${this.transloco.translate('common.objectTypes.sourceCode')}: ${sourceCode.name} (${sourceCode.id})`,
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
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateSourceMetadata(this.threatModel.id, sourceCode.id, result).subscribe(updatedMetadata => {
              if (updatedMetadata && this.threatModel && this.threatModel.sourceCode) {
                const sourceCodeIndex = this.threatModel.sourceCode.findIndex(sc => sc.id === sourceCode.id);
                if (sourceCodeIndex !== -1) {
                  this.threatModel.sourceCode[sourceCodeIndex].metadata = updatedMetadata;
                }
                this.logger.info('Updated source code metadata via API', {
                  sourceCodeId: sourceCode.id,
                  metadata: updatedMetadata,
                });
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific document
   */
  openDocumentMetadataDialog(document: Document, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const dialogData: MetadataDialogData = {
      metadata: document.metadata || [],
      isReadOnly: false,
      objectType: 'Document',
      objectName: `${this.transloco.translate('common.objectTypes.document')}: ${document.name} (${document.id})`,
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
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateDocumentMetadata(this.threatModel.id, document.id, result).subscribe(updatedMetadata => {
              if (updatedMetadata && this.threatModel && this.threatModel.documents) {
                const documentIndex = this.threatModel.documents.findIndex(d => d.id === document.id);
                if (documentIndex !== -1) {
                  this.threatModel.documents[documentIndex].metadata = updatedMetadata;
                }
                this.logger.info('Updated document metadata via API', {
                  documentId: document.id,
                  metadata: updatedMetadata,
                });
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

  /**
   * Opens the permissions dialog to manage threat model permissions
   */
  openPermissionsDialog(): void {
    if (!this.threatModel) {
      return;
    }

    const dialogData: PermissionsDialogData = {
      permissions: this.threatModel.authorization || [],
      owner: this.threatModel.owner,
      isReadOnly: false, // You can add logic here to determine if user has edit permissions
    };

    const dialogRef = this.dialog.open(PermissionsDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      minWidth: '500px',
      maxHeight: '80vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: Authorization[] | undefined) => {
        if (result && this.threatModel) {
          this.threatModel.authorization = result;
          this.threatModel.modified_at = new Date().toISOString();

          // Create a clean threat model object with only basic fields (no entities)
          // Use PATCH to update only the authorization field
          const updates = {
            authorization: this.threatModel.authorization
          };

          // Update the threat model with PATCH (only authorization field)
          this._subscriptions.add(
            this.threatModelService.patchThreatModel(this.threatModel.id, updates).subscribe(updatedModel => {
              if (updatedModel && this.threatModel) {
                // Update only the authorization and modified_at fields from the result
                this.threatModel.authorization = updatedModel.authorization;
                this.threatModel.modified_at = updatedModel.modified_at;
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the metadata dialog to manage threat model metadata
   */
  openMetadataDialog(): void {
    if (!this.threatModel) {
      return;
    }

    const dialogData: MetadataDialogData = {
      metadata: this.threatModel.metadata || [],
      isReadOnly: false, // You can add logic here to determine if user has edit permissions
      objectType: 'ThreatModel',
      objectName: `${this.transloco.translate('common.objectTypes.threatModel')}: ${this.threatModel.name} (${this.threatModel.id})`,
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
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateThreatModelMetadata(this.threatModel.id, result).subscribe(updatedMetadata => {
              if (updatedMetadata && this.threatModel) {
                this.threatModel.metadata = updatedMetadata;
                this.threatModel.modified_at = new Date().toISOString();
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific diagram
   */
  openDiagramMetadataDialog(diagram: Diagram, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const dialogData: MetadataDialogData = {
      metadata: diagram.metadata || [],
      isReadOnly: false,
      objectType: 'Diagram',
      objectName: `${this.transloco.translate('common.objectTypes.diagram')}: ${diagram.name} (${diagram.id})`,
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
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateDiagramMetadata(this.threatModel.id, diagram.id, result).subscribe(updatedMetadata => {
              if (updatedMetadata) {
                const diagramIndex = this.diagrams.findIndex(d => d.id === diagram.id);
                if (diagramIndex !== -1) {
                  this.diagrams[diagramIndex].metadata = updatedMetadata;
                  this.diagrams[diagramIndex].modified_at = new Date().toISOString();
                }
                this.logger.info('Updated diagram metadata via API', {
                  diagramId: diagram.id,
                  metadata: updatedMetadata,
                });
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific threat
   */
  openThreatMetadataDialog(threat: Threat, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const dialogData: MetadataDialogData = {
      metadata: threat.metadata || [],
      isReadOnly: false,
      objectType: 'Threat',
      objectName: `${this.transloco.translate('common.objectTypes.threat')}: ${threat.name} (${threat.id})`,
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
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateThreatMetadata(this.threatModel.id, threat.id, result).subscribe(updatedMetadata => {
              if (updatedMetadata && this.threatModel) {
                const threatIndex = this.threatModel.threats?.findIndex(t => t.id === threat.id);
                if (threatIndex !== undefined && threatIndex !== -1 && this.threatModel.threats) {
                  this.threatModel.threats[threatIndex].metadata = updatedMetadata;
                  this.threatModel.threats[threatIndex].modified_at = new Date().toISOString();
                }
                this.logger.info('Updated threat metadata via API', {
                  threatId: threat.id,
                  threatName: threat.name,
                  metadata: updatedMetadata,
                });
              }
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the source code view (placeholder for future functionality)
   */
  openSourceCodeView(): void {
    // TODO: Implement source code view functionality
    this.logger.info('Source code view clicked - functionality to be implemented');
  }

  /**
   * Generates and saves a PDF report for the current threat model
   */
  async openReport(): Promise<void> {
    if (!this.threatModel) {
      this.logger.warn('Cannot generate report: no threat model loaded');
      return;
    }

    try {
      this.logger.info('Generating PDF report', { 
        threatModelId: this.threatModel.id,
        threatModelName: this.threatModel.name 
      });

      await this.threatModelReportService.generateReport(this.threatModel);
      
      this.logger.info('PDF report generation completed successfully');
    } catch (error) {
      this.logger.error('Failed to generate PDF report', error);
      // You could show a user notification here if needed
    }
  }

  /**
   * Downloads the threat model as a JSON file to the desktop
   */
  downloadToDesktop(): void {
    if (!this.threatModel) {
      this.logger.warn('Cannot download threat model: no threat model loaded');
      return;
    }

    this.logger.info('Downloading threat model to desktop', {
      threatModelId: this.threatModel.id,
      threatModelName: this.threatModel.name,
    });

    try {
      // Generate filename: threat model name (truncated to 63 chars) + "-threat-model.json"
      const filename = this.generateThreatModelFilename(this.threatModel.name);

      // Serialize the complete threat model as JSON
      const jsonContent = JSON.stringify(this.threatModel, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });

      // Use the same file picker pattern as DFD exports
      this.handleThreatModelExport(blob, filename).catch(error => {
        this.logger.error('Error downloading threat model', error);
      });
    } catch (error) {
      this.logger.error('Error preparing threat model download', error);
    }
  }

  /**
   * Generate filename for threat model download
   * Format: "{threatModelName}-threat-model.json" (name truncated to 63 chars)
   */
  private generateThreatModelFilename(threatModelName: string): string {
    // Helper function to sanitize and truncate names for filenames
    const sanitizeAndTruncate = (name: string, maxLength: number): string => {
      // Remove or replace characters that are invalid in filenames
      const sanitized = name
        .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid filename characters with dash
        .replace(/\s+/g, '-') // Replace spaces with dashes
        .replace(/-+/g, '-') // Replace multiple dashes with single dash
        .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

      // Truncate to max length
      return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
    };

    // Sanitize and truncate the threat model name
    const sanitizedName = sanitizeAndTruncate(threatModelName.trim(), 63);

    // If sanitization resulted in an empty string, use default with timestamp
    if (!sanitizedName) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      return `threat-model-${timestamp}.json`;
    }

    const filename = `${sanitizedName}-threat-model.json`;

    this.logger.debugComponent('TmEdit', 'Generated threat model filename', {
      originalName: threatModelName,
      sanitizedName,
      filename,
    });

    return filename;
  }

  /**
   * Handle threat model export using File System Access API with fallback
   */
  private async handleThreatModelExport(blob: Blob, filename: string): Promise<void> {
    // Check if File System Access API is supported
    if ('showSaveFilePicker' in window) {
      try {
        this.logger.debugComponent('TmEdit', 'Using File System Access API for threat model save');
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'JSON files',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.logger.info('Threat model saved successfully using File System Access API', {
          filename,
        });
        return; // Success, exit early
      } catch (error) {
        // Handle File System Access API errors
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.logger.debugComponent('TmEdit', 'Threat model save cancelled by user');
          return; // User cancelled, exit without fallback
        } else {
          this.logger.warn('File System Access API failed, falling back to download method', error);
          // Continue to fallback method below
        }
      }
    } else {
      this.logger.debugComponent(
        'TmEdit',
        'File System Access API not supported, using fallback download method',
      );
    }

    // Fallback method for unsupported browsers or API failures
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.logger.info('Threat model downloaded successfully using fallback method', { filename });
    } catch (fallbackError) {
      this.logger.error('Both File System Access API and fallback method failed', fallbackError);
      throw fallbackError;
    }
  }

  /**
   * Check if the threat model has any threats defined
   * Used to determine if the framework control should be disabled
   * @returns true if threats exist, false otherwise
   */
  hasThreats(): boolean {
    return !!(this.threatModel?.threats && this.threatModel.threats.length > 0);
  }

  /**
   * Update the framework control's disabled state based on whether threats exist
   * The framework cannot be changed once threats are defined to maintain data consistency
   */
  private updateFrameworkControlState(): void {
    const frameworkControl = this.threatModelForm.get('threat_model_framework');
    if (frameworkControl) {
      if (this.hasThreats()) {
        frameworkControl.disable();
      } else {
        frameworkControl.enable();
      }
    }
  }

  /**
   * Get the appropriate Material icon for a diagram based on its type
   * @param diagram The diagram object
   * @returns The Material icon name to use
   */
  getDiagramIcon(diagram: Diagram): string {
    if (!diagram.type) {
      return 'indeterminate_question_box'; // Default icon for unknown type
    }

    // Extract the type prefix (everything before the first hyphen)
    const typePrefix = diagram.type.split('-')[0].toUpperCase();

    switch (typePrefix) {
      case 'DFD':
        return 'graph_3';
      // Future diagram types can be added here
      default:
        return 'indeterminate_question_box'; // Default fallback for unrecognized types
    }
  }

  /**
   * Get tooltip text for a diagram icon showing the diagram type
   * @param diagram The diagram object
   * @returns The tooltip text
   */
  getDiagramTooltip(diagram: Diagram): string {
    return diagram.type || 'Unknown Type';
  }

  /**
   * Handle framework change - log the change for debugging purposes
   * @param oldFramework The previous framework name
   * @param newFramework The new framework name
   */
  private handleFrameworkChange(oldFramework: string, newFramework: string): void {
    this.logger.info('Framework changed', {
      oldFramework,
      newFramework,
      threatCount: this.threatModel?.threats?.length || 0,
    });

    // Framework control should be disabled if threats exist, so this should only
    // happen when there are no existing threats, but we log it for debugging
    if (this.threatModel?.threats && this.threatModel.threats.length > 0) {
      this.logger.warn(
        'Framework change detected with existing threats - this should not be possible',
        {
          oldFramework,
          newFramework,
          threatCount: this.threatModel.threats.length,
        },
      );
    }
  }

  /**
   * Truncate a URL for display in the threats list
   * @param url The full URL
   * @returns Truncated URL for display
   */
  getTruncatedUrl(url: string): string {
    if (!url) return '';

    // Remove protocol and www prefix for cleaner display
    let displayUrl = url.replace(/^https?:\/\/(www\.)?/, '');

    // Truncate if too long
    const maxLength = 40;
    if (displayUrl.length > maxLength) {
      displayUrl = displayUrl.substring(0, maxLength - 3) + '...';
    }

    return displayUrl;
  }

  /**
   * Check if the save button should be shown (development builds only)
   * @returns true if in development mode
   */
  shouldShowSaveButton(): boolean {
    return !environment.production;
  }

  /**
   * Check if the save button should be enabled
   * @returns true if mock data is enabled and we're editing a mock threat model
   */
  isSaveEnabled(): boolean {
    if (!this.threatModel) {
      return false;
    }

    // Only enable if mock data is being used
    if (!this.mockDataService.isUsingMockData) {
      return false;
    }

    // Only enable for existing threat models (not new ones)
    if (this.isNewThreatModel) {
      return false;
    }

    // Check if this is one of the mock threat models
    return this.mockDataService.isMockThreatModel(this.threatModel.id);
  }

  /**
   * Save the threat model to disk for mock data replacement
   * Downloads a file that can be used to replace the mock data file
   */
  saveToDisk(): void {
    if (!this.threatModel) {
      this.logger.warn('Cannot save threat model: no threat model loaded');
      return;
    }

    if (!this.isSaveEnabled()) {
      this.logger.warn('Save to disk is not enabled for this threat model');
      return;
    }

    this.logger.debugComponent('TmEdit', 'Saving threat model to mock data file', {
      threatModelId: this.threatModel.id,
      threatModelName: this.threatModel.name,
    });

    try {
      // Apply form changes to the threat model before saving
      this.applyFormChangesToThreatModel();

      // Get the mock data file name from the service
      const mockFileName = this.mockDataService.getMockDataFileName(this.threatModel.id);

      if (!mockFileName) {
        this.logger.warn('Cannot determine mock data file name for threat model', {
          threatModelId: this.threatModel.id,
        });
        return;
      }

      // Serialize the complete threat model as JSON with proper formatting
      const jsonContent = JSON.stringify(this.threatModel, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });

      // Create download with the exact filename to replace in mock-data directory
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = mockFileName;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the object URL
      URL.revokeObjectURL(url);

      this.logger.debugComponent('TmEdit', 'Mock data file created for download', {
        fileName: mockFileName,
        instruction: `Replace src/assets/mock-data/${mockFileName} with the downloaded file`,
      });

      // Show success message to user in console (development only)
      this.logger.debugComponent('TmEdit', `Mock data file created: ${mockFileName}`);
      this.logger.debugComponent(
        'TmEdit',
        `Replace src/assets/mock-data/${mockFileName} with the downloaded file to update mock data`,
      );
    } catch (error) {
      this.logger.error('Error saving threat model to mock data file', error);
    }
  }

  /**
   * Apply form changes to the threat model object before saving
   */
  private applyFormChangesToThreatModel(): void {
    if (!this.threatModel || !this.threatModelForm.valid) {
      return;
    }

    const formValues: ThreatModelFormValues = this.threatModelForm.value as ThreatModelFormValues;

    // Update the threat model with form values
    this.threatModel.name = formValues.name;
    this.threatModel.description = formValues.description;
    this.threatModel.threat_model_framework = formValues.threat_model_framework;

    if (formValues.issue_url) {
      this.threatModel.issue_url = formValues.issue_url;
    }

    // Update modified timestamp
    this.threatModel.modified_at = new Date().toISOString();

    this.logger.debugComponent('TmEdit', 'Applied form changes to threat model', {
      threatModelId: this.threatModel.id,
      updatedFields: ['name', 'description', 'threat_model_framework', 'issue_url', 'modified_at'],
    });
  }

  /**
   * Trigger auto-save by emitting to the auto-save subject
   * This will be debounced to prevent excessive API calls
   */
  private autoSaveThreatModel(): void {
    this.logger.debugComponent('TmEdit', 'Auto-save triggered');
    this._autoSaveSubject.next();
  }

  /**
   * Perform the actual auto-save operation
   * This method is called after debouncing
   */
  private performAutoSave(): void {
    this.logger.debugComponent('TmEdit', 'performAutoSave called', {
      threatModelExists: !!this.threatModel,
      formValid: this.threatModelForm.valid,
      isNewThreatModel: this.isNewThreatModel,
      isLoadingInitialData: this._isLoadingInitialData,
      threatModelId: this.threatModel?.id
    });

    if (!this.threatModel || this.threatModelForm.invalid || this._isLoadingInitialData) {
      this.logger.debugComponent('TmEdit', 'Auto-save skipped due to conditions', {
        threatModelExists: !!this.threatModel,
        formValid: this.threatModelForm.valid,
        isLoadingInitialData: this._isLoadingInitialData
      });
      return;
    }

    // Apply form changes to the threat model
    this.applyFormChangesToThreatModel();

    // Use PATCH to auto-save only the basic fields that might have changed
    const updates = {
      name: this.threatModel.name,
      description: this.threatModel.description,
      threat_model_framework: this.threatModel.threat_model_framework,
      issue_url: this.threatModel.issue_url
    };

    this.logger.debugComponent('TmEdit', 'Calling threatModelService.patchThreatModel', {
      threatModelId: this.threatModel.id,
      updates,
    });

    // Save to server with PATCH (only basic fields)
    this._subscriptions.add(
      this.threatModelService.patchThreatModel(this.threatModel.id, updates).subscribe({
        next: result => {
          if (result && this.threatModel) {
            // Update only the basic fields from the result, preserve entities
            this.threatModel.name = result.name;
            this.threatModel.description = result.description;
            this.threatModel.threat_model_framework = result.threat_model_framework;
            this.threatModel.issue_url = result.issue_url;
            this.threatModel.modified_at = result.modified_at;
            
            this.logger.debugComponent('TmEdit', 'Auto-saved threat model changes', {
              threatModelId: this.threatModel.id,
              name: this.threatModel.name,
            });
          }
        },
        error: error => {
          this.logger.error('Auto-save failed for threat model', error, {
            threatModelId: this.threatModel?.id,
          });
        }
      })
    );
  }

  /**
   * Load diagrams for the threat model using separate API call
   */
  private loadDiagrams(threatModelId: string): void {
    this._subscriptions.add(
      this.threatModelService.getDiagramsForThreatModel(threatModelId).subscribe(diagrams => {
        this.diagrams = diagrams;
        
        // Update DIAGRAMS_BY_ID map with real diagram data
        this.diagrams.forEach(diagram => {
          DIAGRAMS_BY_ID.set(diagram.id, diagram);
        });
        
        // Update threat model diagrams property for consistency
        if (this.threatModel) {
          this.threatModel.diagrams = diagrams;
        }
      })
    );
  }

  /**
   * Load documents for the threat model using separate API call
   */
  private loadDocuments(threatModelId: string): void {
    this._subscriptions.add(
      this.threatModelService.getDocumentsForThreatModel(threatModelId).subscribe(documents => {
        if (this.threatModel) {
          this.threatModel.documents = documents;
        }
      })
    );
  }

  /**
   * Load source code for the threat model using separate API call
   */
  private loadSourceCode(threatModelId: string): void {
    this._subscriptions.add(
      this.threatModelService.getSourceCodeForThreatModel(threatModelId).subscribe(sourceCode => {
        if (this.threatModel) {
          this.threatModel.sourceCode = sourceCode;
        }
      })
    );
  }
}
