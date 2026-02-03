import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  DEFAULT_SUBTABLE_PAGE_SIZE,
  SUBTABLE_PAGE_SIZE_OPTIONS,
} from '@app/types/pagination.types';
import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ActivatedRoute, Router } from '@angular/router';
import { ThreatModelAuthorizationService } from './services/threat-model-authorization.service';
import { AuthorizationPrepareService } from './services/providers/authorization-prepare.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged } from 'rxjs/operators';
import { LanguageService } from '../../i18n/language.service';
import { LoggerService } from '../../core/services/logger.service';
import { SvgCacheService } from './services/svg-cache.service';
import { ApiService } from '../../core/services/api.service';
import { AddonService } from '../../core/services/addon.service';
import { Addon, AddonObjectType } from '../../types/addon.types';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { CreateDiagramDialogComponent } from './components/create-diagram-dialog/create-diagram-dialog.component';
import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
} from './components/document-editor-dialog/document-editor-dialog.component';
import {
  RepositoryEditorDialogComponent,
  RepositoryEditorDialogData,
} from './components/repository-editor-dialog/repository-editor-dialog.component';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
  NoteEditorResult,
} from './components/note-editor-dialog/note-editor-dialog.component';
import {
  AssetEditorDialogComponent,
  AssetEditorDialogData,
} from './components/asset-editor-dialog/asset-editor-dialog.component';
import {
  PermissionsDialogComponent,
  PermissionsDialogData,
} from './components/permissions-dialog/permissions-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from './components/metadata-dialog/metadata-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from './components/threat-editor-dialog/threat-editor-dialog.component';
import {
  InvokeAddonDialogComponent,
  InvokeAddonDialogData,
  InvokeAddonDialogResult,
} from './components/invoke-addon-dialog/invoke-addon-dialog.component';
import { Diagram, DIAGRAMS_BY_ID } from './models/diagram.model';
import {
  Authorization,
  Asset,
  Document,
  Metadata,
  Note,
  Repository,
  Threat,
  ThreatModel,
  User,
} from './models/threat-model.model';
import { ThreatModelService } from './services/threat-model.service';
import { ThreatModelReportService } from './services/threat-model-report.service';
import { FrameworkService } from '../../shared/services/framework.service';
import { CellDataExtractionService } from '../../shared/services/cell-data-extraction.service';
import { FrameworkModel } from '../../shared/models/framework.model';
import { FieldOption, getFieldOptions } from '../../shared/utils/field-value-helpers';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';

// Define form value interface
interface ThreatModelFormValues {
  name: string;
  description: string;
  threat_model_framework: string;
  issue_uri?: string;
  status?: string | null;
}

// Define document form result interface
interface DocumentFormResult {
  name: string;
  uri: string;
  description?: string;
}

