import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Metadata, Threat } from '../../models/threat-model.model';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { Subscription } from 'rxjs';

/**
 * Interface for threat form values
 */
interface ThreatFormValues {
  name: string;
  description: string;
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
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './threat-editor-dialog.component.html',
  styleUrls: ['./threat-editor-dialog.component.scss'],
})
export class ThreatEditorDialogComponent implements OnInit, OnDestroy {
  threatForm: FormGroup;
  dialogTitle: string = '';
  isViewOnly: boolean = false;
  currentLocale: string = 'en-US';
  currentDirection: 'ltr' | 'rtl' = 'ltr';
  private langSubscription: Subscription | null = null;
  private directionSubscription: Subscription | null = null;

  constructor(
    private dialogRef: MatDialogRef<ThreatEditorDialogComponent>,
    private fb: FormBuilder,
    private logger: LoggerService,
    private languageService: LanguageService,
    @Inject(MAT_DIALOG_DATA) public data: ThreatEditorDialogData,
  ) {
    this.threatForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
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
   * Safely get the metadata array from the threat
   * @returns Array of metadata or empty array if not available
   */
  getMetadata(): Metadata[] {
    return this.data.threat?.metadata || [];
  }

  /**
   * Check if the threat has metadata
   * @returns True if the threat has metadata, false otherwise
   */
  hasMetadata(): boolean {
    return !!this.data.threat?.metadata && this.data.threat.metadata.length > 0;
  }

  ngOnInit(): void {
    // Set dialog mode
    this.isViewOnly = this.data.mode === 'view';

    // Set dialog title based on mode
    if (this.data.mode === 'create') {
      this.dialogTitle = 'threatModels.createNewThreat';
    } else if (this.data.mode === 'edit') {
      this.dialogTitle = 'threatModels.editThreat';
    } else {
      this.dialogTitle = 'threatModels.viewThreat';
    }

    // If editing or viewing, populate form with threat data
    if (this.data.threat) {
      this.threatForm.patchValue({
        name: this.data.threat.name,
        description: this.data.threat.description || '',
      });

      // If view only, disable the form
      if (this.isViewOnly) {
        this.threatForm.disable();
      }
    }

    // Subscribe to language changes
    this.langSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLocale = language.code;
      this.currentDirection = language.rtl ? 'rtl' : 'ltr';
      // Force change detection to update the date format
      this.dialogRef.updateSize();
    });

    // Also subscribe to direction changes
    this.directionSubscription = this.languageService.direction$.subscribe(direction => {
      this.currentDirection = direction;
    });
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
    });
  }

  /**
   * Close the dialog without creating or updating a threat
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
