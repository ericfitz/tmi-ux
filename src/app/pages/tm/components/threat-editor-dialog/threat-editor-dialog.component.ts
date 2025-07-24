import { Component, Inject, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Threat } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { Subscription } from 'rxjs';

/**
 * Interface for threat form values
 */
interface ThreatFormValues {
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

/**
 * Dialog data interface
 */
/**
 * Interface for diagram dropdown options
 */
export interface DiagramOption {
  id: string;
  name: string;
}

/**
 * Interface for cell dropdown options
 */
export interface CellOption {
  id: string;
  label: string;
}

/**
 * Dialog data interface
 */
export interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';
  diagramId?: string;
  cellId?: string;
  diagrams?: DiagramOption[];
  cells?: CellOption[];
}

@Component({
  selector: 'app-threat-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatCheckboxModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './threat-editor-dialog.component.html',
  styleUrls: ['./threat-editor-dialog.component.scss'],
  providers: [],
})
export class ThreatEditorDialogComponent implements OnInit, OnDestroy, AfterViewInit {
  threatForm: FormGroup;
  dialogTitle: string = '';
  isViewOnly: boolean = false;
  currentLocale: string = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';
  isEditingIssueUrl = false;
  initialIssueUrlValue = '';

  // Dropdown options
  diagramOptions: DiagramOption[] = [];
  cellOptions: CellOption[] = [];

  // Special option for "Not associated" selection
  readonly NOT_ASSOCIATED_VALUE = '';


  private langSubscription: Subscription | null = null;
  private directionSubscription: Subscription | null = null;

  // Track dialog source for debugging
  dialogSource: string = '';

