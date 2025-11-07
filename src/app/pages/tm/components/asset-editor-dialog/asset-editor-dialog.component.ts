import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  sensitivity?: string;
}

/**
 * Interface for dialog data
 */
export interface AssetEditorDialogData {
  asset?: Asset;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
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
    MatTooltipModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './asset-editor-dialog.component.html',
  styleUrls: ['./asset-editor-dialog.component.scss'],
})
export class AssetEditorDialogComponent implements OnInit, OnDestroy {
  assetForm: FormGroup;
  mode: 'create' | 'edit';
  isReadOnly: boolean;

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
    this.isReadOnly = data.isReadOnly || false;

    this.assetForm = this.fb.group({
      name: [data.asset?.name || '', [Validators.required, Validators.maxLength(256)]],
      description: [data.asset?.description || '', Validators.maxLength(1024)],
      type: [data.asset?.type || ''],
      criticality: [data.asset?.criticality || '', Validators.maxLength(64)],
      classification: [data.asset?.classification || []],
      sensitivity: [data.asset?.sensitivity || '', Validators.maxLength(256)],
    });

    if (this.isReadOnly) {
      this.assetForm.disable();
    }
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

    if (formValues.sensitivity?.trim()) {
      result.sensitivity = formValues.sensitivity.trim();
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
