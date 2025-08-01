import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../../../shared/material/material.module';
import { Metadata } from '../../models/threat-model.model';

export interface MetadataDialogData {
  metadata: Metadata[];
  isReadOnly?: boolean;
  objectType?: string;
  objectName?: string;
}

@Component({
  selector: 'app-metadata-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslocoModule],
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
export class MetadataDialogComponent implements OnInit {
  dataSource = new MatTableDataSource<Metadata>([]);
  displayedColumns: string[] = [];

  @ViewChild('metadataTable') metadataTable!: MatTable<Metadata>;
  @ViewChild('metadataSort') metadataSort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<MetadataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MetadataDialogData,
  ) {}

  ngOnInit(): void {
    this.dataSource.data = [...this.data.metadata];
    this.displayedColumns = this.data.isReadOnly ? ['key', 'value'] : ['key', 'value', 'actions'];
  }

  /**
   * Updates the key of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new key value
   */
  updateKey(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (index >= 0 && index < this.dataSource.data.length) {
      this.dataSource.data[index].key = input.value;
    }
  }

  /**
   * Updates the value of a metadata item
   * @param index The index of the metadata item to update
   * @param event The blur event containing the new value
   */
  updateValue(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (index >= 0 && index < this.dataSource.data.length) {
      this.dataSource.data[index].value = input.value;
    }
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
   */
  save(): void {
    this.dialogRef.close(this.dataSource.data);
  }

  /**
   * Closes the dialog without saving (cancel)
   */
  cancel(): void {
    this.dialogRef.close();
  }
}
