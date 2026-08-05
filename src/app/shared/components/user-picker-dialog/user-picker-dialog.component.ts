import {
  Component,
  DestroyRef,
  inject,
  Inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { forkJoin, Observable, of } from 'rxjs';
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  startWith,
  map,
  catchError,
} from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AuthService } from '@app/auth/services/auth.service';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { SamlUserService } from '@app/core/services/saml-user.service';

/**
 * A user selected in the picker.
 *
 * Narrower than AdminUser so results can come from either the admin user
 * list or the same-provider SAML directory lookup (which does not expose
 * provider_user_id).
 */
export interface PickedUser {
  /** TMI-internal identifier for the user */
  internal_uuid: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Identity provider the user belongs to */
  provider: string;
  /** Provider-assigned user ID; absent for SAML directory results */
  provider_user_id?: string;
}

export interface UserPickerDialogData {
  title: string;
  excludeUserId?: string;
  showRoleSelector?: boolean;
  roles?: string[];
  roleTranslocoPrefix?: string;
}

export interface UserPickerDialogResult {
  user: PickedUser;
  role?: string;
  customRole?: string;
}

@Component({
  selector: 'app-user-picker-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatAutocompleteModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>

    <mat-dialog-content>
      @if (!selectedUser) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'transfer.userPicker.searchLabel'">Search by email</mat-label>
          <input
            matInput
            data-testid="user-picker-search"
            [formControl]="userSearchControl"
            [matAutocomplete]="auto"
            [placeholder]="'transfer.userPicker.searchPlaceholder' | transloco"
            cdkFocusInitial
          />
          <mat-icon matPrefix>search</mat-icon>
          <mat-autocomplete
            #auto="matAutocomplete"
            [displayWith]="displayUser"
            (optionSelected)="onUserSelected($event)"
          >
            @for (user of filteredUsers$ | async; track user.internal_uuid) {
              <mat-option [value]="user" [attr.data-testid]="'user-picker-option-' + user.email">
                <div class="user-option">
                  <span class="user-name">{{ user.name }}</span>
                  <span class="user-email">{{ user.email }}</span>
                </div>
              </mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      } @else {
        <div class="selected-user" data-testid="user-picker-selected">
          <div class="user-info">
            <div class="user-name">{{ selectedUser.name }}</div>
            <div class="user-email">{{ selectedUser.email }}</div>
          </div>
          <button mat-icon-button (click)="onClearUser()" [matTooltip]="'common.clear' | transloco">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
      @if (data.showRoleSelector && selectedUser) {
        <mat-form-field appearance="outline" class="full-width role-field">
          <mat-label [transloco]="'teams.membersDialog.role'">Role</mat-label>
          <mat-select [(value)]="selectedRole" data-testid="user-picker-role-select">
            @for (role of data.roles; track role) {
              <mat-option [value]="role" [attr.data-testid]="'user-picker-role-' + role">
                {{ data.roleTranslocoPrefix + role | transloco }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (selectedRole === 'other') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label [transloco]="'teams.membersDialog.customRole'">Custom Role</mat-label>
            <input matInput data-testid="user-picker-custom-role" [(ngModel)]="customRole" />
          </mat-form-field>
        }
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button data-testid="user-picker-cancel" (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-flat-button
        color="primary"
        data-testid="user-picker-confirm"
        (click)="onConfirm()"
        [disabled]="!selectedUser || (data.showRoleSelector && !selectedRole)"
      >
        <span [transloco]="'common.confirm'">Confirm</span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .full-width {
        width: 100%;
      }

      mat-dialog-content {
        min-width: 400px;
      }

      .user-option {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }

      .user-name {
        font-weight: 500;
      }

      .user-email {
        font-size: 12px;
        color: var(--theme-text-secondary);
      }

      .selected-user {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--theme-surface-variant, rgba(0, 0, 0, 0.05));
        border-radius: 8px;
      }

      .user-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .role-field {
        margin-top: 16px;
      }
    `,
  ],
})
// SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: dialog for searching and selecting a user with an optional role assignment
export class UserPickerDialogComponent implements OnInit {
  private static readonly RESULT_LIMIT = 10;

  private destroyRef = inject(DestroyRef);

  userSearchControl = new FormControl('');
  filteredUsers$!: Observable<PickedUser[]>;
  selectedUser: PickedUser | null = null;
  selectedRole = '';
  customRole = '';

  /** The signed-in user's provider, when it is a SAML provider (else null) */
  private _samlIdp: string | null = null;

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: inject dialog reference, dialog data, auth, and user lookup services (pure)
  constructor(
    public dialogRef: MatDialogRef<UserPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserPickerDialogData,
    private authService: AuthService,
    private userAdminService: UserAdminService,
    private samlUserService: SamlUserService,
  ) {}

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: initialize the user autocomplete stream and SAML provider detection on component startup
  ngOnInit(): void {
    this.detectSamlProvider();
    this.setupUserAutocomplete();
  }

  /**
   * Determine whether the signed-in user's provider is a SAML provider,
   * enabling the same-provider directory lookup.
   */
  private detectSamlProvider(): void {
    const userIdp = this.authService.userIdp;
    if (!userIdp || userIdp === 'tmi') {
      return;
    }
    this.authService
      .getAvailableSAMLProviders()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of([])),
      )
      .subscribe(providers => {
        this._samlIdp = providers.some(p => p.id === userIdp) ? userIdp : null;
      });
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: build a debounced autocomplete stream merging admin and SAML user lookups
  private setupUserAutocomplete(): void {
    this.filteredUsers$ = this.userSearchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
      switchMap(value => {
        if (typeof value === 'string' && value.length >= 2) {
          return this.searchUsers(value);
        }
        return of([]);
      }),
    );
  }

  /**
   * Search available user sources for the given term and merge results.
   *
   * Admins search the full user list via the admin API; SAML users
   * additionally (or instead) search their own provider's directory.
   */
  private searchUsers(term: string): Observable<PickedUser[]> {
    const sources: Observable<PickedUser[]>[] = [];

    if (this.authService.isAdmin) {
      sources.push(
        this.userAdminService
          .list({ email: term, limit: UserPickerDialogComponent.RESULT_LIMIT })
          .pipe(
            map(response => response.users as PickedUser[]),
            catchError(() => of([] as PickedUser[])),
          ),
      );
    }

    const samlIdp = this._samlIdp;
    if (samlIdp) {
      sources.push(
        this.samlUserService
          .list(samlIdp, { email: term, limit: UserPickerDialogComponent.RESULT_LIMIT })
          .pipe(
            map(response => response.users.map(user => ({ ...user, provider: samlIdp }))),
            catchError(() => of([] as PickedUser[])),
          ),
      );
    }

    if (sources.length === 0) {
      return of([]);
    }

    return forkJoin(sources).pipe(
      map(results => {
        const seen = new Set<string>();
        const merged: PickedUser[] = [];
        for (const user of results.flat()) {
          if (user.internal_uuid === this.data.excludeUserId || seen.has(user.internal_uuid)) {
            continue;
          }
          seen.add(user.internal_uuid);
          merged.push(user);
        }
        return merged;
      }),
    );
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: format a user as a name-and-email string for autocomplete display (pure)
  displayUser(user: PickedUser | null): string {
    if (!user) {
      return '';
    }
    return `${user.name} (${user.email})`;
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: store the user chosen from the autocomplete dropdown (mutates shared state)
  onUserSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedUser = event.option.value as PickedUser;
  }

  // SEM@5cd42152ea247d32680ced31fbcc3bb083b12383: reset selected user, search input, and role fields (mutates shared state)
  onClearUser(): void {
    this.selectedUser = null;
    this.userSearchControl.setValue('');
    this.selectedRole = '';
    this.customRole = '';
  }

  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: close the dialog returning the selected user and optional role assignment
  onConfirm(): void {
    if (this.selectedUser) {
      if (this.data.showRoleSelector) {
        this.dialogRef.close({
          user: this.selectedUser,
          role: this.selectedRole || undefined,
          customRole: this.customRole || undefined,
        });
      } else {
        this.dialogRef.close(this.selectedUser);
      }
    }
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: close the dialog without returning a selection
  onCancel(): void {
    this.dialogRef.close();
  }
}
