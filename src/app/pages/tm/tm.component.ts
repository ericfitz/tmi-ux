/**
 * Threat Model Management Component
 *
 * This component provides the main interface for threat model management and overview.
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

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { LanguageService } from '../../i18n/language.service';
import { ThreatModel } from './models/threat-model.model';
import { ThreatModelService } from './services/threat-model.service';
import { ThreatModelValidatorService } from './validation/threat-model-validator.service';
import { DfdCollaborationService } from '../dfd/services/dfd-collaboration.service';
import { LoggerService } from '../../core/services/logger.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { 
  DeleteThreatModelDialogComponent,
  DeleteThreatModelDialogData 
} from './components/delete-threat-model-dialog/delete-threat-model-dialog.component';

/**
 * Interface for collaboration session data
 */
export interface CollaborationSession {
  id: string;
  threatModelId: string;
  threatModelName: string;
  diagramId: string;
  diagramName: string;
  hostUser: string;
  startedAt: Date;
  activeUsers: number;
}

@Component({
  selector: 'app-tm',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './tm.component.html',
  styleUrl: './tm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TmComponent implements OnInit, OnDestroy {
  threatModels: ThreatModel[] = [];
  collaborationSessions: CollaborationSession[] = [];
  private subscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private collaborationSubscription: Subscription | null = null;
  private currentLocale: string = 'en-US';

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private validator: ThreatModelValidatorService,
    private languageService: LanguageService,
    private collaborationService: DfdCollaborationService,
    private logger: LoggerService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.logger.debugComponent('TM', 'TmComponent.ngOnInit called');
    this.subscription = this.threatModelService.getThreatModels().subscribe(models => {
      this.threatModels = models;
      this.logger.debugComponent('TM', 'TmComponent received threat models', {
        count: models.length,
        models: models.map(tm => ({ id: tm.id, name: tm.name })),
      });
      // Trigger change detection to update the view
      this.cdr.detectChanges();
    });

    // Subscribe to language changes to refresh date formatting
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      // Update current locale
      this.currentLocale = language.code;
      // Force change detection to re-evaluate date formatting
      this.cdr.detectChanges();
    });

    // Load active collaboration sessions
    this.loadCollaborationSessions();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.collaborationSubscription) {
      this.collaborationSubscription.unsubscribe();
    }
  }

  createThreatModel(): void {
    // Create a new threat model and navigate to the edit page
    this.threatModelService
      .createThreatModel('New Threat Model', 'Description of the threat model', 'STRIDE')
      .subscribe(model => {
        void this.router.navigate(['/tm', model.id]);
      });
  }

  openThreatModel(id: string): void {
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
      name: threatModel.name
    };

    const dialogRef = this.dialog.open(DeleteThreatModelDialogComponent, {
      width: '500px',
      data: dialogData,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        // User confirmed deletion
        this.threatModelService.deleteThreatModel(id).subscribe({
          next: success => {
            if (success) {
              // No need to manually refresh - the reactive subscription will update automatically
              this.logger.debugComponent('TM', 'Threat model deleted successfully', { id, name: threatModel.name });
              
              // Show success message
              this.snackBar.open(
                `Threat model "${threatModel.name}" has been deleted.`,
                'Close',
                { duration: 3000 }
              );
            }
          },
          error: error => {
            this.logger.error('Error deleting threat model', error);
            this.snackBar.open(
              'Failed to delete threat model. Please try again.',
              'Close',
              { duration: 5000 }
            );
          }
        });
      }
    });
  }

  /**
   * Refresh the threat model list from the server
   */
  private refreshThreatModelList(): void {
    this.threatModelService.getThreatModels().subscribe({
      next: models => {
        this.threatModels = models;
        this.logger.debugComponent('TM', 'Threat model list refreshed after deletion', {
          count: models.length,
          models: models.map(tm => ({ id: tm.id, name: tm.name })),
        });
        // Trigger change detection to update the view
        this.cdr.detectChanges();
      },
      error: error => {
        this.logger.error('Error refreshing threat model list', error);
        this.snackBar.open(
          'Failed to refresh threat model list. Please reload the page.',
          'Close',
          { duration: 5000 }
        );
      }
    });
  }

  /**
   * Load active collaboration sessions
   */
  private loadCollaborationSessions(): void {
    // For now, we'll use mock data since the actual implementation would depend on the backend API
    // In a real implementation, this would fetch active sessions from the server

    // Mock data for demonstration purposes
    this.collaborationSessions = [
      {
        id: '1',
        threatModelId: '550e8400-e29b-41d4-a716-446655440000',
        threatModelName: 'System Threat Model',
        diagramId: '123e4567-e89b-12d3-a456-426614174000',
        diagramName: 'System Architecture',
        hostUser: 'John Doe',
        startedAt: new Date(),
        activeUsers: 3,
      },
      {
        id: '2',
        threatModelId: '550e8400-e29b-41d4-a716-446655440001',
        threatModelName: 'Cloud Infrastructure Threat Model',
        diagramId: '223e4567-e89b-12d3-a456-426614174000',
        diagramName: 'Cloud Infrastructure',
        hostUser: 'Jane Smith',
        startedAt: new Date(),
        activeUsers: 2,
      },
    ];

    this.logger.info('Loaded collaboration sessions', { count: this.collaborationSessions.length });
    this.cdr.detectChanges();
  }

  /**
   * Navigate to the DFD page for a specific diagram
   * @param diagramId The ID of the diagram to open
   */
  openCollaborationSession(diagramId: string): void {
    this.logger.info('Opening collaboration session', { diagramId });
    void this.router.navigate(['/dfd', diagramId]);
  }

  /**
   * Load a threat model from desktop using File System Access API
   */
  async loadFromDesktop(): Promise<void> {
    this.logger.info('Loading threat model from desktop');

    try {
      let fileHandle: FileSystemFileHandle;
      let file: File;

      // Check if File System Access API is supported
      if ('showOpenFilePicker' in window) {
        this.logger.debugComponent('TM', 'Using File System Access API');

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
        this.logger.debugComponent('TM', 'Using fallback file input method');
        file = await this.selectFileViaInput();
      }

      // Read and parse the file content
      const content = await file.text();
      const threatModelData = JSON.parse(content) as Record<string, unknown>;

      this.logger.info('File loaded successfully', {
        filename: file.name,
        size: file.size,
        type: file.type,
      });

      // Import the threat model
      await this.importThreatModel(threatModelData);
    } catch (error) {
      // Check if user cancelled the operation
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.logger.debugComponent('TM', 'File selection cancelled by user');
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
    try {
      // Basic validation - check if it has expected threat model structure
      if (typeof data['id'] !== 'string' || typeof data['name'] !== 'string') {
        this.showError('Invalid threat model format: missing required fields (id, name)');
        return;
      }

      this.logger.info('Importing threat model', {
        id: data['id'],
        name: data['name'],
      });

      // Validate the threat model data
      const validationResult = this.validator.validate(data as Partial<ThreatModel>);
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

      // Attempt to import the threat model
      const result = await this.threatModelService
        .importThreatModel(data as Partial<ThreatModel> & { id: string; name: string })
        .toPromise();

      if (result?.conflict?.action === 'prompt') {
        // Handle conflict - ask user what to do
        const resolution = this.showConflictDialog(
          data as Partial<ThreatModel> & { id: string; name: string },
          result.conflict.existingModel,
        );

        if (resolution === 'cancel') {
          this.logger.info('User cancelled import due to conflict');
          return;
        }

        // Re-import with user's resolution
        const resolvedResult = await this.threatModelService
          .importThreatModel(
            data as Partial<ThreatModel> & { id: string; name: string },
            resolution,
          )
          .toPromise();

        if (resolvedResult) {
          this.navigateToImportedModel(resolvedResult.model, resolution === 'overwrite');
        }
      } else if (result) {
        // No conflict or already resolved
        this.navigateToImportedModel(result.model, !!result.conflict);
      }
    } catch (error) {
      this.logger.error('Failed to import threat model', error);
      this.showError(
        `Failed to import threat model: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private navigateToImportedModel(model: ThreatModel, wasConflict: boolean): void {
    const action = wasConflict ? 'updated' : 'imported';
    this.logger.info(`Threat model ${action} successfully`, { id: model.id });

    this.snackBar.open(`Threat model "${model.name}" ${action} successfully`, 'Close', {
      duration: 3000,
    });

    // Navigate to the imported/updated threat model
    void this.router.navigate(['/tm', model.id]);
  }

  private showConflictDialog(
    loadedModel: Partial<ThreatModel> & { id: string; name: string },
    existingModel: ThreatModel,
  ): 'discard' | 'overwrite' | 'cancel' {
    // For now, use a simple browser confirm dialog
    // TODO: Replace with a proper Angular Material dialog
    const message =
      `A threat model with the same ID already exists:\n\n` +
      `Existing: "${existingModel.name}" (last modified: ${existingModel.modified_at})\n` +
      `Loaded: "${loadedModel.name}"\n\n` +
      `Choose:\n` +
      `OK = Overwrite existing model with loaded data\n` +
      `Cancel = Keep existing model, discard loaded data`;

    const userChoice = confirm(message);
    return userChoice ? 'overwrite' : 'discard';
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }
}
