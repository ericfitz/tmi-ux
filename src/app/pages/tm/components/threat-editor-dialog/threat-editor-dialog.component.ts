import { Component, Inject, OnInit, OnDestroy, ViewChild, AfterViewInit } from '@angular/core';
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
import { Metadata, Threat } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { Subscription } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTable } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';

/**
 * Interface for threat form values
 */
interface ThreatFormValues {
  name: string;
  description: string;
  severity: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  threat_type: string;
  diagram_id?: string;
  node_id?: string;
  score?: number;
  priority?: string;
  mitigated?: boolean;
  status?: string;
  issue_url?: string;
}

/**
 * Dialog data interface
 */
export interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';
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
    MatTableModule,
    MatSortModule,
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

  // Metadata table properties
  metadataDataSource = new MatTableDataSource<Metadata>([]);
  metadataColumns: string[] = ['key', 'value', 'actions'];
  @ViewChild('metadataTable') metadataTable!: MatTable<Metadata>;

  private langSubscription: Subscription | null = null;
  private directionSubscription: Subscription | null = null;

  constructor(
    private dialogRef: MatDialogRef<ThreatEditorDialogComponent>,
    private fb: FormBuilder,
    private logger: LoggerService,
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
      node_id: [''],
      score: [null],
      priority: [''],
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
   * Safely get the metadata array from the threat
   * @returns Array of metadata or empty array if not available
   */
  getMetadata(): Metadata[] {
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
        diagram_id: '',
        node_id: '',
        score: undefined,
        priority: '',
        mitigated: false,
        status: 'Open',
        issue_url: '',
        metadata: [],
      };
    }

    if (!this.data.threat?.metadata) {
      this.data.threat.metadata = [];
    }

    return this.data.threat.metadata || [];
  }

  /**
   * Check if the threat has metadata
   * @returns True if the threat has metadata, false otherwise
   */
  hasMetadata(): boolean {
    return !!this.data.threat?.metadata && this.data.threat.metadata.length > 0;
  }

  /**
   * Updates the data source for the metadata table
   */
  updateMetadataDataSource(): void {
    this.metadataDataSource.data = this.getMetadata();
    if (this.metadataTable) {
      this.metadataTable.renderRows();
    }
  }

  /**
   * Adds a new metadata item
   */
  addMetadataItem(): void {
    const metadata = this.getMetadata();
    metadata.push({
      key: '',
      value: '',
    });
    this.updateMetadataDataSource();
  }

  /**
   * Updates the key of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new key value
   */
  updateMetadataKey(index: number, event: Event): void {
    const metadata = this.getMetadata();
    const input = event.target as HTMLInputElement;

    if (index >= 0 && index < metadata.length) {
      metadata[index].key = input.value;
      this.updateMetadataDataSource();
    }
  }

  /**
   * Updates the value of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new value
   */
  updateMetadataValue(index: number, event: Event): void {
    const metadata = this.getMetadata();
    const input = event.target as HTMLInputElement;

    if (index >= 0 && index < metadata.length) {
      metadata[index].value = input.value;
      this.updateMetadataDataSource();
    }
  }

  /**
   * Deletes a metadata item
   * @param index The index of the metadata item to delete
   */
  deleteMetadataItem(index: number): void {
    const metadata = this.getMetadata();

    if (index >= 0 && index < metadata.length) {
      metadata.splice(index, 1);
      this.updateMetadataDataSource();
    }
  }

  ngOnInit(): void {
    // Set dialog mode
    this.isViewOnly = this.data.mode === 'view';

    const currentLang = this.translocoService.getActiveLang();

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
            },
          });
        } else {
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
          diagram_id: '',
          node_id: '',
          score: undefined,
          priority: '',
          mitigated: false,
          status: 'Open',
          issue_url: '',
          metadata: [],
        };
      }
    } else if (this.data.mode === 'edit') {
      this.dialogTitle = 'threatEditor.editThreat';
    } else {
      this.dialogTitle = 'threatEditor.viewThreat';
    }

    // If editing or viewing, populate form with threat data
    if (this.data.threat) {
      this.threatForm.patchValue({
        name: this.data.threat.name,
        description: this.data.threat.description || '',
        severity: this.data.threat.severity || 'High',
        threat_type: this.data.threat.threat_type || '',
        diagram_id: this.data.threat.diagram_id || '',
        node_id: this.data.threat.node_id || '',
        score: this.data.threat.score || null,
        priority: this.data.threat.priority || '',
        mitigated: this.data.threat.mitigated || false,
        status: this.data.threat.status || 'Open',
        issue_url: this.data.threat.issue_url || '',
      });

      // If view only, disable the form
      if (this.isViewOnly) {
        this.threatForm.disable();
      }
    }

    // Initialize metadata table data source
    this.updateMetadataDataSource();

    // Force translations to be applied
    this.forceTranslationUpdate();

    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLocale = language.code;
      this.currentDirection = language.rtl ? 'rtl' : 'ltr';
      // Force change detection to update the date format and translations
      this.dialogRef.updateSize();
      this.forceTranslationUpdate();
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
        'threatEditor.nodeId',
        'threatEditor.metadata',
        'threatEditor.metadataKey',
        'threatEditor.metadataValue',
        'threatEditor.actions',
        'threatEditor.delete',
        'threatEditor.noMetadata',
        'threatEditor.cancel',
        'threatEditor.save',
        'threatEditor.close',
      ];

      // Force translation of each key
      keys.forEach(key => {
        this.translateKey(key);
      });
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

      // Log the translation for debugging
      this.logger.debug(`Translation for ${key}: ${translation}`);

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
      node_id: formValues.node_id || undefined,
      score: formValues.score || undefined,
      priority: formValues.priority || undefined,
      mitigated: formValues.mitigated,
      status: formValues.status || undefined,
      issue_url: formValues.issue_url || undefined,
      metadata: this.getMetadata(),
    });
  }

  /**
   * Close the dialog without creating or updating a threat
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
