/**
 * Data Asset Dialog Component
 *
 * This component provides a dialog for selecting or viewing data assets associated with edges
 * in the DFD (Data Flow Diagram) editor.
 *
 * Key functionality:
 * - Displays a dropdown to select data assets (filtered to type === 'data')
 * - Shows "None" option as the first item
 * - Validates and defaults to "None" if stored asset ID doesn't exist
 * - Supports read-only mode (view only)
 * - Returns selected asset ID or null on close
 */

import { Component, Inject, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Asset } from '../../../../tm/models/threat-model.model';

/**
 * Data interface for the data asset dialog
 */
export interface DataAssetDialogData {
  cellId: string;
  currentDataAssetId?: string;
  assets: Asset[];
  isReadOnly: boolean;
}

/**
 * Interface for asset options in the dropdown
 */
interface AssetOption {
  id: string;
  name: string;
}

/**
 * Dialog component for selecting or viewing data assets for edges
 */
@Component({
  selector: 'app-data-asset-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './data-asset-dialog.component.html',
  styleUrls: ['./data-asset-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataAssetDialogComponent implements OnInit {
  /**
   * Constant for "None" option value
   */
  readonly NONE_VALUE = '__none__';

  /**
   * Form control for asset selection
   */
  assetControl: FormControl<string>;

  /**
   * Asset options for the dropdown
   */
  assetOptions: AssetOption[] = [];

  /**
   * Dialog title based on read-only mode
   */
  get dialogTitle(): string {
    return this.data.isReadOnly
      ? this.translocoService.translate('dataAssetDialog.title.view')
      : this.translocoService.translate('dataAssetDialog.title.select');
  }

  constructor(
    private _dialogRef: MatDialogRef<DataAssetDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DataAssetDialogData,
    private translocoService: TranslocoService,
  ) {
    // Initialize form control with current value or "None"
    const initialValue = this._getValidatedAssetId();
    this.assetControl = new FormControl<string>(initialValue, { nonNullable: true });

    // Disable control in read-only mode
    if (this.data.isReadOnly) {
      this.assetControl.disable();
    }
  }

  ngOnInit(): void {
    this._initializeAssetOptions();
  }

  /**
   * Validates the current asset ID and returns it if valid, otherwise returns NONE_VALUE
   */
  private _getValidatedAssetId(): string {
    if (!this.data.currentDataAssetId) {
      return this.NONE_VALUE;
    }

    // Check if the asset exists in the provided assets
    const assetExists = this.data.assets.some(
      asset => asset.id === this.data.currentDataAssetId && asset.type === 'data',
    );

    return assetExists ? this.data.currentDataAssetId : this.NONE_VALUE;
  }

  /**
   * Initialize asset options for the dropdown
   */
  private _initializeAssetOptions(): void {
    // Start with "None" option
    this.assetOptions = [
      {
        id: this.NONE_VALUE,
        name: this.translocoService.translate('common.none'),
      },
    ];

    // Filter to only data assets and sort alphabetically by name
    const dataAssets = this.data.assets
      .filter(asset => asset.type === 'data')
      .sort((a, b) => a.name.localeCompare(b.name));

    // Add data assets to options
    this.assetOptions = [
      ...this.assetOptions,
      ...dataAssets.map(asset => ({
        id: asset.id,
        name: asset.name,
      })),
    ];
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    this._dialogRef.close();
  }

  /**
   * Handle save button click
   */
  onSave(): void {
    const selectedValue = this.assetControl.value;
    const result = selectedValue === this.NONE_VALUE ? null : selectedValue;
    this._dialogRef.close(result);
  }
}
