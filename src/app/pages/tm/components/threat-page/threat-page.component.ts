import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subject, Subscription } from 'rxjs';
import { skip, takeUntil } from 'rxjs/operators';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { ThreatModelService } from '../../services/threat-model.service';
import { ThreatModelAuthorizationService } from '../../services/threat-model-authorization.service';
import { CellDataExtractionService } from '../../../../shared/services/cell-data-extraction.service';
import { FrameworkService } from '../../../../shared/services/framework.service';
import { Threat, ThreatModel } from '../../models/threat-model.model';
import { FrameworkModel } from '../../../../shared/models/framework.model';
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
import { AddonService } from '../../../../core/services/addon.service';
import { Addon } from '../../../../types/addon.types';

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
  ],
  templateUrl: './threat-page.component.html',
  styleUrls: ['./threat-page.component.scss'],
})
export class ThreatPageComponent implements OnInit, OnDestroy {
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

  // Issue URI state
  isEditingIssueUri = false;
  initialIssueUriValue = '';

  // Dropdown options
  diagramOptions: DiagramOption[] = [];
  cellOptions: CellOption[] = [];
  assetOptions: AssetOption[] = [];
  threatTypeOptions: string[] = [];
  severityOptions: FieldOption[] = [];
  statusOptions: FieldOption[] = [];
  priorityOptions: FieldOption[] = [];

  // Complete cell data (all cells from all diagrams) for filtering
  private allCellOptions: CellOption[] = [];

  // Special option for "Not associated" selection
  readonly NOT_ASSOCIATED_VALUE = '';

  // Framework data
  private framework: FrameworkModel | null = null;
  private frameworks: FrameworkModel[] = [];

  // Subscriptions
  private destroy$ = new Subject<void>();
  private diagramChangeSubscription: Subscription | null = null;

  // Track if save is in progress
  isSaving = false;