// Define repository form result interface
interface RepositoryFormResult {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
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
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatGridListModule,
    MatTableModule,
    MatSortModule,
    TranslocoModule,
  ],
  templateUrl: './tm-edit.component.html',
  styleUrls: ['./tm-edit.component.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class TmEditComponent implements OnInit, OnDestroy, AfterViewInit {
  threatModel: ThreatModel | undefined;
  threatModelForm: FormGroup;
  isNewThreatModel = false;
  private _diagrams: Diagram[] = [];
  currentLocale: string = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';
  isEditingIssueUri = false;
  initialIssueUriValue = '';
  frameworks: FrameworkModel[] = [];

  // Permission properties
  canEdit = false;
  canManagePermissions = false;

  // Computed SVG properties to prevent infinite loops
  diagramSvgValidation = new Map<string, boolean>();
  diagramSvgDataUrls = new Map<string, string>();

  // Hover preview state
  hoveredDiagramId: string | null = null;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  // Status dropdown options
  statusOptions: FieldOption[] = [];

  // Addon cache - filtered lists by object type
  addonsForThreatModel: Addon[] = [];
  addonsForAsset: Addon[] = [];
  addonsForThreat: Addon[] = [];
  addonsForDiagram: Addon[] = [];
  addonsForNote: Addon[] = [];
  addonsForDocument: Addon[] = [];
  addonsForRepository: Addon[] = [];

  // Addon row context for row-level invocations
  private currentAddonRowContext: {
    type: AddonObjectType;
    id: string;
    name: string;
  } | null = null;

  // Table data sources
  assetsDataSource = new MatTableDataSource<Asset>([]);
  threatsDataSource = new MatTableDataSource<Threat>([]);
  diagramsDataSource = new MatTableDataSource<Diagram>([]);
  notesDataSource = new MatTableDataSource<Note>([]);
  documentsDataSource = new MatTableDataSource<Document>([]);
  repositoriesDataSource = new MatTableDataSource<Repository>([]);

  // Table sort ViewChildren
  @ViewChild('assetsSort') assetsSort!: MatSort;
  @ViewChild('threatsSort') threatsSort!: MatSort;
  @ViewChild('diagramsSort') diagramsSort!: MatSort;
  @ViewChild('notesSort') notesSort!: MatSort;
  @ViewChild('documentsSort') documentsSort!: MatSort;
  @ViewChild('repositoriesSort') repositoriesSort!: MatSort;

  // Table paginator ViewChildren
  @ViewChild('assetsPaginator') assetsPaginator!: MatPaginator;
  @ViewChild('threatsPaginator') threatsPaginator!: MatPaginator;
  @ViewChild('diagramsPaginator') diagramsPaginator!: MatPaginator;
  @ViewChild('notesPaginator') notesPaginator!: MatPaginator;
  @ViewChild('documentsPaginator') documentsPaginator!: MatPaginator;
  @ViewChild('repositoriesPaginator') repositoriesPaginator!: MatPaginator;

  // Pagination state for sub-tables
  assetsPageIndex = 0;
  assetsPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalAssets = 0;

  threatsPageIndex = 0;
  threatsPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalThreats = 0;

  diagramsPageIndex = 0;
  diagramsPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalDiagrams = 0;

  notesPageIndex = 0;
  notesPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalNotes = 0;

  documentsPageIndex = 0;
  documentsPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalDocuments = 0;

  repositoriesPageIndex = 0;
  repositoriesPageSize = DEFAULT_SUBTABLE_PAGE_SIZE;
  totalRepositories = 0;

  readonly subtablePageSizeOptions = SUBTABLE_PAGE_SIZE_OPTIONS;

  // Displayed columns for each table
  assetsDisplayedColumns: string[] = [
    'icon',
    'name',
    'description',
    'criticality',
    'sensitivity',
    'classification',
    'actions',
  ];
  threatsDisplayedColumns: string[] = [
    'icon',
    'name',
    'description',
    'status',
    'severity',
    'hyperlink',
    'actions',
  ];
  diagramsDisplayedColumns: string[] = ['icon', 'name', 'description', 'thumbnail', 'actions'];
  notesDisplayedColumns: string[] = ['icon', 'name', 'description', 'actions'];
  documentsDisplayedColumns: string[] = ['icon', 'name', 'description', 'hyperlink', 'actions'];
  repositoriesDisplayedColumns: string[] = ['icon', 'name', 'description', 'hyperlink', 'actions'];

  get diagrams(): Diagram[] {
    return this._diagrams;
  }

  set diagrams(value: Diagram[]) {
    this._diagrams = value;
    this.diagramsDataSource.data = value;
    this.computeDiagramSvgData();
  }

  // Enhanced save behavior properties
  // Simplified form tracking
  private _subscriptions = new Subscription();
  private _autoSaveSubject = new Subject<void>();
  private _isLoadingInitialData = false;
  private _originalFormValues?: ThreatModelFormValues;
  private _isSaving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private threatModelReportService: ThreatModelReportService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private languageService: LanguageService,
    private logger: LoggerService,
    private svgCacheService: SvgCacheService,
    private apiService: ApiService,
    private transloco: TranslocoService,
    private frameworkService: FrameworkService,
    private authorizationService: ThreatModelAuthorizationService,
    private cellDataExtractionService: CellDataExtractionService,
    private authorizationPrepare: AuthorizationPrepareService,
    private cdr: ChangeDetectorRef,
    private addonService: AddonService,
    private snackBar: MatSnackBar,
  ) {
    this.threatModelForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      threat_model_framework: ['STRIDE', Validators.required],
      issue_uri: [''],
      status: [null],
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
   * Hardcoded mapping from old string values to new numeric keys
   * Used for migrating legacy data
   * Mapping: Critical=0, High=1, Medium=2, Low=3, Informational=4, Unknown=5
   */
  private readonly severityMap: Record<string, string> = {
    Critical: '0',
    High: '1',
    Medium: '2',
    Low: '3',
    Informational: '4',
    Info: '4',
    Unknown: '5',
    None: '5',
    critical: '0',
    high: '1',
    medium: '2',
    low: '3',
    informational: '4',
    info: '4',
    unknown: '5',
    none: '5',
  };

  private readonly statusMap: Record<string, string> = {
    Open: '0',
    Confirmed: '1',
    'Mitigation Planned': '2',
    'Mitigation In Progress': '3',
    'Verification Pending': '4',
    Resolved: '5',
    Accepted: '6',
    'False Positive': '7',
    Deferred: '8',
    Closed: '9',
    // Lowercase variants
    open: '0',
    confirmed: '1',
    'mitigation planned': '2',
    'mitigation in progress': '3',
    'verification pending': '4',
    resolved: '5',
    accepted: '6',
    'false positive': '7',
    deferred: '8',
    closed: '9',
  };

  private readonly priorityMap: Record<string, string> = {
    'Immediate (P0)': '0',
    'High (P1)': '1',
    'Medium (P2)': '2',
    'Low (P3)': '3',
    'Deferred (P4)': '4',
    Immediate: '0',
    High: '1',
    Medium: '2',
    Low: '3',
    Deferred: '4',
    immediate: '0',
    high: '1',
    medium: '2',
    low: '3',
    deferred: '4',
  };

  /**
   * Migrates old field values to new numeric keys for a single threat
   * @param threat The threat to migrate
   * @returns Migrated threat
   */
  private migrateThreatFieldValues(threat: Threat): Threat {
    const migratedThreat = { ...threat };

    // Migrate severity
    if (
      migratedThreat.severity &&
      !/^\d+$/.test(migratedThreat.severity) &&
      this.severityMap[migratedThreat.severity]
    ) {
      migratedThreat.severity = this.severityMap[migratedThreat.severity];
    }

    // Migrate status
    if (
      migratedThreat.status &&
      !/^\d+$/.test(migratedThreat.status) &&
      this.statusMap[migratedThreat.status]
    ) {
      migratedThreat.status = this.statusMap[migratedThreat.status];
    }

    // Migrate priority
    if (
      migratedThreat.priority &&
      !/^\d+$/.test(migratedThreat.priority) &&
      this.priorityMap[migratedThreat.priority]
    ) {
      migratedThreat.priority = this.priorityMap[migratedThreat.priority];
    }

    return migratedThreat;
  }

  /**
   * Migrates old severity values in all threats to new numeric keys
   * This ensures that old string values like "High" are converted to "4"
   * Uses a hardcoded mapping for immediate conversion without waiting for translations
   */
  private migrateThreatSeverityValues(): void {
    if (!this.threatModel?.threats) {
      this.threatsDataSource.data = [];
      return;
    }

    this.threatModel.threats = this.threatModel.threats.map(threat =>
      this.migrateThreatFieldValues(threat),
    );
    this.threatsDataSource.data = this.threatModel.threats;
  }

  /**
   * Enter edit mode for issue URI
   */
  editIssueUri(): void {
    this.isEditingIssueUri = true;
    // Focus the input field after the view updates
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
   * Check if we should show the hyperlink view for issue URI
   */
  shouldShowIssueUriHyperlink(): boolean {
    return (
      !this.isEditingIssueUri &&
      !!this.initialIssueUriValue &&
      this.initialIssueUriValue.trim() !== ''
    );
  }

  /**
   * Opens URI in new tab when clicked
   */
  openUriInNewTab(uri: string): void {
    if (uri && uri.trim()) {
      window.open(uri, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Check if a URL is valid
   */
  isValidUrl(url: string): boolean {
    if (!url || !url.trim()) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  ngOnInit(): void {
    // Initialize status dropdown options
    this.statusOptions = getFieldOptions('threatModels.status', this.transloco);

    // Disable auto-save during initial data loading
    this._isLoadingInitialData = true;

    // Set up simplified auto-save subscription
    this._subscriptions.add(
      this._autoSaveSubject.pipe(debounceTime(300)).subscribe(() => {
        // this.logger.debugComponent('TmEdit', 'Auto-save triggered, calling performAutoSave');
        this.performAutoSave();
      }),
    );

    // Set up simplified form-level change monitoring
    this.setupFormChangeMonitoring();

    // Load frameworks from JSON files
    this._subscriptions.add(
      this.frameworkService.loadAllFrameworks().subscribe({
        next: frameworks => {
          this.frameworks = frameworks;
          // this.logger.info('Loaded frameworks for threat model editor', {
          //   count: frameworks.length,
          //   frameworks: frameworks.map(f => f.name),
          // });
          // this.logger.debugComponent('TmEdit', 'Framework details loaded', {
          //   frameworks: frameworks.map(f => ({
          //     name: f.name,
          //     threatTypeCount: f.threatTypes.length,
          //     threatTypes: f.threatTypes.map(tt => tt.name),
          //   })),
          // });
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
        // Refresh status dropdown options for new language
        this.statusOptions = getFieldOptions('threatModels.status', this.transloco);
      }),
    );

    // Also subscribe to direction changes
    this._subscriptions.add(
      this.languageService.direction$.subscribe(direction => {
        this.currentDirection = direction;
      }),
    );

    // Get threat model from route resolver
    const threatModel = this.route.snapshot.data['threatModel'] as ThreatModel;
    const id = this.route.snapshot.paramMap.get('id');

    if (!threatModel || !id) {
      this.logger.error('Threat model not found in route data', { id });
      void this.router.navigate(['/dashboard']);
      return;
    }

    // Set up the threat model data
    this.threatModel = threatModel;
    this.isNewThreatModel = false; // Resolved threat models are not new

    // Load threats via API with pagination (migration happens in service)
    this.loadThreats(id);

    // Subscribe to authorization changes
    this._subscriptions.add(
      this.authorizationService.canEdit$.subscribe(canEdit => {
        this.canEdit = canEdit;
        this.updateFormEditability();
      }),
    );

    this._subscriptions.add(
      this.authorizationService.canManagePermissions$.subscribe(canManage => {
        this.canManagePermissions = canManage;
      }),
    );

    // Store the initial issue URI value
    this.initialIssueUriValue = threatModel.issue_uri || '';

    this.threatModelForm.patchValue({
      name: threatModel.name,
      description: threatModel.description || '',
      threat_model_framework: threatModel.threat_model_framework || 'STRIDE',
      issue_uri: this.initialIssueUriValue,
      status: threatModel.status || null,
    });

    // Store original form values for change comparison
    this._originalFormValues = {
      name: threatModel.name,
      description: threatModel.description || '',
      threat_model_framework: threatModel.threat_model_framework || 'STRIDE',
      issue_uri: this.initialIssueUriValue,
      status: threatModel.status || null,
    };

    // Update framework control disabled state based on threats
    this.updateFrameworkControlState();

    // Load diagrams separately
    this.loadDiagrams(id);

    // Load assets separately
    this.loadAssets(id);

    // Load documents separately
    this.loadDocuments(id);

    // Load repositories separately
    this.loadRepositories(id);

    // Load notes separately
    this.loadNotes(id);

    // Load addons for menus
    this.loadAddons();

    // Re-enable auto-save after initial population is complete
    setTimeout(() => {
      this._isLoadingInitialData = false;
    }, 100);
  }

  /**
   * Update form editability based on permissions
   */
  private updateFormEditability(): void {
    if (this.canEdit) {
      this.threatModelForm.enable();
    } else {
      this.threatModelForm.disable();
    }
  }

  ngAfterViewInit(): void {
    // Connect sort to data sources
    if (this.assetsSort) {
      this.assetsDataSource.sort = this.assetsSort;
    }
    if (this.threatsSort) {
      this.threatsDataSource.sort = this.threatsSort;
      // Custom sorting for threats - severity ordering
      this.threatsDataSource.sortingDataAccessor = (
        threat: Threat,
        property: string,
      ): string | number => {
        switch (property) {
          case 'severity':
            return this.getSeverityOrder(threat.severity);
          case 'status':
            return threat.status ? parseInt(threat.status, 10) : 999;
          case 'name':
            return threat.name?.toLowerCase() ?? '';
          default:
            return (threat as unknown as Record<string, string>)[property] ?? '';
        }
      };
    }
    if (this.diagramsSort) {
      this.diagramsDataSource.sort = this.diagramsSort;
    }
    if (this.notesSort) {
      this.notesDataSource.sort = this.notesSort;
    }
    if (this.documentsSort) {
      this.documentsDataSource.sort = this.documentsSort;
    }
    if (this.repositoriesSort) {
      this.repositoriesDataSource.sort = this.repositoriesSort;
    }
  }

  /**
   * Get numeric order for severity (lower = more severe)
   */
  private getSeverityOrder(severity: string | null): number {
    if (!severity) return 999;
    const order = parseInt(severity, 10);
    return isNaN(order) ? 999 : order;
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    this._subscriptions.unsubscribe();

    // Clear hover timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    // Clear SVG caches to prevent memory leaks
    this.clearSvgCaches();
  }

  /**
   * Clear all SVG-related caches
   * This should be called when navigating away from threat models
   */
  private clearSvgCaches(): void {
    this.svgCacheService.clearAllCaches();
    this.diagramSvgValidation.clear();
    this.diagramSvgDataUrls.clear();
  }

  /**
   * Set up simplified form-level change monitoring
   */
  private setupFormChangeMonitoring(): void {
    // Single form-level subscription for all changes
    this._subscriptions.add(
      this.threatModelForm.valueChanges
        .pipe(
          debounceTime(1000), // Debounce for 1 second
          filter(() => !this._isLoadingInitialData), // Skip during initial loading
          filter(() => this.threatModelForm.valid), // Only save valid forms
          distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)), // Prevent duplicate saves
        )
        .subscribe((formValue: ThreatModelFormValues) => {
          if (this.threatModel && this.hasFormChanged(formValue)) {
            this.autoSaveThreatModel();
          }
        }),
    );
  }

  /**
   * Check if form values have changed from original
   */
  private hasFormChanged(formValue: ThreatModelFormValues): boolean {
    if (!this._originalFormValues) return false;

    // Compare status values (single string or null, not an array)
    const statusChanged = (formValue.status ?? null) !== (this._originalFormValues.status ?? null);

    return (
      formValue.name !== this._originalFormValues.name ||
      formValue.description !== this._originalFormValues.description ||
      formValue.threat_model_framework !== this._originalFormValues.threat_model_framework ||
      formValue.issue_uri !== this._originalFormValues.issue_uri ||
      statusChanged
    );
  }

  /**
   * Update original form values after successful save
   */
  private updateOriginalFormValues(formValue: ThreatModelFormValues): void {
    this._originalFormValues = { ...formValue };
  }

  /**
   * Handle framework selection change (for framework-specific logic)
   */
  onFrameworkChange(event: { value: unknown }): void {
    if (
      !this._isLoadingInitialData &&
      this.threatModel &&
      event.value !== this.threatModel.threat_model_framework
    ) {
      // Handle framework change logic (threat type updates, etc.)
      const newFramework = event.value as string;
      const isInitialFrameworkSet =
        !this.threatModel.threat_model_framework &&
        newFramework === 'STRIDE' &&
        (!this.threatModel.threats || this.threatModel.threats.length === 0);

      if (!isInitialFrameworkSet) {
        this.handleFrameworkChange(this.threatModel.threat_model_framework, newFramework);
      }

      // Update the model framework field
      this.threatModel.threat_model_framework = newFramework;

      // Trigger auto-save for framework changes (form valueChanges will handle the debouncing)
      if (!isInitialFrameworkSet) {
        this._autoSaveSubject.next();
      }
    }
  }

  /**
   * Simplified field blur handler (mainly for UI state like issue URL editing)
   */
  onFieldBlur(fieldName: string, event: Event): void {
    // Only handle UI-specific blur logic now - auto-save is handled by form valueChanges
    if (fieldName === 'issue_uri') {
      this.onIssueUriBlur(event);
    }
  }

  /**
   * Issue URI blur handler for UI state management
   */
  onIssueUriBlur(_event: Event): void {
    // Update the display value for consistency
    const currentValue = (this.threatModelForm.get('issue_uri')?.value as string) || '';
    this.initialIssueUriValue = currentValue;
    this.isEditingIssueUri = false;
    // Auto-save is now handled by form valueChanges subscription
  }

  /**
   * Opens a dialog to create a new threat
   * If the user confirms, adds the threat to the threat model
   */
  addThreat(): void {
    this.openThreatEditor();
  }

  /**
   * Opens the threat page for editing an existing threat, or dialog for creating a new threat.
   * For existing threats, navigates to the full-page threat editor at /tm/:id/threat/:threatId.
   * For new threats, opens the dialog for quick creation.
   * @param threat Optional threat to edit or view
   * @param shapeType Optional shape type to filter applicable threat types (used for dialog creation)
   */
  openThreatEditor(threat?: Threat, shapeType?: string): void {
    if (!this.threatModel) {
      return;
    }

    // For existing threats, navigate to the full page
    if (threat?.id) {
      this.logger.debugComponent('TmEditComponent', 'Navigating to threat page', {
        threatId: threat.id,
        threatModelId: this.threatModel.id,
      });
      void this.router.navigate(['/tm', this.threatModel.id, 'threat', threat.id]);
      return;
    }

    // For create mode, use dialog
    this.openThreatEditorWithData(threat, shapeType, 'create');
  }

  /**
   * Opens the threat editor dialog with the provided data
   * @param threat Optional threat to edit or view
   * @param shapeType Optional shape type to filter applicable threat types
   * @param mode Dialog mode
   */
  private openThreatEditorWithData(
    threat?: Threat,
    shapeType?: string,
    mode?: 'create' | 'edit' | 'view',
  ): void {
    if (!this.threatModel) {
      return;
    }

    // Determine the mode based on whether a threat is provided (if not already specified)
    const dialogMode: 'create' | 'edit' | 'view' = mode || (threat ? 'edit' : 'create');

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
      this.logger.debugComponent('TmEditComponent', 'Using framework for threat editor', {
        currentFrameworkName,
        frameworkThreatTypes: framework.threatTypes.map(tt => tt.name),
        shapeType: shapeType || 'none',
      });
    }

    // Extract diagram and cell data using the utility service
    const cellData = this.cellDataExtractionService.extractFromThreatModel(this.threatModel);

    const dialogData: ThreatEditorDialogData = {
      threat,
      threatModelId: this.threatModel.id,
      mode: dialogMode,
      isReadOnly: !this.canEdit,
      diagramId: threat?.diagram_id,
      cellId: threat?.cell_id,
      diagrams: cellData.diagrams,
      cells: cellData.cells,
      assets: this.threatModel.assets?.map(a => ({ id: a.id, name: a.name, type: a.type })) || [],
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
            threat_type: string[];
            asset_id?: string;
            diagram_id?: string;
            cell_id?: string;
            score?: number;
            priority?: string;
            mitigated?: boolean;
            status?: string;
            issue_uri?: string;
          }
          const formResult = result as ThreatFormResult;

          if (mode === 'create') {
            // Create a new threat via API
            const newThreatData: Partial<Threat> = {
              name: formResult.name,
              description: formResult.description,
              severity: formResult.severity || 'High',
              threat_type: formResult.threat_type || [],
              mitigated: formResult.mitigated || false,
              status: formResult.status || 'Open',
              metadata: [],
            };

            // Only include optional fields if they have values
            if (formResult.asset_id !== undefined) {
              newThreatData.asset_id = formResult.asset_id;
            }
            if (formResult.diagram_id !== undefined) {
              newThreatData.diagram_id = formResult.diagram_id;
            }
            if (formResult.cell_id !== undefined) {
              newThreatData.cell_id = formResult.cell_id;
            }
            if (formResult.score !== undefined) {
              newThreatData.score = formResult.score;
            }
            if (formResult.priority !== undefined) {
              newThreatData.priority = formResult.priority;
            }
            if (formResult.issue_uri !== undefined) {
              newThreatData.issue_uri = formResult.issue_uri;
            }

            this._subscriptions.add(
              this.threatModelService
                .createThreat(this.threatModel.id, newThreatData)
                .subscribe(newThreat => {
                  // Add the new threat to local state (check for duplicates first)
                  // Use spread to create new array and update data source for immediate UI refresh
                  if (!this.threatModel!.threats?.find(t => t.id === newThreat.id)) {
                    this.threatModel!.threats = [...(this.threatModel!.threats || []), newThreat];
                    this.threatsDataSource.data = this.threatModel!.threats;
                  }

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
              threat_type: formResult.threat_type || threat.threat_type || [],
            };

            // Only include optional fields if they have values
            if (formResult.asset_id !== undefined) {
              updatedThreatData.asset_id = formResult.asset_id;
            }
            if (formResult.diagram_id !== undefined) {
              updatedThreatData.diagram_id = formResult.diagram_id;
            }
            if (formResult.cell_id !== undefined) {
              updatedThreatData.cell_id = formResult.cell_id;
            }
            if (formResult.score !== undefined) {
              updatedThreatData.score = formResult.score;
            }
            if (formResult.priority !== undefined) {
              updatedThreatData.priority = formResult.priority;
            }
            if (formResult.mitigated !== undefined) {
              updatedThreatData.mitigated = formResult.mitigated;
            }
            if (formResult.status !== undefined) {
              updatedThreatData.status = formResult.status;
            }
            if (formResult.issue_uri !== undefined) {
              updatedThreatData.issue_uri = formResult.issue_uri;
            }

            this._subscriptions.add(
              this.threatModelService
                .updateThreat(this.threatModel.id, threat.id, updatedThreatData)
                .subscribe(updatedThreat => {
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
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete threat - insufficient permissions');
      return;
    }

    if (!this.threatModel || !this.threatModel.threats) {
      return;
    }

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: threat.id,
      name: threat.name,
      objectType: 'threat',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        // Delete the threat via API
        this._subscriptions.add(
          this.threatModelService
            .deleteThreat(this.threatModel!.id, threat.id)
            .subscribe(success => {
              if (success) {
                // Remove the threat from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel!.threats = this.threatModel!.threats!.filter(
                  t => t.id !== threat.id,
                );
                this.threatsDataSource.data = this.threatModel!.threats;

                // Update framework control state since we removed a threat
                this.updateFrameworkControlState();
              }
            }),
        );
      }
    });
  }

  /**
   * Opens a dialog to create a new diagram
   * If the user confirms, adds the new diagram to the threat model
   */
  addDiagram(): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add diagram - insufficient permissions');
      return;
    }
    const dialogRef = this.dialog.open(CreateDiagramDialogComponent, {
      width: '400px',
      data: {
        threatModelName: this.threatModel?.name || '',
      },
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

                  // Add the new diagram to local state (check for duplicates first)
                  // Use spread to create new array and update data source for immediate UI refresh
                  const isDuplicate = this.threatModel?.diagrams?.find(d => {
                    if (typeof d === 'string') return d === newDiagram.id;
                    return d.id === newDiagram.id;
                  });

                  if (!isDuplicate) {
                    // Handle both string ID arrays and Diagram object arrays
                    if (
                      this.threatModel!.diagrams?.length &&
                      typeof this.threatModel!.diagrams[0] === 'string'
                    ) {
                      this.threatModel!.diagrams = [
                        ...((this.threatModel!.diagrams || []) as unknown as string[]),
                        newDiagram.id,
                      ] as unknown as Diagram[];
                    } else {
                      this.threatModel!.diagrams = [
                        ...(this.threatModel!.diagrams || []),
                        newDiagram,
                      ];
                    }
                  }

                  // Always update the display diagrams array (these are always Diagram objects)
                  if (!this._diagrams.find(d => d.id === newDiagram.id)) {
                    this._diagrams = [...this._diagrams, newDiagram];
                    this.diagramsDataSource.data = this._diagrams;
                    this.computeDiagramSvgData();
                  }
                },
                error: error => {
                  this.logger.error('Failed to create diagram', error);
                },
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
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.diagrams || !this.canEdit) {
      if (!this.canEdit) {
        this.logger.warn('Cannot delete diagram - insufficient permissions');
      }
      return;
    }

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: diagram.id,
      name: diagram.name,
      objectType: 'diagram',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        // Delete the diagram via API
        this._subscriptions.add(
          this.threatModelService
            .deleteDiagram(this.threatModel!.id, diagram.id)
            .subscribe(success => {
              if (success && this.threatModel && this.threatModel.diagrams) {
                // Remove the diagram from local state using filter (immutable)
                this.threatModel.diagrams = this.threatModel.diagrams.filter(
                  (d: string | Diagram) => (typeof d === 'string' ? d : d.id) !== diagram.id,
                );

                // Remove the diagram from the display array using filter
                // This triggers the setter which updates diagramsDataSource.data
                this.diagrams = this.diagrams.filter(d => d.id !== diagram.id);

                // Remove from DIAGRAMS_BY_ID map
                DIAGRAMS_BY_ID.delete(diagram.id);
              }
            }),
        );
      }
    });
  }

  /**
   * Opens a dialog to create a new document
   * If the user confirms, adds the new document to the threat model
   */
  addDocument(): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add document - insufficient permissions');
      return;
    }
    const dialogData: DocumentEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
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
            uri: result.uri,
            description: result.description || undefined,
          };

          this._subscriptions.add(
            this.threatModelService
              .createDocument(this.threatModel.id, newDocumentData)
              .subscribe(newDocument => {
                // Add the new document to local state (check for duplicates first)
                // Use spread to create new array and update data source for immediate UI refresh
                if (!this.threatModel!.documents?.find(d => d.id === newDocument.id)) {
                  this.threatModel!.documents = [
                    ...(this.threatModel!.documents || []),
                    newDocument,
                  ];
                  this.documentsDataSource.data = this.threatModel!.documents;
                }
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
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }

    const dialogData: DocumentEditorDialogData = {
      document,
      mode: 'edit',
      isReadOnly: !this.canEdit,
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
            uri: result.uri,
            description: result.description || undefined,
          };

          this._subscriptions.add(
            this.threatModelService
              .updateDocument(this.threatModel.id, document.id, updatedDocumentData)
              .subscribe(updatedDocument => {
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
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete document - insufficient permissions');
      return;
    }

    if (!this.threatModel || !this.threatModel.documents) {
      return;
    }

    // Show confirmation dialog (no typed confirmation for documents - reference only)
    const dialogData: DeleteConfirmationDialogData = {
      id: document.id,
      name: document.name,
      objectType: 'document',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        // Delete the document via API
        this._subscriptions.add(
          this.threatModelService
            .deleteDocument(this.threatModel!.id, document.id)
            .subscribe(success => {
              if (success && this.threatModel && this.threatModel.documents) {
                // Remove the document from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.documents = this.threatModel.documents.filter(
                  d => d.id !== document.id,
                );
                this.documentsDataSource.data = this.threatModel.documents;
              }
            }),
        );
      }
    });
  }

  /**
   * Generates tooltip text for document list items
   * @param document The document to generate tooltip for
   * @returns Formatted tooltip text with URL and description
   */
  getDocumentTooltip(document: Document): string {
    let tooltip = document.uri;
    if (document.description) {
      tooltip += `\n\n${document.description}`;
    }
    return tooltip;
  }

  /**
   * Opens a dialog to create a new source code repository reference
   * If the user confirms, adds the new source code to the threat model
   */
  addRepository(): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add repository - insufficient permissions');
      return;
    }

    const dialogData: RepositoryEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
    };

    const dialogRef = this.dialog.open(RepositoryEditorDialogComponent, {
      width: '700px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: RepositoryFormResult | undefined) => {
        if (result && this.threatModel) {
          // Create a new repository via API
          const newRepositoryData: Partial<Repository> = {
            name: result.name,
            description: result.description || undefined,
            type: result.type,
            uri: result.uri,
            parameters: result.parameters,
          };

          this._subscriptions.add(
            this.threatModelService
              .createRepository(this.threatModel.id, newRepositoryData)
              .subscribe(newRepository => {
                // Add the new repository to local state (check for duplicates first)
                // Use spread to create new array and update data source for immediate UI refresh
                if (!this.threatModel!.repositories?.find(r => r.id === newRepository.id)) {
                  this.threatModel!.repositories = [
                    ...(this.threatModel!.repositories || []),
                    newRepository,
                  ];
                  this.repositoriesDataSource.data = this.threatModel!.repositories;
                }
              }),
          );
        }
      }),
    );
  }

  /**
   * Opens a dialog to edit a repository reference
   * If the user confirms, updates the repository in the threat model
   * @param repository The repository to edit
   * @param event The click event
   */
  editRepository(repository: Repository, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }

    const dialogData: RepositoryEditorDialogData = {
      repository,
      mode: 'edit',
      isReadOnly: !this.canEdit,
    };

    const dialogRef = this.dialog.open(RepositoryEditorDialogComponent, {
      width: '700px',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: RepositoryFormResult | undefined) => {
        if (result && this.threatModel) {
          // Update the repository via API
          const updatedRepositoryData: Partial<Repository> = {
            name: result.name,
            description: result.description || undefined,
            type: result.type,
            uri: result.uri,
            parameters: result.parameters,
          };

          this._subscriptions.add(
            this.threatModelService
              .updateRepository(this.threatModel.id, repository.id, updatedRepositoryData)
              .subscribe(updatedRepository => {
                // Update the repository in local state
                if (this.threatModel && this.threatModel.repositories) {
                  const index = this.threatModel.repositories.findIndex(
                    r => r.id === repository.id,
                  );
                  if (index !== -1) {
                    this.threatModel.repositories[index] = updatedRepository;
                  }
                }
              }),
          );
        }
      }),
    );
  }

  /**
   * Deletes a repository reference from the threat model
   * @param repository The repository to delete
   * @param event The click event
   */
  deleteRepository(repository: Repository, event: Event): void {
    // Prevent event propagation
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete repository - insufficient permissions');
      return;
    }

    if (!this.threatModel || !this.threatModel.repositories) {
      return;
    }

    // Show confirmation dialog (no typed confirmation for repositories - reference only)
    const dialogData: DeleteConfirmationDialogData = {
      id: repository.id,
      name: repository.name,
      objectType: 'repository',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        // Delete the repository via API
        this._subscriptions.add(
          this.threatModelService
            .deleteRepository(this.threatModel!.id, repository.id)
            .subscribe(success => {
              if (success && this.threatModel && this.threatModel.repositories) {
                // Remove the repository from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.repositories = this.threatModel.repositories.filter(
                  r => r.id !== repository.id,
                );
                this.repositoriesDataSource.data = this.threatModel.repositories;
              }
            }),
        );
      }
    });
  }

  /**
   * Generates tooltip text for repository list items
   * @param repository The repository to generate tooltip for
   * @returns Formatted tooltip text with URI and description
   */
  getRepositoryTooltip(repository: Repository): string {
    let tooltip = repository.uri;
    if (repository.description) {
      tooltip += `\n\n${repository.description}`;
    }
    if (repository.parameters) {
      tooltip += `\n\n${repository.parameters.refType}: ${repository.parameters.refValue}`;
      if (repository.parameters.subPath) {
        tooltip += `\nPath: ${repository.parameters.subPath}`;
      }
    }
    return tooltip;
  }

  /**
   * Opens the metadata dialog for a specific repository
   */
  openRepositoryMetadataDialog(repository: Repository, event: Event): void {
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: repository.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Repository',
      objectName: `${this.transloco.translate('common.objectTypes.repository')}: ${repository.name} (${repository.id})`,
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
            this.threatModelService
              .updateRepositoryMetadata(this.threatModel.id, repository.id, result)
              .subscribe(updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.repositories) {
                  const repositoryIndex = this.threatModel.repositories.findIndex(
                    r => r.id === repository.id,
                  );
                  if (repositoryIndex !== -1) {
                    this.threatModel.repositories[repositoryIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated repository metadata via API', {
                    repositoryId: repository.id,
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
   * Opens the dialog to create a new note
   */
  addNote(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create notes');
      return;
    }

    const dialogData: NoteEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
    };

    const dialogRef = this.dialog.open(NoteEditorDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      minWidth: '600px',
      maxHeight: '90vh',
      data: dialogData,
    });

    // Subscribe to save events from the dialog
    const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(noteResult => {
      if (!this.threatModel) {
        return;
      }
      this._subscriptions.add(
        this.threatModelService.createNote(this.threatModel.id, noteResult).subscribe(
          createdNote => {
            if (this.threatModel) {
              // Use spread to create new array and update data source for immediate UI refresh
              if (!this.threatModel.notes?.find(n => n.id === createdNote.id)) {
                this.threatModel.notes = [...(this.threatModel.notes || []), createdNote];
                this.notesDataSource.data = this.threatModel.notes;
              }
              this.logger.info('Created note via API', { note: createdNote });
              // Notify the dialog that the note was created
              dialogRef.componentInstance.setCreatedNoteId(createdNote.id);
            }
          },
          error => {
            this.logger.error('Failed to create note', error);
          },
        ),
      );
    });

    this._subscriptions.add(saveSubscription);

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: NoteEditorResult | undefined) => {
        if (result && this.threatModel) {
          // Check if the note was already created via the save button
          if (result.wasCreated && result.noteId) {
            // Note was already created, update it if there are changes
            this._subscriptions.add(
              this.threatModelService
                .updateNote(this.threatModel.id, result.noteId, result.formValue)
                .subscribe(
                  updatedNote => {
                    if (this.threatModel && this.threatModel.notes) {
                      const index = this.threatModel.notes.findIndex(n => n.id === result.noteId);
                      if (index !== -1) {
                        this.threatModel.notes[index] = updatedNote;
                      }
                      this.logger.info('Updated note via API', { note: updatedNote });
                    }
                  },
                  error => {
                    this.logger.error('Failed to update note', error);
                  },
                ),
            );
          } else {
            // Note was not created yet, create it now
            this._subscriptions.add(
              this.threatModelService.createNote(this.threatModel.id, result.formValue).subscribe(
                createdNote => {
                  if (this.threatModel) {
                    // Use spread to create new array and update data source for immediate UI refresh
                    if (!this.threatModel.notes?.find(n => n.id === createdNote.id)) {
                      this.threatModel.notes = [...(this.threatModel.notes || []), createdNote];
                      this.notesDataSource.data = this.threatModel.notes;
                    }
                    this.logger.info('Created note via API', { note: createdNote });
                  }
                },
                error => {
                  this.logger.error('Failed to create note', error);
                },
              ),
            );
          }
        }
      }),
    );
  }

  /**
   * Navigates to the full-page note editor for an existing note.
   * For new notes, use addNote() which opens the dialog.
   */
  editNote(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }

    // Navigate to full-page note editor (same pattern as openThreatEditor)
    this.logger.info('Navigating to note page', {
      threatModelId: this.threatModel.id,
      noteId: note.id,
    });
    void this.router.navigate(['/tm', this.threatModel.id, 'note', note.id]);
  }

  /**
   * Deletes a note from the threat model
   */
  deleteNote(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.notes || !this.canEdit) {
      this.logger.warn('User does not have permission to delete notes');
      return;
    }

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: note.id,
      name: note.name,
      objectType: 'note',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this._subscriptions.add(
          this.threatModelService.deleteNote(this.threatModel!.id, note.id).subscribe(success => {
            if (success && this.threatModel && this.threatModel.notes) {
              // Remove the note from local state using filter (immutable)
              // and update data source for immediate UI refresh
              this.threatModel.notes = this.threatModel.notes.filter(n => n.id !== note.id);
              this.notesDataSource.data = this.threatModel.notes;
              this.logger.info('Deleted note', { noteId: note.id });
            }
          }),
        );
      }
    });
  }

  /**
   * Downloads a note as a markdown file
   */
  downloadNote(note: Note, event: Event): void {
    event.stopPropagation();

    const content = note.content || '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.threatModel?.name || 'ThreatModel'}-${note.name}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Downloads a diagram model in the specified format
   * @param diagram The diagram to download
   * @param format The format to download: 'json', 'yaml', or 'graphml'
   */
  downloadDiagramModel(diagram: Diagram, format: 'json' | 'yaml' | 'graphml'): void {
    if (!this.threatModel) {
      this.logger.warn('Cannot download diagram model: no threat model loaded');
      return;
    }

    this.logger.info('Downloading diagram model', {
      diagramId: diagram.id,
      diagramName: diagram.name,
      format,
    });

    this._subscriptions.add(
      this.threatModelService.getDiagramModel(this.threatModel.id, diagram.id, format).subscribe({
        next: content => {
          const mimeType = this.getMimeTypeForFormat(format);
          const extension = this.getExtensionForFormat(format);
          const filename = this.generateDiagramModelFilename(diagram.name, extension);
          const blob = new Blob([content], { type: mimeType });

          this.handleDiagramModelExport(blob, filename, format).catch(error => {
            this.logger.error('Error downloading diagram model', error);
          });
        },
        error: error => {
          this.logger.error('Error fetching diagram model from API', error);
        },
      }),
    );
  }

  /**
   * Get the MIME type for a diagram model format
   */
  private getMimeTypeForFormat(format: 'json' | 'yaml' | 'graphml'): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'yaml':
        return 'application/x-yaml';
      case 'graphml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get the file extension for a diagram model format
   */
  private getExtensionForFormat(format: 'json' | 'yaml' | 'graphml'): string {
    switch (format) {
      case 'json':
        return '.json';
      case 'yaml':
        return '.yaml';
      case 'graphml':
        return '.graphml';
      default:
        return '';
    }
  }

  /**
   * Generate filename for diagram model download
   * Format: "{threatModelName}-{diagramName}-model{extension}"
   */
  private generateDiagramModelFilename(diagramName: string, extension: string): string {
    const sanitizeAndTruncate = (name: string, maxLength: number): string => {
      const sanitized = name
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
    };

    const threatModelPart = sanitizeAndTruncate(
      this.threatModel?.name?.trim() || 'ThreatModel',
      40,
    );
    const diagramPart = sanitizeAndTruncate(diagramName.trim(), 40);

    const filename = `${threatModelPart}-${diagramPart}-model${extension}`;

    this.logger.debugComponent('TmEdit', 'Generated diagram model filename', {
      threatModelName: this.threatModel?.name,
      diagramName,
      filename,
    });

    return filename;
  }

  /**
   * Handle diagram model export using File System Access API with fallback
   */
  private async handleDiagramModelExport(
    blob: Blob,
    filename: string,
    format: 'json' | 'yaml' | 'graphml',
  ): Promise<void> {
    if ('showSaveFilePicker' in window) {
      try {
        this.logger.debugComponent('TmEdit', 'Using File System Access API for diagram model save');

        const fileTypes = this.getFileTypesForFormat(format);
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: fileTypes,
        });

        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();

        this.logger.info('Diagram model saved successfully using File System Access API', {
          filename,
          format,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.logger.debugComponent('TmEdit', 'Diagram model save cancelled by user');
          return;
        } else {
          this.logger.warn('File System Access API failed, falling back to download method', error);
        }
      }
    } else {
      this.logger.debugComponent(
        'TmEdit',
        'File System Access API not supported, using fallback download method',
      );
    }

    // Fallback method
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      this.logger.info('Diagram model downloaded successfully using fallback method', {
        filename,
        format,
      });
    } catch (fallbackError) {
      this.logger.error('Both File System Access API and fallback method failed', fallbackError);
      throw fallbackError;
    }
  }

  /**
   * Get file types configuration for the save dialog based on format
   */
  private getFileTypesForFormat(
    format: 'json' | 'yaml' | 'graphml',
  ): { description: string; accept: Record<string, string[]> }[] {
    switch (format) {
      case 'json':
        return [{ description: 'JSON files', accept: { 'application/json': ['.json'] } }];
      case 'yaml':
        return [{ description: 'YAML files', accept: { 'application/x-yaml': ['.yaml', '.yml'] } }];
      case 'graphml':
        return [{ description: 'GraphML files', accept: { 'application/xml': ['.graphml'] } }];
      default:
        return [];
    }
  }

  /**
   * Opens the metadata dialog for a specific note
   */
  openNoteMetadataDialog(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: note.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Note',
      objectName: `${this.transloco.translate('common.objectTypes.note')}: ${note.name} (${note.id})`,
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
        if (result && this.threatModel && this.canEdit) {
          this._subscriptions.add(
            this.threatModelService
              .updateNoteMetadata(this.threatModel.id, note.id, result)
              .subscribe(updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.notes) {
                  const noteIndex = this.threatModel.notes.findIndex(n => n.id === note.id);
                  if (noteIndex !== -1) {
                    this.threatModel.notes[noteIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated note metadata via API', {
                    noteId: note.id,
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
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: document.metadata || [],
      isReadOnly: !this.canEdit,
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
            this.threatModelService
              .updateDocumentMetadata(this.threatModel.id, document.id, result)
              .subscribe(updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.documents) {
                  const documentIndex = this.threatModel.documents.findIndex(
                    d => d.id === document.id,
                  );
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
    // Clear SVG caches before navigating away
    this.clearSvgCaches();
    void this.router.navigate(['/dashboard']);
  }

  /**
   * Opens the permissions dialog to manage threat model permissions
   */
  openPermissionsDialog(): void {
    if (!this.threatModel) {
      return;
    }

    // Capture original state for rollback on error
    const originalAuthorizations: Authorization[] = this.threatModel.authorization
      ? (JSON.parse(JSON.stringify(this.threatModel.authorization)) as Authorization[])
      : [];
    const originalOwner: User = { ...this.threatModel.owner };

    const dialogData: PermissionsDialogData = {
      permissions: this.threatModel.authorization || [],
      owner: this.threatModel.owner,
      isReadOnly: !this.canManagePermissions, // Only owners can modify permissions
      onOwnerChange: (newOwner: User) => {
        if (this.threatModel) {
          this.threatModel.owner = newOwner;
          this.threatModel.modified_at = new Date().toISOString();
        }
      },
    };

    const dialogRef = this.dialog.open(PermissionsDialogComponent, {
      width: '1000px',
      maxWidth: '90vw',
      maxHeight: '80vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef
        .afterClosed()
        .subscribe((result: { permissions: Authorization[]; owner: User } | undefined) => {
          if (!result || !this.threatModel) {
            return;
          }

          // Prepare authorizations for API (parse subject, transform provider)
          const preparedAuthorizations = this.authorizationPrepare.prepareForApi(
            result.permissions,
          );

          // Update local state
          this.threatModel.authorization = preparedAuthorizations;
          this.threatModel.owner = result.owner;
          this.threatModel.modified_at = new Date().toISOString();

          // Create updates object with both authorization and owner if owner changed
          const updates: Partial<Pick<ThreatModel, 'authorization' | 'owner'>> = {
            authorization: preparedAuthorizations,
          };

          // Only include owner in updates if it changed (compare by composite key)
          const originalOwnerKey = `${originalOwner.provider}:${originalOwner.provider_id}`;
          const newOwnerKey = `${result.owner.provider}:${result.owner.provider_id}`;
          if (originalOwnerKey !== newOwnerKey) {
            updates.owner = result.owner;
          }

          // Update the threat model with PATCH and error handling
          this._subscriptions.add(
            this.threatModelService.patchThreatModel(this.threatModel.id, updates).subscribe({
              next: updatedModel => {
                if (updatedModel && this.threatModel) {
                  // Update the relevant fields from the result
                  // Note: authorization from server response should already have display_name filtered out
                  // by ThreatModelService.patchThreatModel(), but we defensively ensure it here as well
                  this.threatModel.authorization = updatedModel.authorization;
                  this.threatModel.owner = updatedModel.owner;
                  this.threatModel.modified_at = updatedModel.modified_at;
                }
              },
              error: error => {
                this.logger.error('Failed to update permissions', error);

                // Rollback state on error
                if (this.threatModel) {
                  this.threatModel.authorization = originalAuthorizations;
                  this.threatModel.owner = originalOwner;
                }

                // TODO: Show error notification to user
              },
            }),
          );
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
      isReadOnly: !this.canEdit, // You can add logic here to determine if user has edit permissions
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
            this.threatModelService
              .updateThreatModelMetadata(this.threatModel.id, result)
              .subscribe(updatedMetadata => {
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
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: diagram.metadata || [],
      isReadOnly: !this.canEdit,
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
            this.threatModelService
              .updateDiagramMetadata(this.threatModel.id, diagram.id, result)
              .subscribe(updatedMetadata => {
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
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: threat.metadata || [],
      isReadOnly: !this.canEdit,
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
            this.threatModelService
              .updateThreatMetadata(this.threatModel.id, threat.id, result)
              .subscribe(updatedMetadata => {
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
   * Opens the repository view (placeholder for future functionality)
   */
  openRepositoryView(): void {
    // TODO: Implement repository view functionality
    this.logger.info('Repository view clicked - functionality to be implemented');
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

      // Normalize the threat model to ensure consistent date formats
      const normalizedThreatModel = this.normalizeThreatModelForExport(this.threatModel);

      // Serialize the complete threat model as JSON
      const jsonContent = JSON.stringify(normalizedThreatModel, null, 2);
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
   * Normalize threat model data for export to ensure consistent formats
   * - Converts dates to ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   * - Ensures all required fields are present
   */
  private normalizeThreatModelForExport(threatModel: ThreatModel): ThreatModel {
    const normalized = { ...threatModel };

    // Normalize top-level dates
    normalized.created_at = this.normalizeDate(threatModel.created_at);
    normalized.modified_at = this.normalizeDate(threatModel.modified_at);

    // Normalize diagram dates
    if (normalized.diagrams) {
      normalized.diagrams = normalized.diagrams.map(diagram => ({
        ...diagram,
        created_at: this.normalizeDate(diagram.created_at),
        modified_at: this.normalizeDate(diagram.modified_at),
      }));
    }

    // Normalize threat dates
    if (normalized.threats) {
      normalized.threats = normalized.threats.map(threat => ({
        ...threat,
        created_at: this.normalizeDate(threat.created_at),
        modified_at: this.normalizeDate(threat.modified_at),
      }));
    }

    return normalized;
  }

  /**
   * Normalize a date string to ISO 8601 format
   * Handles various input formats and ensures output is YYYY-MM-DDTHH:mm:ss.sssZ
   */
  private normalizeDate(dateString: string): string {
    if (!dateString) {
      return new Date().toISOString();
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        this.logger.warn('Invalid date encountered, using current date', { dateString });
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      this.logger.error('Error normalizing date', { dateString, error });
      return new Date().toISOString();
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
   * Also respects read-only mode permissions
   */
  private updateFrameworkControlState(): void {
    const frameworkControl = this.threatModelForm.get('threat_model_framework');
    if (frameworkControl) {
      if (this.hasThreats() || !this.canEdit) {
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
   * Compute SVG data for all diagrams to prevent change detection loops
   */
  private computeDiagramSvgData(): void {
    this.diagramSvgValidation.clear();
    this.diagramSvgDataUrls.clear();

    this._diagrams.forEach(diagram => {
      if (diagram.image?.svg) {
        // Create cache key from diagram ID and SVG data
        const cacheKey = `${diagram.id}-${diagram.image.svg.substring(0, 50)}`;

        // Check validation
        let isValid: boolean;
        if (this.svgCacheService.hasValidationCache(cacheKey)) {
          isValid = this.svgCacheService.getValidationCache(cacheKey)!;
        } else {
          isValid = this.isValidBase64Svg(diagram.image.svg);
          this.svgCacheService.setValidationCache(cacheKey, isValid);
        }
        this.diagramSvgValidation.set(diagram.id, isValid);

        // Check data URL
        if (isValid) {
          let dataUrl: string;
          const processedCacheKey = `${cacheKey}-processed`;
          if (this.svgCacheService.hasDataUrlCache(processedCacheKey)) {
            dataUrl = this.svgCacheService.getDataUrlCache(processedCacheKey)!;
          } else {
            // Create data URL directly from processed SVG - scaling handled by CSS
            dataUrl = `data:image/svg+xml;base64,${diagram.image.svg}`;
            this.svgCacheService.setDataUrlCache(processedCacheKey, dataUrl);
          }
          this.diagramSvgDataUrls.set(diagram.id, dataUrl);
        }
      }
    });
  }

  /**
   * Check if a diagram has a valid SVG image for thumbnail display
   * @param diagram The diagram object
   * @returns True if the diagram has valid SVG data
   */
  hasSvgImage(diagram: Diagram): boolean {
    return this.diagramSvgValidation.get(diagram.id) || false;
  }

  /**
   * Get the SVG data URL for a diagram thumbnail
   * @param diagram The diagram object
   * @returns SVG data URL or empty string
   */
  getSvgDataUrl(diagram: Diagram): string {
    return this.diagramSvgDataUrls.get(diagram.id) || '';
  }

  /**
   * Get SVG viewBox attribute from diagram
   * @param diagram The diagram object
   * @returns SVG viewBox attribute or null
   */
  getSvgViewBox(diagram: Diagram): string | null {
    // Extract viewBox from the SVG content - the DFD export service now handles optimal viewBox calculation
    return this.extractViewBoxFromSvg(diagram);
  }

  /**
   * Fallback method to extract viewBox from SVG content
   * @param diagram The diagram object
   * @returns SVG viewBox attribute or null
   */
  private extractViewBoxFromSvg(diagram: Diagram): string | null {
    if (!diagram.image?.svg) {
      return null;
    }

    try {
      // Decode the base64 SVG
      const svgContent = atob(diagram.image.svg);

      // Create a temporary DOM element to parse the SVG
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');

      if (!svgElement) {
        return null;
      }

      return svgElement.getAttribute('viewBox');
    } catch (error) {
      this.logger.warn('Failed to extract viewBox from SVG', { error });
      return null;
    }
  }

  /**
   * Validate if a base64 string contains well-formed SVG
   * @param base64Svg Base64 encoded SVG string
   * @returns True if valid SVG
   */
  private isValidBase64Svg(base64Svg: string): boolean {
    try {
      // Basic validation - check if it's valid base64
      if (!base64Svg || base64Svg.length === 0) {
        return false;
      }

      // Decode base64
      const svgText = atob(base64Svg);

      // Log for debugging
      this.logger.debugComponent('TmEditComponent', 'Validating SVG', {
        base64Length: base64Svg.length,
        decodedLength: svgText.length,
        preview: svgText.substring(0, 100),
      });

      // Basic SVG validation - check if it starts with SVG tag or XML declaration
      const trimmed = svgText.trim();
      if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
        this.logger.warn('SVG validation failed: does not start with <svg or <?xml', {
          actualStart: trimmed.substring(0, 20),
        });
        return false;
      }

      // Check if it contains svg tag
      if (!trimmed.includes('<svg')) {
        this.logger.warn('SVG validation failed: does not contain <svg tag');
        return false;
      }

      // Very basic check for closing tag
      if (!trimmed.includes('</svg>')) {
        this.logger.warn('SVG validation failed: does not contain </svg> closing tag');
        return false;
      }

      this.logger.debugComponent('TmEditComponent', 'SVG validation passed');
      return true;
    } catch (error) {
      this.logger.warn('SVG validation failed with error', { error });
      return false;
    }
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

    if (formValues.issue_uri) {
      this.threatModel.issue_uri = formValues.issue_uri;
    }

    // Update modified timestamp
    this.threatModel.modified_at = new Date().toISOString();

    this.logger.debugComponent('TmEdit', 'Applied form changes to threat model', {
      threatModelId: this.threatModel.id,
      updatedFields: ['name', 'description', 'threat_model_framework', 'issue_uri', 'modified_at'],
    });
  }

  /**
   * Trigger auto-save by emitting to the auto-save subject
   * This will be debounced to prevent excessive API calls
   */
  private autoSaveThreatModel(): void {
    this.logger.info('Auto-save triggered');
    this._autoSaveSubject.next();
  }

  /**
   * Perform the actual auto-save operation with enhanced error handling
   * This method is called after debouncing
   */
  private performAutoSave(): void {
    // this.logger.debugComponent('TmEdit', 'performAutoSave called', {
    //   threatModelExists: !!this.threatModel,
    //   formValid: this.threatModelForm.valid,
    //   isNewThreatModel: this.isNewThreatModel,
    //   isLoadingInitialData: this._isLoadingInitialData,
    //   threatModelId: this.threatModel?.id,
    //   canEdit: this.canEdit,
    // });

    if (
      !this.threatModel ||
      this.threatModelForm.invalid ||
      this._isLoadingInitialData ||
      !this.canEdit ||
      this._isSaving
    ) {
      this.logger.debugComponent('TmEdit', 'Auto-save skipped due to conditions', {
        threatModelExists: !!this.threatModel,
        formValid: this.threatModelForm.valid,
        isLoadingInitialData: this._isLoadingInitialData,
        canEdit: this.canEdit,
        isSaving: this._isSaving,
      });
      return;
    }

    // Get current form values and check if they've changed
    const formValues = this.threatModelForm.getRawValue() as ThreatModelFormValues;
    if (!this.hasFormChanged(formValues)) {
      this.logger.info('Auto-save skipped: no unsaved changes');
      return;
    }

    // Create updates object with only changed form fields
    // Note: This object should NEVER contain authorization/owner - those are managed separately
    const updates: Partial<
      Pick<ThreatModel, 'name' | 'description' | 'threat_model_framework' | 'issue_uri' | 'status'>
    > = {};

    if (formValues.name !== this._originalFormValues!.name) {
      updates.name = formValues.name;
    }
    if (formValues.description !== this._originalFormValues!.description) {
      updates.description = formValues.description;
    }
    if (formValues.threat_model_framework !== this._originalFormValues!.threat_model_framework) {
      updates.threat_model_framework = formValues.threat_model_framework;
    }
    if (formValues.issue_uri !== this._originalFormValues!.issue_uri) {
      updates.issue_uri = formValues.issue_uri;
    }
    // Compare status values (single string or null, not an array)
    if ((formValues.status ?? null) !== (this._originalFormValues!.status ?? null)) {
      updates.status = formValues.status;
    }

    // Runtime safety: Remove authorization/owner if somehow present (should not happen due to type constraint)
    // This is a defensive measure against runtime object mutations
    const safeUpdates = updates as Record<string, unknown>;
    if ('authorization' in safeUpdates) {
      this.logger.warn('Unexpected authorization field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['authorization'];
    }
    if ('owner' in safeUpdates) {
      this.logger.warn('Unexpected owner field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['owner'];
    }

    // Log what fields are being updated (INFO level for Heroku debugging)
    this.logger.info('Auto-save PATCH request', {
      threatModelId: this.threatModel.id,
      updateKeys: Object.keys(safeUpdates),
    });

    // Set saving flag to prevent concurrent saves
    this._isSaving = true;

    // Save to server with PATCH (only changed fields)
    this._subscriptions.add(
      this.threatModelService.patchThreatModel(this.threatModel.id, safeUpdates).subscribe({
        next: result => {
          this._isSaving = false;
          if (result && this.threatModel) {
            // Update the threat model with server response
            Object.keys(updates).forEach(key => {
              (this.threatModel as unknown as Record<string, unknown>)[key] = (
                result as unknown as Record<string, unknown>
              )[key];
            });
            this.threatModel.modified_at = result.modified_at;
            // Always sync status_updated with server (server manages this timestamp field)
            // This ensures the UI reflects the latest timestamp after any status change
            if ('status_updated' in result) {
              this.threatModel.status_updated = result.status_updated;
            }
            // Trigger change detection to ensure UI reflects updated timestamps
            this.cdr.detectChanges();

            // Update original form values with what we just saved
            this.updateOriginalFormValues(formValues);

            // Check if user made additional changes while save was in flight
            // If so, trigger another save cycle
            const currentFormValues = this.threatModelForm.getRawValue() as ThreatModelFormValues;
            if (this.hasFormChanged(currentFormValues)) {
              this.logger.info('Detected changes made during save, triggering follow-up save');
              this._autoSaveSubject.next();
            }

            // Reset form dirty state so save button dims/disables
            this.threatModelForm.markAsPristine();

            this.logger.info('Auto-saved threat model changes', {
              threatModelId: this.threatModel.id,
              savedFields: Object.keys(updates),
              name: this.threatModel.name,
            });
          }
        },
        error: error => {
          this._isSaving = false;
          this.logger.error('Auto-save failed for threat model', error, {
            threatModelId: this.threatModel?.id,
            attemptedUpdates: updates,
          });
        },
      }),
    );
  }

  /**
   * Load diagrams for the threat model with pagination
   * Always uses API call for server-side pagination
   */
  private loadDiagrams(threatModelId: string): void {
    const offset = calculateOffset(this.diagramsPageIndex, this.diagramsPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getDiagramsForThreatModel(threatModelId, this.diagramsPageSize, offset)
        .subscribe(response => {
          this.diagrams = response.diagrams;
          this.totalDiagrams = response.total;

          // Update DIAGRAMS_BY_ID map with real diagram data
          this.diagrams.forEach(diagram => {
            DIAGRAMS_BY_ID.set(diagram.id, diagram);
          });

          // Update threat model diagrams property for consistency
          if (this.threatModel) {
            this.threatModel.diagrams = response.diagrams;
          }
        }),
    );
  }

  /**
   * Handle diagrams page change
   */
  onDiagramsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.diagramsPageIndex = event.pageIndex;
    this.diagramsPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadDiagrams(this.threatModel.id);
    }
  }

  /**
   * Load documents for the threat model using separate API call with pagination
   */
  private loadDocuments(threatModelId: string): void {
    const offset = calculateOffset(this.documentsPageIndex, this.documentsPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getDocumentsForThreatModel(threatModelId, this.documentsPageSize, offset)
        .subscribe(response => {
          if (this.threatModel) {
            this.threatModel.documents = response.documents;
            this.documentsDataSource.data = response.documents;
            this.totalDocuments = response.total;
          }
        }),
    );
  }

  /**
   * Handle documents page change
   */
  onDocumentsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.documentsPageIndex = event.pageIndex;
    this.documentsPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadDocuments(this.threatModel.id);
    }
  }

  /**
   * Load repositories for the threat model using separate API call with pagination
   */
  private loadRepositories(threatModelId: string): void {
    const offset = calculateOffset(this.repositoriesPageIndex, this.repositoriesPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getRepositoriesForThreatModel(threatModelId, this.repositoriesPageSize, offset)
        .subscribe(response => {
          if (this.threatModel) {
            this.threatModel.repositories = response.repositories;
            this.repositoriesDataSource.data = response.repositories;
            this.totalRepositories = response.total;
          }
        }),
    );
  }

  /**
   * Handle repositories page change
   */
  onRepositoriesPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.repositoriesPageIndex = event.pageIndex;
    this.repositoriesPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadRepositories(this.threatModel.id);
    }
  }

  /**
   * Get the appropriate Material icon for an asset type
   * @param type The asset type
   * @returns The Material icon name to use
   */
  getAssetTypeIcon(type?: string): string {
    if (!type) {
      return 'diamond'; // Default icon
    }

    const iconMap: Record<string, string> = {
      data: 'database',
      software: 'deployed_code',
      hardware: 'host',
      infrastructure: 'factory',
      service: 'cloud_circle',
      personnel: 'person',
    };

    return iconMap[type] || 'diamond';
  }

  /**
   * Load assets for the threat model using separate API call with pagination
   */
  private loadAssets(threatModelId: string): void {
    // Initialize assets array to empty array to ensure it exists
    if (this.threatModel) {
      this.threatModel.assets = [];
    }

    const offset = calculateOffset(this.assetsPageIndex, this.assetsPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getAssetsForThreatModel(threatModelId, this.assetsPageSize, offset)
        .subscribe({
          next: response => {
            if (this.threatModel) {
              this.threatModel.assets = response.assets;
              this.assetsDataSource.data = response.assets;
              this.totalAssets = response.total;
            }
          },
          error: error => {
            this.logger.error('Failed to load assets', error);
            if (this.threatModel) {
              this.threatModel.assets = [];
              this.assetsDataSource.data = [];
              this.totalAssets = 0;
            }
          },
        }),
    );
  }

  /**
   * Handle assets page change
   */
  onAssetsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.assetsPageIndex = event.pageIndex;
    this.assetsPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadAssets(this.threatModel.id);
    }
  }

  /**
   * Load threats for the threat model using separate API call with pagination
   */
  private loadThreats(threatModelId: string): void {
    const offset = calculateOffset(this.threatsPageIndex, this.threatsPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getThreatsForThreatModel(threatModelId, this.threatsPageSize, offset)
        .subscribe({
          next: response => {
            if (this.threatModel) {
              this.threatModel.threats = response.threats;
              this.threatsDataSource.data = response.threats;
              this.totalThreats = response.total;
            }
          },
          error: error => {
            this.logger.error('Failed to load threats', error);
            if (this.threatModel) {
              this.threatModel.threats = [];
              this.threatsDataSource.data = [];
              this.totalThreats = 0;
            }
          },
        }),
    );
  }

  /**
   * Handle threats page change
   */
  onThreatsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.threatsPageIndex = event.pageIndex;
    this.threatsPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadThreats(this.threatModel.id);
    }
  }

  /**
   * Opens the dialog to create a new asset
   */
  addAsset(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create assets');
      return;
    }

    const dialogData: AssetEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
    };

    const dialogRef = this.dialog.open(AssetEditorDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: Partial<Asset> | undefined) => {
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.createAsset(this.threatModel.id, result).subscribe(
              createdAsset => {
                if (this.threatModel) {
                  // Use spread to create new array and update data source for immediate UI refresh
                  if (!this.threatModel.assets?.find(a => a.id === createdAsset.id)) {
                    this.threatModel.assets = [...(this.threatModel.assets || []), createdAsset];
                    this.assetsDataSource.data = this.threatModel.assets;
                  }
                  this.logger.info('Created asset via API', { asset: createdAsset });
                }
              },
              error => {
                this.logger.error('Failed to create asset', error);
              },
            ),
          );
        }
      }),
    );
  }

  /**
   * Loads addons from server and caches filtered lists by object type
   */
  private loadAddons(): void {
    this._subscriptions.add(
      this.addonService.list().subscribe({
        next: response => {
          this.filterAndCacheAddons(response.addons);
        },
        error: error => {
          this.logger.error('Failed to load addons', error);
          this.filterAndCacheAddons([]);
        },
      }),
    );
  }

  /**
   * Filters addons by object type and caches them
   */
  private filterAndCacheAddons(addons: Addon[]): void {
    const filterByType = (type: AddonObjectType): Addon[] =>
      addons.filter(addon => addon.objects?.includes(type));

    this.addonsForThreatModel = filterByType('threat_model');
    this.addonsForAsset = filterByType('asset');
    this.addonsForThreat = filterByType('threat');
    this.addonsForDiagram = filterByType('diagram');
    this.addonsForNote = filterByType('note');
    this.addonsForDocument = filterByType('document');
    this.addonsForRepository = filterByType('repository');
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
   * Opens the dialog to edit an existing asset
   */
  editAsset(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: AssetEditorDialogData = {
      mode: 'edit',
      asset: { ...asset },
      isReadOnly: !this.canEdit,
    };

    const dialogRef = this.dialog.open(AssetEditorDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: Partial<Asset> | undefined) => {
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatModelService.updateAsset(this.threatModel.id, asset.id, result).subscribe(
              updatedAsset => {
                if (this.threatModel && this.threatModel.assets) {
                  const index = this.threatModel.assets.findIndex(a => a.id === asset.id);
                  if (index !== -1) {
                    this.threatModel.assets[index] = updatedAsset;
                  }
                  this.logger.info('Updated asset via API', { asset: updatedAsset });
                }
              },
              error => {
                this.logger.error('Failed to update asset', error);
              },
            ),
          );
        }
      }),
    );
  }

  /**
   * Deletes an asset from the threat model
   */
  deleteAsset(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.assets || !this.canEdit) {
      this.logger.warn('User does not have permission to delete assets');
      return;
    }

    // Show confirmation dialog
    const dialogData: DeleteConfirmationDialogData = {
      id: asset.id,
      name: asset.name,
      objectType: 'asset',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this._subscriptions.add(
          this.threatModelService.deleteAsset(this.threatModel!.id, asset.id).subscribe(success => {
            if (success && this.threatModel && this.threatModel.assets) {
              // Remove the asset from local state using filter (immutable)
              // and update data source for immediate UI refresh
              this.threatModel.assets = this.threatModel.assets.filter(a => a.id !== asset.id);
              this.assetsDataSource.data = this.threatModel.assets;
              this.logger.info('Deleted asset', { assetId: asset.id });
            }
          }),
        );
      }
    });
  }

  /**
   * Opens the metadata dialog for a specific asset
   */
  openAssetMetadataDialog(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: asset.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Asset',
      objectName: `${this.transloco.translate('common.objectTypes.asset')}: ${asset.name} (${asset.id})`,
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
        if (result && this.threatModel && this.canEdit) {
          this._subscriptions.add(
            this.threatModelService
              .updateAssetMetadata(this.threatModel.id, asset.id, result)
              .subscribe(updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.assets) {
                  const assetIndex = this.threatModel.assets.findIndex(a => a.id === asset.id);
                  if (assetIndex !== -1) {
                    this.threatModel.assets[assetIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated asset metadata via API', {
                    assetId: asset.id,
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
   * Load notes for the threat model using separate API call with pagination
   */
  private loadNotes(threatModelId: string): void {
    // Initialize notes array to empty array to ensure it exists
    if (this.threatModel) {
      this.threatModel.notes = [];
    }

    const offset = calculateOffset(this.notesPageIndex, this.notesPageSize);

    this._subscriptions.add(
      this.threatModelService
        .getNotesForThreatModel(threatModelId, this.notesPageSize, offset)
        .subscribe({
          next: response => {
            if (this.threatModel) {
              this.threatModel.notes = response.notes;
              this.notesDataSource.data = response.notes;
              this.totalNotes = response.total;
            }
          },
          error: error => {
            this.logger.error('Failed to load notes', error);
            if (this.threatModel) {
              this.threatModel.notes = [];
              this.notesDataSource.data = [];
              this.totalNotes = 0;
            }
          },
        }),
    );
  }

  /**
   * Handle notes page change
   */
  onNotesPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.notesPageIndex = event.pageIndex;
    this.notesPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadNotes(this.threatModel.id);
    }
  }

  /**
   * Handle mouse enter on diagram thumbnail to show hover preview
   * @param diagramId The ID of the diagram to preview
   */
  onThumbnailHover(diagramId: string): void {
    // Clear any existing timeout
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }

    // Set hover with delay
    this.hoverTimeout = setTimeout(() => {
      this.hoveredDiagramId = diagramId;
    }, 300);
  }

  /**
   * Handle mouse leave on diagram thumbnail to hide hover preview
   */
  onThumbnailLeave(): void {
    // Clear timeout if hover hasn't triggered yet
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }

    // Hide preview immediately
    this.hoveredDiagramId = null;
  }

  /**
   * Get the SVG data URL for the currently hovered diagram
   * @returns SVG data URL or empty string if no diagram is hovered
   */
  getHoveredDiagramSvgUrl(): string {
    if (!this.hoveredDiagramId) {
      return '';
    }

    const diagram = this.diagrams.find(d => d.id === this.hoveredDiagramId);
    return diagram ? this.getSvgDataUrl(diagram) : '';
  }

  // ========== Addon Invocation Methods ==========

  /**
   * Set the addon context for row-level invocation
   * Called when a row-level addon menu trigger is clicked
   */
  setAddonRowContext(type: AddonObjectType, id: string, name: string): void {
    this.currentAddonRowContext = { type, id, name };
  }

  /**
   * Clear addon row context
   * Called when a row-level addon menu is closed
   */
  clearAddonRowContext(): void {
    this.currentAddonRowContext = null;
  }

  /**
   * Opens the invoke addon dialog
   * @param addon The addon to invoke
   * @param objectType The object type for context
   * @param isBulk True for card-level (all objects), false for row-level
   * @param objectId Optional object ID (for row-level invocations)
   * @param objectName Optional object name for display
   */
  private openInvokeAddonDialog(
    addon: Addon,
    objectType: AddonObjectType,
    isBulk: boolean,
    objectId?: string,
    objectName?: string,
  ): void {
    if (!this.threatModel) {
      this.logger.error('Cannot invoke addon: no threat model loaded');
      return;
    }

    const dialogData: InvokeAddonDialogData = {
      addon,
      threatModelId: this.threatModel.id,
      threatModelName: this.threatModel.name,
      objectType,
      isBulk,
      objectId,
      objectName,
    };

    const dialogRef = this.dialog.open(InvokeAddonDialogComponent, {
      width: '550px',
      maxHeight: '90vh',
      data: dialogData,
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: InvokeAddonDialogResult | undefined) => {
        if (result?.submitted && result.response) {
          const message = this.transloco.translate('addons.invokeDialog.invocationQueued');
          this.snackBar.open(message, '', { duration: 3000 });
          this.logger.info('Addon invocation queued', {
            addon_id: addon.id,
            invocation_id: result.response.invocation_id,
          });
        }
      }),
    );
  }

  /**
   * Invoke addon with current row context
   * Called from row-level addon menu items
   */
  invokeAddonWithRowContext(addon: Addon): void {
    if (!this.currentAddonRowContext) {
      this.logger.warn('No row context set for addon invocation');
      return;
    }
    this.openInvokeAddonDialog(
      addon,
      this.currentAddonRowContext.type,
      false,
      this.currentAddonRowContext.id,
      this.currentAddonRowContext.name,
    );
  }

  // Card-level addon invocation methods (bulk operations)

  /**
   * Invoke addon for the threat model (card-level)
   */
  invokeAddonForThreatModel(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'threat_model', true);
  }

  /**
   * Invoke addon for assets (card-level)
   */
  invokeAddonForAssets(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'asset', true);
  }

  /**
   * Invoke addon for threats (card-level)
   */
  invokeAddonForThreats(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'threat', true);
  }

  /**
   * Invoke addon for diagrams (card-level)
   */
  invokeAddonForDiagrams(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'diagram', true);
  }

  /**
   * Invoke addon for notes (card-level)
   */
  invokeAddonForNotes(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'note', true);
  }

  /**
   * Invoke addon for documents (card-level)
   */
  invokeAddonForDocuments(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'document', true);
  }

  /**
   * Invoke addon for repositories (card-level)
   */
  invokeAddonForRepositories(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'repository', true);
  }
}
