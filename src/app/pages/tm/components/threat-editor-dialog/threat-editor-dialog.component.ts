import {
  Component,
  Inject,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Threat } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';
import { FrameworkModel } from '../../../../shared/models/framework.model';
import {
  FieldOption,
  getFieldOptions,
  migrateFieldValue,
} from '../../../../shared/utils/field-value-helpers';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';
import {
  AiFeedbackDialogComponent,
  AiFeedbackDialogData,
} from '../../../../shared/components/ai-feedback-dialog/ai-feedback-dialog.component';
import type { ArtifactFeedbackSentiment } from '../../../../core/services/ai-artifact-feedback.service';

/**
 * Interface for threat form values
 */
interface ThreatFormValues {
  name: string;
  description: string;
  severity: string | null;
  threat_type: string[];
  asset_id?: string;
  diagram_id?: string;
  cell_id?: string;
  score?: number;
  priority?: string | null;
  mitigated?: boolean;
  status?: string | null;
  mitigation?: string;
  issue_uri?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
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
  diagramId?: string; // NEW: Which diagram this cell belongs to
}

/**
 * Interface for asset dropdown options
 */
export interface AssetOption {
  id: string;
  name: string;
  type: string;
}

/**
 * Dialog data interface
 */
export interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';
  isReadOnly?: boolean;
  diagramId?: string;
  cellId?: string;
  diagrams?: DiagramOption[];
  cells?: CellOption[];
  assets?: AssetOption[];
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
    TooltipAriaLabelDirective,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './threat-editor-dialog.component.html',
  styleUrls: ['./threat-editor-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [],
})
// SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: dialog for creating, editing, or viewing a threat with form validation and i18n
export class ThreatEditorDialogComponent implements OnInit, OnDestroy, AfterViewInit {
  threatForm: FormGroup;
  dialogTitle: string = '';
  isViewOnly: boolean = false;
  currentLocale: string = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';
  // Dropdown options
  assetOptions: AssetOption[] = [];
  threatTypeOptions: string[] = [];
  severityOptions: FieldOption[] = [];

  // Special option for "Not associated" selection
  readonly NOT_ASSOCIATED_VALUE = '';

  private langSubscription: Subscription | null = null;
  private directionSubscription: Subscription | null = null;

  // Track dialog source for debugging
  dialogSource: string = '';

