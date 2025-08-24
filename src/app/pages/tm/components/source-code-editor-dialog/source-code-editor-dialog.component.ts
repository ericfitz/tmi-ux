import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Source } from '../../models/threat-model.model';

// Enhanced save behavior imports
import { SaveStateService, SaveState } from '../../../../shared/services/save-state.service';
import { ServerConnectionService, DetailedConnectionStatus } from '../../../../core/services/server-connection.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SaveIndicatorComponent } from '../../../../shared/components/save-indicator/save-indicator.component';

/**
 * Interface for source code form values
 */
interface SourceCodeFormValues {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  url: string;
  refType?: 'branch' | 'tag' | 'commit';
  refValue?: string;
  subPath?: string;
}

/**
 * Interface for dialog data
 */
export interface SourceCodeEditorDialogData {
  sourceCode?: Source;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-source-code-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoModule,
    SaveIndicatorComponent,
  ],
  templateUrl: './source-code-editor-dialog.component.html',
  styleUrls: ['./source-code-editor-dialog.component.scss'],
})
export class SourceCodeEditorDialogComponent implements OnInit, OnDestroy {
  sourceCodeForm: FormGroup;
  mode: 'create' | 'edit';

  // Enhanced save behavior properties
  formId: string;
  saveState: SaveState | undefined;
  connectionStatus: DetailedConnectionStatus | undefined;
  private _subscriptions: Subscription = new Subscription();
  private _originalValues: SourceCodeFormValues;

  constructor(
    private dialogRef: MatDialogRef<SourceCodeEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: SourceCodeEditorDialogData,
    // Enhanced save behavior services
    private saveStateService: SaveStateService,
    private serverConnectionService: ServerConnectionService,
    private notificationService: NotificationService,
    private formValidationService: FormValidationService,
  ) {
    this.mode = data.mode;

    // Store original values for change detection
    this._originalValues = {
      name: data.sourceCode?.name || '',
      description: data.sourceCode?.description || '',
      type: data.sourceCode?.type || 'git',
      url: data.sourceCode?.url || '',
      refType: data.sourceCode?.parameters?.refType || 'branch',
      refValue: data.sourceCode?.parameters?.refValue || '',
      subPath: data.sourceCode?.parameters?.subPath || '',
    };

    this.sourceCodeForm = this.fb.group({
      name: [this._originalValues.name, [Validators.required, Validators.maxLength(256)]],
      description: [this._originalValues.description, Validators.maxLength(1024)],
      type: [this._originalValues.type, Validators.required],
      url: [this._originalValues.url, [Validators.required, Validators.maxLength(1024)]],
      refType: [this._originalValues.refType],
      refValue: [this._originalValues.refValue, Validators.maxLength(256)],
      subPath: [this._originalValues.subPath, Validators.maxLength(256)],
    });

    // Create unique form ID for this dialog instance
    this.formId = `source-code-editor-dialog-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
      this.serverConnectionService.detailedConnectionStatus$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    // Connection monitoring cleanup handled by service
    this.saveStateService.destroySaveState(this.formId);
  }

  /**
   * Handles blur events on form fields for auto-save
   * @param fieldName The name of the field that lost focus
   */
  onFieldBlur(fieldName: keyof SourceCodeFormValues): void {
    const control = this.sourceCodeForm.get(fieldName);
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
          'Source Code',
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
      (this._originalValues as unknown as Record<string, unknown>)[fieldName] = newValue;
      this.saveStateService.updateOriginalValues(this.formId, this._originalValues as unknown as Record<string, unknown>);
      this.saveStateService.updateSaveStatus(this.formId, 'saved');
    }, 300);
  }

  /**
   * Close the dialog with the source code data
   */
  onSubmit(): void {
    if (this.sourceCodeForm.invalid) {
      return;
    }

    const formValues = this.sourceCodeForm.getRawValue() as SourceCodeFormValues;

    // Build the result with proper structure
    const result = {
      name: formValues.name,
      description: formValues.description,
      type: formValues.type,
      url: formValues.url,
      parameters: formValues.refValue
        ? {
            refType: formValues.refType || 'branch',
            refValue: formValues.refValue,
            subPath: formValues.subPath,
          }
        : undefined,
    };

    this.dialogRef.close(result);
  }

  /**
   * Close the dialog without saving
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
