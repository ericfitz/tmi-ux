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
import { FrameworkModel } from '../../../../shared/models/framework.model';

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
  framework?: FrameworkModel;
  shapeType?: string;
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
  threatTypeOptions: string[] = [];

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
      threat_type: ['', Validators.required],
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
    const currentValue = (this.threatForm.get('issue_url')?.value as string) || '';
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
   * Initialize threat type options based on the framework and optional shape type
   */
  private initializeThreatTypeOptions(): void {
    this.threatTypeOptions = [];

    if (this.data.framework && this.data.framework.threatTypes.length > 0) {
      let applicableThreatTypes = this.data.framework.threatTypes;

      // Filter threat types by shape type if provided
      if (this.data.shapeType) {
        applicableThreatTypes = this.data.framework.threatTypes.filter(tt =>
          tt.appliesTo.includes(this.data.shapeType!),
        );

        this.logger.info('Filtering threat types by shape type', {
          framework: this.data.framework.name,
          shapeType: this.data.shapeType,
          filteredThreatTypes: applicableThreatTypes.map(tt => tt.name),
          allThreatTypes: this.data.framework.threatTypes.map(tt => tt.name),
        });
      }

      this.threatTypeOptions = applicableThreatTypes.map(tt => tt.name);

      this.logger.info('Threat type options initialized from framework', {
        framework: this.data.framework.name,
        shapeType: this.data.shapeType || 'none',
        threatTypes: this.threatTypeOptions,
      });
    } else {
      // Fallback to default threat types if no framework provided
      this.threatTypeOptions = [
        'Spoofing',
        'Tampering',
        'Repudiation',
        'Information Disclosure',
        'Denial of Service',
        'Elevation of Privilege',
      ];
      this.logger.warn('No framework provided, using default STRIDE threat types');
    }
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
              this.initializeThreatTypeOptions();

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
          this.initializeThreatTypeOptions();

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
        this.initializeThreatTypeOptions();
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
          threat_type:
            this.threatTypeOptions.length > 0
              ? this.threatTypeOptions[0]
              : 'Information Disclosure',
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

    // Use first threat type from framework, or fallback to a default
    const defaultThreatType =
      this.threatTypeOptions.length > 0 ? this.threatTypeOptions[0] : 'Information Disclosure';

    this.threatForm.patchValue({
      name: '',
      description: '',
      severity: 'High',
      threat_type: defaultThreatType,
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
      this.initializeThreatTypeOptions();
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

      // Manually trigger translation update for all keys
      const keys = [
        'threatEditor.threatName',
        'threatEditor.threatDescription',
        'threatEditor.threatType',
        'common.severity',
        'common.score',
        'common.priority',
        'common.issueUrl',
        'common.status',
        'common.mitigated',
        'common.diagramId',
        'common.cellId',
        'threatEditor.notAssociatedWithDiagram',
        'threatEditor.notAssociatedWithCell',
        'common.cancel',
        'common.save',
        'common.close',
      ];

      // Log the problematic labels that are not showing
      this.logger.info('Checking translations for problematic labels:', {
        source: this.dialogSource,
        threatName: this.translocoService.translate('threatEditor.threatName'),
        threatDescription: this.translocoService.translate('threatEditor.threatDescription'),
        priority: this.translocoService.translate('common.priority'),
        issueUrl: this.translocoService.translate('common.issueUrl'),
        diagramId: this.translocoService.translate('common.diagramId'),
        cellId: this.translocoService.translate('common.cellId'),
      });

      // Diagnostic check for form field classes
      setTimeout(() => {
        document.querySelectorAll('.mat-form-field');
        document.querySelectorAll('.mat-form-field.mat-form-field-should-float');
      }, 50);

      // Additional diagnostics for Angular Material form field classes
      setTimeout(() => {
        document.querySelectorAll('.mat-form-field-appearance-outline');
        document.querySelectorAll('.mat-focused');
        document.querySelectorAll('.mat-form-field-label');
        document.querySelectorAll('.mat-form-field-empty');
      }, 100);

      // Force translation of each key
      keys.forEach(key => {
        this.translateKey(key);
      });

      // Add a second delayed update to ensure translations are applied
      setTimeout(() => {
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
            this.logger.debugComponent(
              'ThreatEditorDialog',
              `Retry translation for ${key}: ${retryTranslation}`,
            );
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
