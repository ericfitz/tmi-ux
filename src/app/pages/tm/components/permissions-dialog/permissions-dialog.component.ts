import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSort } from '@angular/material/sort';
import { MatTable, MatTableDataSource } from '@angular/material/table';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { TranslocoModule } from '@jsverse/transloco';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

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
import { OAuthProviderInfo, SAMLProviderInfo } from '@app/auth/models/auth.models';
import {
  getPrincipalDisplayName,
  getCompositeKey,
  principalsEqual,
} from '@app/shared/utils/principal-display.utils';
import { ProviderAdapterService } from '../../services/providers/provider-adapter.service';
import {
  AuthorizationIssueCode,
  AuthorizationPrepareService,
} from '../../services/providers/authorization-prepare.service';
import {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from '../../services/permissions-autocomplete.service';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';

/**
 * Authorization with temporary _subject field for UI state management
 */
export interface AuthorizationWithSubject extends Authorization {
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
    MatAutocompleteModule,
    TranslocoModule,
    ScrollIndicatorDirective,
    PrincipalTypeIconComponent,
    ProviderDisplayComponent,
    UserDisplayComponent,
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
              <span class="info-value"><app-user-display [user]="data.owner" /></span>
            </div>
          </div>

          @if (validationIssues.size) {
            <div
              class="validation-error-message"
              data-testid="permissions-validation-error"
              role="alert"
            >
              @for (key of validationIssueKeys(); track key) {
                <div>{{ key | transloco }}</div>
              }
            </div>
          }

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
                    <mat-form-field
                      appearance="outline"
                      class="table-field type-field"
                      [class.invalid-field]="rowIssue(i) === 'unsupported_principal_type'"
                    >
                      <mat-select
                        data-testid="permissions-type-select"
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
                    <mat-form-field
                      appearance="outline"
                      class="table-field provider-field"
                      [class.invalid-field]="rowIssue(i) === 'unsupported_principal_type'"
                    >
                      <mat-select
                        data-testid="permissions-provider-select"
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
                    <mat-form-field
                      appearance="outline"
                      class="table-field"
                      [class.invalid-field]="rowIssue(i) === 'missing_subject'"
                    >
                      <input
                        matInput
                        #subjectInput
                        data-testid="permissions-subject-input"
                        [attr.aria-invalid]="rowIssue(i) === 'missing_subject'"
                        [(ngModel)]="auth._subject"
                        [placeholder]="getSubjectPlaceholderKey(auth) | transloco"
                        [attr.tabindex]="i * 5 + 3"
                        [matAutocomplete]="subjectAuto"
                        (input)="onSubjectInput(i, $event)"
                      />
                      <mat-autocomplete
                        #subjectAuto="matAutocomplete"
                        (optionSelected)="onAutocompleteSelected(i, $event)"
                      >
                        @for (suggestion of autocompleteSuggestions; track suggestion.value) {
                          <mat-option [value]="suggestion">
                            {{ suggestion.displayLabel }}
                          </mat-option>
                        }
                      </mat-autocomplete>
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
                        data-testid="permissions-role-select"
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
                        data-testid="permissions-set-owner-button"
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
                        data-testid="permissions-delete-button"
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
            data-testid="permissions-add-button"
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
          data-testid="permissions-cancel-button"
          (click)="close()"
          [attr.tabindex]="getCloseButtonTabIndex()"
          [attr.aria-label]="'common.cancel' | transloco"
        >
          <span [transloco]="'common.cancel'">Close</span>
        </button>
        @if (!data.isReadOnly) {
          <button
            mat-flat-button
            color="primary"
            cdkFocusInitial
            data-testid="permissions-save-button"
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
  changeDetection: ChangeDetectionStrategy.Eager,
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

      .validation-error-message {
        color: var(--color-error);
        padding: 8px 0 0;
        font-size: 13px;
      }

      .table-field.invalid-field {
        --mdc-outlined-text-field-outline-color: var(--color-error);
        --mdc-outlined-text-field-hover-outline-color: var(--color-error);
        --mdc-outlined-text-field-focus-outline-color: var(--color-error);
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
// SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: dialog for viewing and editing a resource's permission list and owner
export class PermissionsDialogComponent implements OnInit, OnDestroy {
  permissionsDataSource = new MatTableDataSource<Authorization>([]);
  displayedColumns: string[] = [];
  availableProviders: Array<OAuthProviderInfo | SAMLProviderInfo> = [];
  providersLoading = true;

  /** IDs of providers that came from the SAML provider list */
  private _samlProviderIds = new Set<string>();

  @ViewChild('permissionsTable') permissionsTable!: MatTable<Authorization>;
  @ViewChild('permissionsSort') permissionsSort!: MatSort;
  @ViewChildren('subjectInput') subjectInputs!: QueryList<ElementRef<HTMLInputElement>>;

  private _subscriptions: Subscription = new Subscription();
  private _originalPermissions: Authorization[] = [];

  // Expose utility functions to template
  getPrincipalDisplayName = getPrincipalDisplayName;
  getCompositeKey = getCompositeKey;
  principalsEqual = principalsEqual;

  /** Subject that emits search terms for autocomplete */
  autocompleteTrigger$ = new Subject<{
    term: string;
    principalType: 'user' | 'group';
    provider: string;
  }>();

  /** Current autocomplete suggestions */
  autocompleteSuggestions: AutocompleteSuggestion[] = [];

  /** Rows that failed validation on the last save attempt, keyed by row index */
  validationIssues = new Map<number, AuthorizationIssueCode>();

  /** Index of the row currently being edited (for autocomplete context) */
  private _activeRowIndex = -1;

  // SEM@168dbc74d5ae125f3c4201fe5d17c3334874b6bf: inject dialog, auth, provider adapter, and autocomplete dependencies
  constructor(
    public dialogRef: MatDialogRef<PermissionsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PermissionsDialogData,
    private authService: AuthService,
    private providerAdapter: ProviderAdapterService,
    private autocompleteService: PermissionsAutocompleteService,
    private authorizationPrepare: AuthorizationPrepareService,
  ) {}

  // SEM@168dbc74d5ae125f3c4201fe5d17c3334874b6bf: initialize permission table, columns, providers, and autocomplete pipeline (mutates shared state)
  ngOnInit(): void {
    this.permissionsDataSource.data = this.data.permissions.map(auth => ({
      ...auth,
      _subject: auth.email || auth.provider_id || '',
    }));
    this._originalPermissions = [...this.data.permissions];

    // Updated column order: type, provider, subject, role, actions
    this.displayedColumns = this.data.isReadOnly
      ? ['principal_type', 'provider', 'subject', 'role']
      : ['principal_type', 'provider', 'subject', 'role', 'actions'];

    // Load available providers
    this.loadProviders();

    // Set up autocomplete search pipeline
    this._subscriptions.add(
      this.autocompleteTrigger$
        .pipe(
          debounceTime(300),
          distinctUntilChanged(
            (prev, curr) =>
              prev.term === curr.term &&
              prev.principalType === curr.principalType &&
              prev.provider === curr.provider,
          ),
          switchMap(({ term, principalType, provider }) =>
            this.autocompleteService.search(term, principalType, provider),
          ),
        )
        .subscribe(suggestions => {
          this.autocompleteSuggestions = suggestions;
        }),
    );
  }

  // SEM@0b80acf835f1ad7f9fc0e5cbaf2bc4f125615152: unsubscribe all subscriptions on component destruction (mutates shared state)
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Load OAuth and SAML providers from the authentication service
   */
  // SEM@10a1c25477a868d41404f6284fb3ecb65aa29fd6: fetch available OAuth and SAML providers and merge with built-in providers (reads DB)
  private loadProviders(): void {
    this.providersLoading = true;
    const builtInProviders = this.providerAdapter.getBuiltInProviders();
    this._subscriptions.add(
      forkJoin({
        oauth: this.authService
          .getAvailableProviders()
          .pipe(catchError(() => of([] as OAuthProviderInfo[]))),
        saml: this.authService
          .getAvailableSAMLProviders()
          .pipe(catchError(() => of([] as SAMLProviderInfo[]))),
      }).subscribe(({ oauth, saml }) => {
        const builtInIds = new Set(builtInProviders.map(p => p.id));
        this._samlProviderIds = new Set(saml.map(p => p.id));
        this.availableProviders = [
          ...oauth.filter(p => !builtInIds.has(p.id)),
          ...saml.filter(p => !builtInIds.has(p.id)),
          ...builtInProviders,
        ];
        this.providersLoading = false;
      }),
    );
  }

  /**
   * Check if a provider is in the available providers list
   * @param provider The provider identifier
   * @returns True if the provider is available
   */
  // SEM@797a9fcb0f8bad241afdf69e64c72f2da0885671: check whether a provider ID exists in the loaded provider list (pure)
  isProviderAvailable(provider: string): boolean {
    return this.availableProviders.some(p => p.id === provider);
  }

  /**
   * Get the provider info object for a provider ID
   * @param providerId The provider identifier
   * @returns The provider info object or null if not found
   */
  // SEM@e6f1f6d3e3dcf79489800b4db20b247e10a3b305: look up provider metadata by provider ID, or null if absent (pure)
  getProviderInfo(providerId: string): OAuthProviderInfo | SAMLProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }

  /**
   * Get tooltip text for a permission row
   * Shows display name for existing permissions
   * @param auth The authorization object
   * @returns Tooltip text or empty string
   */
  // SEM@797a9fcb0f8bad241afdf69e64c72f2da0885671: return display name tooltip for an existing permission row (pure)
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
  // SEM@797a9fcb0f8bad241afdf69e64c72f2da0885671: check whether a permission was added after the dialog opened (pure)
  isNewPermission(auth: Authorization): boolean {
    return !this._originalPermissions.some(orig => this.principalsEqual(orig, auth));
  }

  /**
   * Get the subject value for display (email or provider_id)
   * @param auth The authorization object
   * @returns The subject value to display
   */
  // SEM@6e377df107e25a9c6de25b7d8ea17defb185ee8b: resolve the display subject string from a permission entry (pure)
  getSubjectValue(auth: Authorization): string {
    return (auth as AuthorizationWithSubject)._subject ?? auth.email ?? auth.provider_id ?? '';
  }

  /**
   * Get the translation key for the subject field placeholder based on principal type
   * @param auth The authorization object
   * @returns Translation key for the placeholder
   */
  // SEM@4898e0c966e5d38f3e8cf220acb5b62397a33fee: return the placeholder translation key appropriate for the permission's principal type (pure)
  getSubjectPlaceholderKey(auth: Authorization): string {
    return auth.principal_type === 'group'
      ? 'threatModels.permissionsSubjectPlaceholderGroup'
      : 'threatModels.permissionsSubjectPlaceholderUser';
  }

  /**
   * Updates the principal type of a permission
   * @param index The index of the permission to update
   * @param event The selection change event containing the new principal type value
   */
  // SEM@13ad524189c94573aeee64a7185463714eeb6821: update the principal type of a permission row and refresh the table (mutates shared state)
  updatePermissionPrincipalType(index: number, event: { value: 'user' | 'group' }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.clearRowIssue(index);
      this.permissionsDataSource.data[index].principal_type = event.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Updates the provider of a permission
   * @param index The index of the permission to update
   * @param event The selection change event containing the new provider value
   */
  // SEM@6c8878fb5e0ec62d91e60e0de2293417ebc05238: update provider on a permission row, auto-adjusting principal type and default subject (mutates shared state)
  updatePermissionProvider(index: number, event: { value: string }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.clearRowIssue(index);
      const auth = this.permissionsDataSource.data[index];
      auth.provider = event.value;

      // Auto-constrain principal type if current type is invalid for this provider
      if (!this.providerAdapter.isValidForPrincipalType(event.value, auth.principal_type)) {
        if (this.providerAdapter.isValidForPrincipalType(event.value, 'group')) {
          auth.principal_type = 'group';
        } else if (this.providerAdapter.isValidForPrincipalType(event.value, 'user')) {
          auth.principal_type = 'user';
        }
      }

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
  // SEM@df857842acb683048164ddc3b37030f666db756c: update the role of a permission row and refresh the table (mutates shared state)
  updatePermissionRole(index: number, event: { value: 'reader' | 'writer' | 'owner' }): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.permissionsDataSource.data[index].role = event.value;
      this.permissionsTable.renderRows();
    }
  }

  /**
   * The validation issue recorded against a permission row on the last save attempt
   * @param index The index of the permission row
   * @returns The issue code, or undefined when the row is fine
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: report the validation issue recorded against a permission row (pure)
  rowIssue(index: number): AuthorizationIssueCode | undefined {
    return this.validationIssues.get(index);
  }

  /**
   * Distinct translation keys for the validation issues currently outstanding
   * @returns Translation keys to render in the dialog's error message
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: map outstanding validation issue codes to distinct translation keys (pure)
  validationIssueKeys(): string[] {
    const keys = new Set<string>();
    for (const code of this.validationIssues.values()) {
      keys.add(this.issueTranslationKey(code));
    }
    return [...keys];
  }

  /**
   * Maps a validation issue code to its message translation key
   * @param code The issue code reported by AuthorizationPrepareService
   * @returns The translation key for the user-facing message
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: map a validation issue code to its message translation key (pure)
  private issueTranslationKey(code: AuthorizationIssueCode): string {
    switch (code) {
      case 'unsupported_principal_type':
        return 'threatModels.permissionsProviderPrincipalUnsupported';
      case 'missing_subject':
        return 'threatModels.permissionsSubjectRequired';
      default: {
        // Compile-time guard: a new issue code must be given a message here
        const unhandled: never = code;
        return unhandled;
      }
    }
  }

  /**
   * Clears the validation issue on a row the user has just edited
   * @param index The index of the permission row that changed
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: drop the validation issue recorded against an edited row (mutates shared state)
  private clearRowIssue(index: number): void {
    this.validationIssues.delete(index);
  }

  /**
   * Re-keys recorded validation issues after a row is removed from the list
   * @param removedIndex The index of the row that was removed
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: shift recorded validation issues down past a removed row (mutates shared state)
  private reindexIssuesAfterDelete(removedIndex: number): void {
    const shifted = new Map<number, AuthorizationIssueCode>();
    for (const [index, code] of this.validationIssues) {
      if (index < removedIndex) {
        shifted.set(index, code);
      } else if (index > removedIndex) {
        shifted.set(index - 1, code);
      }
    }
    this.validationIssues = shifted;
  }

  /**
   * Adds a new permission to the list
   */
  // SEM@7f8cdb5e01b2b85cf804323f2143d47daf06299d: append a blank permission entry with default provider to the permissions list (mutates shared state)
  addPermission(): void {
    // The new row is appended, so no recorded issue index shifts. Keeping them
    // leaves the outstanding errors visible instead of appearing to accept them.
    const defaultProvider = this.availableProviders[0]?.id || 'google';
    this.permissionsDataSource.data.push({
      principal_type: 'user',
      provider: defaultProvider,
      provider_id: '',
      email: '',
      role: 'reader',
      _subject: '',
      // Note: display_name is intentionally omitted as it's a server-managed field
    } as Authorization);
    this.permissionsTable.renderRows();
  }

  /**
   * Deletes a permission from the list
   * @param index The index of the permission to delete
   */
  // SEM@0648dcbaf3095e0e174d61f4feb92ebd8069af56: remove a permission entry by index from the permissions list (mutates shared state)
  deletePermission(index: number): void {
    if (index >= 0 && index < this.permissionsDataSource.data.length) {
      this.reindexIssuesAfterDelete(index);
      this.permissionsDataSource.data.splice(index, 1);
      this.permissionsTable.renderRows();
    }
  }

  /**
   * Sets the selected user as owner
   * @param index The index of the permission to set as owner
   */
  // SEM@85c97d704e5197f893d6e6ce1a6b8a0763d47d21: promote a user permission entry to owner and notify the parent via callback (mutates shared state)
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
        display_name: selectedAuth.display_name || selectedAuth.provider_id,
        email: selectedAuth.email || '',
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
  // SEM@481531368b0836c949ec773e0bf21ab13052d454: close the dialog returning the updated permissions list and owner
  save(): void {
    const permissions = this.permissionsDataSource.data.map(auth => {
      const authWithSubject = auth as AuthorizationWithSubject;
      return {
        ...auth,
        _subject: authWithSubject._subject || auth.email || auth.provider_id,
      };
    });

    // Entries the API would reject (an added-but-unfilled row, most commonly) are
    // caught here rather than submitted. A rejected PATCH discards every other
    // permission edit in the dialog along with the offending one.
    const issues = this.authorizationPrepare.findIssues(permissions);
    this.validationIssues = new Map(issues.map(issue => [issue.index, issue.code]));
    if (issues.length > 0) {
      this.permissionsTable.renderRows();
      // The table scrolls, so the offending row and the message can both sit below
      // the fold — focusing the row scrolls it into view and says which one it is
      this.subjectInputs?.get(issues[0].index)?.nativeElement.focus();
      return;
    }

    this.dialogRef.close({
      permissions,
      owner: this.data.owner,
    });
  }

  /**
   * Closes the dialog without saving
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: dismiss the dialog without saving any permission changes
  close(): void {
    this.dialogRef.close();
  }

  /**
   * Gets the tabindex for the add permission button
   * @returns The tabindex value after all table rows
   */
  // SEM@13ad524189c94573aeee64a7185463714eeb6821: compute tab index for the add-permission button after all table rows (pure)
  getAddPermissionButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 1;
  }

  /**
   * Gets the tabindex for the close button
   * @returns The tabindex value after the add button
   */
  // SEM@13ad524189c94573aeee64a7185463714eeb6821: compute tab index for the close button based on row count (pure)
  getCloseButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 2;
  }

  /**
   * Gets the tabindex for the save button
   * @returns The tabindex value after the close button
   */
  // SEM@13ad524189c94573aeee64a7185463714eeb6821: compute tab index for the save button based on row count (pure)
  getSaveButtonTabIndex(): number {
    return this.permissionsDataSource.data.length * 8 + 3;
  }

  /**
   * Gets the translation key for a subject type
   * @param subjectType The subject type ('user' or 'group')
   * @returns The translation key for the subject type
   */
  // SEM@9a6eb84ed5cddcc3f90da30e13b5dc21e9bcd188: map a subject type to its i18n translation key (pure)
  getSubjectTypeTranslationKey(subjectType: string): string {
    return `common.subjectTypes.${subjectType}`;
  }

  /**
   * Gets the translation key for a role
   * @param role The role ('owner', 'writer', or 'reader')
   * @returns The translation key for the role
   */
  // SEM@9a6eb84ed5cddcc3f90da30e13b5dc21e9bcd188: map a permission role to its i18n translation key (pure)
  getRoleTranslationKey(role: string): string {
    return `common.roles.${role}`;
  }

  /**
   * Handle input events on the subject field for autocomplete
   * Only triggers search for searchable providers (TMI, or the signed-in
   * user's own SAML provider)
   */
  // SEM@168dbc74d5ae125f3c4201fe5d17c3334874b6bf: handle subject field input and dispatch autocomplete search for searchable providers (mutates shared state)
  onSubjectInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const auth = this.permissionsDataSource.data[index];

    this.clearRowIssue(index);

    if (!this.isAutocompleteActive(auth)) {
      this.autocompleteSuggestions = [];
      return;
    }

    this._activeRowIndex = index;
    this.autocompleteTrigger$.next({
      term: input.value,
      principalType: auth.principal_type,
      provider: auth.provider,
    });
  }

  /**
   * Handle autocomplete option selection
   */
  // SEM@168dbc74d5ae125f3c4201fe5d17c3334874b6bf: update authorization row subject from autocomplete selection (mutates shared state)
  onAutocompleteSelected(index: number, event: MatAutocompleteSelectedEvent): void {
    const suggestion = event.option.value as AutocompleteSuggestion;
    const auth = this.permissionsDataSource.data[index] as AuthorizationWithSubject;
    auth._subject = suggestion.value;
    this.clearRowIssue(index);
  }

  /**
   * Check if autocomplete should be active for a given row
   *
   * Active for TMI rows (admin-searchable) and for rows whose provider is
   * the signed-in user's own SAML provider (same-provider directory lookup).
   */
  // SEM@168dbc74d5ae125f3c4201fe5d17c3334874b6bf: determine if autocomplete is enabled for a given authorization row (pure)
  isAutocompleteActive(auth: Authorization): boolean {
    return (
      auth.provider === 'tmi' ||
      (this._samlProviderIds.has(auth.provider) && auth.provider === this.authService.userIdp)
    );
  }
}