  constructor(
    private dialogRef: MatDialogRef<ThreatEditorDialogComponent>,
    private fb: FormBuilder,
    public logger: LoggerService, // Make logger public for debugging
    private languageService: LanguageService,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: ThreatEditorDialogData,
  ) {
    this.threatForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      severity: ['High', Validators.required],
      threat_type: ['Elevation of Privilege', Validators.required],
      diagram_id: [''],
      cell_id: [''],
      score: [null],
      priority: ['High'],
      mitigated: [false],
      status: ['Open'],
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
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('Could not copy text: ', errorMessage);
      });
  }




  /**
   * Enter edit mode for issue URL
   */
  editIssueUrl(): void {
    this.isEditingIssueUrl = true;
    // Focus the input field after the view updates
    setTimeout(() => {
      const input = document.querySelector('input[formControlName="issue_url"]') as HTMLInputElement;
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
    const currentValue = this.threatForm.get('issue_url')?.value || '';
    this.initialIssueUrlValue = currentValue;
    // Exit edit mode when user clicks away from the input
    this.isEditingIssueUrl = false;
  }

  /**
   * Check if we should show the hyperlink view for issue URL
   */
  shouldShowIssueUrlHyperlink(): boolean {
    return !this.isEditingIssueUrl && !!this.initialIssueUrlValue;
  }

  /**
   * Opens URL in new tab when clicked
   */
  openUrlInNewTab(url: string): void {
    if (url && url.trim()) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Initialize diagram options for the dropdown
   */
  private initializeDiagramOptions(): void {
    // Initialize with "Not associated" option
    this.diagramOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        name: this.translocoService.translate('threatEditor.notAssociatedWithDiagram'),
      },
    ];

    // Add diagrams from input if provided
    if (this.data.diagrams && this.data.diagrams.length > 0) {
      this.diagramOptions = [...this.diagramOptions, ...this.data.diagrams];
    }
    // If no diagrams provided but there's a current diagram ID, add it as an option
    else if (this.data.diagramId) {
      this.diagramOptions.push({
        id: this.data.diagramId,
        name: this.data.diagramId, // Use ID as name if no name provided
      });
    }

    this.logger.info('Diagram options initialized:', this.diagramOptions);
  }

  /**
   * Initialize cell options for the dropdown
   */
  private initializeCellOptions(): void {
    // Initialize with "Not associated" option
    this.cellOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        label: this.translocoService.translate('threatEditor.notAssociatedWithCell'),
      },
    ];

    // Add cells from input if provided
    if (this.data.cells && this.data.cells.length > 0) {
      this.cellOptions = [...this.cellOptions, ...this.data.cells];
    }
    // If no cells provided but there's a current cell ID, add it as an option
    else if (this.data.cellId) {
      this.cellOptions.push({
        id: this.data.cellId,
        label: this.data.cellId, // Use ID as label if no label provided
      });
    }

    this.logger.info('Cell options initialized:', this.cellOptions);
  }

  ngOnInit(): void {
    // Set dialog mode
    this.isViewOnly = this.data.mode === 'view';

    // Log initialization context
    const openedFrom = new Error().stack?.includes('dfd.component') ? 'DFD Editor' : 'TM Edit';
    this.logger.info('ThreatEditorDialog initialized with data:', {
      mode: this.data.mode,
      threatModelId: this.data.threatModelId,
      hasThreat: !!this.data.threat,
      openedFrom,
    });

    // Log detailed initialization data for debugging
    this.logger.info('Detailed initialization data:', {
      source: openedFrom,
      dialogData: JSON.stringify(this.data),
      threatData: this.data.threat
        ? JSON.stringify({
            id: this.data.threat.id,
            name: this.data.threat.name,
            description: this.data.threat.description,
            severity: this.data.threat.severity,
            threat_type: this.data.threat.threat_type,
            diagram_id: this.data.threat.diagram_id,
            cell_id: this.data.threat.cell_id,
          })
        : 'No threat data',
      stackTrace: new Error().stack,
    });

    // Add a property to track the source for debugging
    this.dialogSource = openedFrom;

    const currentLang = this.translocoService.getActiveLang();
    this.logger.info('Current language:', currentLang);

    // First load English as fallback
    this.translocoService.load('en-US').subscribe({
      next: () => {
        this.logger.info('English translations loaded successfully');

        // Then load current language if not English
        if (currentLang !== 'en-US') {
          this.translocoService.load(currentLang).subscribe({
            next: () => {
              // Force translation update
              this.translocoService.setActiveLang(currentLang);
              this.logger.info('Translations loaded successfully for language: ' + currentLang);

              // Initialize dropdown options after translations are loaded
              this.initializeDiagramOptions();
              this.initializeCellOptions();

              // Force change detection to update the translations
              setTimeout(() => {
                this.dialogRef.updateSize();
                this.logger.info('Dialog size updated to force refresh');
              }, 100);
            },
            error: (err: unknown) => {
              const errorMessage = err instanceof Error ? err.message : String(err);
              this.logger.error(
                'Failed to load translations for language: ' + currentLang,
                errorMessage,
              );
              // Fallback to English
              this.translocoService.setActiveLang('en-US');

              // Initialize dropdown options with English translations
              this.initializeDiagramOptions();
              this.initializeCellOptions();
            },
          });
        } else {
          // Initialize dropdown options with English translations
          this.initializeDiagramOptions();
          this.initializeCellOptions();

          // Force change detection to update the translations
          setTimeout(() => {
            this.dialogRef.updateSize();
            this.logger.info('Dialog size updated to force refresh');
          }, 100);
        }
      },
      error: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('Failed to load English translations', errorMessage);

        // Initialize dropdown options even if translations failed
        this.initializeDiagramOptions();
        this.initializeCellOptions();
      },
    });

    // Set dialog title based on mode
    if (this.data.mode === 'create') {
      this.dialogTitle = 'threatEditor.createNewThreat';

      // Initialize with empty data for new threats
      if (!this.data.threat) {
        this.data.threat = {
          id: '',
          threat_model_id: this.data.threatModelId,
          name: '',
          description: '',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          severity: 'High',
          threat_type: 'Information Disclosure',
          diagram_id: this.data.diagramId || '',
          cell_id: this.data.cellId || '',
          score: 10.0,
          priority: 'High',
          mitigated: false,
          status: 'Open',
          issue_url: 'n/a',
          metadata: [],
        };
      }
    } else if (this.data.mode === 'edit') {
      this.dialogTitle = 'threatEditor.editThreat';
    } else {
      this.dialogTitle = 'threatEditor.viewThreat';
    }

    // Initialize form with empty values for text fields and default values for other fields
    // We're using floatLabel="always" in the HTML to ensure labels are always visible
    const defaultCellId = this.data.cellId || '';

    this.threatForm.patchValue({
      name: '',
      description: '',
      severity: 'High',
      threat_type: 'Information Disclosure',
      diagram_id: this.data.diagramId || '',
      cell_id: defaultCellId,
      score: 10.0,
      priority: 'High',
      mitigated: false,
      status: 'Open',
      issue_url: '',
    });

    // If editing or viewing, populate form with threat data
    if (this.data.threat) {
      // Store the initial issue URL value
      this.initialIssueUrlValue = this.data.threat.issue_url || '';
      
      this.threatForm.patchValue({
        name: this.data.threat.name,
        description: this.data.threat.description || '',
        severity: this.data.threat.severity || 'High',
        threat_type: this.data.threat.threat_type || '',
        diagram_id: this.data.threat.diagram_id || '',
        cell_id: this.data.threat.cell_id || '',
        score: this.data.threat.score || null,
        priority: this.data.threat.priority || '',
        mitigated: this.data.threat.mitigated || false,
        status: this.data.threat.status || 'Open',
        issue_url: this.initialIssueUrlValue,
      });

      // If view only, disable the form
      if (this.isViewOnly) {
        this.threatForm.disable();
      }
    }


    // Force translations to be applied
    this.forceTranslationUpdate();

    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLocale = language.code;
      this.currentDirection = language.rtl ? 'rtl' : 'ltr';
      // Force change detection to update the date format and translations
      this.dialogRef.updateSize();
      this.forceTranslationUpdate();

      // Reinitialize dropdown options when language changes
      this.initializeDiagramOptions();
      this.initializeCellOptions();
    });

    // Also subscribe to direction changes
    this.directionSubscription = this.languageService.direction$.subscribe(direction => {
      this.currentDirection = direction;
      // Force translation update when direction changes
      this.forceTranslationUpdate();
    });
  }

  /**
   * After view initialization, force translation update
   */
  ngAfterViewInit(): void {
    // Force translation update after view is initialized
    this.forceTranslationUpdate();

    // Add diagnostic check for Angular Material form field initialization
    setTimeout(() => {
      // Check if the form fields are properly initialized
      const formFields = document.querySelectorAll('.mat-form-field');
      const labels = document.querySelectorAll('.mat-form-field-label');

      this.logger.info('Form field initialization in ngAfterViewInit:', {
        source: this.dialogSource,
        formFieldsCount: formFields.length,
        labelsCount: labels.length,
        // Check if form field is properly initialized with Angular Material classes
        formFieldClasses: Array.from(formFields).map(field => {
          return {
            classList: Array.from(field.classList),
            hasLabel: !!field.querySelector('.mat-form-field-label'),
            labelText:
              field.querySelector('.mat-form-field-label')?.textContent?.trim() || 'No label text',
          };
        }),
      });
    }, 150);
  }

  /**
   * Force translation update by triggering a dialog resize
   * This helps ensure translations are properly applied
   */
  private forceTranslationUpdate(): void {
    // Use setTimeout to ensure this runs after Angular's change detection cycle
    setTimeout(() => {
      // Update dialog size to force a refresh
      this.dialogRef.updateSize();
      this.logger.info('Force translation update triggered');

      // Manually trigger translation update for all keys
      const keys = [
        'threatEditor.threatName',
        'threatEditor.threatDescription',
        'threatEditor.threatType',
        'threatEditor.severity',
        'threatEditor.score',
        'threatEditor.priority',
        'threatEditor.issueUrl',
        'threatEditor.status',
        'threatEditor.mitigated',
        'threatEditor.diagramId',
        'threatEditor.cellId',
        'threatEditor.notAssociatedWithDiagram',
        'threatEditor.notAssociatedWithCell',
        'threatEditor.cancel',
        'threatEditor.save',
        'threatEditor.close',
      ];

      // Log the problematic labels that are not showing
      this.logger.info('Checking translations for problematic labels:', {
        source: this.dialogSource,
        threatName: this.translocoService.translate('threatEditor.threatName'),
        threatDescription: this.translocoService.translate('threatEditor.threatDescription'),
        priority: this.translocoService.translate('threatEditor.priority'),
        issueUrl: this.translocoService.translate('threatEditor.issueUrl'),
        diagramId: this.translocoService.translate('threatEditor.diagramId'),
        cellId: this.translocoService.translate('threatEditor.cellId'),
      });

      // Check if form fields have the floating label class
      setTimeout(() => {
        const formFields = document.querySelectorAll('.mat-form-field');
        const floatingLabels = document.querySelectorAll(
          '.mat-form-field.mat-form-field-should-float',
        );
        this.logger.info('Form field state:', {
          source: this.dialogSource,
          totalFormFields: formFields.length,
          fieldsWithFloatingLabels: floatingLabels.length,
          formFieldsHaveContent: Array.from(formFields).map(field => {
            const input = field.querySelector('input, textarea');
            return input && 'value' in input
              ? !!(input as HTMLInputElement | HTMLTextAreaElement).value
              : false;
          }),
        });
      }, 50);

      // Add additional diagnostics for Angular Material form field classes
      setTimeout(() => {
        // Check for mat-form-field-appearance-outline class
        const outlineFields = document.querySelectorAll('.mat-form-field-appearance-outline');

        // Check for mat-focused class
        const focusedFields = document.querySelectorAll('.mat-focused');

        // Check for mat-form-field-label elements
        const labelElements = document.querySelectorAll('.mat-form-field-label');

        // Check if labels are visible (not having mat-form-field-empty class)
        const emptyFields = document.querySelectorAll('.mat-form-field-empty');

        this.logger.info('Angular Material form field diagnostics:', {
          source: this.dialogSource,
          outlineFieldsCount: outlineFields.length,
          focusedFieldsCount: focusedFields.length,
          labelElementsCount: labelElements.length,
          emptyFieldsCount: emptyFields.length,
          // Check if labels have computed style of visibility: hidden or display: none
          labelVisibility: Array.from(labelElements).map(label => {
            const computedStyle = window.getComputedStyle(label);
            return {
              visibility: computedStyle.visibility,
              display: computedStyle.display,
              opacity: computedStyle.opacity,
            };
          }),
        });
      }, 100);

      // Force translation of each key
      keys.forEach(key => {
        this.translateKey(key);
      });

      // Add a second delayed update to ensure translations are applied
      setTimeout(() => {
        this.logger.info('Running secondary translation update');
        this.dialogRef.updateSize();
        keys.forEach(key => {
          this.translateKey(key);
        });
      }, 300);
    }, 200);
  }

  /**
   * Force translation update for a specific key
   * @param key The translation key to update
   */
  private translateKey(key: string): void {
    try {
      // Get the translation
      const translation = this.translocoService.translate(key);

      // If translation is missing or empty, try to load it again
      if (!translation || translation === key) {
        this.logger.warn(`Missing translation for key: ${key}`);

        // Try to load the translation again
        const currentLang = this.translocoService.getActiveLang();
        this.translocoService.load(currentLang).subscribe({
          next: () => {
            const retryTranslation = this.translocoService.translate(key);
            this.logger.debug(`Retry translation for ${key}: ${retryTranslation}`);
          },
          error: (err: unknown) => {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to load translations for retry: ${errorMessage}`);
          },
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error translating key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
      this.langSubscription = null;
    }

    if (this.directionSubscription) {
      this.directionSubscription.unsubscribe();
      this.directionSubscription = null;
    }
  }

  /**
   * Close the dialog with the threat data
   */
  onSubmit(): void {
    if (this.threatForm.invalid) {
      return;
    }

    const formValues = this.threatForm.getRawValue() as ThreatFormValues;

    // Return the form values to be used to create or update the threat
    this.dialogRef.close({
      name: formValues.name,
      description: formValues.description,
      severity: formValues.severity,
      threat_type: formValues.threat_type,
      diagram_id: formValues.diagram_id || undefined,
      cell_id: formValues.cell_id || undefined,
      score: formValues.score || undefined,
      priority: formValues.priority || undefined,
      mitigated: formValues.mitigated,
      status: formValues.status || undefined,
      issue_url: formValues.issue_url || undefined,
      metadata: this.data.threat?.metadata || [],
    });
  }

  /**
   * Close the dialog without creating or updating a threat
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