  // Addons for threat
  addonsForThreat: Addon[] = [];

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
    });
  }

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
    this.authorizationService.canEdit$.pipe(takeUntil(this.destroy$)).subscribe(canEdit => {
      this.canEdit = canEdit;
      this.updateFormEditability();
    });

    // Subscribe to language changes
    this.languageService.currentLanguage$
      .pipe(skip(1), takeUntil(this.destroy$))
      .subscribe(language => {
        this.currentLocale = language.code;
        this.currentDirection = language.rtl ? 'rtl' : 'ltr';
        this.reinitializeDropdownOptions();
      });

    this.languageService.direction$.pipe(takeUntil(this.destroy$)).subscribe(direction => {
      this.currentDirection = direction;
    });

    // Load frameworks and initialize
    this.loadFrameworksAndInitialize();

    // Load addons
    this.loadAddons();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.diagramChangeSubscription?.unsubscribe();
  }

  /**
   * Load frameworks and initialize the form
   */
  private loadFrameworksAndInitialize(): void {
    this.frameworkService
      .loadAllFrameworks()
      .pipe(takeUntil(this.destroy$))
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
  private reinitializeDropdownOptions(): void {
    this.initializeDiagramOptions();
    this.initializeCellOptions();
    this.initializeAssetOptions();
    this.initializeThreatTypeOptions();
    this.initializeFieldOptions();
  }

  /**
   * Initialize diagram options for the dropdown
   */
  private initializeDiagramOptions(): void {
    this.diagramOptions = [
      {
        id: this.NOT_ASSOCIATED_VALUE,
        name: this.translocoService.translate('threatEditor.notAssociatedWithDiagram'),
      },
    ];

    if (this.threatModel?.diagrams) {
      const diagrams = this.threatModel.diagrams.map(d => ({
        id: d.id,
        name: d.name,
      }));
      this.diagramOptions = [...this.diagramOptions, ...diagrams];
    }
  }

  /**
   * Initialize cell options for the dropdown
   */
  private initializeCellOptions(): void {
    if (this.threatModel) {
      const cellData = this.cellDataExtractionService.extractFromThreatModel(this.threatModel);
      this.allCellOptions = cellData.cells;
    }
    this.filterCellOptions();
  }

  /**
   * Initialize asset options for the dropdown
   */
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
  private initializeThreatTypeOptions(): void {
    if (this.framework?.threatTypes?.length) {
      this.threatTypeOptions = this.framework.threatTypes.map(tt => tt.name);
    } else {
      // Fallback to default STRIDE threat types
      this.threatTypeOptions = [
        'Spoofing',
        'Tampering',
        'Repudiation',
        'Information Disclosure',
        'Denial of Service',
        'Elevation of Privilege',
      ];
    }
  }

  /**
   * Initialize field options for severity, status, and priority dropdowns
   */
  private initializeFieldOptions(): void {
    this.severityOptions = getFieldOptions('threatEditor.threatSeverity', this.translocoService);
    this.statusOptions = getFieldOptions('threatEditor.threatStatus', this.translocoService);
    this.priorityOptions = getFieldOptions('threatEditor.threatPriority', this.translocoService);
  }

  /**
   * Filter cell options based on the currently selected diagram
   */
  private filterCellOptions(selectedDiagramId?: string): void {
    const diagramId =
      selectedDiagramId ||
      (this.threatForm?.get('diagram_id')?.value as string) ||
      this.threat?.diagram_id;

    const notAssociatedOption: CellOption = {
      id: this.NOT_ASSOCIATED_VALUE,
      label: this.translocoService.translate('threatEditor.notAssociatedWithCell'),
    };

    let filteredCells: CellOption[] = [];

    if (diagramId && diagramId !== this.NOT_ASSOCIATED_VALUE) {
      filteredCells = this.allCellOptions.filter(cell => cell.diagramId === diagramId);
    } else {
      filteredCells = [...this.allCellOptions];
    }

    this.cellOptions = [notAssociatedOption, ...filteredCells];
  }

  /**
   * Set up reactive subscription to filter cell options when diagram selection changes
   */
  private setupDiagramChangeFiltering(): void {
    const diagramControl = this.threatForm.get('diagram_id');
    if (diagramControl) {
      this.diagramChangeSubscription = diagramControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((diagramId: string) => {
          this.filterCellOptions(diagramId);

          // Reset cell_id if it doesn't exist in the new filtered list
          const currentCellId = this.threatForm.get('cell_id')?.value as string;
          if (currentCellId && currentCellId !== this.NOT_ASSOCIATED_VALUE) {
            const cellExists = this.cellOptions.some(cell => cell.id === currentCellId);
            if (!cellExists) {
              this.threatForm.patchValue(
                { cell_id: this.NOT_ASSOCIATED_VALUE },
                { emitEvent: false },
              );
            }
          }
        });
    }
  }

  /**
   * Populate form with threat data
   */
  private populateForm(): void {
    if (!this.threat) return;

    this.initialIssueUriValue = this.threat.issue_uri || '';

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

    // Determine asset_id value
    let assetIdValue = this.NOT_ASSOCIATED_VALUE;
    if (this.threat.asset_id) {
      const assetExists = this.threatModel?.assets?.some(
        asset => asset.id === this.threat!.asset_id,
      );
      if (assetExists) {
        assetIdValue = this.threat.asset_id;
      }
    }

    this.threatForm.patchValue({
      name: this.threat.name,
      asset_id: assetIdValue,
      description: this.threat.description || '',
      severity: migratedSeverity,
      threat_type: this.threat.threat_type || [],
      diagram_id: this.threat.diagram_id || this.NOT_ASSOCIATED_VALUE,
      cell_id: this.threat.cell_id || this.NOT_ASSOCIATED_VALUE,
      score: this.threat.score ?? null,
      priority: migratedPriority,
      mitigated: this.threat.mitigated || false,
      status: migratedStatus,
      mitigation: this.threat.mitigation || '',
      issue_uri: this.initialIssueUriValue,
    });

    // Mark form as pristine after initial population
    this.threatForm.markAsPristine();
  }

  /**
   * Update form editability based on permissions
   */
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
  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  /**
   * Cancel and navigate back
   */
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
  save(): void {
    if (this.threatForm.invalid || !this.canEdit || this.isSaving) return;

    this.isSaving = true;

    const formValues = this.threatForm.getRawValue() as ThreatFormValues;

    const threatData: Partial<Threat> = {
      ...this.threat,
      name: formValues.name,
      description: formValues.description || undefined,
      severity: formValues.severity || undefined,
      threat_type: formValues.threat_type || [],
      asset_id:
        formValues.asset_id && formValues.asset_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.asset_id
          : undefined,
      diagram_id:
        formValues.diagram_id && formValues.diagram_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.diagram_id
          : undefined,
      cell_id:
        formValues.cell_id && formValues.cell_id !== this.NOT_ASSOCIATED_VALUE
          ? formValues.cell_id
          : undefined,
      score: formValues.score ?? undefined,
      priority: formValues.priority || undefined,
      mitigated: formValues.mitigated,
      status: formValues.status || undefined,
      mitigation: formValues.mitigation || undefined,
      issue_uri: formValues.issue_uri || undefined,
    };

    this.threatModelService
      .updateThreat(this.threatModelId, this.threatId, threatData)
      .pipe(takeUntil(this.destroy$))
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

  /**
   * Delete the threat
   */
  deleteThreat(): void {
    if (!this.canEdit || !this.threat) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the threat "${this.threat.name}"? This action cannot be undone.`,
    );

    if (confirmed) {
      this.threatModelService
        .deleteThreat(this.threatModelId, this.threatId)
        .pipe(takeUntil(this.destroy$))
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
  }

  /**
   * Open metadata dialog
   */
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
   * Enter edit mode for issue URI
   */
  editIssueUri(): void {
    this.isEditingIssueUri = true;
    setTimeout(() => {
      const input = document.querySelector(
        'input[formControlName="issue_uri"]',
      ) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 0);
  }

  /**
   * Handle blur event on issue URI input
   */
  onIssueUriBlur(): void {
    const currentValue = (this.threatForm.get('issue_uri')?.value as string) || '';
    this.initialIssueUriValue = currentValue;
    this.isEditingIssueUri = false;
  }

  /**
   * Check if we should show the hyperlink view for issue URI
   */
  shouldShowIssueUriHyperlink(): boolean {
    return !this.isEditingIssueUri && !!this.initialIssueUriValue;
  }

  /**
   * Opens URI in new tab when clicked
   */
  openUriInNewTab(uri: string): void {
    if (uri?.trim()) {
      window.open(uri, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Load addons from server and filter for threat type
   */
  private loadAddons(): void {
    this.addonService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: addons => {
          this.addonsForThreat = addons.filter(addon => addon.objects?.includes('threat'));
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
  getAddonIcon(addon: Addon): string {
    if (!addon.icon) {
      return 'extension';
    }
    return addon.icon.replace('material-symbols:', '');
  }

  /**
   * Invoke addon for this threat
   */
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
      .pipe(takeUntil(this.destroy$))
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
