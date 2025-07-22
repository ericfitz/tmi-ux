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

      .metadata-content {
        min-height: 200px;
        max-height: 60vh;
        overflow-y: auto;
        overflow-x: hidden;
      }

      .table-container {
        margin: 16px 0;
        width: 100%;
        overflow-x: auto;
      }

      .metadata-table {
        width: 100%;
        min-width: 400px;
      }

      .table-field {
        width: 100%;
        min-width: 120px;
      }

      .table-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
      }

      .table-field .mat-mdc-form-field-infix {
        min-height: 40px;
        padding: 8px 0;
      }

      .table-field input {
        font-size: 14px;
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

      .mat-mdc-cell,
      .mat-mdc-header-cell {
        padding: 8px 4px;
      }

      .no-items-message {
        text-align: center;
        color: rgba(0, 0, 0, 0.6);
        padding: 32px;
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
    const newData = [...this.dataSource.data, {
      key: '',
      value: '',
    }];
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
