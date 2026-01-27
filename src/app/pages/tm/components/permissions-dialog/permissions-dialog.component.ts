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
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
import { AuthService } from '@app/auth/services/auth.service';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import {
  getPrincipalDisplayName,
  getCompositeKey,
  principalsEqual,
} from '@app/shared/utils/principal-display.utils';
import { ProviderAdapterService } from '../../services/providers/provider-adapter.service';

/**
 * Authorization with temporary _subject field for UI state management
 */
interface AuthorizationWithSubject extends Authorization {
  _subject?: string;
}

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
    ProviderDisplayComponent,
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
                <td
                  mat-cell
                  *matCellDef="let auth; let i = index"
                  [matTooltip]="getRowTooltip(auth)"
                  [matTooltipDisabled]="isNewPermission(auth)"
                >
                  @if (!data.isReadOnly) {
                    <mat-form-field appearance="outline" class="table-field type-field">
                      <mat-select
                        [value]="auth.principal_type"
                        (selectionChange)="updatePermissionPrincipalType(i, $event)"
                        [attr.tabindex]="i * 5 + 1"
                      >
                        <mat-select-trigger>
                          <div class="type-option">
                            <app-principal-type-icon
                              [principalType]="auth.principal_type"
                            ></app-principal-type-icon>
                            {{ getSubjectTypeTranslationKey(auth.principal_type) | transloco }}
                          </div>
                        </mat-select-trigger>
                        <mat-option value="user">
                          <div class="type-option">
                            <app-principal-type-icon
                              [principalType]="'user'"
                            ></app-principal-type-icon>
                            {{ 'common.subjectTypes.user' | transloco }}
                          </div>
                        </mat-option>
                        <mat-option value="group">
                          <div class="type-option">
                            <app-principal-type-icon
                              [principalType]="'group'"
                            ></app-principal-type-icon>
                            {{ 'common.subjectTypes.group' | transloco }}
                          </div>
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

              <!-- Provider Column -->
              <ng-container matColumnDef="provider">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsProvider' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field appearance="outline" class="table-field provider-field">
                      <mat-select
                        [value]="auth.provider"
                        (selectionChange)="updatePermissionProvider(i, $event)"
                        [attr.tabindex]="i * 5 + 2"
                      >
                        <mat-select-trigger>
                          <app-provider-display
                            [providerInfo]="getProviderInfo(auth.provider)"
                          ></app-provider-display>
                        </mat-select-trigger>
                        @for (provider of availableProviders; track provider.id) {
                          <mat-option [value]="provider.id">
                            <app-provider-display [providerInfo]="provider"></app-provider-display>
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <app-provider-display
                      [provider]="auth.provider"
                      [class.unavailable-provider]="!isProviderAvailable(auth.provider)"
                    ></app-provider-display>
                  }
                </td>
              </ng-container>

              <!-- Subject Column (replaces Provider ID and Email) -->
              <ng-container matColumnDef="subject">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>
                  {{ 'threatModels.permissionsSubject' | transloco }}
                </th>
                <td mat-cell *matCellDef="let auth; let i = index">
                  @if (!data.isReadOnly) {
                    <mat-form-field appearance="outline" class="table-field">
                      <input
                        matInput
                        [value]="getSubjectValue(auth)"
                        (blur)="updatePermissionSubject(i, $event)"
                        [placeholder]="getSubjectPlaceholder(auth)"
                        [attr.tabindex]="i * 5 + 3"
                      />
                    </mat-form-field>
                  }
                  @if (data.isReadOnly) {
                    <span>{{ getSubjectValue(auth) }}</span>
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
                    <mat-form-field appearance="outline" class="table-field">
                      <mat-select
                        [value]="auth.role"
                        (selectionChange)="updatePermissionRole(i, $event)"
                        [attr.tabindex]="i * 5 + 5"
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
                        [attr.tabindex]="i * 5 + 6"
                        [attr.aria-label]="'threatModels.setAsOwner' | transloco"
                      >
                        <mat-icon fontSet="material-symbols-outlined">lock_person</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        color="warn"
                        (click)="deletePermission(i)"
                        [matTooltip]="'common.delete' | transloco"
                        [attr.tabindex]="i * 5 + 7"
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
      }

      .permissions-content {
        min-height: 200px;
        max-height: 60vh;
        overflow-y: auto;
        overflow-x: auto;
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
        min-width: 1000px;
      }

      .table-field {
        width: 100%;
        min-width: 100px;
      }

      .type-field {
        min-width: 110px;
      }

      .provider-field {
        min-width: 160px;
      }

      /* Simple form field styling - match quotas table approach */
      .table-field {
        font-size: var(--font-size-base);
      }

      .table-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
      }

      .table-field input {
        font-size: var(--font-size-base);
      }

      .table-field mat-select {
        font-size: var(--font-size-base);
      }

      /* Ensure provider display is properly aligned */
      .table-field app-provider-display {
        display: inline-flex;
        align-items: center;
      }

      .type-display,
      .type-option {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .type-option mat-icon,
      .type-option app-principal-type-icon {
        display: inline-flex;
        align-items: center;
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 1;
      }

      .type-option app-principal-type-icon ::ng-deep mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
      }

      /* Column widths */
      .mat-column-principal_type {
        width: 110px;
        max-width: 110px;
      }

      .mat-column-provider {
        width: 160px;
        max-width: 160px;
      }

      .mat-column-subject {
        width: 240px;
        min-width: 240px;
      }

      .mat-column-role {
        width: 100px;
        max-width: 100px;
      }

      .mat-column-actions {
        width: 140px;
        max-width: 140px;
        text-align: center;
      }

      .mat-mdc-cell,
      .mat-mdc-header-cell {
        padding: 12px 16px;
        vertical-align: middle;
      }

      /* Center actions buttons in the row */
      .mat-column-actions {
        vertical-align: middle;
      }

      .actions-container {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 32px;
      }

      .table-field .mat-mdc-form-field-wrapper {
        padding-bottom: 0;
        margin-bottom: 0;
      }

      .table-field .mat-mdc-form-field-flex {
        align-items: center;
      }

      .unavailable-provider {
        opacity: 0.5;
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
          min-width: 800px;
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
  availableProviders: OAuthProviderInfo[] = [];
  providersLoading = true;

  @ViewChild('permissionsTable') permissionsTable!: MatTable<Authorization>;
  @ViewChild('permissionsSort') permissionsSort!: MatSort;

  private _subscriptions: Subscription = new Subscription();
  private _originalPermissions: Authorization[] = [];

  // Expose utility functions to template
  getPrincipalDisplayName = getPrincipalDisplayName;
  getCompositeKey = getCompositeKey;
  principalsEqual = principalsEqual;

  constructor(
    public dialogRef: MatDialogRef<PermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PermissionsDialogData,
    private authService: AuthService,
    private providerAdapter: ProviderAdapterService,
  ) {}

  ngOnInit(): void {
    this.permissionsDataSource.data = [...this.data.permissions];
    this._originalPermissions = [...this.data.permissions];

    // Updated column order: type, provider, subject, role, actions
    this.displayedColumns = this.data.isReadOnly
      ? ['principal_type', 'provider', 'subject', 'role']
      : ['principal_type', 'provider', 'subject', 'role', 'actions'];

    // Load available providers
    this.loadProviders();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Load OAuth providers from the authentication service
   */
  private loadProviders(): void {
    this.providersLoading = true;
    this._subscriptions.add(
      this.authService.getAvailableProviders().subscribe({
        next: providers => {
          this.availableProviders = providers;
          this.providersLoading = false;
        },
        error: () => {
          this.availableProviders = [];
          this.providersLoading = false;
        },
      }),
    );
  }

  /**
   * Check if a provider is in the available providers list
   * @param provider The provider identifier
   * @returns True if the provider is available
   */
  isProviderAvailable(provider: string): boolean {
    return this.availableProviders.some(p => p.id === provider);
  }

  /**
   * Get the provider info object for a provider ID
   * @param providerId The provider identifier
   * @returns The provider info object or null if not found
   */
  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }

  /**
   * Get tooltip text for a permission row
   * Shows display name for existing permissions
   * @param auth The authorization object
   * @returns Tooltip text or empty string
   */
  getRowTooltip(auth: Authorization): string {
    if (this.isNewPermission(auth)) {
      return '';
    }
    return auth.display_name || '';
  }

  /**
   * Check if a permission is newly added (not in original list)
   * @param auth The authorization object
   * @returns True if this is a new permission
   */
  isNewPermission(auth: Authorization): boolean {
    return !this._originalPermissions.some(orig => this.principalsEqual(orig, auth));
  }

  /**
   * Get the subject value for display (email or provider_id)
   * @param auth The authorization object
   * @returns The subject value to display
   */
  getSubjectValue(auth: Authorization): string {
    // Check if there's a cached _subject value first
    const cachedSubject = (auth as AuthorizationWithSubject)._subject;
    if (cachedSubject !== undefined) {
      return cachedSubject;
    }
    // Otherwise return email or provider_id
    return auth.email || auth.provider_id;
  }

  /**
   * Get placeholder text for the subject field based on principal type
   * @param auth The authorization object
   * @returns Placeholder text
   */
  getSubjectPlaceholder(auth: Authorization): string {
    return auth.principal_type === 'group' ? 'Group name (e.g., everyone)' : 'Email or user ID';
  }

  /**
   * Updates the subject of a permission
   * @param index The index of the permission to update
   * @param event The blur event containing the new subject value
   */
  updatePermissionSubject(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const subject = input.value.trim();

    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      const auth = this.permissionsDataSource.data[index] as AuthorizationWithSubject;

      // Store in temporary field for later parsing by AuthorizationPrepareService
      auth._subject = subject;

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
      const auth = this.permissionsDataSource.data[index];
      auth.provider = event.value;

      // Auto-populate subject with default if available
      const defaultSubject = this.providerAdapter.getDefaultSubject(
        event.value,
        auth.principal_type,
      );
      if (defaultSubject) {
        const authWithSubject = auth as AuthorizationWithSubject;
        authWithSubject._subject = defaultSubject;
        auth.provider_id = defaultSubject;
        auth.email = undefined;
      }

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
    const defaultProvider = this.availableProviders[0]?.id || 'google';
    this.permissionsDataSource.data.push({
      principal_type: 'user',
      provider: defaultProvider,
      provider_id: '',
      email: '',
      role: 'reader',
      // Note: display_name is intentionally omitted as it's a server-managed field
    } as Authorization);
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
   * Ensures _subject field is set for all permissions
   */
  save(): void {
    const permissions = this.permissionsDataSource.data.map(auth => {
      const authWithSubject = auth as AuthorizationWithSubject;
      return {
        ...auth,
        _subject: authWithSubject._subject || auth.email || auth.provider_id,
      };
    });

    this.dialogRef.close({
      permissions,
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
}
