import { Component, DestroyRef, OnDestroy, OnInit, Optional } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { identity, MonoTypeOperatorFunction, Subscription } from 'rxjs';
import { skip } from 'rxjs/operators';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  UrlDropZoneDirective,
} from '@app/shared/imports';

import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { ThreatModelService } from '../../services/threat-model.service';
import { ThreatModelAuthorizationService } from '../../services/threat-model-authorization.service';
import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { CVSSScore, SSVCScore, Threat, ThreatModel } from '../../models/threat-model.model';
import { Diagram } from '../../models/diagram.model';
import type { components } from '@app/generated/api-types';
import { FrameworkModel, ThreatTypeModel } from '../../../../shared/models/framework.model';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: local alias for the ThreatInput API schema component type (pure)
type ApiThreatInput = components['schemas']['ThreatInput'];
import {
  FieldOption,
  getFieldOptions,
  migrateFieldValue,
} from '../../../../shared/utils/field-value-helpers';
import {
  DiagramOption,
  CellOption,
  AssetOption,
} from '../threat-editor-dialog/threat-editor-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../metadata-dialog/metadata-dialog.component';
import {
  InvokeAddonDialogComponent,
  InvokeAddonDialogData,
  InvokeAddonDialogResult,
} from '../invoke-addon-dialog/invoke-addon-dialog.component';
import { CvssCalculatorDialogComponent } from '../cvss-calculator-dialog/cvss-calculator-dialog.component';
import {
  CvssCalculatorDialogResult,
  CvssVersion,
} from '../cvss-calculator-dialog/cvss-calculator-dialog.types';
import { SsvcCalculatorDialogComponent } from '../ssvc-calculator-dialog/ssvc-calculator-dialog.component';
import { SsvcCalculatorDialogResult } from '../ssvc-calculator-dialog/ssvc-calculator-dialog.types';
import { CwePickerDialogComponent } from '../cwe-picker-dialog/cwe-picker-dialog.component';
import { CwePickerDialogResult } from '../cwe-picker-dialog/cwe-picker-dialog.types';
import { FrameworkMappingPickerDialogComponent } from '../framework-mapping-picker-dialog/framework-mapping-picker-dialog.component';
import { FrameworkMappingPickerDialogResult } from '../framework-mapping-picker-dialog/framework-mapping-picker-dialog.types';
import { isValidUrl } from '../../../../shared/utils/url.util';
import { AddonService } from '../../../../core/services/addon.service';
import { Addon } from '../../../../types/addon.types';
import { CweService } from '../../../../shared/services/cwe.service';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';

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
  cwe_id: string[];
  cvss: CVSSScore[];
  ssvc: SSVCScore | null;
}

/**
 * Full-page component for viewing and editing individual threats.
 * Replaces the dialog for editing existing threats from the tm-edit page.
 */
@Component({
  selector: 'app-threat-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoModule,
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    UrlDropZoneDirective,
  ],
  templateUrl: './threat-page.component.html',
  styleUrls: ['./threat-page.component.scss'],
})
// SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: full-page standalone component for viewing and editing an individual threat
export class ThreatPageComponent implements OnInit, OnDestroy {
  private destroyRef: DestroyRef | null = null;

  // Route data
  threatModelId = '';
  threatId = '';
  threatModel: ThreatModel | null = null;
  threat: Threat | null = null;

  // Form
  threatForm: FormGroup;

  // Authorization
  canEdit = false;

  // Localization
  currentLocale = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  // Dropdown options
  diagramOptions: DiagramOption[] = [];
  cellOptions: CellOption[] = [];
  assetOptions: AssetOption[] = [];
  threatTypeOptions: string[] = [];
  private threatTypeModels: ThreatTypeModel[] = [];
  severityOptions: FieldOption[] = [];
  statusOptions: FieldOption[] = [];
  priorityOptions: FieldOption[] = [];

  // True when the threat model has no diagrams at all.
  hasNoDiagramsInThreatModel = false;
  // True when a diagram is selected but it has no cells.
  selectedDiagramHasNoCells = false;
  // True while cells for the selected diagram are being fetched.
  isLoadingCells = false;
  // The most recently loaded full diagram (with cells). Used by
  // _getSelectedCellType to look up a cell's shape for the framework-mapping
  // picker; the threat-model response does not include cells inline.
  private loadedDiagram: Diagram | null = null;

