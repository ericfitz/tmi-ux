import { Component, Inject, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import {
  DIALOG_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  ScrollIndicatorDirective,
} from '@app/shared/imports';
import { Authorization, User } from '../../models/threat-model.model';
import { PrincipalTypeIconComponent } from '@app/shared/components/principal-type-icon/principal-type-icon.component';
import {
  getPrincipalDisplayName,
  getCompositeKey,
  principalsEqual,
} from '@app/shared/utils/principal-display.utils';

export interface PermissionsDialogData {
  permissions: Authorization[];
  owner: User;
  isReadOnly?: boolean;
  onOwnerChange?: (newOwner: User) => void;
}

@Component({
  selector: 'app-permissions-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    TranslocoModule,
    ScrollIndicatorDirective,
    PrincipalTypeIconComponent,
  ],
  template: `
    <div class="permissions-dialog">
      <h2 mat-dialog-title>
        {{
          data.isReadOnly
            ? ('common.viewPermissions' | transloco)
            : ('common.permissions' | transloco)
        }}
        @if (data.isReadOnly) {
          <mat-icon
            class="read-only-indicator"
            color="warn"
            [matTooltip]="'common.readOnlyTooltip' | transloco"
            [attr.aria-label]="'common.readOnly' | transloco"
            >edit_off</mat-icon
          >
        }
      </h2>

      <mat-dialog-content appScrollIndicator>
        <div class="permissions-content">
          <!-- Owner Display -->
          <div class="info-section">
            <div class="info-field">
              <span class="info-label">{{ 'common.roles.owner' | transloco }}:</span>
              <span class="info-value">{{ getPrincipalDisplayName(data.owner) }}</span>
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
              <!-- Principal Type Column -->
              <ng-container matColumnDef="principal_type">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'common.type' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field type-field">
                      <mat-select
                        [value]="auth.principal_type"
                        (selectionChange)="updatePermissionPrincipalType(i, $event)"
                        [attr.tabindex]="i * 7 + 1"
                      >
                        <mat-option value="user">
                          <app-principal-type-icon
                            [principalType]="'user'"
                          ></app-principal-type-icon>
                          {{ 'common.subjectTypes.user' | transloco }}
                        </mat-option>
                        <mat-option value="group">
                          <app-principal-type-icon
                            [principalType]="'group'"
                          ></app-principal-type-icon>
                          {{ 'common.subjectTypes.group' | transloco }}
                        </mat-option>
                      </mat-select>
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <div class="type-display">
                      <app-principal-type-icon
                        [principalType]="auth.principal_type"
                      ></app-principal-type-icon>
                      <span>{{
                        getSubjectTypeTranslationKey(auth.principal_type) | transloco
                      }}</span>
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Display Name Column -->
              <ng-container matColumnDef="display_name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsDisplayName' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field">
                      <input
                        matInput
                        [value]="auth.display_name"
                        (blur)="updatePermissionDisplayName(i, $event)"
                        [placeholder]="'threatModels.permissionsDisplayName' | transloco"
                        [attr.tabindex]="i * 7 + 2"
                      />
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ auth.display_name }}</span>
                  }
                </td>
              </ng-container>

              <!-- Email Column -->
              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsEmail' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field">
                      <input
                        matInput
                        [value]="auth.email || ''"
                        (blur)="updatePermissionEmail(i, $event)"
                        [placeholder]="'threatModels.permissionsEmail' | transloco"
                        [attr.tabindex]="i * 7 + 3"
                      />
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ auth.email || '' }}</span>
                  }
                </td>
              </ng-container>

              <!-- Provider Column -->
              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsProvider' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field">
                      <mat-select
                        [value]="auth.provider"
                        (selectionChange)="updatePermissionProvider(i, $event)"
                        [attr.tabindex]="i * 7 + 4"
                      >
                        <mat-option value="google">Google</mat-option>
                        <mat-option value="github">GitHub</mat-option>
                        <mat-option value="microsoft">Microsoft</mat-option>
                        <mat-option value="gitlab">GitLab</mat-option>
                        <mat-option value="bitbucket">Bitbucket</mat-option>
                        <mat-option value="apple">Apple</mat-option>
                      </mat-select>
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ getProviderDisplayName(auth.provider) }}</span>
                  }
                </td>
              </ng-container>

              <!-- Provider ID Column -->
              <ng-container matColumnDef="provider_id">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsPrincipalId' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field">
                      <input
                        matInput
                        [value]="auth.provider_id"
                        (blur)="updatePermissionProviderId(i, $event)"
                        [placeholder]="
                          auth.principal_type === 'user'
                            ? ('threatModels.permissionsUserId' | transloco)
                            : ('threatModels.permissionsGroupId' | transloco)
                        "
                        [attr.tabindex]="i * 7 + 5"
                      />
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ auth.provider_id }}</span>
                  }
                </td>
              </ng-container>

              <!-- Role Column -->
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsRole' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field class="table-field">
                      <mat-select
                        [value]="auth.role"
                        (selectionChange)="updatePermissionRole(i, $event)"
                        [attr.tabindex]="i * 7 + 6"
                      >
                        <mat-option value="owner">{{
                          'common.roles.owner' | transloco
                        }}</mat-option>
                        <mat-option value="writer">{{
                          'common.roles.writer' | transloco
                        }}</mat-option>
                        <mat-option value="reader">{{
                          'common.roles.reader' | transloco
                        }}</mat-option>
                      </mat-select>
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ getRoleTranslationKey(auth.role) | transloco }}</span>
                  }
                </td>
              </ng-container>

              <!-- Actions Column -->
              @if (!data.isReadOnly) {
                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
                  <td mat-cell *matCellDef="let auth; let i = index" class="actions-cell">
                    <div class="actions-container">
                      <button
                        mat-icon-button
                        color="primary"
                        (click)="setAsOwner(i)"
                        [matTooltip]="'threatModels.setAsOwner' | transloco"
                        [disabled]="
                          principalsEqual(auth, data.owner) || auth.principal_type !== 'user'
                        "
                        [attr.tabindex]="i * 7 + 7"
                        [attr.aria-label]="'threatModels.setAsOwner' | transloco"
                      >
                        <mat-icon fontSet="material-symbols-outlined">lock_person</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        color="warn"
                        (click)="deletePermission(i)"
                        [matTooltip]="'common.delete' | transloco"
                        [attr.tabindex]="i * 7 + 8"
                        [attr.aria-label]="'common.delete' | transloco"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </td>
                </ng-container>
              }

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>

          @if (!permissionsDataSource.data.length) {
            <div class="no-items-message">
              {{ 'threatModels.noPermissions' | transloco }}
            </div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        @if (!data.isReadOnly) {
          <button
            mat-button
            color="primary"
            (click)="addPermission()"
            [attr.tabindex]="getAddPermissionButtonTabIndex()"
            [attr.aria-label]="'threatModels.addPermission' | transloco"
          >
            <mat-icon>add</mat-icon>
            <span [transloco]="'threatModels.addPermission'">Add Permission</span>
          </button>
        }
        <button
          mat-button
          (click)="close()"
          [attr.tabindex]="getCloseButtonTabIndex()"
          [attr.aria-label]="'common.cancel' | transloco"
        >
          <span [transloco]="'common.cancel'">Close</span>
        </button>
        @if (!data.isReadOnly) {
          <button
            mat-raised-button
            color="primary"
            (click)="save()"
            [attr.tabindex]="getSaveButtonTabIndex()"
            [attr.aria-label]="'common.save' | transloco"
          >
            <span [transloco]="'common.save'">Save</span>
          </button>
        }
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
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 12px;
        font-family: var(--font-family-primary);
      }

      .info-field {
        display: flex;
        margin-bottom: 6px;
        font-size: var(--font-size-base);
        align-items: center;
      }

      .info-field:last-child {
        margin-bottom: 0;
      }

      .info-label {
        font-weight: var(--font-weight-medium);
        min-width: 120px;
        color: var(--color-text-secondary);
      }

      .info-value {
        color: var(--color-text-primary);
      }

      .table-container {
        margin: 16px 0;
        width: 100%;
        overflow-x: auto;
      }

      .permissions-table {
        width: 100%;
        min-width: 800px;
      }

      .table-field {
        width: 100%;
        min-width: 100px;
      }

      .type-field {
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
        font-size: var(--font-size-base);
      }

      .type-display {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* Principal type column */
      .mat-column-principal_type {
        width: 100px;
        max-width: 100px;
      }

      /* Display name column */
      .mat-column-display_name {
        width: 150px;
        min-width: 150px;
      }

      /* Email column */
      .mat-column-email {
        width: 180px;
        min-width: 180px;
      }

      /* Provider column */
      .mat-column-provider {
        width: 120px;
        max-width: 120px;
      }

      /* Provider ID column */
      .mat-column-provider_id {
        width: 150px;
        min-width: 150px;
      }

      /* Role column */
      .mat-column-role {
        width: 120px;
        max-width: 120px;
      }

      /* Actions column */
      .mat-column-actions {
        width: 140px;
        max-width: 140px;
        text-align: center;
      }

      .mat-mdc-cell,
      .mat-mdc-header-cell {
        padding: 8px 4px;
        vertical-align: middle;
      }

      .mat-mdc-cell {
        height: 56px;
      }

      .actions-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 100%;
        min-height: 40px;
        margin-top: -16px;
      }

      .actions-cell {
        vertical-align: middle;
      }

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

      .table-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
        margin-bottom: 0;
      }

      .table-field .mat-mdc-form-field-flex {
        align-items: center;
      }

      .no-items-message {
        text-align: center;
        color: var(--color-text-secondary);
        padding: 32px;
        font-style: italic;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        margin: 0;
        flex-wrap: wrap;
        gap: 8px;
      }

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
          min-width: 700px;
        }

        .table-field {
          min-width: 80px;
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

  // Expose utility functions to template
  getPrincipalDisplayName = getPrincipalDisplayName;
  getCompositeKey = getCompositeKey;
  principalsEqual = principalsEqual;

  constructor(
    public dialogRef: MatDialogRef<PermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PermissionsDialogData,
  ) {}

  ngOnInit(): void {
    this.permissionsDataSource.data = [...this.data.permissions];
    this.displayedColumns = this.data.isReadOnly
      ? ['principal_type', 'display_name', 'email', 'provider', 'provider_id', 'role']
      : ['principal_type', 'display_name', 'email', 'provider', 'provider_id', 'role', 'actions'];
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Updates the display name of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new display name value
   */
  updatePermissionDisplayName(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newDisplayName = input.value.trim();

    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].display_name = newDisplayName;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the email of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new email value
   */
  updatePermissionEmail(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newEmail = input.value.trim();

    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].email = newEmail;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the principal type of a permission
   * @param index The index of the permission to update
   * @param event The selection change event containing the new principal type value
   */
  updatePermissionPrincipalType(index: number, event: { value: 'user' | 'group' }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].principal_type = event.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the provider of a permission
   * @param index The index of the permission to update
   * @param event The selection change event containing the new provider value
   */
  updatePermissionProvider(index: number, event: { value: string }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].provider = event.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the provider ID of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new provider ID value
   */
  updatePermissionProviderId(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const newProviderId = input.value.trim();

    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].provider_id = newProviderId;
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
      principal_type: 'user',
      provider: 'google',
      provider_id: '',
      display_name: '',
      email: '',
      role: 'reader',
    });
    this.permissionsTable.renderRows();
  }

  /**
   * Deletes a permission from the list
   * @param index The index of the permission to delete
   */
  deletePermission(index: number): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
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

      // Ensure only users (not groups) can be set as owner
      if (selectedAuth.principal_type !== 'user') {
        console.warn('Only users can be set as owner');
        return;
      }

      // Create User object from authorization entry
      const newOwner: User = {
        principal_type: 'user',
        provider: selectedAuth.provider,
        provider_id: selectedAuth.provider_id,
        display_name: selectedAuth.display_name,
        email: selectedAuth.email,
      };

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

  /**
   * Gets the tabindex for the add permission button
   * @returns The tabindex value after all table rows
   */
  getAddPermissionButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 1;
  }

  /**
   * Gets the tabindex for the close button
   * @returns The tabindex value after the add button
   */
  getCloseButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 2;
  }

  /**
   * Gets the tabindex for the save button
   * @returns The tabindex value after the close button
   */
  getSaveButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 3;
  }

  /**
   * Gets the translation key for a subject type
   * @param subjectType The subject type ('user' or 'group')
   * @returns The translation key for the subject type
   */
  getSubjectTypeTranslationKey(subjectType: string): string {
    return `common.subjectTypes.${subjectType}`;
  }

  /**
   * Gets the translation key for a role
   * @param role The role ('owner', 'writer', or 'reader')
   * @returns The translation key for the role
   */
  getRoleTranslationKey(role: string): string {
    return `common.roles.${role}`;
  }

  /**
   * Gets the display name for a provider with proper capitalization
   * @param provider The provider identifier
   * @returns The formatted provider display name
   */
  getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      gitlab: 'GitLab',
      bitbucket: 'Bitbucket',
      apple: 'Apple',
    };
    return displayNames[provider] || provider;
  }
}
