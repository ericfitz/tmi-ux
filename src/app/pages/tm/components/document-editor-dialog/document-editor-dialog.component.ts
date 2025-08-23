import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Document } from '../../models/threat-model.model';

// Enhanced save behavior imports
import { SaveStateService, SaveState } from '../../../../shared/services/save-state.service';
import { ConnectionMonitorService, ConnectionStatus } from '../../../../shared/services/connection-monitor.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SaveIndicatorComponent } from '../../../../shared/components/save-indicator/save-indicator.component';

/**
 * Interface for document form values
 */
interface DocumentFormValues {
  name: string;
  url: string;
  description?: string;
}

/**
 * Interface for dialog data
 */
export interface DocumentEditorDialogData {
  document?: Document;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-document-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoModule,
    SaveIndicatorComponent,
  ],
  templateUrl: './document-editor-dialog.component.html',
  styleUrls: ['./document-editor-dialog.component.scss'],
})
export class DocumentEditorDialogComponent implements OnInit, OnDestroy {
  documentForm: FormGroup;
  mode: 'create' | 'edit';

  // Enhanced save behavior properties
  formId: string;
  saveState: SaveState | undefined;
  connectionStatus: ConnectionStatus | undefined;
  private _subscriptions: Subscription = new Subscription();
  private _originalValues: DocumentFormValues;

  constructor(
    private dialogRef: MatDialogRef<DocumentEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: DocumentEditorDialogData,
    // Enhanced save behavior services
    private saveStateService: SaveStateService,
    private connectionMonitorService: ConnectionMonitorService,
    private notificationService: NotificationService,
    private formValidationService: FormValidationService,
  ) {
    this.mode = data.mode;

    // Store original values for change detection
    this._originalValues = {
      name: data.document?.name || '',
      url: data.document?.url || '',
      description: data.document?.description || '',
    };

    this.documentForm = this.fb.group({
      name: [this._originalValues.name, [Validators.required, Validators.maxLength(256)]],
      url: [this._originalValues.url, [Validators.required, Validators.maxLength(1024)]],
      description: [this._originalValues.description, Validators.maxLength(1024)],
    });

    // Create unique form ID for this dialog instance
    this.formId = `document-editor-dialog-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  ngOnInit(): void {
    // Initialize save state
    this._subscriptions.add(
      this.saveStateService.initializeSaveState(this.formId, this._originalValues as unknown as Record<string, unknown>).subscribe(state => {
        this.saveState = state;
      })
    );

    // Monitor connection status
    this._subscriptions.add(
      this.connectionMonitorService.getConnectionStatus().subscribe(status => {
        this.connectionStatus = status;
      })
    );

    // Start connection monitoring
    this.connectionMonitorService.startMonitoring();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.connectionMonitorService.stopMonitoring();
    this.saveStateService.destroySaveState(this.formId);
  }

  /**
   * Handles blur events on form fields for auto-save
   * @param fieldName The name of the field that lost focus
   */
  onFieldBlur(fieldName: keyof DocumentFormValues): void {
    const control = this.documentForm.get(fieldName);
    if (!control) return;

    const currentValue = (control.value as string) || '';
    const originalValue = this._originalValues[fieldName] || '';

    // Only save if value actually changed
    if (currentValue !== originalValue) {
      // Validate the field before saving
      const validators = control.validator ? [control.validator] : [];
      const validationResult = this.formValidationService.validateField(
        this.formId, 
        fieldName, 
        currentValue, 
        validators
      );
      
      if (validationResult.isValid) {
        this.performAutoSave(fieldName as string, currentValue);
      } else {
        this.notificationService.showValidationError(
          'Document',
          validationResult.errorMessages.join(', ')
        );
      }
    }
  }

  /**
   * Performs auto-save for individual field changes
   * @param fieldName The field that changed
   * @param newValue The new value
   */
  private performAutoSave(fieldName: string, newValue: string): void {
    this.saveStateService.markFieldChanged(this.formId, fieldName, newValue);
    this.saveStateService.updateSaveStatus(this.formId, 'saving');

    // In a real implementation, this would make an API call
    // For now, simulate the save operation
    setTimeout(() => {
      // Update original values to reflect saved state
      this._originalValues[fieldName as keyof DocumentFormValues] = newValue;
      this.saveStateService.updateOriginalValues(this.formId, this._originalValues as unknown as Record<string, unknown>);
      this.saveStateService.updateSaveStatus(this.formId, 'saved');
    }, 300);
  }

  /**
   * Close the dialog with the document data
   */
  onSubmit(): void {
    if (this.documentForm.invalid) {
      return;
    }

    const formValues = this.documentForm.getRawValue() as DocumentFormValues;
    this.dialogRef.close(formValues);
  }

  /**
   * Close the dialog without saving
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
