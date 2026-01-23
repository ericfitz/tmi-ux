/**
 * Dashboard Component
 *
 * This component provides the main dashboard interface for threat model management and overview.
 * It displays threat model lists, collaboration sessions, and provides navigation to editing features.
 *
 * Key functionality:
 * - Displays comprehensive list of available threat models with search and filtering
 * - Shows active collaboration sessions with real-time updates
 * - Provides threat model creation, editing, and deletion capabilities
 * - Handles navigation to threat model editing and diagram creation workflows
 * - Manages threat model sharing and collaboration features
 * - Supports internationalization for multi-language threat model management
 * - Provides responsive design for various screen sizes and devices
 * - Implements role-based access control for threat model operations
 * - Shows threat model metadata and status information
 * - Supports bulk operations and batch processing for threat models
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Observable, Subscription } from 'rxjs';
import { take, map, filter, switchMap } from 'rxjs/operators';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LanguageService } from '../../i18n/language.service';
import { ThreatModel } from '../tm/models/threat-model.model';
import { TMListItem } from './models/tm-list-item.model';
import { ThreatModelService } from '../tm/services/threat-model.service';
import { ThreatModelValidatorService } from '../tm/validation/threat-model-validator.service';
import { DfdCollaborationService } from '../../core/services/dfd-collaboration.service';
import {
  CollaborationSessionService,
  CollaborationSession,
} from '../../core/services/collaboration-session.service';
import { LoggerService } from '../../core/services/logger.service';
import { SvgCacheService } from '../tm/services/svg-cache.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  DeleteThreatModelDialogComponent,
  DeleteThreatModelDialogData,
} from './components/delete-threat-model-dialog/delete-threat-model-dialog.component';
import { AuthService } from '../../auth/services/auth.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  threatModels: TMListItem[] = [];
  dataSource = new MatTableDataSource<TMListItem>([]);

  @ViewChild(MatSort) sort!: MatSort;

  // View mode and filtering
  dashboardListView = false;
  filterText = '';
  displayedColumns: string[] = [
    'name',
    'description',
    'lastModified',
    'status',
    'statusLastChanged',
    'owner',
    'created',
    'actions',
  ];

  // Observable streams
  collaborationSessions$!: Observable<CollaborationSession[]>;
  shouldShowCollaboration$!: Observable<boolean>;

  // Loading state
  isLoadingThreatModels = true;
  isLoadingCollaborationSessions = true;
  isImporting = false;

  private subscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private collaborationSessionsSubscription: Subscription | null = null;
  private currentLocale: string = 'en-US';

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private validator: ThreatModelValidatorService,
    private languageService: LanguageService,
    private collaborationService: DfdCollaborationService,
    private collaborationSessionService: CollaborationSessionService,
    private logger: LoggerService,
    private svgCacheService: SvgCacheService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
    private authService: AuthService,
    private userPreferencesService: UserPreferencesService,
  ) {}

  ngOnInit(): void {
    // this.logger.debugComponent('Dashboard', 'DashboardComponent.ngOnInit called');

    // Load view preference from localStorage
    this.loadViewPreference();

    // Clear SVG caches when initializing dashboard to ensure fresh start
    this.svgCacheService.clearAllCaches();

    // Subscribe to collaboration session polling since we need session data on dashboard
    this.collaborationSessionService.subscribeToSessionPolling();

    // Initialize observable streams
    this.collaborationSessions$ = this.collaborationSessionService.sessions$;
    this.shouldShowCollaboration$ = this.collaborationSessionService.shouldShowCollaboration$;

    // Track collaboration sessions loading state
    this.collaborationSessionsSubscription = this.collaborationSessions$.subscribe(() => {
      this.isLoadingCollaborationSessions = false;
      this.cdr.detectChanges();
    });

    // Force refresh on dashboard load to ensure we have the latest data
    this.isLoadingThreatModels = true;
    this.subscription = this.threatModelService.getThreatModelList().subscribe(models => {
      // Ensure models is always an array
      this.threatModels = models || [];
      this.applyFilter();
      this.isLoadingThreatModels = false;
      // this.logger.debugComponent('Dashboard', 'DashboardComponent received threat model list', {
      //   count: this.threatModels.length,
      //   models: this.threatModels.map(tm => ({ id: tm.id, name: tm.name })),
      // });
      // Trigger change detection to update the view
      this.cdr.detectChanges();
    });

    // Subscribe to language changes to refresh date formatting
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      // Update current locale
      this.currentLocale = language.code;
      // Force change detection to re-evaluate date formatting and status labels
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.collaborationSessionsSubscription) {
      this.collaborationSessionsSubscription.unsubscribe();
    }

    // Unsubscribe from collaboration session polling when leaving dashboard
    this.collaborationSessionService.unsubscribeFromSessionPolling();
  }

  ngAfterViewInit(): void {
    // Set up sorting after view is initialized
    this.dataSource.sort = this.sort;

    // Custom sorting accessor to handle nested properties and date columns
    this.dataSource.sortingDataAccessor = (item: TMListItem, property: string): string | number => {
      switch (property) {
        case 'name':
          return item.name?.toLowerCase() || '';
        case 'description':
          return item.description?.toLowerCase() || '';
        case 'lastModified':
          return item.modified_at ? new Date(item.modified_at).getTime() : 0;
        case 'status':
          return item.status?.toLowerCase() || '';
        case 'statusLastChanged':
          return item.status_updated ? new Date(item.status_updated).getTime() : 0;
        case 'owner':
          return item.owner?.display_name?.toLowerCase() || item.owner?.email?.toLowerCase() || '';
        case 'created':
          return item.created_at ? new Date(item.created_at).getTime() : 0;
        default:
          return '';
      }
    };
  }

  createThreatModel(): void {
    // Wait for user profile to load before creating threat model
    // This ensures authorization can be properly calculated
    this.authService.userProfile$
      .pipe(
        filter(profile => profile !== null),
        take(1),
        switchMap(() =>
          this.threatModelService.createThreatModel(
            'New Threat Model',
            'Description of the threat model',
            'STRIDE',
          ),
        ),
      )
      .subscribe(model => {
        void this.router.navigate(['/tm', model.id]);
      });
  }

  openThreatModel(id: string): void {
    // When opening a threat model for editing, the service will automatically
    // expire all other cached models and cache only the one being opened
    void this.router.navigate(['/tm', id]);
  }

  /**
   * Format a date according to the current locale
   */
  formatDate(date: string | null | undefined): string {
    // Handle null, undefined, or empty date strings
    if (!date) {
      return '—';
    }

    const dateObj = new Date(date);

    // Check if the date is valid
    if (isNaN(dateObj.getTime())) {
      this.logger.warn('Invalid date provided to formatDate', { date });
      return '—';
    }

    // Use Intl.DateTimeFormat for more consistent locale-based formatting
    return new Intl.DateTimeFormat(this.currentLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(dateObj);
  }

  /**
   * Format session start time as a relative time string
   * Uses Intl.RelativeTimeFormat for proper internationalization
   */
  formatSessionTime(startedAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - startedAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) {
      return this.transloco.translate('collaboration.justNow');
    } else if (diffMinutes < 60) {
      // Use Intl.RelativeTimeFormat for minutes
      return this.formatRelativeTime(-diffMinutes, 'minute');
    } else if (diffHours < 24) {
      // Use Intl.RelativeTimeFormat for hours
      return this.formatRelativeTime(-diffHours, 'hour');
    } else {
      // For sessions older than 24 hours, show the actual time
      return new Intl.DateTimeFormat(this.currentLocale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(startedAt);
    }
  }

  /**
   * Format relative time using Intl.RelativeTimeFormat with fallback
   * @param value The relative time value (negative for past)
   * @param unit The time unit ('minute', 'hour', etc.)
   * @returns Localized relative time string
   */
  private formatRelativeTime(value: number, unit: 'minute' | 'hour'): string {
    try {
      // Check if Intl.RelativeTimeFormat is supported
      if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
        const rtf = new Intl.RelativeTimeFormat(this.currentLocale, {
          numeric: 'auto',
          style: 'long',
        });
        return rtf.format(value, unit);
      }
    } catch {
      // Fallback if RelativeTimeFormat fails
      // this.logger.debugComponent('TM', 'RelativeTimeFormat not supported, using fallback');
    }

    // Fallback to English format for unsupported browsers
    const absValue = Math.abs(value);
    const unitText = unit === 'minute' ? 'minute' : 'hour';
    const pluralSuffix = absValue === 1 ? '' : 's';
    return `${absValue} ${unitText}${pluralSuffix} ago`;
  }

  deleteThreatModel(id: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent opening threat model when clicking delete

    // Find the threat model to get its name for the confirmation dialog
    const threatModel = this.threatModels.find(tm => tm.id === id);
    if (!threatModel) {
      this.logger.error('Threat model not found for deletion', { id });
      return;
    }

    // Show confirmation dialog
    const dialogData: DeleteThreatModelDialogData = {
      id: threatModel.id,
      name: threatModel.name,
    };

    const dialogRef = this.dialog.open(DeleteThreatModelDialogComponent, {
      width: '500px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        // User confirmed deletion
        this.threatModelService.deleteThreatModel(id).subscribe({
          next: success => {
            if (success) {
              // No need to manually refresh - the reactive subscription will update automatically
              // this.logger.debugComponent('TM', 'Threat model deleted successfully', {
              //   id,
              //   name: threatModel.name,
              // });

              // Show success message
              this.snackBar.open(`Threat model "${threatModel.name}" has been deleted.`, 'Close', {
                duration: 3000,
              });
            }
          },
          error: error => {
            this.logger.error('Error deleting threat model', error);
            this.snackBar.open('Failed to delete threat model. Please try again.', 'Close', {
              duration: 5000,
            });
          },
        });
      }
    });
  }

  /**
   * Refresh the collaboration sessions list
   */
  refreshCollaborationSessions(): void {
    // this.logger.info('Manually refreshing collaboration sessions');
    this.isLoadingCollaborationSessions = true;
    this.collaborationSessionService.refreshSessions();
    // Loading state will be cleared by the subscription to collaborationSessions$
  }

  /**
   * Refresh the threat models list
   */
  refreshThreatModels(): void {
    // this.logger.info('Manually refreshing threat models');
    this.isLoadingThreatModels = true;
    this.threatModelService.getThreatModelList().subscribe(models => {
      this.threatModels = models || [];
      this.applyFilter();
      this.isLoadingThreatModels = false;
      // this.logger.info('Threat models refreshed', { count: this.threatModels.length });
      this.cdr.detectChanges();
    });
  }

  /**
   * Navigate to the DFD page for a specific diagram
   * @param diagramId The ID of the diagram to open
   */
  openCollaborationSession(diagramId: string): void {
    // this.logger.info('Opening collaboration session', { diagramId });

    // Find the session data to get the threat model ID
    this.collaborationSessions$
      .pipe(
        take(1),
        map(sessions => sessions.find(session => session.diagramId === diagramId)),
      )
      .subscribe(session => {
        if (!session) {
          this.logger.error('Collaboration session not found', { diagramId });
          return;
        }

        // Navigate to DFD page with collaboration context using correct nested route
        void this.router.navigate(['/tm', session.threatModelId, 'dfd', diagramId], {
          queryParams: {
            joinCollaboration: 'true',
          },
        });
      });
  }

  /**
   * Load a threat model from desktop using File System Access API
   */
  async import(): Promise<void> {
    // this.logger.info('Loading threat model from desktop');

    try {
      let fileHandle: FileSystemFileHandle;
      let file: File;

      // Check if File System Access API is supported
      if ('showOpenFilePicker' in window) {
        // this.logger.debugComponent('TM', 'Using File System Access API');

        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'JSON files',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
          excludeAcceptAllOption: false,
        });

        fileHandle = handle;
        file = await fileHandle.getFile();
      } else {
        // Fallback for browsers that don't support File System Access API
        // this.logger.debugComponent('TM', 'Using fallback file input method');
        file = await this.selectFileViaInput();
      }

      // Read and parse the file content
      const content = await file.text();
      const threatModelData = JSON.parse(content) as Record<string, unknown>;

      // this.logger.info('File loaded successfully', {
      //   filename: file.name,
      //   size: file.size,
      //   type: file.type,
      // });

      // Import the threat model
      await this.importThreatModel(threatModelData);
    } catch (error) {
      // Check if user cancelled the operation
      if (error instanceof DOMException && error.name === 'AbortError') {
        // this.logger.debugComponent('TM', 'File selection cancelled by user');
        return;
      }

      // Handle other errors (file parsing, import errors, etc.)
      this.logger.error('Failed to load threat model from file', error);
    }
  }

  /**
   * Fallback method for selecting files in browsers without File System Access API
   */
  private selectFileViaInput(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = event => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      };

      input.oncancel = () => {
        reject(new DOMException('User cancelled file selection', 'AbortError'));
      };

      // Trigger file picker
      input.click();
    });
  }

  /**
   * Import a threat model from parsed JSON data
   */
  private async importThreatModel(data: Record<string, unknown>): Promise<void> {
    this.isImporting = true;
    try {
      // Basic validation - check if it has expected threat model structure
      if (typeof data['id'] !== 'string' || typeof data['name'] !== 'string') {
        this.showError('Invalid threat model format: missing required fields (id, name)');
        return;
      }

      // this.logger.info('Importing threat model', {
      //   id: data['id'],
      //   name: data['name'],
      // });

      // Validate the threat model data
      const validationResult = this.validator.validate(data as unknown as ThreatModel);
      if (!validationResult.valid) {
        this.logger.error('Threat model validation failed', validationResult.errors);
        this.showError(
          `Threat model validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`,
        );
        return;
      }

      if (validationResult.warnings.length > 0) {
        this.logger.warn('Threat model has validation warnings', validationResult.warnings);
      }

      // Import the threat model (always creates a new instance)
      const result = await this.threatModelService
        .importThreatModel(data as Partial<ThreatModel> & { id: string; name: string })
        .toPromise();

      if (result) {
        this.navigateToImportedModel(result.model);
      }
    } catch (error) {
      this.logger.error('Failed to import threat model', error);
      this.showError(
        `Failed to import threat model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      this.isImporting = false;
    }
  }

  private navigateToImportedModel(model: ThreatModel): void {
    // this.logger.info('Threat model imported successfully', { id: model.id });

    this.snackBar.open(`Threat model "${model.name}" imported successfully`, 'Close', {
      duration: 3000,
    });

    // Navigate to the imported/updated threat model
    void this.router.navigate(['/tm', model.id]);
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  /**
   * Load the dashboard view preference from UserPreferencesService
   */
  private loadViewPreference(): void {
    const prefs = this.userPreferencesService.getPreferences();
    this.dashboardListView = prefs.dashboardListView;
  }

  /**
   * Toggle between card and list view
   */
  toggleViewMode(): void {
    this.dashboardListView = !this.dashboardListView;

    // Save preference via UserPreferencesService
    this.userPreferencesService.updatePreferences({
      dashboardListView: this.dashboardListView,
    });

    this.cdr.detectChanges();
  }

  /**
   * Handle filter input changes
   */
  onFilterChange(value: string): void {
    this.filterText = value;
    this.applyFilter();
    this.cdr.detectChanges();
  }

  /**
   * Clear the filter
   */
  clearFilter(): void {
    this.filterText = '';
    this.applyFilter();
    this.cdr.detectChanges();
  }

  /**
   * Apply the current filter to the threat models list
   */
  private applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    let filtered: TMListItem[];

    if (!filter) {
      filtered = [...this.threatModels];
    } else {
      filtered = this.threatModels.filter(
        tm =>
          tm.name?.toLowerCase().includes(filter) ||
          tm.description?.toLowerCase().includes(filter) ||
          tm.owner?.display_name?.toLowerCase().includes(filter) ||
          tm.status?.toLowerCase().includes(filter),
      );
    }

    // Update both the dataSource (for table) and filteredThreatModels (for cards)
    this.dataSource.data = filtered;
  }

  /**
   * Get filtered threat models for card view
   */
  get filteredThreatModels(): TMListItem[] {
    return this.dataSource.data;
  }
}
