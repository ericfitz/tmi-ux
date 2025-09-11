import { Component, Inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS, FORM_MATERIAL_IMPORTS } from '@app/shared/imports';
import { Authorization } from '../../models/threat-model.model';

export interface PermissionsDialogData {
  permissions: Authorization[];
  owner: string;
  isReadOnly?: boolean;
  onOwnerChange?: (newOwner: string) => void;
}

@Component({
  selector: 'app-permissions-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, ...FORM_MATERIAL_IMPORTS, TranslocoModule],
  template: `
    <div class="permissions-dialog">
      <h2 mat-dialog-title>
        {{ 'common.permissions' | transloco }}
      </h2>

      <mat-dialog-content>
        <div class="permissions-content">
          <!-- Owner Display -->
          <div class="info-section">
            <div class="info-field">
              <span class="info-label">{{ 'common.roles.owner' | transloco }}:</span>
              <span class="info-value">{{ data.owner }}</span>
            </div>
          </div>

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
                      <mat-option value="owner">{{ 'common.roles.owner' | transloco }}</mat-option>
                      <mat-option value="writer">{{
                        'common.roles.writer' | transloco
                      }}</mat-option>
                      <mat-option value="reader">{{
                        'common.roles.reader' | transloco
                      }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <span *ngIf="data.isReadOnly">{{ 'common.roles.' + auth.role | transloco }}</span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions" *ngIf="!data.isReadOnly">
                <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
                <td mat-cell *matCellDef="let auth; let i = index" class="actions-cell">
                  <div class="actions-container">
                    <button
                      mat-icon-button
                      color="primary"
                      (click)="setAsOwner(i)"
                      [matTooltip]="'threatModels.setAsOwner' | transloco"
                      [disabled]="auth.subject === data.owner"
                    >
                      <mat-icon fontSet="material-symbols-outlined">lock_person</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      color="warn"
                      (click)="deletePermission(i)"
                      [matTooltip]="'common.delete' | transloco"
                      [disabled]="i === 0"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
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

      .info-section {
        background-color: #f5f5f5;
        border-radius: 4px;
        padding: 8px 12px;
        margin-bottom: 12px;
        font-family: Roboto, Arial, sans-serif;
      }

      .info-field {
        display: flex;
        margin-bottom: 6px;
        font-size: 14px;
        align-items: center;
      }

      .info-field:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-weight: 500;
        min-width: 120px;
        color: rgb(0 0 0 / 70%);
      }

      .info-value {
        color: rgb(0 0 0 / 87%);
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

      /* Make actions column wider to accommodate both buttons */
      .mat-column-actions {
        width: 140px;
        max-width: 140px;
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
        vertical-align: middle;
      }

      .mat-mdc-cell {
        height: 56px; /* Consistent row height */
      }

      .actions-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 100%;
        min-height: 40px;
        margin-top: -16px; /* Move buttons up by 6px */
      }

      .actions-cell {
        vertical-align: middle;
      }

      /* Center align icons in action buttons */
      .actions-container mat-icon {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .actions-container button[mat-icon-button] {
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Ensure form fields don't make cells too tall */
      .table-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
        margin-bottom: 0;
      }

      .table-field .mat-mdc-form-field-flex {
        align-items: center;
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

      // Save indicator styling
      .header-save-indicator {
        margin-left: 12px;
        display: inline-flex;
        align-items: center;
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
          width: 120px;
          max-width: 120px;
        }

        .mat-column-subject {
          min-width: 150px;
        }
      }
    `,
  ],
})
export class PermissionsDialogComponent implements OnInit, OnDestroy {
  permissionsDataSource = new MatTableDataSource<Authorization>([]);
  displayedColumns: string[] = [];

  @ViewChild('permissionsTable') permissionsTable!: MatTable<Authorization>;
  @ViewChild('permissionsSort') permissionsSort!: MatSort;

  private _subscriptions: Subscription = new Subscription();

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

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Updates the subject (user) of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new subject value
   */
  updatePermissionSubject(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newSubject = input.value.trim();

    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].subject = newSubject;
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
   * Sets the selected user as owner
   * @param index The index of the permission to set as owner
   */
  setAsOwner(index: number): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      const selectedAuth = this.permissionsDataSource.data[index];
      const newOwner = selectedAuth.subject;

      // Update the local owner value
      this.data.owner = newOwner;

      // Notify parent component about the owner change if callback is provided
      if (this.data.onOwnerChange) {
        this.data.onOwnerChange(newOwner);
      }

      // Refresh the table to update button states
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Saves the permissions and closes the dialog
   */
  save(): void {
    this.dialogRef.close({
      permissions: this.permissionsDataSource.data,
      owner: this.data.owner,
    });
  }

  /**
   * Closes the dialog without saving
   */
  close(): void {
    this.dialogRef.close();
  }
}
