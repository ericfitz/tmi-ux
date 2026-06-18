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
import { isValidUrl } from '@app/shared/utils/url.util';
import { copyToClipboardWithFeedback } from '@app/shared/utils/clipboard.util';
import { ActivatedRoute, Router } from '@angular/router';
import { ThreatModelAuthorizationService } from './services/threat-model-authorization.service';
import { AuthorizationPrepareService } from './services/providers/authorization-prepare.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, filter, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { LanguageService } from '../../i18n/language.service';
import { LoggerService } from '../../core/services/logger.service';
import { SvgCacheService } from './services/svg-cache.service';
import { ApiService } from '../../core/services/api.service';
import { AddonService } from '../../core/services/addon.service';
import { AuthService } from '../../auth/services/auth.service';
import { SecurityReviewerService } from '../../shared/services/security-reviewer.service';
import { Addon, AddonObjectType } from '../../types/addon.types';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  UrlDropZoneDirective,
} from '@app/shared/imports';
import { DocumentEditorDialogData } from './components/document-editor-dialog/document-editor-dialog.component';
import { RepositoryEditorDialogData } from './components/repository-editor-dialog/repository-editor-dialog.component';
import {
  NoteEditorDialogData,
  NoteEditorResult,
} from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';
import { AssetEditorDialogData } from './components/asset-editor-dialog/asset-editor-dialog.component';
import {
  PermissionsDialogComponent,
  PermissionsDialogData,
} from './components/permissions-dialog/permissions-dialog.component';
import { MetadataDialogData } from './components/metadata-dialog/metadata-dialog.component';
import { ThreatEditorDialogData } from './components/threat-editor-dialog/threat-editor-dialog.component';
import {
  InvokeAddonDialogComponent,
  InvokeAddonDialogData,
  InvokeAddonDialogResult,
} from './components/invoke-addon-dialog/invoke-addon-dialog.component';
import {
  ExportDialogComponent,
  ExportDialogData,
  ExportDialogResult,
} from './components/export-dialog/export-dialog.component';

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
import { ThreatFilterStateService } from './services/threat-filter-state.service';
import {
  ThreatFilters,
  createDefaultThreatFilters,
  hasAdvancedThreatFilters,
  hasAnyThreatFilters,
} from './models/threat-filter.model';
import { ThreatModelReportService } from './services/report/threat-model-report.service';
import { TmEditFormattingService } from './services/tm-edit-formatting.service';
import { TmEditAutoSaveService, ThreatModelFormValues } from './services/tm-edit-auto-save.service';
import { TmDialogService } from './services/tm-dialog.service';
import { TmDocumentCrudService } from './services/tm-document-crud.service';
import { TmDiagramCrudService } from './services/tm-diagram-crud.service';
import { TmThreatCrudService, ThreatQueryState } from './services/tm-threat-crud.service';
import { TmRepositoryCrudService } from './services/tm-repository-crud.service';
import { TmNoteCrudService } from './services/tm-note-crud.service';
import { TmAssetCrudService } from './services/tm-asset-crud.service';
import { FrameworkService } from '../../shared/services/framework.service';
import { CellDataExtractionService } from '../../shared/services/cell-data-extraction.service';
import { FrameworkModel } from '../../shared/models/framework.model';
import {
  FieldOption,
  getFieldLabel,
  getFieldOptions,
} from '../../shared/utils/field-value-helpers';
import { DeleteConfirmationDialogData } from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { UserPickerDialogComponent } from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { AdminUser } from '@app/types/user.types';
import { ProjectPickerComponent } from '@app/shared/components/project-picker/project-picker.component';
import { ProjectService } from '@app/core/services/project.service';
import { environment } from '../../../environments/environment';

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
    UserDisplayComponent,
    ProjectPickerComponent,
    UrlDropZoneDirective,
  ],
  templateUrl: './tm-edit.component.html',
  styleUrls: ['./tm-edit.component.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: route component for editing a threat model and all its child artifacts (mutates shared state)
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

  readonly showConfidential = environment.enableConfidentialThreatModels ?? false;

  // Permission properties
  canEdit = false;
  canManagePermissions = false;

  // Section collapse state
  inputsSectionExpanded = true;
  outputsSectionExpanded = true;

  // Computed SVG properties to prevent infinite loops
  diagramSvgValidation = new Map<string, boolean>();
  diagramSvgDataUrls = new Map<string, string>();

  // Hover preview state
  hoveredDiagramId: string | null = null;
  private hoverTimeout: ReturnType<typeof setTimeout> | null = null;

  // Status dropdown options
  statusOptions: FieldOption[] = [];

  // Threat card filter state
  threatFilters: ThreatFilters = createDefaultThreatFilters();
  showAdvancedThreatFilters = false;
  threatSeverityOptions: FieldOption[] = [];
  threatStatusOptions: FieldOption[] = [];
  threatPriorityOptions: FieldOption[] = [];
  threatTypeOptions: string[] = [];
  threatSortActive = 'severity';
  threatSortDirection: 'asc' | 'desc' | '' = 'asc';
  private threatNameFilterChanged$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Security reviewer dropdown
  securityReviewerOptions: User[] = [];
  securityReviewerMode: 'dropdown' | 'picker' | 'loading' = 'loading';

  // Project picker
  projectName: string | null = null;

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
    metadata?: Metadata[];
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
    'severity',
    'name',
    'description',
    'status',
    'mitigated',
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
    const safe = value ?? [];
    this._diagrams = safe;
    this.diagramsDataSource.data = safe;
    this.computeDiagramSvgData();
  }

  // Enhanced save behavior properties
  // Simplified form tracking
  private _subscriptions = new Subscription();
  private _autoSaveSubject = new Subject<void>();
  private _isLoadingInitialData = false;
  private _originalFormValues?: ThreatModelFormValues;
  private _isSaving = false;

  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: register injected services and initialize the threat model reactive form (mutates shared state)
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
    private authService: AuthService,
    private securityReviewerService: SecurityReviewerService,
    private projectService: ProjectService,
    private threatFilterStateService: ThreatFilterStateService,
    private formattingService: TmEditFormattingService,
    private autoSaveService: TmEditAutoSaveService,
    private dialogService: TmDialogService,
    private documentCrud: TmDocumentCrudService,
    private diagramCrud: TmDiagramCrudService,
    private threatCrud: TmThreatCrudService,
    private repositoryCrud: TmRepositoryCrudService,
    private noteCrud: TmNoteCrudService,
    private assetCrud: TmAssetCrudService,
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
   * Copy text to clipboard with snackbar feedback
   * @param text Text to copy
   */
  // SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: copy text to clipboard and notify the user via snackbar
  copyToClipboard(text: string): void {
    copyToClipboardWithFeedback(text, {
      snackBar: this.snackBar,
      transloco: this.transloco,
      logger: this.logger,
    });
  }

  /**
   * Copy the threat model ID to clipboard
   */
  // SEM@dac6bb108d615c885aaf4c8b0ac82595f838ecd6: copy the current threat model ID to clipboard with snackbar feedback
  copyThreatModelId(): void {
    if (this.threatModel?.id) {
      this.copyToClipboard(this.threatModel.id);
    }
  }

  /**
   * Enter edit mode for issue URI
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: switch the issue URI field to edit mode and focus the input (mutates shared state)
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
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: return whether the issue URI hyperlink view should be rendered instead of the editor (pure)
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
  // SEM@842e13b899452ede91f10594c85586d003e70d31: open a validated URI in a new browser tab
  openUriInNewTab(uri: string): void {
    if (isValidUrl(uri)) {
      window.open(uri, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * Check if a URL is valid
   */
  // SEM@842e13b899452ede91f10594c85586d003e70d31: validate whether a string is a well-formed URL (pure)
  isValidUrl(url: string): boolean {
    return isValidUrl(url);
  }

  /** Gets the translated label for a threat severity value, handling legacy numeric values. */
  // SEM@a9878a701a7dd9c267ccc2dc9292958bb05e1fcd: fetch the translated display label for a threat severity value (pure)
  getThreatSeverityLabel(severity: string | null | undefined): string {
    return getFieldLabel(severity, 'threatEditor.threatSeverity', this.transloco);
  }

  /** Gets the translated label for a threat status value, handling legacy numeric values. */
  // SEM@a9878a701a7dd9c267ccc2dc9292958bb05e1fcd: fetch the translated display label for a threat status value (pure)
  getThreatStatusLabel(status: string | null | undefined): string {
    return getFieldLabel(status, 'threatEditor.threatStatus', this.transloco);
  }

  /** Gets the CSS class for a threat severity value, handling legacy numeric values. */
  // SEM@e99d1625a4dc0a2f2b84345424ec14cb9b48ca0f: fetch the CSS severity class for a threat severity value (pure)
  getThreatSeverityClass(severity: string | null | undefined): string {
    return this.formattingService.getThreatSeverityClass(severity);
  }

  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: initialize the threat model editor: load data, subscribe to changes, configure form (mutates shared state)
  ngOnInit(): void {
    // Initialize status dropdown options
    this.statusOptions = getFieldOptions('threatModels.status', this.transloco);

    // Initialize threat filter dropdown options
    this.threatSeverityOptions = getFieldOptions('threatEditor.threatSeverity', this.transloco);
    this.threatStatusOptions = getFieldOptions('threatEditor.threatStatus', this.transloco);
    this.threatPriorityOptions = getFieldOptions('threatEditor.threatPriority', this.transloco);

    // Set up debounced name filter for threats
    this.threatNameFilterChanged$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        this.threatFilters.name = value;
        this.threatsPageIndex = 0;
        this.loadThreatsAndSaveState();
      });

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
          this.updateThreatTypeOptions();
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
        this.threatSeverityOptions = getFieldOptions('threatEditor.threatSeverity', this.transloco);
        this.threatStatusOptions = getFieldOptions('threatEditor.threatStatus', this.transloco);
        this.threatPriorityOptions = getFieldOptions('threatEditor.threatPriority', this.transloco);
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

    // Populate threat type options from the threat model's framework
    this.updateThreatTypeOptions();

    // Restore threat card state if returning to the same threat model
    this.restoreThreatCardState(id);

    // Load threats via API with filters, sorting, and pagination
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

    // Load security reviewers for the reviewer dropdown
    this.loadSecurityReviewers();

    // Re-enable auto-save after initial population is complete
    setTimeout(() => {
      this._isLoadingInitialData = false;
    }, 100);
  }

  /**
   * Update form editability based on permissions
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: enable or disable the threat model form based on the user's edit permission (mutates shared state)
  private updateFormEditability(): void {
    if (this.canEdit) {
      this.threatModelForm.enable();
    } else {
      this.threatModelForm.disable();
    }
  }

  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: connect MatSort instances to their table data sources after the view initializes (mutates shared state)
  ngAfterViewInit(): void {
    // Connect sort to data sources
    if (this.assetsSort) {
      this.assetsDataSource.sort = this.assetsSort;
    }
    // Threats table uses server-side sorting — no client-side MatSort setup needed
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

  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: persist threat card state, unsubscribe all subscriptions, and clear SVG caches on teardown (mutates shared state)
  ngOnDestroy(): void {
    // Save threat card state for restoration if returning to same TM
    this.saveThreatCardState();

    // Complete destroy subject for takeUntil subscriptions
    this.destroy$.next();
    this.destroy$.complete();

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
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: evict all cached SVG data for diagrams to free memory (mutates shared state)
  private clearSvgCaches(): void {
    this.svgCacheService.clearAllCaches();
    this.diagramSvgValidation.clear();
    this.diagramSvgDataUrls.clear();
  }

  /** Toggle the Inputs section expand/collapse state */
  // SEM@7e0905392e5e4c24877e4640bec67f12d70d9ee7: toggle the expand/collapse state of the Inputs section (mutates shared state)
  toggleInputsSection(): void {
    this.inputsSectionExpanded = !this.inputsSectionExpanded;
  }

  /** Toggle the Outputs section expand/collapse state */
  // SEM@7e0905392e5e4c24877e4640bec67f12d70d9ee7: toggle the expand/collapse state of the Outputs section (mutates shared state)
  toggleOutputsSection(): void {
    this.outputsSectionExpanded = !this.outputsSectionExpanded;
  }

  /**
   * Set up simplified form-level change monitoring
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: subscribe to form value changes and trigger auto-save when the threat model form is dirty (mutates shared state)
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
  // SEM@5430d2efdce732310b5e837d71bd1329e58af449: compare current form values against saved snapshot to detect unsaved edits (pure)
  private hasFormChanged(formValue: ThreatModelFormValues): boolean {
    return this.autoSaveService.hasFormChanged(formValue, this._originalFormValues);
  }

  /**
   * Update original form values after successful save
   */
  // SEM@df857842acb683048164ddc3b37030f666db756c: store current form values as the saved baseline after a successful save (mutates shared state)
  private updateOriginalFormValues(formValue: ThreatModelFormValues): void {
    this._originalFormValues = { ...formValue };
  }

  /**
   * Handle framework selection change (for framework-specific logic)
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: handle threat model framework selection change and trigger auto-save (mutates shared state)
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

  // ─── Security Reviewer ───────────────────────────────────────────────

  /**
   * Load security reviewer options via shared SecurityReviewerService.
   */
  // SEM@c6b6df846b0cda2a62a673463fd38771ec98b377: fetch security reviewer options and set dropdown or picker mode (mutates shared state)
  private loadSecurityReviewers(): void {
    this._subscriptions.add(
      this.securityReviewerService
        .loadReviewerOptions(this.threatModel?.security_reviewer)
        .subscribe(result => {
          if (result.mode === 'dropdown') {
            this.securityReviewerOptions = result.reviewers;
            this.securityReviewerMode = 'dropdown';
          } else {
            this.securityReviewerMode = 'picker';
          }
          this.cdr.detectChanges();
        }),
    );
  }

  /**
   * Handle security reviewer dropdown selection change.
   * Persists immediately via PATCH (not through form auto-save).
   */
  // SEM@6c071df61169a648a295f203e10831067d21bcaa: persist security reviewer assignment via PATCH with optimistic update and rollback
  onSecurityReviewerChange(event: { value: unknown }): void {
    if (!this.threatModel || !this.canEdit) return;

    const selectedUser = event.value as User | null;
    const previousReviewer = this.threatModel.security_reviewer ?? null;

    // Update local model immediately for responsive UI
    this.threatModel.security_reviewer = selectedUser;

    this._subscriptions.add(
      this.threatModelService
        .patchThreatModel(this.threatModel.id, { security_reviewer: selectedUser })
        .subscribe({
          next: result => {
            if (result && this.threatModel) {
              this.threatModel.security_reviewer = result.security_reviewer;
              this.threatModel.modified_at = result.modified_at;
              this.cdr.detectChanges();
              this.logger.info('Security reviewer updated', {
                threatModelId: this.threatModel.id,
                reviewer: selectedUser?.email ?? 'none',
              });
            }
          },
          error: error => {
            this.logger.error('Failed to update security reviewer', error);
            // Rollback on error
            if (this.threatModel) {
              this.threatModel.security_reviewer = previousReviewer;
              this.cdr.detectChanges();
            }
          },
        }),
    );
  }

  /**
   * Open user picker dialog for security reviewer (fallback when group list unavailable)
   */
  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: dispatch user picker dialog to assign a security reviewer when dropdown is unavailable
  openSecurityReviewerPicker(): void {
    if (!this.threatModel || !this.canEdit) return;

    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      data: {
        title: this.transloco.translate('threatModels.changeSecurityReviewer'),
      },
    });

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((selectedAdminUser: AdminUser | undefined) => {
        if (!selectedAdminUser || !this.threatModel) return;

        const user: User = {
          principal_type: 'user',
          provider: selectedAdminUser.provider,
          provider_id: selectedAdminUser.provider_user_id,
          email: selectedAdminUser.email,
          display_name: selectedAdminUser.name,
        };

        this.onSecurityReviewerChange({ value: user });
      }),
    );
  }

  /**
   * Clear the security reviewer assignment
   */
  // SEM@6c071df61169a648a295f203e10831067d21bcaa: remove the assigned security reviewer from the threat model
  clearSecurityReviewer(): void {
    this.onSecurityReviewerChange({ value: null });
  }

  /**
   * Compare function for mat-select to match User objects by provider identity
   */
  compareReviewers = (a: User | null, b: User | null): boolean =>
    this.securityReviewerService.compareReviewers(a, b);

  // ─── End Security Reviewer ─────────────────────────────────────────

  // ─── Project Picker ───────────────────────────────────────────────

  /**
   * Handle project picker selection change.
   * Persists immediately via PATCH (not through form auto-save).
   */
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: persist project assignment change via PATCH with optimistic update and rollback
  onProjectChange(projectId: string | null): void {
    if (!this.threatModel || !this.canEdit) return;

    const previousProjectId = this.threatModel.project_id ?? null;

    // Update local model immediately for responsive UI
    this.threatModel.project_id = projectId;

    this._subscriptions.add(
      this.threatModelService
        .patchThreatModel(this.threatModel.id, { project_id: projectId })
        .subscribe({
          next: result => {
            if (result && this.threatModel) {
              this.threatModel.project_id = result.project_id;
              this.threatModel.modified_at = result.modified_at;
              this.cdr.detectChanges();
              this.logger.info('Project updated', {
                threatModelId: this.threatModel.id,
                projectId: projectId ?? 'none',
              });
            }
          },
          error: error => {
            this.logger.error('Failed to update project', error);
            // Rollback on error
            if (this.threatModel) {
              this.threatModel.project_id = previousProjectId;
              this.cdr.detectChanges();
            }
          },
        }),
    );
  }

  // ─── End Project Picker ───────────────────────────────────────────

  /**
   * Simplified field blur handler (mainly for UI state like issue URL editing)
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: route field blur events to field-specific handlers for UI state updates (pure)
  onFieldBlur(fieldName: string, event: Event): void {
    // Only handle UI-specific blur logic now - auto-save is handled by form valueChanges
    if (fieldName === 'issue_uri') {
      this.onIssueUriBlur(event);
    }
  }

  /**
   * Issue URI blur handler for UI state management
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: finalize issue URI display value and exit edit mode on blur (mutates shared state)
  onIssueUriBlur(_event: Event): void {
    // Update the display value for consistency
    const currentValue = (this.threatModelForm.get('issue_uri')?.value as string) || '';
    this.initialIssueUriValue = currentValue;
    this.isEditingIssueUri = false;
    // Auto-save is now handled by form valueChanges subscription
  }

  /**
   * Handles a URL dropped onto the issue URI container.
   * Sets the issue_uri form control value to the dropped URL.
   */
  // SEM@52e5d401a2aa7bf4620d0d17860898f6b21da94a: populate the issue URI form control with a dropped URL (mutates shared state)
  onIssueUriUrlDropped(url: string): void {
    if (!this.canEdit) return;
    this.threatModelForm.get('issue_uri')?.setValue(url);
    this.threatModelForm.get('issue_uri')?.markAsDirty();
    this.initialIssueUriValue = url;
    this.isEditingIssueUri = false;
  }

  /**
   * Opens a dialog to create a new threat
   * If the user confirms, adds the threat to the threat model
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: open threat creation dialog to add a new threat to the threat model
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
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: navigate to threat page for existing threats or open creation dialog for new threats
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
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: build threat editor dialog data and dispatch create or edit dialog
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

    this._subscriptions.add(
      this.dialogService.openThreatEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        if (dialogMode === 'create') {
          this._handleCreateThreatResult(result);
        } else if (dialogMode === 'edit' && threat) {
          this._handleEditThreatResult(result, threat);
        }
      }),
    );
  }

  /** Handle creating a new threat from dialog result. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: store a new threat via API and reload the threats list on success
  private _handleCreateThreatResult(result: Partial<Threat>): void {
    if (!this.threatModel) return;
    this._subscriptions.add(
      this.threatCrud.createThreat(this.threatModel.id, result).subscribe({
        next: () => {
          if (this.threatModel) {
            this.loadThreats(this.threatModel.id);
          }
          this.updateFrameworkControlState();
        },
        error: error => this.logger.error('Failed to create threat', error),
      }),
    );
  }

  /** Handle updating an existing threat from dialog result. */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: update an existing threat via API and refresh the local threats list
  private _handleEditThreatResult(result: Partial<Threat>, threat: Threat): void {
    if (!this.threatModel) return;
    this._subscriptions.add(
      this.threatCrud.updateThreat(this.threatModel.id, threat, result).subscribe({
        next: updatedThreat => {
          const index = this.threatModel?.threats?.findIndex(t => t.id === threat.id) ?? -1;
          if (index !== -1 && this.threatModel?.threats) {
            this.threatModel.threats[index] = updatedThreat;
            this.threatsDataSource.data = this.threatModel.threats;
          }
        },
        error: error => this.logger.error('Failed to update threat', error),
      }),
    );
  }

  /**
   * Deletes a threat from the threat model
   * @param threat The threat to delete
   * @param event The click event
   */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: confirm and delete a threat, then remove it from the local threat model state
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

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.threats) return;
        this._subscriptions.add(
          this.threatCrud.deleteThreat(this.threatModel.id, threat.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.threats) {
                // Remove the threat from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.threats = this.threatModel.threats.filter(t => t.id !== threat.id);
                this.threatsDataSource.data = this.threatModel.threats;

                // Update framework control state since we removed a threat
                this.updateFrameworkControlState();
              }
            },
            error: error => this.logger.error('Failed to delete threat', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens a dialog to create a new diagram
   * If the user confirms, adds the new diagram to the threat model
   */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: open diagram creation dialog and add the new diagram to the threat model
  addDiagram(): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add diagram - insufficient permissions');
      return;
    }
    this._subscriptions.add(
      this.dialogService
        .openDiagramCreate({ threatModelName: this.threatModel?.name || '' })
        .subscribe(diagramData => {
          if (!diagramData || !this.threatModel) return;
          this._subscriptions.add(
            this.diagramCrud.createDiagram(this.threatModel.id, diagramData).subscribe({
              next: created => {
                if (!this.threatModel) return;
                this.diagrams = [...this.diagrams, created];
                this.totalDiagrams = this.totalDiagrams + 1;
                this.threatModel.diagrams = [...(this.threatModel.diagrams ?? []), created];
              },
              error: error => this.logger.error('Failed to create diagram', error),
            }),
          );
        }),
    );
  }

  /**
   * Deletes a diagram from the threat model
   * @param diagram The diagram to delete
   * @param event The click event
   */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: confirm and delete a diagram, then remove it from the local threat model state
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

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel) return;
        this._subscriptions.add(
          this.diagramCrud.deleteDiagram(this.threatModel.id, diagram.id).subscribe({
            next: success => {
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
            },
            error: error => this.logger.error('Failed to delete diagram', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens a dialog to create a new document
   * If the user confirms, adds the new document to the threat model
   */
  // SEM@58d59feac54c60ffda564c30c3c6881885a5d865: open document creation dialog and store the new document on the threat model
  addDocument(uri?: string): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add document - insufficient permissions');
      return;
    }
    const dialogData: DocumentEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
      threatModelId: this.threatModel?.id,
      ...(uri ? { document: { uri } as Document } : {}),
    };

    this._subscriptions.add(
      this.dialogService.openDocumentEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        // Service-mode: the dialog already created the document in-place.
        if (result.createdDocument) {
          this.loadDocuments(this.threatModel.id);
          return;
        }

        this._subscriptions.add(
          this.documentCrud.createDocument(this.threatModel.id, result.values).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadDocuments(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create document', error),
          }),
        );
      }),
    );
  }

  /**
   * Handles a URL dropped onto the documents card.
   * Opens the create document dialog with the URI pre-populated.
   */
  // SEM@6b3cabf678313d326a2521b0cf1b48844d4c2aa1: handle a dropped URL by opening the document creation dialog pre-populated with the URI
  onDocumentUrlDropped(url: string): void {
    if (!this.canEdit || this.dialog.openDialogs.length > 0) return;
    this.addDocument(url);
  }

  /**
   * Opens a dialog to edit a document
   * If the user confirms, updates the document in the threat model
   * @param document The document to edit
   * @param event The click event
   */
  // SEM@58d59feac54c60ffda564c30c3c6881885a5d865: open document editor dialog and persist the updated document to the threat model
  editDocument(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }

    const dialogData: DocumentEditorDialogData = {
      document,
      mode: 'edit',
      isReadOnly: !this.canEdit,
      threatModelId: this.threatModel.id,
    };

    this._subscriptions.add(
      this.dialogService.openDocumentEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud
            .updateDocument(this.threatModel.id, document.id, result.values)
            .subscribe({
              next: updatedDocument => {
                if (this.threatModel && this.threatModel.documents) {
                  const index = this.threatModel.documents.findIndex(d => d.id === document.id);
                  if (index !== -1) {
                    this.threatModel.documents[index] = updatedDocument;
                  }
                  this.documentsDataSource.data = this.threatModel.documents;
                }
              },
              error: error => this.logger.error('Failed to update document', error),
            }),
        );
      }),
    );
  }

  /**
   * Deletes a document from the threat model
   * @param document The document to delete
   * @param event The click event
   */
  // SEM@58d59feac54c60ffda564c30c3c6881885a5d865: confirm and delete a document, then remove it from the local threat model state
  deleteDocument(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete document - insufficient permissions');
      return;
    }

    if (!this.threatModel || !this.threatModel.documents) {
      return;
    }

    const dialogData: DeleteConfirmationDialogData = {
      id: document.id,
      name: document.name,
      objectType: 'document',
    };

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud.deleteDocument(this.threatModel.id, document.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.documents) {
                this.threatModel.documents = this.threatModel.documents.filter(
                  d => d.id !== document.id,
                );
                this.documentsDataSource.data = this.threatModel.documents;
              }
            },
            error: error => this.logger.error('Failed to delete document', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens a dialog to create a new source code repository reference
   * If the user confirms, adds the new source code to the threat model
   */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: open repository creation dialog and store the new repository on the threat model
  addRepository(uri?: string): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add repository - insufficient permissions');
      return;
    }

    const dialogData: RepositoryEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
      ...(uri ? { repository: { uri } as Repository } : {}),
    };

    this._subscriptions.add(
      this.dialogService.openRepositoryEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud.createRepository(this.threatModel.id, result).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadRepositories(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create repository', error),
          }),
        );
      }),
    );
  }

  /**
   * Handles a URL dropped onto the repositories card.
   * Opens the create repository dialog with the URI pre-populated.
   */
  // SEM@6b3cabf678313d326a2521b0cf1b48844d4c2aa1: handle a dropped URL by opening the repository creation dialog pre-populated with the URI
  onRepositoryUrlDropped(url: string): void {
    if (!this.canEdit || this.dialog.openDialogs.length > 0) return;
    this.addRepository(url);
  }

  /**
   * Opens a dialog to edit a repository reference
   * If the user confirms, updates the repository in the threat model
   * @param repository The repository to edit
   * @param event The click event
   */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: open editor dialog and update a repository reference on the threat model (mutates shared state)
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

    this._subscriptions.add(
      this.dialogService.openRepositoryEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud
            .updateRepository(this.threatModel.id, repository.id, result)
            .subscribe({
              next: updatedRepository => {
                if (this.threatModel && this.threatModel.repositories) {
                  const index = this.threatModel.repositories.findIndex(
                    r => r.id === repository.id,
                  );
                  if (index !== -1) {
                    this.threatModel.repositories[index] = updatedRepository;
                  }
                  this.repositoriesDataSource.data = this.threatModel.repositories;
                }
              },
              error: error => this.logger.error('Failed to update repository', error),
            }),
        );
      }),
    );
  }

  /**
   * Deletes a repository reference from the threat model
   * @param repository The repository to delete
   * @param event The click event
   */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: confirm and delete a repository reference from the threat model (mutates shared state)
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

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.repositories) return;
        this._subscriptions.add(
          this.repositoryCrud.deleteRepository(this.threatModel.id, repository.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.repositories) {
                // Remove the repository from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.repositories = this.threatModel.repositories.filter(
                  r => r.id !== repository.id,
                );
                this.repositoriesDataSource.data = this.threatModel.repositories;
              }
            },
            error: error => this.logger.error('Failed to delete repository', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific repository
   */
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: open metadata dialog and update a repository's metadata via API (mutates shared state)
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

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud
            .updateRepositoryMetadata(this.threatModel.id, repository.id, result)
            .subscribe({
              next: updatedMetadata => {
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
              },
              error: error => this.logger.error('Failed to update repository metadata', error),
            }),
        );
      }),
    );
  }

  /**
   * Opens the dialog to create a new note
   */
  // SEM@139bebbae2731b16f251536df55fbd29ea901c42: open note editor dialog and create a new note on the threat model (mutates shared state)
  addNote(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create notes');
      return;
    }

    const dialogData: NoteEditorDialogData = {
      mode: 'create',
      entityType: 'threat_model',
      isReadOnly: !this.canEdit,
    };
    const dialogRef = this.dialogService.openNoteEditor(dialogData);

    // Subscribe to save events from the dialog
    const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(noteResult => {
      if (!this.threatModel) {
        return;
      }
      this._subscriptions.add(
        this.noteCrud.createNote(this.threatModel.id, noteResult).subscribe({
          next: createdNote => {
            if (this.threatModel) {
              this.loadNotes(this.threatModel.id);
              // Notify the dialog that the note was created
              dialogRef.componentInstance.setCreatedNoteId(createdNote.id);
            }
          },
          error: error => this.logger.error('Failed to create note', error),
        }),
      );
    });

    this._subscriptions.add(saveSubscription);

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: NoteEditorResult | undefined) => {
        if (!result || !this.threatModel) {
          return;
        }
        // Check if the note was already created via the save button
        if (result.wasCreated && result.noteId) {
          // Note was already created, update it if there are changes
          this._subscriptions.add(
            this.noteCrud
              .updateNote(this.threatModel.id, result.noteId, result.formValue)
              .subscribe({
                next: updatedNote => {
                  if (this.threatModel && this.threatModel.notes) {
                    const index = this.threatModel.notes.findIndex(n => n.id === result.noteId);
                    if (index !== -1) {
                      this.threatModel.notes[index] = updatedNote;
                    }
                    this.notesDataSource.data = this.threatModel.notes;
                    this.logger.info('Updated note via API', { note: updatedNote });
                  }
                },
                error: error => this.logger.error('Failed to update note', error),
              }),
          );
        } else {
          // Note was not created yet, create it now
          this._subscriptions.add(
            this.noteCrud.createNote(this.threatModel.id, result.formValue).subscribe({
              next: () => {
                if (this.threatModel) {
                  this.loadNotes(this.threatModel.id);
                }
              },
              error: error => this.logger.error('Failed to create note', error),
            }),
          );
        }
      }),
    );
  }

  /**
   * Navigates to the full-page note editor for an existing note.
   * For new notes, use addNote() which opens the dialog.
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: navigate to the full-page note editor for an existing note
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
  // SEM@139bebbae2731b16f251536df55fbd29ea901c42: confirm and delete a note from the threat model (mutates shared state)
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
    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.notes) {
          return;
        }
        this._subscriptions.add(
          this.noteCrud.deleteNote(this.threatModel.id, note.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.notes) {
                // Remove the note from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.notes = this.threatModel.notes.filter(n => n.id !== note.id);
                this.notesDataSource.data = this.threatModel.notes;
                this.logger.info('Deleted note', { noteId: note.id });
              }
            },
            error: error => this.logger.error('Failed to delete note', error),
          }),
        );
      }),
    );
  }

  /**
   * Downloads a note as a markdown file
   */
  // SEM@6035d4ff1f129142bc9e672956f001cf13ed700b: download a note's content as a markdown file to the user's device
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
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch diagram model from API and download it in the specified format
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
      this.diagramCrud.getDiagramModel(this.threatModel.id, diagram.id, format).subscribe({
        next: content => {
          const mimeType = this.formattingService.getMimeTypeForFormat(format);
          const extension = this.formattingService.getExtensionForFormat(format);
          const filename = this.formattingService.generateDiagramModelFilename(
            this.threatModel?.name,
            diagram.name,
            extension,
          );
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
   * Handle diagram model export using File System Access API with fallback
   */
  // SEM@febac2629261f5184c68f094bd6ab6afc986bea7: save a diagram model blob to disk using File System API or anchor fallback
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
  // SEM@febac2629261f5184c68f094bd6ab6afc986bea7: map an export format to its save-dialog file type configuration (pure)
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
  // SEM@139bebbae2731b16f251536df55fbd29ea901c42: open metadata dialog and update a note's metadata via API (mutates shared state)
  openNoteMetadataDialog(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: note.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Note',
      objectName: `${this.transloco.translate('common.objectTypes.note')}: ${note.name} (${note.id})`,
    };
    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel || !this.canEdit) {
          return;
        }
        this._subscriptions.add(
          this.noteCrud.updateNoteMetadata(this.threatModel.id, note.id, result).subscribe({
            next: updatedMetadata => {
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
            },
            error: error => this.logger.error('Failed to update note metadata', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific document
   */
  // SEM@58d59feac54c60ffda564c30c3c6881885a5d865: open metadata dialog and update a document's metadata via API (mutates shared state)
  openDocumentMetadataDialog(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: document.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Document',
      objectName: `${this.transloco.translate('common.objectTypes.document')}: ${document.name} (${document.id})`,
    };

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud
            .updateDocumentMetadata(this.threatModel.id, document.id, result)
            .subscribe({
              next: updatedMetadata => {
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
              },
              error: error => this.logger.error('Failed to update document metadata', error),
            }),
        );
      }),
    );
  }

  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: discard edits and navigate back to the dashboard
  cancel(): void {
    // Clear SVG caches before navigating away
    this.clearSvgCaches();
    void this.router.navigate(['/dashboard']);
  }

  /**
   * Opens the permissions dialog to manage threat model permissions
   */
  // SEM@b35f37669194da06fdcb5b2eba70858b8916088f: open permissions dialog and persist updated authorization and owner to the threat model (mutates shared state)
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
  // SEM@384da63391fdb7be917bbe163eee1e687d263bdf: fetch fresh metadata, open metadata dialog, and persist threat model metadata via API (mutates shared state)
  openMetadataDialog(): void {
    if (!this.threatModel) {
      return;
    }

    // Fetch fresh metadata from the API so the dialog reflects server state
    // (the cached this.threatModel.metadata can lag a prior save's response).
    this._subscriptions.add(
      this.threatModelService.getThreatModelMetadata(this.threatModel.id).subscribe(metadata => {
        if (!this.threatModel) return;
        this.threatModel.metadata = metadata || [];

        const dialogData: MetadataDialogData = {
          metadata: this.threatModel.metadata,
          isReadOnly: !this.canEdit,
          objectType: 'ThreatModel',
          objectName: `${this.transloco.translate('common.objectTypes.threatModel')}: ${this.threatModel.name} (${this.threatModel.id})`,
        };

        this._subscriptions.add(
          this.dialogService.openMetadata(dialogData).subscribe(result => {
            if (result && this.threatModel) {
              this._subscriptions.add(
                this.threatModelService
                  .updateThreatModelMetadata(this.threatModel.id, result)
                  .subscribe({
                    next: updatedMetadata => {
                      if (updatedMetadata && this.threatModel) {
                        this.threatModel.metadata = updatedMetadata;
                        this.threatModel.modified_at = new Date().toISOString();
                      }
                    },
                    error: error =>
                      this.logger.error('Failed to update threat model metadata', error),
                  }),
              );
            }
          }),
        );
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific diagram
   */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch diagram metadata, open metadata dialog, and persist updates via API (mutates shared state)
  openDiagramMetadataDialog(diagram: Diagram, event: Event): void {
    event.stopPropagation();
    // Remove focus from the button to restore non-focused state
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) return;

    // Fetch metadata from API since list endpoint doesn't include it
    this._subscriptions.add(
      this.diagramCrud.getDiagramMetadata(this.threatModel.id, diagram.id).subscribe({
        next: metadata => {
          const dialogData: MetadataDialogData = {
            metadata: metadata || [],
            isReadOnly: !this.canEdit,
            objectType: 'Diagram',
            objectName: `${this.transloco.translate('common.objectTypes.diagram')}: ${diagram.name} (${diagram.id})`,
          };
          this._subscriptions.add(
            this.dialogService.openMetadata(dialogData).subscribe(result => {
              if (!result || !this.threatModel) return;
              this._subscriptions.add(
                this.diagramCrud
                  .updateDiagramMetadata(this.threatModel.id, diagram.id, result)
                  .subscribe({
                    next: updatedMetadata => {
                      if (updatedMetadata) {
                        this.logger.info('Updated diagram metadata via API', {
                          diagramId: diagram.id,
                          metadata: updatedMetadata,
                        });
                      }
                    },
                    error: error => this.logger.error('Failed to update diagram metadata', error),
                  }),
              );
            }),
          );
        },
        error: error => this.logger.error('Failed to fetch diagram metadata', error),
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific threat
   */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: open metadata dialog and update a threat's metadata via API (mutates shared state)
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

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (result && this.threatModel) {
          this._subscriptions.add(
            this.threatCrud.updateThreatMetadata(this.threatModel.id, threat.id, result).subscribe({
              next: updatedMetadata => {
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
              },
              error: error => this.logger.error('Failed to update threat metadata', error),
            }),
          );
        }
      }),
    );
  }

  /**
   * Opens the repository view (placeholder for future functionality)
   */
  // SEM@4135678012329fabec902d99e43836ab6545b889: placeholder: log intent to open repository view (no-op)
  openRepositoryView(): void {
    // TODO: Implement repository view functionality
    this.logger.info('Repository view clicked - functionality to be implemented');
  }

  /**
   * Generates and saves a PDF report for the current threat model
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: generate and save a PDF report for the current threat model
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
   * Navigate to the Timmy chat page for the current threat model.
   */
  // SEM@0d2745da4e8e3843cd65f62979270c63dc57e657: navigate to the Timmy AI chat page for the current threat model
  openChat(): void {
    if (!this.threatModel) return;
    void this.router.navigate(['/tm', this.threatModel.id, 'chat']);
  }

  /**
   * Navigate to the audit trail page for the current threat model (all entities).
   */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: navigate to the full audit trail page for the current threat model
  openAuditTrail(): void {
    if (!this.threatModel) return;
    void this.router.navigate(['/tm', this.threatModel.id, 'audit']);
  }

  /**
   * Navigate to the audit trail page scoped to a specific sub-entity.
   */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: navigate to the audit trail page filtered to a specific sub-entity
  openEntityAuditTrail(
    objectType: string,
    entityId: string,
    entityName: string,
    event?: MouseEvent,
  ): void {
    if (event) event.stopPropagation();
    if (!this.threatModel) return;
    void this.router.navigate(['/tm', this.threatModel.id, 'audit'], {
      queryParams: { objectType, objectId: entityId, entityName },
    });
  }

  // SEM@fb0bbd2e1d7140740b5cc7054991efc5dd765fd4: open export dialog and download the full threat model as a JSON file
  downloadToDesktop(): void {
    if (!this.threatModel) {
      this.logger.warn('Cannot download threat model: no threat model loaded');
      return;
    }

    this.logger.info('Opening export dialog for threat model', {
      threatModelId: this.threatModel.id,
      threatModelName: this.threatModel.name,
    });

    const dialogRef = this.dialog.open<ExportDialogComponent, ExportDialogData, ExportDialogResult>(
      ExportDialogComponent,
      {
        width: '450px',
        data: {
          threatModelName: this.threatModel.name,
          fetchObservable: this.threatModelService.exportThreatModel(this.threatModel.id),
        },
        disableClose: true,
      },
    );

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe(result => {
        if (!result) return;
        void this.triggerDownload(result.blob, result.filename);
      }),
    );
  }

  /**
   * Trigger a file download using the File System Access API with fallback.
   * Must be called within a user activation context (e.g., from a dialog
   * afterClosed callback triggered by a user click).
   */
  // SEM@fb0bbd2e1d7140740b5cc7054991efc5dd765fd4: save a blob to disk using File System Access API with anchor-element fallback
  private async triggerDownload(blob: Blob, filename: string): Promise<void> {
    if ('showSaveFilePicker' in window) {
      try {
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

        this.logger.info('Threat model saved via File System Access API', { filename });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          this.logger.debugComponent('TmEdit', 'Save cancelled by user');
          return;
        }
        this.logger.warn('File System Access API failed, using fallback', error);
      }
    }

    // Fallback: anchor element download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    this.logger.info('Threat model downloaded via fallback method', { filename });
  }

  /**
   * Check if the threat model has any threats defined
   * Used to determine if the framework control should be disabled
   * @returns true if threats exist, false otherwise
   */
  // SEM@959a96b7f5f6dcedf8de21fc57c1e98b75d19a98: return whether the threat model has at least one threat defined (pure)
  hasThreats(): boolean {
    return !!(this.threatModel?.threats && this.threatModel.threats.length > 0);
  }

  /**
   * Update the framework control's disabled state based on whether threats exist
   * The framework cannot be changed once threats are defined to maintain data consistency
   * Also respects read-only mode permissions
   */
  // SEM@3d4759907cc752579d755e92067e98a48c64991e: enable or disable the framework form control based on threat existence and edit permission (mutates shared state)
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

  /** Gets the appropriate Material icon for a diagram based on its type. */
  // SEM@e99d1625a4dc0a2f2b84345424ec14cb9b48ca0f: map a diagram to its Material icon name by type (pure)
  getDiagramIcon(diagram: Diagram): string {
    return this.formattingService.getDiagramIcon(diagram);
  }

  /** Gets tooltip text for a diagram icon showing the diagram type. */
  // SEM@e99d1625a4dc0a2f2b84345424ec14cb9b48ca0f: map a diagram to its localized tooltip text by type (pure)
  getDiagramTooltip(diagram: Diagram): string {
    return this.formattingService.getDiagramTooltip(diagram);
  }

  /**
   * Compute SVG data for all diagrams to prevent change detection loops
   */
  // SEM@e99d1625a4dc0a2f2b84345424ec14cb9b48ca0f: precompute and cache SVG validation flags and data URLs for all diagrams (mutates shared state)
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
          isValid = this.formattingService.isValidBase64Svg(diagram.image.svg);
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
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: return whether a diagram has a valid cached SVG thumbnail (pure)
  hasSvgImage(diagram: Diagram): boolean {
    return this.diagramSvgValidation.get(diagram.id) || false;
  }

  /**
   * Get the SVG data URL for a diagram thumbnail
   * @param diagram The diagram object
   * @returns SVG data URL or empty string
   */
  // SEM@fa838e60ffa1932bc800ea6767510da97633c1e8: return the cached SVG data URL for a diagram thumbnail (pure)
  getSvgDataUrl(diagram: Diagram): string {
    return this.diagramSvgDataUrls.get(diagram.id) || '';
  }

  /**
   * Handle framework change - log the change for debugging purposes
   * @param oldFramework The previous framework name
   * @param newFramework The new framework name
   */
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: log a framework change event and warn if threats already exist (pure)
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
   * Apply form changes to the threat model object before saving
   */
  // SEM@49eb7e7e833ee0ab440b0ac33b2873d626065d8e: sync valid form field values onto the threat model before saving (mutates shared state)
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
  // SEM@1e88117765617743294af0ef90f010d702265698: emit to the debounced auto-save subject to schedule a save (mutates shared state)
  private autoSaveThreatModel(): void {
    this.logger.info('Auto-save triggered');
    this._autoSaveSubject.next();
  }

  /**
   * Perform the actual auto-save operation with enhanced error handling
   * This method is called after debouncing
   */
  // SEM@5430d2efdce732310b5e837d71bd1329e58af449: PATCH changed threat model fields to the API and reconcile state on success (reads DB)
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

    // Build a partial update containing only changed fields. The service
    // also strips authorization/owner defensively.
    const updates = this.autoSaveService.buildUpdates(formValues, this._originalFormValues!);
    const safeUpdates = updates as Record<string, unknown>;

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
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch a paginated diagram list for a threat model and update component state (reads DB)
  private loadDiagrams(threatModelId: string): void {
    this._subscriptions.add(
      this.diagramCrud
        .loadDiagrams(threatModelId, this.diagramsPageIndex, this.diagramsPageSize)
        .subscribe({
          next: page => {
            this.diagrams = page.diagrams;
            this.totalDiagrams = page.total;

            // Update DIAGRAMS_BY_ID map with real diagram data
            page.diagrams.forEach(diagram => DIAGRAMS_BY_ID.set(diagram.id, diagram));

            // Update threat model diagrams property for consistency
            if (this.threatModel) {
              this.threatModel.diagrams = page.diagrams;
            }
          },
          error: error => this.logger.error('Failed to load diagrams', error),
        }),
    );
  }

  /**
   * Handle diagrams page change
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle diagram paginator event and reload the current page (reads DB)
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
  // SEM@58d59feac54c60ffda564c30c3c6881885a5d865: fetch a paginated document list for a threat model and update component state (reads DB)
  private loadDocuments(threatModelId: string): void {
    this._subscriptions.add(
      this.documentCrud
        .loadDocuments(threatModelId, this.documentsPageIndex, this.documentsPageSize)
        .subscribe({
          next: page => {
            if (this.threatModel) {
              this.threatModel.documents = page.documents;
              this.documentsDataSource.data = page.documents;
              this.totalDocuments = page.total;
            }
          },
          error: error => this.logger.error('Failed to load documents', error),
        }),
    );
  }

  /**
   * Handle documents page change
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle document paginator event and reload the current page (reads DB)
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
  // SEM@273bab474c740f41e9d130e66d12ffdd239e9ac9: fetch a paginated repository list for a threat model and update component state (reads DB)
  private loadRepositories(threatModelId: string): void {
    this._subscriptions.add(
      this.repositoryCrud
        .loadRepositories(threatModelId, this.repositoriesPageIndex, this.repositoriesPageSize)
        .subscribe({
          next: page => {
            if (this.threatModel) {
              this.threatModel.repositories = page.repositories;
              this.repositoriesDataSource.data = page.repositories;
              this.totalRepositories = page.total;
            }
          },
          error: error => this.logger.error('Failed to load repositories', error),
        }),
    );
  }

  /**
   * Handle repositories page change
   */
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle repository paginator event and reload the current page (reads DB)
  onRepositoriesPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.repositoriesPageIndex = event.pageIndex;
    this.repositoriesPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadRepositories(this.threatModel.id);
    }
  }

  /** Gets the appropriate Material icon for an asset type. */
  // SEM@e99d1625a4dc0a2f2b84345424ec14cb9b48ca0f: map an asset type string to its Material icon name (pure)
  getAssetTypeIcon(type?: string): string {
    return this.formattingService.getAssetTypeIcon(type);
  }

  /**
   * Load assets for the threat model using separate API call with pagination
   */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: fetch a paginated asset list for a threat model and update component state (reads DB)
  private loadAssets(threatModelId: string): void {
    // Initialize assets array to empty array to ensure it exists
    if (this.threatModel) {
      this.threatModel.assets = [];
    }

    this._subscriptions.add(
      this.assetCrud
        .loadAssets(threatModelId, this.assetsPageIndex, this.assetsPageSize)
        .subscribe({
          next: page => {
            if (this.threatModel) {
              this.threatModel.assets = page.assets;
              this.assetsDataSource.data = page.assets;
              this.totalAssets = page.total;
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
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle asset paginator event and reload the current page (reads DB)
  onAssetsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.assetsPageIndex = event.pageIndex;
    this.assetsPageSize = event.pageSize;
    if (this.threatModel) {
      this.loadAssets(this.threatModel.id);
    }
  }

  /** Snapshot the component's current threat query state (page + sort + filters). */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: snapshot current threat pagination, sort, and filter state into a query object (pure)
  private buildThreatQueryState(): ThreatQueryState {
    return {
      pageIndex: this.threatsPageIndex,
      pageSize: this.threatsPageSize,
      sortActive: this.threatSortActive,
      sortDirection: this.threatSortDirection,
      filters: this.threatFilters,
    };
  }

  /**
   * Load threats for the threat model using API with filters, sorting, and pagination
   */
  // SEM@2448d40fcb8d5c2695db6c1bdc7952b40e57b317: fetch a filtered, sorted, paginated threat list and update component state (reads DB)
  private loadThreats(threatModelId: string): void {
    this._subscriptions.add(
      this.threatCrud.loadThreats(threatModelId, this.buildThreatQueryState()).subscribe({
        next: page => {
          if (this.threatModel) {
            const threats = page.threats.map(t =>
              this.formattingService.migrateThreatFieldValues(t),
            );
            this.threatModel.threats = threats;
            this.threatsDataSource.data = threats;
            this.totalThreats = page.total;
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

  /** Reload threats and persist current filter state */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: reload threats and persist the current filter card state (reads DB)
  private loadThreatsAndSaveState(): void {
    if (this.threatModel) {
      this.loadThreats(this.threatModel.id);
      this.saveThreatCardState();
    }
  }

  /**
   * Handle threats page change
   */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: handle threat paginator event and reload the current page (reads DB)
  onThreatsPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.threatsPageIndex = event.pageIndex;
    this.threatsPageSize = event.pageSize;
    this.loadThreatsAndSaveState();
  }

  /** Handle threat name filter input */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: dispatch a threat name filter value to the debounced filter subject (mutates shared state)
  onThreatNameFilterChange(value: string): void {
    this.threatNameFilterChanged$.next(value);
  }

  /** Handle server-side filter change (dropdowns, toggles) — immediate reload */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: reset threat page to zero and reload threats on dropdown or toggle filter change (reads DB)
  onThreatFilterChange(): void {
    this.threatsPageIndex = 0;
    this.loadThreatsAndSaveState();
  }

  /** Handle sort change from the threats table header */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: update threat sort column and direction, reset page to first (mutates shared state)
  onThreatSortChange(sort: { active: string; direction: 'asc' | 'desc' | '' }): void {
    this.threatSortActive = sort.active;
    this.threatSortDirection = sort.direction;
    this.threatsPageIndex = 0;
    this.loadThreatsAndSaveState();
  }

  /** Clear all threat filters and reset to defaults */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: reset all threat filters to defaults and reload the threat list (mutates shared state)
  clearAllThreatFilters(): void {
    this.threatFilters = createDefaultThreatFilters();
    this.threatsPageIndex = 0;
    this.showAdvancedThreatFilters = false;
    this.loadThreatsAndSaveState();
  }

  /** Toggle the mitigated filter: null → true → false → null */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: cycle the mitigated threat filter through null, true, and false states (mutates shared state)
  toggleMitigatedFilter(): void {
    if (this.threatFilters.mitigated === null) {
      this.threatFilters.mitigated = true;
    } else if (this.threatFilters.mitigated === true) {
      this.threatFilters.mitigated = false;
    } else {
      this.threatFilters.mitigated = null;
    }
    this.onThreatFilterChange();
  }

  get hasActiveThreatFilters(): boolean {
    return hasAnyThreatFilters(this.threatFilters);
  }

  get hasAdvancedThreatFiltersActive(): boolean {
    return hasAdvancedThreatFilters(this.threatFilters);
  }

  /** Update threat type options from the current framework */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: populate threat type options from the active threat modeling framework (mutates shared state)
  private updateThreatTypeOptions(): void {
    if (!this.threatModel) return;
    const frameworkName = this.threatModel.threat_model_framework || 'STRIDE';
    const framework = this.frameworks.find(f => f.name === frameworkName);
    this.threatTypeOptions = framework?.threatTypes?.map(tt => tt.name) ?? [];
  }

  /** Save current threat card state for later restoration */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: persist current threat filter, sort, and pagination state for later restoration (mutates shared state)
  private saveThreatCardState(): void {
    if (!this.threatModel) return;
    this.threatFilterStateService.saveState({
      threatModelId: this.threatModel.id,
      filters: { ...this.threatFilters },
      sortActive: this.threatSortActive,
      sortDirection: this.threatSortDirection,
      pageIndex: this.threatsPageIndex,
      pageSize: this.threatsPageSize,
      showAdvancedFilters: this.showAdvancedThreatFilters,
    });
  }

  /** Restore threat card state if returning to the same threat model */
  // SEM@6e22d874fca2906477bada6894288c7d35ac6298: restore previously saved threat filter, sort, and pagination state (mutates shared state)
  private restoreThreatCardState(threatModelId: string): void {
    const saved = this.threatFilterStateService.getState(threatModelId);
    if (saved) {
      this.threatFilters = { ...saved.filters };
      this.threatSortActive = saved.sortActive;
      this.threatSortDirection = saved.sortDirection;
      this.threatsPageIndex = saved.pageIndex;
      this.threatsPageSize = saved.pageSize;
      this.showAdvancedThreatFilters = saved.showAdvancedFilters;
    }
  }

  /**
   * Opens the dialog to create a new asset
   */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: open asset editor dialog and create a new asset via API (mutates shared state)
  addAsset(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create assets');
      return;
    }

    const dialogData: AssetEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
    };

    this._subscriptions.add(
      this.dialogService.openAssetEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.assetCrud.createAsset(this.threatModel.id, result).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadAssets(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create asset', error),
          }),
        );
      }),
    );
  }

  /**
   * Loads addons from server and caches filtered lists by object type
   */
  // SEM@d790b8bd7f1bf990d1aec2d3118089a501ee6f98: fetch all addons from the server and cache them by object type (mutates shared state)
  private loadAddons(): void {
    this._subscriptions.add(
      this.addonService.list().subscribe({
        next: response => {
          const addons = response.addons ?? [];
          this.logger.debug('Addon API response', {
            count: addons.length,
            ids: addons.map(a => a.id),
          });
          this.filterAndCacheAddons(addons);
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
  // SEM@0fe5ff80314766ac33e872ed59e185586c3c1eb3: partition addon list by supported object type and store into typed caches (mutates shared state)
  private filterAndCacheAddons(addons: Addon[]): void {
    // SEM@0fe5ff80314766ac33e872ed59e185586c3c1eb3: filter addons to those supporting a given object type (pure)
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
  // SEM@0fe5ff80314766ac33e872ed59e185586c3c1eb3: resolve display icon name for an addon, stripping material-symbols prefix (pure)
  getAddonIcon(addon: Addon): string {
    if (!addon.icon) {
      return 'extension';
    }
    return addon.icon.replace('material-symbols:', '');
  }

  /**
   * Opens the dialog to edit an existing asset
   */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: open asset editor dialog and persist changes to an existing asset via API (mutates shared state)
  editAsset(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: AssetEditorDialogData = {
      mode: 'edit',
      asset: { ...asset },
      isReadOnly: !this.canEdit,
    };

    this._subscriptions.add(
      this.dialogService.openAssetEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.assetCrud.updateAsset(this.threatModel.id, asset.id, result).subscribe({
            next: updatedAsset => {
              if (this.threatModel && this.threatModel.assets) {
                const index = this.threatModel.assets.findIndex(a => a.id === asset.id);
                if (index !== -1) {
                  this.threatModel.assets[index] = updatedAsset;
                }
                this.assetsDataSource.data = this.threatModel.assets;
                this.logger.info('Updated asset via API', { asset: updatedAsset });
              }
            },
            error: error => this.logger.error('Failed to update asset', error),
          }),
        );
      }),
    );
  }

  /**
   * Deletes an asset from the threat model
   */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: confirm and delete an asset from the threat model via API (mutates shared state)
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

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.assets) return;
        this._subscriptions.add(
          this.assetCrud.deleteAsset(this.threatModel.id, asset.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.assets) {
                // Remove the asset from local state using filter (immutable)
                // and update data source for immediate UI refresh
                this.threatModel.assets = this.threatModel.assets.filter(a => a.id !== asset.id);
                this.assetsDataSource.data = this.threatModel.assets;
                this.logger.info('Deleted asset', { assetId: asset.id });
              }
            },
            error: error => this.logger.error('Failed to delete asset', error),
          }),
        );
      }),
    );
  }

  /**
   * Opens the metadata dialog for a specific asset
   */
  // SEM@458002b0819d7370853d19a3b4bfc01cfe4708ed: open metadata editor dialog and update an asset's metadata via API (mutates shared state)
  openAssetMetadataDialog(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: asset.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Asset',
      objectName: `${this.transloco.translate('common.objectTypes.asset')}: ${asset.name} (${asset.id})`,
    };

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel || !this.canEdit) return;
        this._subscriptions.add(
          this.assetCrud.updateAssetMetadata(this.threatModel.id, asset.id, result).subscribe({
            next: updatedMetadata => {
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
            },
            error: error => this.logger.error('Failed to update asset metadata', error),
          }),
        );
      }),
    );
  }

  /**
   * Load notes for the threat model using separate API call with pagination
   */
  // SEM@139bebbae2731b16f251536df55fbd29ea901c42: fetch a paginated page of notes for the threat model from the API (mutates shared state)
  private loadNotes(threatModelId: string): void {
    // Initialize notes array to empty array to ensure it exists
    if (this.threatModel) {
      this.threatModel.notes = [];
    }
    this._subscriptions.add(
      this.noteCrud.loadNotes(threatModelId, this.notesPageIndex, this.notesPageSize).subscribe({
        next: page => {
          if (this.threatModel) {
            this.threatModel.notes = page.notes;
            this.notesDataSource.data = page.notes;
            this.totalNotes = page.total;
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
  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: update notes pagination state and reload the notes page (mutates shared state)
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
  // SEM@1d2d0267968e0b8635f7aac0bba50d275f94b62d: show diagram thumbnail preview after a hover delay (mutates shared state)
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
  // SEM@1d2d0267968e0b8635f7aac0bba50d275f94b62d: cancel pending hover delay and hide the diagram thumbnail preview (mutates shared state)
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
  // SEM@d4911b695f58ccef3d5ee02916c161dc056adc86: return the SVG data URL for the currently hovered diagram (pure)
  getHoveredDiagramSvgUrl(): string {
    if (!this.hoveredDiagramId) {
      return '';
    }

    const diagram = this.diagrams?.find(d => d.id === this.hoveredDiagramId);
    return diagram ? this.getSvgDataUrl(diagram) : '';
  }

  // ========== Addon Invocation Methods ==========

  /**
   * Set the addon context for row-level invocation
   * Called when a row-level addon menu trigger is clicked
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: store the row-level addon invocation context for the selected object (mutates shared state)
  setAddonRowContext(type: AddonObjectType, id: string, name: string, metadata?: Metadata[]): void {
    this.currentAddonRowContext = { type, id, name, metadata };
  }

  /**
   * Clear addon row context
   * Called when a row-level addon menu is closed
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: clear the stored row-level addon invocation context (mutates shared state)
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
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: dispatch addon invocation dialog for a given object and notify on submission (mutates shared state)
  private openInvokeAddonDialog(
    addon: Addon,
    objectType: AddonObjectType,
    isBulk: boolean,
    objectId?: string,
    objectName?: string,
    metadata?: Metadata[],
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
      metadata,
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
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: invoke an addon against the currently stored row-level object context (mutates shared state)
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
      this.currentAddonRowContext.metadata,
    );
  }

  // Card-level addon invocation methods (bulk operations)

  /**
   * Invoke addon for the threat model (card-level)
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: invoke an addon against the entire threat model as a bulk operation (mutates shared state)
  invokeAddonForThreatModel(addon: Addon): void {
    this.openInvokeAddonDialog(
      addon,
      'threat_model',
      true,
      undefined,
      undefined,
      this.threatModel?.metadata,
    );
  }

  /**
   * Invoke addon for assets (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: invoke an addon against all assets as a bulk operation (mutates shared state)
  invokeAddonForAssets(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'asset', true);
  }

  /**
   * Invoke addon for threats (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: dispatch addon invocation dialog scoped to the threat entity type
  invokeAddonForThreats(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'threat', true);
  }

  /**
   * Invoke addon for diagrams (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: dispatch addon invocation dialog scoped to the diagram entity type
  invokeAddonForDiagrams(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'diagram', true);
  }

  /**
   * Invoke addon for notes (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: dispatch addon invocation dialog scoped to the note entity type
  invokeAddonForNotes(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'note', true);
  }

  /**
   * Invoke addon for documents (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: dispatch addon invocation dialog scoped to the document entity type
  invokeAddonForDocuments(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'document', true);
  }

  /**
   * Invoke addon for repositories (card-level)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: dispatch addon invocation dialog scoped to the repository entity type
  invokeAddonForRepositories(addon: Addon): void {
    this.openInvokeAddonDialog(addon, 'repository', true);
  }
}
