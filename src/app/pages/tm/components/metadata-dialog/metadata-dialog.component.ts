import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../../../shared/material/material.module';
import { Metadata } from '../../models/threat-model.model';

// Enhanced save behavior imports
import { SaveStateService, SaveState } from '../../../../shared/services/save-state.service';
import { ServerConnectionService, DetailedConnectionStatus } from '../../../../core/services/server-connection.service';
import { NotificationService } from '../../../../shared/services/notification.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SaveIndicatorComponent } from '../../../../shared/components/save-indicator/save-indicator.component';

export interface MetadataDialogData {
  metadata: Metadata[];
  isReadOnly?: boolean;
  objectType?: string;
  objectName?: string;
}

@Component({
  selector: 'app-metadata-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslocoModule, SaveIndicatorComponent],
  templateUrl: './metadata-dialog.component.html',
  styles: [
    `
      .metadata-dialog {
        width: 100%;
        max-width: 90vw;
        min-width: 500px;
      }

      .dialog-subtitle {
        font-size: 14px;
        font-weight: 400;
        color: rgba(0, 0, 0, 0.6);
        margin: -12px 24px 4px 24px;
        padding: 0;
        line-height: 1.4;
      }

      .metadata-content {
        min-height: 200px;
        max-height: 60vh;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .table-container {
        margin: 4px 0;
        width: 100%;
        overflow-x: auto;
      }

      .metadata-table {
        width: 100%;
        min-width: 400px;
      }

      /* Ensure table rows are compact */
      .metadata-table .mat-mdc-row,
      .metadata-table .mat-mdc-header-row {
        height: auto !important;
        min-height: auto !important;
      }

      .table-field {
        width: 100%;
        min-width: 120px;
        margin: 0 !important;
      }

      /* Override Material form field heights aggressively with ng-deep */
      ::ng-deep .metadata-table .table-field.mat-mdc-form-field {
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
      }

      ::ng-deep .metadata-table .table-field .mat-mdc-form-field-wrapper {
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
        padding: 0 !important;
      }

      .table-field .mat-mdc-form-field-wrapper {
        padding: 0 !important;
        margin: 0 !important;
        height: 32px !important;
      }

      /* Target all wrapper elements aggressively with ng-deep */
      ::ng-deep .metadata-table .table-field .mat-mdc-text-field-wrapper {
        padding: 0 4px !important;
        margin: 0 !important;
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
      }

      ::ng-deep .metadata-table .table-field .mat-mdc-form-field-flex {
        padding: 0 !important;
        margin: 0 !important;
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
        align-items: center !important;
      }

      .table-field .mat-mdc-form-field-subscript-wrapper {
        height: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        display: none !important;
        line-height: 0 !important;
      }

      ::ng-deep .metadata-table .table-field .mat-mdc-form-field-infix {
        min-height: 24px !important;
        height: 24px !important;
        max-height: 24px !important;
        padding: 0 4px !important;
        display: flex !important;
        align-items: center !important;
      }

      /* Input element itself - minimize all spacing around text */
      ::ng-deep .metadata-table .table-field input.mat-mdc-input-element {
        padding: 0 !important;
        margin: 0 !important;
        height: 20px !important;
        max-height: 20px !important;
        line-height: 20px !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
      }

      .table-field input {
        font-size: 14px;
        vertical-align: top !important;
      }

      /* Remove any default Material outline styling that adds space */
      .table-field .mdc-notched-outline {
        border: 1px solid rgba(0, 0, 0, 0.38) !important;
      }

      .table-field .mdc-notched-outline__leading,
      .table-field .mdc-notched-outline__notch,
      .table-field .mdc-notched-outline__trailing {
        border-top: 1px solid rgba(0, 0, 0, 0.38) !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.38) !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Make key and value columns equal width */
      .mat-column-key,
      .mat-column-value {
        flex: 1;
        min-width: 150px;
      }

      /* Make actions column wider */
      .mat-column-actions {
        width: 100px;
        max-width: 100px;
        text-align: center;
      }

      .mat-column-actions .mat-mdc-icon-button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 28px !important;
        width: 28px !important;
        transform: translateY(-2px) !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }

      .mat-mdc-cell,
      .mat-mdc-header-cell {
        vertical-align: middle;
      }

      .mat-mdc-cell {
        height: 34px !important;
        padding: 1px 4px !important;
        vertical-align: middle !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
      }

      .mat-mdc-header-cell {
        height: 32px !important;
        padding: 2px 4px !important;
        vertical-align: middle !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
      }

      .no-items-message {
        text-align: center;
        color: rgba(0, 0, 0, 0.6);
        padding: 16px;
        font-style: italic;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        margin: 0;
        flex-wrap: wrap;
        gap: 8px;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .metadata-dialog {
          min-width: 320px;
          max-width: 95vw;
        }

        .metadata-table {
          min-width: 320px;
        }

        .table-field {
          min-width: 80px;
        }

        .mat-column-key,
        .mat-column-value {
          min-width: 120px;
        }

        .mat-column-actions {
          width: 80px;
          max-width: 80px;
        }
      }
    `,
  ],
})
export class MetadataDialogComponent implements OnInit, OnDestroy {
  dataSource = new MatTableDataSource<Metadata>([]);
  displayedColumns: string[] = [];

