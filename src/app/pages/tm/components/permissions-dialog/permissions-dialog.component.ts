import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../../../shared/material/material.module';
import { Authorization } from '../../models/threat-model.model';

export interface PermissionsDialogData {
  permissions: Authorization[];
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-permissions-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslocoModule],
  template: `
    <div class="permissions-dialog">
      <h2 mat-dialog-title [transloco]="'threatModels.permissions'">Permissions</h2>

      <mat-dialog-content>
        <div class="permissions-content">
          <div class="table-container">
            <table
              mat-table
              [dataSource]="permissionsDataSource"
              #permissionsTable
              matSort
              #permissionsSort="matSort"
              class="permissions-table"
            >
              <!-- Subject Column -->
              <ng-container matColumnDef="subject">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsUser' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  <mat-form-field class="table-field" *ngIf="!data.isReadOnly">
                    <input
                      matInput
                      [value]="auth.subject"
                      (blur)="updatePermissionSubject(i, $event)"
                      placeholder="User Email"
                    />
                  </mat-form-field>
                  <span *ngIf="data.isReadOnly">{{ auth.subject }}</span>
                </td>
              </ng-container>

              <!-- Role Column -->
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsRole' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  <mat-form-field class="table-field" *ngIf="!data.isReadOnly">
                    <mat-select
                      [value]="auth.role"
                      (selectionChange)="updatePermissionRole(i, $event)"
                    >
                      <mat-option value="owner">{{
                        'collaboration.roles.owner' | transloco
                      }}</mat-option>
                      <mat-option value="writer">{{
                        'collaboration.roles.writer' | transloco
                      }}</mat-option>
                      <mat-option value="reader">{{
                        'collaboration.roles.reader' | transloco
                      }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <span *ngIf="data.isReadOnly">{{
                    'collaboration.roles.' + auth.role | transloco
                  }}</span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions" *ngIf="!data.isReadOnly">
                <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="deletePermission(i)"
                    [matTooltip]="'common.delete' | transloco"
                    [disabled]="i === 0"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>

          <div *ngIf="!permissionsDataSource.data.length" class="no-items-message">
            {{ 'threatModels.noPermissions' | transloco }}
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button color="primary" (click)="addPermission()" *ngIf="!data.isReadOnly">
          <mat-icon>add</mat-icon>
          <span [transloco]="'threatModels.addPermission'">Add Permission</span>
        </button>
        <button mat-button (click)="close()">
          <span [transloco]="'common.cancel'">Close</span>
        </button>
        <button mat-raised-button color="primary" (click)="save()" *ngIf="!data.isReadOnly">
          <span [transloco]="'common.save'">Save</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .permissions-dialog {
        width: 100%;
        max-width: 90vw;
        min-width: 500px;
      }

      .permissions-content {
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

      .permissions-table {
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

      .table-field input,
      .table-field mat-select {
        font-size: 14px;
      }

      /* Make role column narrower */
      .mat-column-role {
        width: 120px;
        max-width: 120px;
      }

      /* Make actions column wider */
      .mat-column-actions {
        width: 100px;
        max-width: 100px;
        text-align: center;
      }

      /* Subject column takes remaining space */
      .mat-column-subject {
        flex: 1;
        min-width: 200px;
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
        .permissions-dialog {
          min-width: 320px;
          max-width: 95vw;
        }

        .permissions-table {
          min-width: 320px;
        }

        .table-field {
          min-width: 80px;
        }

        .mat-column-role {
          width: 100px;
          max-width: 100px;
        }

        .mat-column-actions {
          width: 80px;
          max-width: 80px;
        }

        .mat-column-subject {
          min-width: 150px;
        }
      }
    `,
  ],
})
export class PermissionsDialogComponent implements OnInit {
  permissionsDataSource = new MatTableDataSource<Authorization>([]);
  displayedColumns: string[] = [];

  @ViewChild('permissionsTable') permissionsTable!: MatTable<Authorization>;
  @ViewChild('permissionsSort') permissionsSort!: MatSort;

  constructor(
    public dialogRef: MatDialogRef<PermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PermissionsDialogData,
  ) {}

  ngOnInit(): void {
    this.permissionsDataSource.data = [...this.data.permissions];
    this.displayedColumns = this.data.isReadOnly
      ? ['subject', 'role']
      : ['subject', 'role', 'actions'];
  }

  /**
   * Updates the subject (user) of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new subject value
   */
  updatePermissionSubject(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].subject = input.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the role of a permission
   * @param index The index of the permission to update
   * @param event The selection change event containing the new role value
   */
  updatePermissionRole(index: number, event: { value: 'reader' | 'writer' | 'owner' }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].role = event.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Adds a new permission to the list
   */
  addPermission(): void {
    this.permissionsDataSource.data.push({
      subject: '',
      role: 'reader',
    });
    this.permissionsTable.renderRows();
  }

  /**
   * Deletes a permission from the list
   * @param index The index of the permission to delete
   */
  deletePermission(index: number): void {
    // Don't allow deleting the first permission (owner)
    if (index > 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data.splice(index, 1);
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Saves the permissions and closes the dialog
   */
  save(): void {
    this.dialogRef.close(this.permissionsDataSource.data);
  }

  /**
   * Closes the dialog without saving
   */
  close(): void {
    this.dialogRef.close();
  }
}
