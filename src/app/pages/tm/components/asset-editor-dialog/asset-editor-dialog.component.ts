import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { MatChipInputEvent } from '@angular/material/chips';

import { Asset } from '../../models/threat-model.model';

/**
 * Interface for asset form values
 */
interface AssetFormValues {
  name: string;
  description?: string;
  type?: 'data' | 'hardware' | 'software' | 'infrastructure' | 'service' | 'personnel';
  criticality?: string;
  classification?: string[];
  sensitivity?: string[];
}

/**
 * Interface for dialog data
 */
export interface AssetEditorDialogData {
  asset?: Asset;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-asset-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatIconModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './asset-editor-dialog.component.html',
  styleUrls: ['./asset-editor-dialog.component.scss'],
})
export class AssetEditorDialogComponent implements OnInit, OnDestroy {
  assetForm: FormGroup;
  mode: 'create' | 'edit';

  // Chip input configuration
  readonly separatorKeysCodes = [ENTER, COMMA] as const;

  // Asset type options
  assetTypes: Array<'data' | 'hardware' | 'software' | 'infrastructure' | 'service' | 'personnel'> =
    ['data', 'hardware', 'software', 'infrastructure', 'service', 'personnel'];

  private _subscriptions: Subscription = new Subscription();

  constructor(
    private dialogRef: MatDialogRef<AssetEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: AssetEditorDialogData,
  ) {
    this.mode = data.mode;

    this.assetForm = this.fb.group({
      name: [data.asset?.name || '', [Validators.required, Validators.maxLength(256)]],
      description: [data.asset?.description || '', Validators.maxLength(1024)],
      type: [data.asset?.type || ''],
      criticality: [data.asset?.criticality || '', Validators.maxLength(64)],
      classification: [data.asset?.classification || []],
      sensitivity: [data.asset?.sensitivity || []],
    });
  }

  ngOnInit(): void {
    // Component initialization complete
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Add a classification chip
   */
  addClassification(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      const currentClassification = this.assetForm.get('classification')?.value as string[];
      if (!currentClassification.includes(value)) {
        this.assetForm.patchValue({
          classification: [...currentClassification, value],
        });
      }
    }

    event.chipInput.clear();
  }

  /**
   * Remove a classification chip
   */
  removeClassification(classification: string): void {
    const currentClassification = this.assetForm.get('classification')?.value as string[];
    const index = currentClassification.indexOf(classification);

    if (index >= 0) {
      const updated = [...currentClassification];
      updated.splice(index, 1);
      this.assetForm.patchValue({ classification: updated });
    }
  }

  /**
   * Add a sensitivity chip
   */
  addSensitivity(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();

    if (value) {
      const currentSensitivity = this.assetForm.get('sensitivity')?.value as string[];
      if (!currentSensitivity.includes(value)) {
        this.assetForm.patchValue({
          sensitivity: [...currentSensitivity, value],
        });
      }
    }

    event.chipInput.clear();
  }

  /**
   * Remove a sensitivity chip
   */
  removeSensitivity(sensitivity: string): void {
    const currentSensitivity = this.assetForm.get('sensitivity')?.value as string[];
    const index = currentSensitivity.indexOf(sensitivity);

    if (index >= 0) {
      const updated = [...currentSensitivity];
      updated.splice(index, 1);
      this.assetForm.patchValue({ sensitivity: updated });
    }
  }

  /**
   * Close the dialog with the asset data
   */
  onSubmit(): void {
    if (this.assetForm.invalid) {
      return;
    }

    const formValues = this.assetForm.getRawValue() as AssetFormValues;

    // Clean up empty optional fields
    const result: Partial<AssetFormValues> = {
      name: formValues.name,
    };

    if (formValues.description?.trim()) {
      result.description = formValues.description.trim();
    }

    if (formValues.type) {
      result.type = formValues.type;
    }

    if (formValues.criticality?.trim()) {
      result.criticality = formValues.criticality.trim();
    }

    if (formValues.classification && formValues.classification.length > 0) {
      result.classification = formValues.classification;
    }

    if (formValues.sensitivity && formValues.sensitivity.length > 0) {
      result.sensitivity = formValues.sensitivity;
    }

    this.dialogRef.close(result);
  }

  /**
   * Close the dialog without saving
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