  // Simplified form tracking
  private _subscriptions: Subscription = new Subscription();
  private _originalThreat: Threat | null = null;

  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: initialize the threat editor reactive form with all field controls (mutates shared state)
  constructor(
    private dialogRef: MatDialogRef<ThreatEditorDialogComponent>,
    private fb: FormBuilder,
    public logger: LoggerService, // Make logger public for debugging
    private languageService: LanguageService,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: ThreatEditorDialogData,
    private dialog: MatDialog,
  ) {
    this.threatForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      asset_id: [''],
      description: ['', Validators.maxLength(500)],
      severity: [null],
      threat_type: [[]],
      diagram_id: [''],
      cell_id: [''],
      score: [null],
      priority: [null],
      mitigated: [false],
      status: [null],
      mitigation: ['', Validators.maxLength(1024)],
      issue_uri: [''],
      include_in_report: [true],
      timmy_enabled: [true],
    });
  }

  /**
   * Initialize threat type options based on the framework and optional shape type
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: populate threat-type dropdown from the active framework, filtered by shape type (mutates shared state)
  private initializeThreatTypeOptions(): void {
    this.threatTypeOptions = [];

    if (this.data.framework && this.data.framework.threatTypes.length > 0) {
      let applicableThreatTypes = this.data.framework.threatTypes;

      // Filter threat types by shape type if provided
      if (this.data.shapeType) {
        const filteredTypes = this.data.framework.threatTypes.filter(tt =>
          tt.appliesTo.includes(this.data.shapeType!),
        );

        this.logger.debugComponent('ThreatEditorDialog', 'Filtering threat types by shape type', {
          framework: this.data.framework.name,
          shapeType: this.data.shapeType,
          filteredThreatTypes: filteredTypes.map(tt => tt.name),
          allThreatTypes: this.data.framework.threatTypes.map(tt => tt.name),
        });

        // Only use filtered types if we found some matches, otherwise use all types
        if (filteredTypes.length > 0) {
          applicableThreatTypes = filteredTypes;
        } else {
          this.logger.debugComponent(
            'ThreatEditorDialog',
            'No threat types match shape type, using all framework threat types',
            {
              shapeType: this.data.shapeType,
            },
          );
        }
      }

      this.threatTypeOptions = applicableThreatTypes.map(tt => tt.name);

      this.logger.debugComponent(
        'ThreatEditorDialog',
        'Threat type options initialized from framework',
        {
          framework: this.data.framework.name,
          shapeType: this.data.shapeType || 'none',
          threatTypes: this.threatTypeOptions,
        },
      );
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
   * Initialize field options for severity dropdown
   */
  // SEM@7f8b7a5dd18ae9c991ae27e35e7c953ec2a7d982: populate the severity dropdown options from i18n translations (mutates shared state)
  private initializeFieldOptions(): void {
    this.severityOptions = getFieldOptions('threatEditor.threatSeverity', this.translocoService);
  }

  /**
   * Initialize asset options for the dropdown
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: build the asset dropdown list with current asset first and remainder sorted (mutates shared state)
  private initializeAssetOptions(): void {
    // Initialize with "Not associated" option
    this.assetOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        name: this.translocoService.translate('threatEditor.notAssociatedWithAsset'),
        type: '',
      },
    ];

    // If there's a current asset ID, find it and add as second option
    let currentAssetOption: AssetOption | null = null;
    const currentAssetId = this.data.threat?.asset_id;

    if (currentAssetId) {
      // Look for current asset in provided assets
      if (this.data.assets && this.data.assets.length > 0) {
        currentAssetOption = this.data.assets.find(asset => asset.id === currentAssetId) || null;
      }

      // If found, add current asset as second option
      if (currentAssetOption) {
        this.assetOptions.push(currentAssetOption);
      }
    }

    // Add remaining assets from input (excluding the current one already added), sorted alphabetically by name
    if (this.data.assets && this.data.assets.length > 0) {
      const remainingAssets = this.data.assets
        .filter(asset => asset.id !== currentAssetId)
        .sort((a, b) => a.name.localeCompare(b.name));
      this.assetOptions = [...this.assetOptions, ...remainingAssets];
    }

    this.logger.debugComponent('ThreatEditorDialog', 'Asset options initialized:', {
      currentAssetId: currentAssetId,
      optionsCount: this.assetOptions.length,
      firstOption: this.assetOptions[0]?.name,
      secondOption: this.assetOptions[1]?.name,
    });
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: bootstrap dialog mode, load translations, wire language subscriptions, and populate form (mutates shared state)
  ngOnInit(): void {
    // Set dialog mode - use isReadOnly if provided, otherwise check mode
    this.isViewOnly = this.data.isReadOnly || this.data.mode === 'view';

    // Log initialization context
    const openedFrom = new Error().stack?.includes('dfd.component') ? 'DFD Editor' : 'TM Edit';
    this.logger.info('Threat editor dialog opened', {
      mode: this.data.mode,
      threatModelId: this.data.threatModelId,
      openedFrom,
    });

    // Log detailed initialization data for debugging
    this.logger.debugComponent('ThreatEditorDialog', 'Detailed initialization data:', {
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
    this.logger.debugComponent('ThreatEditorDialog', 'Current language:', currentLang);

    this._loadTranslationsAndInitialize(currentLang);

    this._initializeDialogTitleAndDefaults();
    this._initializeFormValues();
    this._populateFormFromThreat();

    // Force translations to be applied
    this.forceTranslationUpdate();

    // Subscribe to language changes (skip first emission since we already initialized)
    this.langSubscription = this.languageService.currentLanguage$
      .pipe(skip(1))
      .subscribe(language => {
        this.currentLocale = language.code;
        this.currentDirection = language.rtl ? 'rtl' : 'ltr';
        // Force change detection to update the date format and translations
        this.dialogRef.updateSize();
        this.forceTranslationUpdate();

        // Reinitialize dropdown options when language changes
        this._initializeAllDropdownOptions();
      });

    // Also subscribe to direction changes
    this.directionSubscription = this.languageService.direction$.subscribe(direction => {
      this.currentDirection = direction;
      // Force translation update when direction changes
      this.forceTranslationUpdate();
    });

    // Initialize enhanced save behavior
    this.initializeEnhancedSaveBehavior();
  }

  /**
   * Sets the dialog title and initializes default threat data for create mode.
   */
  // SEM@d47739de2acf5e281b60be208f2dfa034ea03423: set dialog title and create a default threat stub when mode is create (mutates shared state)
  private _initializeDialogTitleAndDefaults(): void {
    if (this.data.mode === 'create') {
      this.dialogTitle = 'threatEditor.createNewThreat';

      if (!this.data.threat) {
        this.data.threat = {
          threat_model_id: this.data.threatModelId,
          name: '',
          description: '',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          severity: 'high',
          threat_type: [],
          diagram_id: this.data.diagramId || '',
          cell_id: this.data.cellId || '',
          score: 10.0,
          priority: 'high',
          mitigated: false,
          status: 'open',
          mitigation: '',
          issue_uri: '',
          metadata: [],
        } as unknown as Threat;
      }
    } else if (this.data.mode === 'edit') {
      this.dialogTitle = 'common.editThreat';
    } else {
      this.dialogTitle = 'common.viewThreat';
    }
  }

  /**
   * Sets the form to default empty/null values.
   */
  // SEM@a5d47afbe751f0027d056ced66949574212e626e: reset all form controls to blank or default values (mutates shared state)
  private _initializeFormValues(): void {
    this.threatForm.patchValue({
      name: '',
      asset_id: this.NOT_ASSOCIATED_VALUE,
      description: '',
      severity: null,
      threat_type: [],
      diagram_id: this.data.diagramId || this.NOT_ASSOCIATED_VALUE,
      cell_id: this.data.cellId || this.NOT_ASSOCIATED_VALUE,
      score: null,
      priority: null,
      mitigated: false,
      status: null,
      mitigation: '',
      issue_uri: '',
      include_in_report: true,
      timmy_enabled: true,
    });
  }

  /**
   * Populates the form from existing threat data (for edit/view modes).
   */
  // SEM@bc74129e94a2260f653a8dcd396dd786eec59d08: patch form controls from existing threat data, migrating legacy field values (mutates shared state)
  private _populateFormFromThreat(): void {
    if (!this.data.threat) return;

    this.logger.debugComponent(
      'ThreatEditorDialog',
      'Populating threat editor form with threat data',
      {
        threatId: this.data.threat.id,
        name: this.data.threat.name,
        description: this.data.threat.description,
        severity: this.data.threat.severity,
        threat_type: this.data.threat.threat_type,
        diagram_id: this.data.threat.diagram_id,
        cell_id: this.data.threat.cell_id,
        score: this.data.threat.score,
        priority: this.data.threat.priority,
        mitigated: this.data.threat.mitigated,
        status: this.data.threat.status,
        mitigation: this.data.threat.mitigation,
        issue_uri: this.data.threat.issue_uri,
      },
    );

    let assetIdValue = this.NOT_ASSOCIATED_VALUE;
    if (this.data.threat.asset_id) {
      const assetExists = this.data.assets?.some(asset => asset.id === this.data.threat!.asset_id);
      if (assetExists) {
        assetIdValue = this.data.threat.asset_id;
      }
    }

    const migratedSeverity = migrateFieldValue(
      this.data.threat.severity,
      'threatEditor.threatSeverity',
      this.translocoService,
    );
    const migratedStatus = migrateFieldValue(
      this.data.threat.status,
      'threatEditor.threatStatus',
      this.translocoService,
    );
    const migratedPriority = migrateFieldValue(
      this.data.threat.priority,
      'threatEditor.threatPriority',
      this.translocoService,
    );

    this.logger.debugComponent('ThreatEditorDialog', 'Migrated field values', {
      originalSeverity: this.data.threat.severity,
      migratedSeverity,
      originalStatus: this.data.threat.status,
      migratedStatus,
      originalPriority: this.data.threat.priority,
      migratedPriority,
    });

    this.threatForm.patchValue({
      name: this.data.threat.name,
      asset_id: assetIdValue,
      description: this.data.threat.description || '',
      severity: migratedSeverity,
      threat_type: this.data.threat.threat_type || [],
      diagram_id: this.data.threat.diagram_id || this.NOT_ASSOCIATED_VALUE,
      cell_id: this.data.threat.cell_id || this.NOT_ASSOCIATED_VALUE,
      score: this.data.threat.score || null,
      priority: migratedPriority,
      mitigated: this.data.threat.mitigated || false,
      status: migratedStatus,
      mitigation: this.data.threat.mitigation || '',
      issue_uri: this.data.threat.issue_uri || '',
      include_in_report: this.data.threat.include_in_report,
      timmy_enabled: this.data.threat.timmy_enabled ?? true,
    });

    this.logger.debugComponent('ThreatEditorDialog', 'Form values after patching', {
      formValues: this.threatForm.value as ThreatFormValues,
    });

    if (this.isViewOnly) {
      this.threatForm.disable();
    }
  }

  /**
   * Loads translations (English first, then current language) and initializes all dropdown options.
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: load English translations then current-language translations before initializing dropdowns
  private _loadTranslationsAndInitialize(currentLang: string): void {
    this.translocoService.load('en-US').subscribe({
      next: () => {
        this.logger.debugComponent(
          'ThreatEditorDialog',
          'English translations loaded successfully',
        );

        if (currentLang !== 'en-US') {
          this._loadLanguageAndInitialize(currentLang);
        } else {
          this._initializeAllDropdownOptions();
          this._refreshDialogSize();
        }
      },
      error: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('Failed to load English translations', errorMessage);
        this._initializeAllDropdownOptions();
      },
    });
  }

  /**
   * Loads a non-English language translation and initializes dropdown options.
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: load translations for a locale and initialize all dropdown options (mutates shared state)
  private _loadLanguageAndInitialize(lang: string): void {
    this.translocoService.load(lang).subscribe({
      next: () => {
        this.logger.debugComponent(
          'ThreatEditorDialog',
          'Translations loaded successfully for language: ' + lang,
        );
        this._initializeAllDropdownOptions();
        this._refreshDialogSize();
      },
      error: (err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('Failed to load translations for language: ' + lang, errorMessage);
        this.translocoService.setActiveLang('en-US');
        this._initializeAllDropdownOptions();
      },
    });
  }

  /**
   * Initializes all dropdown option lists from translations.
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: initialize all dropdown option lists from current locale translations (mutates shared state)
  private _initializeAllDropdownOptions(): void {
    this.initializeAssetOptions();
    this.initializeThreatTypeOptions();
    this.initializeFieldOptions();
  }

  /**
   * Forces a dialog size update to refresh translations in the UI.
   */
  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: trigger a dialog size update to force a UI translation refresh (mutates shared state)
  private _refreshDialogSize(): void {
    setTimeout(() => {
      this.dialogRef.updateSize();
      this.logger.debugComponent('ThreatEditorDialog', 'Dialog size updated to force refresh');
    }, 100);
  }

  /**
   * Initialize enhanced save behavior services
   */
  // SEM@0b80acf835f1ad7f9fc0e5cbaf2bc4f125615152: snapshot the original threat for change detection on save (mutates shared state)
  private initializeEnhancedSaveBehavior(): void {
    // Store original threat for change detection
    this._originalThreat = this.data.threat ? { ...this.data.threat } : null;
  }

  /**
   * After view initialization, force translation update
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: force translation update and log form field state after view initialization (mutates shared state)
  ngAfterViewInit(): void {
    // Force translation update after view is initialized
    this.forceTranslationUpdate();

    // Add diagnostic check for Angular Material form field initialization
    setTimeout(() => {
      // Check if the form fields are properly initialized
      const formFields = document.querySelectorAll('.mat-form-field');
      const labels = document.querySelectorAll('.mat-form-field-label');

      this.logger.debugComponent(
        'ThreatEditorDialog',
        'Form field initialization in ngAfterViewInit:',
        {
          source: this.dialogSource,
          formFieldsCount: formFields.length,
          labelsCount: labels.length,
          // Check if form field is properly initialized with Angular Material classes
          formFieldClasses: Array.from(formFields).map(field => {
            return {
              classList: Array.from(field.classList),
              hasLabel: !!field.querySelector('.mat-form-field-label'),
              labelText:
                field.querySelector('.mat-form-field-label')?.textContent?.trim() ||
                'No label text',
            };
          }),
        },
      );
    }, 150);
  }

  /**
   * Force translation update by triggering a dialog resize
   * This helps ensure translations are properly applied
   */
  // SEM@f156eddc40615f5c90ac9f12cf77eb8a00cb3f22: re-translate all dialog i18n keys and resize dialog to flush stale translations (mutates shared state)
  private forceTranslationUpdate(): void {
    // Use setTimeout to ensure this runs after Angular's change detection cycle
    setTimeout(() => {
      // Update dialog size to force a refresh
      this.dialogRef.updateSize();

      // Manually trigger translation update for all keys
      const keys = [
        'common.threatName',
        'common.objectTypes.asset',
        'common.threatDescription',
        'common.threatType',
        'common.severity',
        'threatEditor.notAssociatedWithAsset',
        'common.cancel',
        'common.save',
        'common.close',
      ];

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
  // SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: resolve an i18n key and reload the locale if the translation is missing (mutates shared state)
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
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Error translating key ${key}: ${errorMessage}`);
    }
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: unsubscribe all active subscriptions on component teardown (mutates shared state)
  ngOnDestroy(): void {
    if (this.langSubscription) {
      this.langSubscription.unsubscribe();
      this.langSubscription = null;
    }

    if (this.directionSubscription) {
      this.directionSubscription.unsubscribe();
      this.directionSubscription = null;
    }

    // Clean up subscriptions
    this._subscriptions.unsubscribe();
  }

  /**
   * Get validation rules for threat fields
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: return field validator functions for name, description, and threat type (pure)
  private getThreatValidationRules(): Record<string, unknown[]> {
    return {
      name: [(value: string) => (value && value.trim().length > 0 ? null : { required: true })],
      description: [
        (value: string) =>
          value && value.length <= 500
            ? null
            : { maxLength: { max: 500, actual: value?.length || 0 } },
      ],
      threat_type: [
        (value: string) => (value && value.trim().length > 0 ? null : { required: true }),
      ],
    };
  }

  /**
   * Close the dialog with the threat data
   */
  // SEM@a5d47afbe751f0027d056ced66949574212e626e: validate and close the dialog with the threat form payload
  onSubmit(): void {
    if (this.threatForm.invalid) {
      return;
    }

    const formValues = this.threatForm.getRawValue() as ThreatFormValues;

    // Return the form values to be used to create or update the threat.
    // Send explicit empty/null values for cleared fields so the server
    // can distinguish "clear this field" from "leave unchanged".
    this.dialogRef.close({
      name: formValues.name,
      description: formValues.description || '',
      severity: formValues.severity || '',
      threat_type: formValues.threat_type || [],
      asset_id:
        formValues.asset_id && formValues.asset_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.asset_id
          : null,
      diagram_id:
        formValues.diagram_id && formValues.diagram_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.diagram_id
          : null,
      cell_id:
        formValues.cell_id && formValues.cell_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.cell_id
          : null,
      score: formValues.score ?? undefined, // see ericfitz/tmi#208 for server-side clearing
      priority: formValues.priority || '',
      mitigated: formValues.mitigated,
      status: formValues.status || '',
      mitigation: formValues.mitigation || '',
      issue_uri: formValues.issue_uri || '',
      include_in_report: formValues.include_in_report,
      timmy_enabled: formValues.timmy_enabled,
      metadata: this.data.threat?.metadata || [],
    });
  }

  /**
   * Close the dialog without creating or updating a threat
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: close the dialog without saving threat changes
  onCancel(): void {
    this.dialogRef.close();
  }

  /**
   * True when this threat was attributed to an automation/service account by
   * the server. Drives whether the feedback affordance is shown.
   */
  get isAutoGenerated(): boolean {
    return this.data.threat?.auto_generated === true;
  }

  /**
   * Open the AI artifact feedback dialog pre-seeded with the given sentiment.
   */
  // SEM@77253a3829b48ef313d35aaf87fe4e4f489d18b2: open the AI artifact feedback dialog pre-seeded with the given sentiment
  openFeedback(sentiment: ArtifactFeedbackSentiment): void {
    if (!this.data.threat) return;
    this.dialog.open<AiFeedbackDialogComponent, AiFeedbackDialogData>(AiFeedbackDialogComponent, {
      width: '520px',
      data: {
        threatModelId: this.data.threatModelId,
        targetType: 'threat',
        targetId: this.data.threat.id,
        initialSentiment: sentiment,
      },
    });
  }
}