  // Special option for "Not associated" selection
  readonly NOT_ASSOCIATED_VALUE = '';

  // Framework data
  private framework: FrameworkModel | null = null;
  private frameworks: FrameworkModel[] = [];

  // Subscriptions
  private diagramChangeSubscription: Subscription | null = null;

  // Track if save is in progress
  isSaving = false;

  // Addons for threat
  addonsForThreat: Addon[] = [];

  // CWE name lookup
  private cweNameMap = new Map<string, string>();

  // SEM@fda5a8a7189951ee270000543334c785ff38e1f6: inject dependencies and build the reactive threat form with validators (mutates shared state)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private logger: LoggerService,
    private languageService: LanguageService,
    private translocoService: TranslocoService,
    private threatModelService: ThreatModelService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
    private frameworkService: FrameworkService,
    private addonService: AddonService,
    private cweService: CweService,
    @Optional() destroyRef?: DestroyRef,
  ) {
    this.destroyRef = destroyRef ?? null;
    this.threatForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(256)]],
      asset_id: [''],
      description: ['', Validators.maxLength(2048)],
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
      cwe_id: [[]],
      cvss: [[]],
      ssvc: [null],
    });
  }

  /**
   * Helper to conditionally apply takeUntilDestroyed
   * Returns identity operator when destroyRef is not available (tests)
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: return takeUntilDestroyed operator, or identity when destroyRef is absent (pure)
  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }

  // SEM@fda5a8a7189951ee270000543334c785ff38e1f6: resolve route params, load threat, subscribe to auth and language, load frameworks (mutates shared state)
  ngOnInit(): void {
    // Get route parameters
    this.threatModelId = this.route.snapshot.paramMap.get('id') || '';
    this.threatId = this.route.snapshot.paramMap.get('threatId') || '';

    // Get resolved threat model
    this.threatModel = this.route.snapshot.data['threatModel'] as ThreatModel | null;

    if (!this.threatModel) {
      this.logger.error('Threat model not found');
      void this.router.navigate(['/dashboard']);
      return;
    }

    // Find threat in threat model
    this.threat = this.threatModel.threats?.find(t => t.id === this.threatId) || null;

    if (!this.threat) {
      this.logger.warn('Threat not found', {
        threatModelId: this.threatModelId,
        threatId: this.threatId,
      });
      void this.router.navigate(['/tm', this.threatModelId], {
        queryParams: { error: 'threat_not_found' },
      });
      return;
    }

    this.logger.info('Threat page loaded', {
      threatModelId: this.threatModelId,
      threatId: this.threatId,
      threatName: this.threat.name,
    });

    // Subscribe to authorization
    this.authorizationService.canEdit$.pipe(this.untilDestroyed()).subscribe(canEdit => {
      this.canEdit = canEdit;
      this.updateFormEditability();
    });

    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(skip(1), this.untilDestroyed())
      .subscribe(language => {
        this.currentLocale = language.code;
        this.currentDirection = language.rtl ? 'rtl' : 'ltr';
        this.reinitializeDropdownOptions();
      });

    this.languageService.direction$.pipe(this.untilDestroyed()).subscribe(direction => {
      this.currentDirection = direction;
    });

    // Load frameworks and initialize
    this.loadFrameworksAndInitialize();

    // Load addons
    this.loadAddons();

    // Load CWE names for tooltips
    this.cweService
      .loadWeaknesses()
      .pipe(this.untilDestroyed())
      .subscribe(weaknesses => {
        for (const w of weaknesses) {
          this.cweNameMap.set(w.cwe_id, w.name);
        }
      });
  }

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: unsubscribe the diagram change subscription on component teardown (mutates shared state)
  ngOnDestroy(): void {
    this.diagramChangeSubscription?.unsubscribe();
  }

  /**
   * Load frameworks and initialize the form
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch all frameworks, select the matching one, then initialize form and dropdowns (mutates shared state)
  private loadFrameworksAndInitialize(): void {
    this.frameworkService
      .loadAllFrameworks()
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (frameworks: FrameworkModel[]) => {
          this.frameworks = frameworks;
          this.framework =
            frameworks.find(f => f.name === this.threatModel?.threat_model_framework) || null;

          this.logger.debugComponent('ThreatPageComponent', 'Framework loaded', {
            frameworkName: this.framework?.name,
            threatTypeCount: this.framework?.threatTypes?.length,
          });

          // Initialize dropdown options
          this.initializeDropdownOptions();

          // Populate form with threat data
          this.populateForm();

          // Set up diagram change filtering
          this.setupDiagramChangeFiltering();

          // Update form editability
          this.updateFormEditability();
        },
        error: (err: unknown) => {
          this.logger.error('Failed to load frameworks', err);
          // Initialize with defaults even if frameworks fail to load
          this.initializeDropdownOptions();
          this.populateForm();
          this.setupDiagramChangeFiltering();
          this.updateFormEditability();
        },
      });
  }

  /**
   * Initialize all dropdown options
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: initialize all dropdown option lists from threat model and framework data (mutates shared state)
  private initializeDropdownOptions(): void {
    this.initializeDiagramOptions();
    this.initializeCellOptions();
    this.initializeAssetOptions();
    this.initializeThreatTypeOptions();
    this.initializeFieldOptions();
  }

  /**
   * Reinitialize dropdown options (for language changes)
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: rebuild all dropdown options and reload cell list after a locale change (mutates shared state)
  private reinitializeDropdownOptions(): void {
    this.initializeDiagramOptions();
    this.initializeAssetOptions();
    this.initializeThreatTypeOptions();
    this.initializeFieldOptions();
    // Reload cells for the currently-selected diagram so their "not associated"
    // entry picks up the new locale.
    const currentDiagramId = this.threatForm.get('diagram_id')?.value as string;
    this.loadCellsForDiagram(currentDiagramId);
  }

  /**
   * Initialize diagram options for the dropdown
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: build diagram dropdown options from the threat model's diagram list (mutates shared state)
  private initializeDiagramOptions(): void {
    const diagrams = this.threatModel?.diagrams ?? [];
    this.hasNoDiagramsInThreatModel = diagrams.length === 0;

    this.diagramOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        name: this.translocoService.translate('threatEditor.notAssociatedWithDiagram'),
      },
      ...diagrams.map(d => ({ id: d.id, name: d.name })),
    ];
  }

  /**
   * Initialize cell options. Cells are loaded per-selected-diagram (see
   * loadCellsForDiagram); on init we just show the "not associated" entry
   * and let populateForm() trigger the actual fetch.
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: seed the cell dropdown with the not-associated placeholder before diagram selection (mutates shared state)
  private initializeCellOptions(): void {
    this.cellOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        label: this.translocoService.translate('threatEditor.notAssociatedWithCell'),
      },
    ];
  }

  /**
   * Initialize asset options for the dropdown
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: build asset dropdown options from the threat model's sorted asset list (mutates shared state)
  private initializeAssetOptions(): void {
    this.assetOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        name: this.translocoService.translate('threatEditor.notAssociatedWithAsset'),
        type: '',
      },
    ];

    if (this.threatModel?.assets) {
      const sortedAssets = [...this.threatModel.assets].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      this.assetOptions = [
        ...this.assetOptions,
        ...sortedAssets.map(a => ({ id: a.id, name: a.name, type: a.type })),
      ];
    }
  }

  /**
   * Initialize threat type options based on the framework
   */
  // SEM@fc4f8e5e163a8b6aa93df61a4b0cf00196573dc4: build threat type dropdown options from framework, falling back to STRIDE defaults (mutates shared state)
  private initializeThreatTypeOptions(): void {
    if (this.framework?.threatTypes?.length) {
      this.threatTypeModels = this.framework.threatTypes;
      this.threatTypeOptions = this.threatTypeModels.map(tt => tt.name);
    } else {
      const defaultTypes = [
        'Spoofing',
        'Tampering',
        'Repudiation',
        'Information Disclosure',
        'Denial of Service',
        'Elevation of Privilege',
      ];
      this.threatTypeModels = defaultTypes.map(name => ({ name, appliesTo: [] }));
      this.threatTypeOptions = defaultTypes;
    }
  }

  /**
   * Get the shape of the currently selected cell from the loaded diagram.
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: resolve the shape type of the currently selected diagram cell (pure)
  private _getSelectedCellType(): string | null {
    const cellId = this.threatForm.get('cell_id')?.value as string;
    if (!cellId || cellId === this.NOT_ASSOCIATED_VALUE) return null;

    const cell = this.loadedDiagram?.cells?.find(c => c.id === cellId);
    return cell?.shape ?? null;
  }

  /**
   * Initialize field options for severity, status, and priority dropdowns
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: build localized dropdown options for severity, status, and priority fields (mutates shared state)
  private initializeFieldOptions(): void {
    this.severityOptions = getFieldOptions('threatEditor.threatSeverity', this.translocoService);
    this.statusOptions = getFieldOptions('threatEditor.threatStatus', this.translocoService);
    this.priorityOptions = getFieldOptions('threatEditor.threatPriority', this.translocoService);
  }

  /**
   * Load cells for the given diagram and refresh the cell dropdown.
   * - "not associated" / empty: drop cells back to just "not associated".
   * - Real diagram: fetch the full diagram (cells are not included inline
   *   on the threat-model response) and extract its cells.
   *
   * If the currently-selected cell_id is not in the loaded set, it is reset
   * to "not associated" so the dropdown never shows a stale selection.
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: fetch diagram cells and populate the cell dropdown, resetting stale selection (mutates shared state)
  private loadCellsForDiagram(diagramId: string | null | undefined): void {
    const notAssociatedOption: CellOption = {
      id: this.NOT_ASSOCIATED_VALUE,
      label: this.translocoService.translate('threatEditor.notAssociatedWithCell'),
    };

    if (!diagramId || diagramId === this.NOT_ASSOCIATED_VALUE) {
      this.cellOptions = [notAssociatedOption];
      this.selectedDiagramHasNoCells = false;
      this.isLoadingCells = false;
      this.loadedDiagram = null;
      this.resetCellIfStale();
      return;
    }

    this.isLoadingCells = true;
    this.selectedDiagramHasNoCells = false;

    this.threatModelService
      .getDiagramById(this.threatModelId, diagramId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (diagram: Diagram | undefined) => {
          this.isLoadingCells = false;
          this.loadedDiagram = diagram ?? null;
          const diagramForExtract: ThreatModel = {
            ...(this.threatModel as ThreatModel),
            diagrams: diagram ? [diagram] : [],
          };
          const cellData = diagram
            ? this.cellDataExtractionService.extractFromThreatModel(diagramForExtract, diagram.id)
            : { diagrams: [], cells: [] };
          this.cellOptions = [notAssociatedOption, ...cellData.cells];
          this.selectedDiagramHasNoCells = cellData.cells.length === 0;
          this.resetCellIfStale();
        },
        error: (err: unknown) => {
          this.isLoadingCells = false;
          this.logger.error('Failed to load diagram cells', err);
          this.loadedDiagram = null;
          this.cellOptions = [notAssociatedOption];
          this.selectedDiagramHasNoCells = false;
          this.resetCellIfStale();
        },
      });
  }

  /** Reset the cell_id form control if the selected value is not in cellOptions. */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: clear the cell form control when its current value is absent from available options (mutates shared state)
  private resetCellIfStale(): void {
    const currentCellId = this.threatForm.get('cell_id')?.value as string;
    if (currentCellId && currentCellId !== this.NOT_ASSOCIATED_VALUE) {
      const cellExists = this.cellOptions.some(cell => cell.id === currentCellId);
      if (!cellExists) {
        this.threatForm.patchValue({ cell_id: this.NOT_ASSOCIATED_VALUE }, { emitEvent: false });
      }
    }
  }

  /**
   * Set up reactive subscription to reload cell options when diagram selection changes.
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: subscribe to diagram selection changes and reload cell options reactively (mutates shared state)
  private setupDiagramChangeFiltering(): void {
    const diagramControl = this.threatForm.get('diagram_id');
    if (diagramControl) {
      this.diagramChangeSubscription = diagramControl.valueChanges
        .pipe(this.untilDestroyed())
        .subscribe((diagramId: string) => {
          this.loadCellsForDiagram(diagramId);
        });
    }
  }

  /** Resolve asset_id to its threat-model value or "not associated" if missing. */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: resolve the threat's asset id against the threat model, returning sentinel if missing (pure)
  private resolveAssetIdValue(): string {
    const id = this.threat?.asset_id;
    if (!id) return this.NOT_ASSOCIATED_VALUE;
    const exists = this.threatModel?.assets?.some(a => a.id === id);
    return exists ? id : this.NOT_ASSOCIATED_VALUE;
  }

  /** Resolve diagram_id to its threat-model value or "not associated" if missing. */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: resolve the threat's diagram id against the threat model, returning sentinel if missing (pure)
  private resolveDiagramIdValue(): string {
    const id = this.threat?.diagram_id;
    if (!id) return this.NOT_ASSOCIATED_VALUE;
    const exists = this.threatModel?.diagrams?.some(d => d.id === id);
    return exists ? id : this.NOT_ASSOCIATED_VALUE;
  }

  /**
   * Populate form with threat data
   */
  // SEM@6bd0ad493b306df4d08509f291361497b92a7a2d: populate the threat form with migrated field values and trigger initial cell load (mutates shared state)
  private populateForm(): void {
    if (!this.threat) return;

    // Migrate old string values to numeric keys
    const migratedSeverity = migrateFieldValue(
      this.threat.severity,
      'threatEditor.threatSeverity',
      this.translocoService,
    );
    const migratedStatus = migrateFieldValue(
      this.threat.status,
      'threatEditor.threatStatus',
      this.translocoService,
    );
    const migratedPriority = migrateFieldValue(
      this.threat.priority,
      'threatEditor.threatPriority',
      this.translocoService,
    );

    const assetIdValue = this.resolveAssetIdValue();
    const diagramIdValue = this.resolveDiagramIdValue();
    const cellIdValue: string =
      diagramIdValue !== this.NOT_ASSOCIATED_VALUE && this.threat.cell_id
        ? this.threat.cell_id
        : this.NOT_ASSOCIATED_VALUE;

    this.threatForm.patchValue({
      name: this.threat.name,
      asset_id: assetIdValue,
      description: this.threat.description || '',
      severity: migratedSeverity,
      threat_type: this.threat.threat_type || [],
      diagram_id: diagramIdValue,
      cell_id: cellIdValue,
      score: this.threat.score ?? null,
      priority: migratedPriority,
      mitigated: this.threat.mitigated || false,
      status: migratedStatus,
      mitigation: this.threat.mitigation || '',
      issue_uri: this.threat.issue_uri || '',
      include_in_report: this.threat.include_in_report,
      timmy_enabled: this.threat.timmy_enabled ?? true,
      cwe_id: this.threat.cwe_id || [],
      cvss: this.threat.cvss || [],
      ssvc: this.threat.ssvc ?? null,
    });

    // populateForm runs before setupDiagramChangeFiltering wires up the
    // valueChanges subscription, so trigger the initial cells load manually.
    this.loadCellsForDiagram(diagramIdValue);

    // Mark form as pristine after initial population
    this.threatForm.markAsPristine();
  }

  /**
   * Update form editability based on permissions
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: enable or disable the threat form based on edit permission (mutates shared state)
  private updateFormEditability(): void {
    if (this.canEdit) {
      this.threatForm.enable();
    } else {
      this.threatForm.disable();
    }
  }

  /**
   * Navigate back to threat model page
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: route the user back to the parent threat model page
  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  /**
   * Cancel and navigate back
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: navigate back, prompting for confirmation if the form has unsaved changes
  cancel(): void {
    if (this.threatForm.dirty) {
      const confirmed = window.confirm(
        this.translocoService.translate('common.unsavedChangesWarning') ||
          'You have unsaved changes. Are you sure you want to close?',
      );
      if (confirmed) {
        this.navigateBack();
      }
    } else {
      this.navigateBack();
    }
  }

  /**
   * Save the threat
   */
  // SEM@cee4a5ff46c0649755a9808fdf31ce0eea5f0a3e: persist threat edits to the API and navigate back on success (writes DB)
  save(): void {
    if (this.threatForm.invalid || !this.canEdit || this.isSaving) return;

    this.isSaving = true;

    const threatData = this.buildThreatData();

    this.threatModelService
      .updateThreat(this.threatModelId, this.threatId, threatData)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.snackBar.open(
            this.translocoService.translate('common.savedSuccessfully'),
            this.translocoService.translate('common.close'),
            { duration: 3000 },
          );
          this.navigateBack();
        },
        error: err => {
          this.isSaving = false;
          this.logger.error('Failed to save threat', err);
          this.snackBar.open(
            this.translocoService.translate('common.saveFailed'),
            this.translocoService.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  // SEM@d097e9c21706f5e53de376a2a2fdab9581f73717: convert form values to a threat API input payload, nulling sentinel associations (pure)
  private buildThreatData(): Partial<ApiThreatInput> {
    const formValues = this.threatForm.getRawValue() as ThreatFormValues;

    return {
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
      cwe_id: formValues.cwe_id || [],
      cvss: formValues.cvss || [],
    };
  }

  /**
   * Delete the threat
   */
  // SEM@6f6a3c38fe60c48b7e5f30344fd306519e169b05: confirm and delete the current threat via the API, then navigate back (writes DB)
  deleteThreat(): void {
    if (!this.canEdit || !this.threat) return;

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: this.threat.id,
      name: this.threat.name,
      objectType: 'threat',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.threatModelService
          .deleteThreat(this.threatModelId, this.threatId)
          .pipe(this.untilDestroyed())
          .subscribe({
            next: () => {
              this.snackBar.open(
                this.translocoService.translate('common.deletedSuccessfully') ||
                  'Deleted successfully',
                this.translocoService.translate('common.close') || 'Close',
                { duration: 3000 },
              );
              this.navigateBack();
            },
            error: err => {
              this.logger.error('Failed to delete threat', err);
              this.snackBar.open(
                this.translocoService.translate('common.deleteFailed') || 'Delete failed',
                this.translocoService.translate('common.close') || 'Close',
                { duration: 5000 },
              );
            },
          });
      }
    });
  }

  /**
   * Open metadata dialog
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: open the metadata editor dialog and merge returned key-value pairs onto the threat (mutates shared state)
  openMetadataDialog(): void {
    if (!this.threat) return;

    const dialogRef = this.dialog.open(MetadataDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: {
        metadata: this.threat.metadata || [],
        isReadOnly: !this.canEdit,
        entityType: 'threat',
        entityId: this.threatId,
        threatModelId: this.threatModelId,
      } as MetadataDialogData,
    });

    dialogRef
      .afterClosed()
      .subscribe((result: { metadata: { key: string; value: string }[] } | undefined) => {
        if (result && this.threat) {
          this.threat.metadata = result.metadata.map(m => ({ key: m.key, value: m.value }));
        }
      });
  }

  // Issue URI methods
  /**
   * Copy text to clipboard
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: copy a text string to the system clipboard and notify the user
  copyToClipboard(text: string): void {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.snackBar.open(
          this.translocoService.translate('common.copiedToClipboard'),
          this.translocoService.translate('common.close'),
          { duration: 2000 },
        );
      })
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.error('Could not copy text: ', errorMessage);
      });
  }

  /**
   * Handles a URL dropped onto the issue URI container.
   * Sets the issue_uri form control value to the dropped URL.
   */
  // SEM@9cb14cd85aff4520986fafb81c4d07db32adc09d: handle a dropped URL by setting the issue URI form field value (mutates shared state)
  onIssueUriUrlDropped(url: string): void {
    if (!this.canEdit) return;
    this.threatForm.get('issue_uri')?.setValue(url);
    this.threatForm.get('issue_uri')?.markAsDirty();
  }

  /**
   * Check if a string is a valid URL
   */
  // SEM@842e13b899452ede91f10594c85586d003e70d31: validate whether a string is a well-formed URL (pure)
  isValidUrl(url: string): boolean {
    return isValidUrl(url);
  }

  /**
   * Opens URI in new tab
   */
  // SEM@842e13b899452ede91f10594c85586d003e70d31: open a validated URI in a new browser tab
  openUriInNewTab(uri: string): void {
    if (isValidUrl(uri)) {
      window.open(uri, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Remove a CWE ID chip
   */
  // SEM@fda5a8a7189951ee270000543334c785ff38e1f6: look up the display name for a CWE id, falling back to the raw id (pure)
  getCweName(cweId: string): string {
    return this.cweNameMap.get(cweId) || cweId;
  }

  // SEM@8ec8f3c2c7654e2033be230890574aaabedd875a: remove a CWE id from the form's cwe list and mark the form dirty (mutates shared state)
  removeCweId(cweId: string): void {
    const current = this.threatForm.get('cwe_id')?.value as string[];
    const index = current.indexOf(cweId);
    if (index >= 0) {
      const updated = [...current];
      updated.splice(index, 1);
      this.threatForm.patchValue({ cwe_id: updated });
      this.threatForm.markAsDirty();
    }
  }

  /**
   * Open the CWE picker dialog to browse and select a CWE
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: open the CWE picker dialog and append the selected CWE id to the form (mutates shared state)
  openCwePicker(): void {
    const dialogRef = this.dialog.open(CwePickerDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        existingCweIds: this.threatForm.get('cwe_id')?.value as string[],
      },
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: CwePickerDialogResult | undefined) => {
        if (!result) return;
        const current = this.threatForm.get('cwe_id')?.value as string[];
        if (!current.includes(result.cweId)) {
          this.threatForm.patchValue({ cwe_id: [...current, result.cweId] });
          this.threatForm.markAsDirty();
        }
      });
  }

  /**
   * Open the framework mapping picker dialog to select threat types
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: open the framework mapping picker and update the selected threat types on the form (mutates shared state)
  openFrameworkMappingPicker(): void {
    const dialogRef = this.dialog.open(FrameworkMappingPickerDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        availableTypes: this.threatTypeModels,
        selectedTypes: this.threatForm.get('threat_type')?.value as string[],
        cellType: this._getSelectedCellType(),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: FrameworkMappingPickerDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ threat_type: result.selectedTypes });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Remove a threat type chip
   */
  // SEM@cbc9ac25398b066c451e1176a56c8b44a11f3ee4: remove a threat type from the form's threat type list and mark the form dirty (mutates shared state)
  removeThreatType(typeName: string): void {
    const current = this.threatForm.get('threat_type')?.value as string[];
    const updated = current.filter(t => t !== typeName);
    this.threatForm.patchValue({ threat_type: updated });
    this.threatForm.markAsDirty();
  }

  /**
   * Whether the Add CVSS button should be enabled.
   * Disabled when both 3.1 and 4.0 versions already have entries.
   */
  get canAddCvss(): boolean {
    const versions = this._getExistingCvssVersions();
    return !versions.includes('3.1') || !versions.includes('4.0');
  }

  /**
   * Open the CVSS calculator dialog to create a new entry
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: open the CVSS calculator dialog and append the resulting score entry to the form (mutates shared state)
  openCvssCalculator(): void {
    const dialogRef = this.dialog.open(CvssCalculatorDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        existingVersions: this._getExistingCvssVersions(),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: CvssCalculatorDialogResult | undefined) => {
        if (!result) return;
        const current = this.threatForm.get('cvss')?.value as CVSSScore[];
        this.threatForm.patchValue({
          cvss: [...current, result.entry],
        });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Open the CVSS calculator dialog to edit an existing entry
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: open CVSS calculator dialog to edit an existing score entry (mutates shared state)
  editCvssEntry(index: number): void {
    const current = this.threatForm.get('cvss')?.value as CVSSScore[];
    if (index < 0 || index >= current.length) return;

    const dialogRef = this.dialog.open(CvssCalculatorDialogComponent, {
      width: '800px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        existingEntry: current[index],
        existingIndex: index,
      },
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: CvssCalculatorDialogResult | undefined) => {
        if (!result || result.editIndex === undefined) return;
        const updated = [...current];
        updated[result.editIndex] = result.entry;
        this.threatForm.patchValue({ cvss: updated });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Remove a CVSS entry by index
   */
  // SEM@8ec8f3c2c7654e2033be230890574aaabedd875a: delete a CVSS score entry from the threat form by index (mutates shared state)
  removeCvssEntry(index: number): void {
    const current = this.threatForm.get('cvss')?.value as CVSSScore[];
    if (index >= 0 && index < current.length) {
      const updated = [...current];
      updated.splice(index, 1);
      this.threatForm.patchValue({ cvss: updated });
      this.threatForm.markAsDirty();
    }
  }

  // SEM@c19b6f2113fec36784e9fe7b2e6b5968f505490f: list CVSS versions present in the current threat form entries (pure)
  private _getExistingCvssVersions(): CvssVersion[] {
    const entries = (this.threatForm.get('cvss')?.value as CVSSScore[]) ?? [];
    const versions: CvssVersion[] = [];
    if (entries.some(e => e.vector?.startsWith('CVSS:3.'))) versions.push('3.1');
    if (entries.some(e => e.vector?.startsWith('CVSS:4.0'))) versions.push('4.0');
    return versions;
  }

  /**
   * Open the SSVC calculator dialog to create a new entry
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: open SSVC calculator dialog to create a new scoring entry (mutates shared state)
  openSsvcCalculator(): void {
    const dialogRef = this.dialog.open(SsvcCalculatorDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {},
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: SsvcCalculatorDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ ssvc: result.entry });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Open the SSVC calculator dialog to edit the existing entry
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: open SSVC calculator dialog to edit the existing score entry (mutates shared state)
  editSsvcEntry(): void {
    const existing = this.threatForm.get('ssvc')?.value as SSVCScore | null;
    if (!existing) return;

    const dialogRef = this.dialog.open(SsvcCalculatorDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { existingEntry: existing },
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: SsvcCalculatorDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ ssvc: result.entry });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Remove the SSVC entry
   */
  // SEM@cfd296b973ca675f9b4d7a207d27e5be5ed95e32: delete the SSVC score entry from the threat form (mutates shared state)
  removeSsvcEntry(): void {
    this.threatForm.patchValue({ ssvc: null });
    this.threatForm.markAsDirty();
  }

  /**
   * Get CSS class for the SSVC decision chip
   */
  // SEM@cfd296b973ca675f9b4d7a207d27e5be5ed95e32: map an SSVC decision value to its CSS chip class name (pure)
  getSsvcDecisionClass(): string {
    const ssvc = this.threatForm.get('ssvc')?.value as SSVCScore | null;
    if (!ssvc) return '';
    switch (ssvc.decision) {
      case 'Defer':
        return 'ssvc-decision-defer';
      case 'Scheduled':
        return 'ssvc-decision-scheduled';
      case 'Out-of-Cycle':
        return 'ssvc-decision-out-of-cycle';
      case 'Immediate':
        return 'ssvc-decision-immediate';
      default:
        return '';
    }
  }

  /**
   * Load addons from server and filter for threat type
   */
  // SEM@d790b8bd7f1bf990d1aec2d3118089a501ee6f98: fetch threat-applicable addons from the server and store them (mutates shared state)
  private loadAddons(): void {
    this.addonService
      .list()
      .pipe(this.untilDestroyed())
      .subscribe({
        next: response => {
          this.addonsForThreat = (response.addons ?? []).filter(addon =>
            addon.objects?.includes('threat'),
          );
        },
        error: error => {
          this.logger.error('Failed to load addons', error);
          this.addonsForThreat = [];
        },
      });
  }

  /**
   * Gets the icon name for display, handling material-symbols: prefix
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: resolve an addon's display icon name, stripping the material-symbols prefix (pure)
  getAddonIcon(addon: Addon): string {
    if (!addon.icon) {
      return 'extension';
    }
    return addon.icon.replace('material-symbols:', '');
  }

  /**
   * Invoke addon for this threat
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: dispatch an addon against the current threat via an invocation dialog
  invokeAddon(addon: Addon): void {
    if (!this.threatModel || !this.threat) {
      this.logger.error('Cannot invoke addon: no threat model or threat loaded');
      return;
    }

    const dialogData: InvokeAddonDialogData = {
      addon,
      threatModelId: this.threatModelId,
      threatModelName: this.threatModel.name,
      objectType: 'threat',
      isBulk: false,
      objectId: this.threatId,
      objectName: this.threat.name,
    };

    const dialogRef = this.dialog.open(InvokeAddonDialogComponent, {
      width: '550px',
      maxHeight: '90vh',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: InvokeAddonDialogResult | undefined) => {
        if (result?.submitted && result.response) {
          this.logger.info('Addon invoked successfully', {
            addonId: addon.id,
            threatId: this.threatId,
          });
        }
      });
  }
}