  @ViewChild('metadataTable') metadataTable!: MatTable<Metadata>;
  @ViewChild('metadataSort') metadataSort!: MatSort;

  // Enhanced save behavior properties
  formId: string;
  saveState: SaveState | undefined;
  connectionStatus: DetailedConnectionStatus | undefined;
  private _subscriptions: Subscription = new Subscription();
  private _originalMetadata: Metadata[] = [];

  constructor(
    public dialogRef: MatDialogRef<MetadataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MetadataDialogData,
    // Enhanced save behavior services
    private saveStateService: SaveStateService,
    private serverConnectionService: ServerConnectionService,
    private notificationService: NotificationService,
    private formValidationService: FormValidationService,
  ) {
    // Create unique form ID for this dialog instance
    this.formId = `metadata-dialog-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  ngOnInit(): void {
    this.dataSource.data = [...this.data.metadata];
    this.displayedColumns = this.data.isReadOnly ? ['key', 'value'] : ['key', 'value', 'actions'];
    
    // Store original metadata for change detection
    this._originalMetadata = JSON.parse(JSON.stringify(this.data.metadata)) as Metadata[];
    
    // Initialize save state
    this._subscriptions.add(
      this.saveStateService.initializeSaveState(this.formId, this._originalMetadata as unknown as Record<string, unknown>).subscribe(state => {
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
   * Updates the key of a metadata item with change detection and auto-save
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new key value
   */
  updateKey(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newKey = input.value.trim();
    
    if (index >= 0 && index < this.dataSource.data.length) {
      const originalItem = this._originalMetadata[index];
      const currentItem = this.dataSource.data[index];
      
      // Only update if value actually changed
      if (originalItem && currentItem.key !== newKey) {
        currentItem.key = newKey;
        
        // Mark field as changed and trigger auto-save
        this.saveStateService.markFieldChanged(this.formId, `metadata_${index}_key`, newKey);
        this.performAutoSave(index, 'key', newKey);
      }
    }
  }

  /**
   * Updates the value of a metadata item with change detection and auto-save
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new value
   */
  updateValue(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newValue = input.value.trim();
    
    if (index >= 0 && index < this.dataSource.data.length) {
      const originalItem = this._originalMetadata[index];
      const currentItem = this.dataSource.data[index];
      
      // Only update if value actually changed
      if (originalItem && currentItem.value !== newValue) {
        currentItem.value = newValue;
        
        // Mark field as changed and trigger auto-save
        this.saveStateService.markFieldChanged(this.formId, `metadata_${index}_value`, newValue);
        this.performAutoSave(index, 'value', newValue);
      }
    }
  }

  /**
   * Performs auto-save for individual metadata field changes
   */
  private performAutoSave(index: number, field: 'key' | 'value', newValue: string): void {
    // Validate the field before saving
    if (!newValue) {
      this.notificationService.showValidationError('Metadata', `${field} cannot be empty`);
      return;
    }
    
    this.saveStateService.updateSaveStatus(this.formId, 'saving');
    
    // In a real implementation, this would make an API call to save the metadata
    // For now, simulate the save operation
    setTimeout(() => {
      this.saveStateService.updateOriginalValues(this.formId, this.dataSource.data as unknown as Record<string, unknown>);
      this.saveStateService.updateSaveStatus(this.formId, 'saved');
      
      // Update original metadata to reflect saved state
      this._originalMetadata = JSON.parse(JSON.stringify(this.dataSource.data)) as Metadata[];
    }, 300);
  }

  /**
   * Gets filtered metadata - removes empty entries and validates
   * @returns Valid metadata entries (both key and value must be non-empty)
   */
  private getValidMetadata(): Metadata[] {
    return this.dataSource.data.filter(item => 
      item.key && item.key.trim() !== '' && 
      item.value && item.value.trim() !== ''
    );
  }

  /**
   * Adds a new metadata item to the list
   */
  addItem(): void {
    const newData = [
      ...this.dataSource.data,
      {
        key: '',
        value: '',
      },
    ];
    this.dataSource.data = newData;
  }

  /**
   * Deletes a metadata item from the list
   * @param index The index of the metadata item to delete
   */
  deleteItem(index: number): void {
    if (index >= 0 && index < this.dataSource.data.length) {
      const newData = [...this.dataSource.data];
      newData.splice(index, 1);
      this.dataSource.data = newData;
    }
  }

  /**
   * Saves the metadata and closes the dialog
   * Only saves valid metadata entries (non-empty key and value pairs)
   */
  save(): void {
    const validMetadata = this.getValidMetadata();
    this.dialogRef.close(validMetadata);
  }

  /**
   * Closes the dialog without saving (cancel)
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
