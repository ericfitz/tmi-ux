import {
  Component,
  DestroyRef,
  inject,
  Inject,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminUserIdentitiesResponse } from '@app/types/user.types';
import { UnlinkIdentityDialogComponent } from '@app/core/components/user-preferences-dialog/identities-tab/unlink-identity-dialog.component';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

export interface LinkedAccountsDialogData {
  internalUuid: string;
  userName: string;
}

/** One row of the linked-accounts table: the primary identity or a linked one. */
interface IdentityRow {
  /** Linked-identity id; empty for the synthesized primary row. */
  id: string;
  provider: string;
  /** Email (preferred) or display name of the account. */
  label: string;
  /** ISO timestamp for linked identities; null for the primary row. */
  linkedAt: string | null;
  isPrimary: boolean;
}

/**
 * Admin dialog listing a user's primary and linked sign-in identities with
 * an unlink action on linked rows. The primary identity lives on the user
 * record and cannot be unlinked; admins cannot link identities (linking
 * requires the target user's own OAuth consent).
 */
@Component({
  selector: 'app-linked-accounts-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2
      mat-dialog-title
      [transloco]="'admin.users.linkedAccounts.title'"
      [translocoParams]="{ userName: data.userName }"
    >
      Linked accounts for {{ data.userName }}
    </h2>
    <mat-dialog-content data-testid="linked-accounts-dialog">
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (rows().length > 0) {
        <table
          mat-table
          [dataSource]="rows()"
          class="identities-table"
          data-testid="linked-accounts-table"
        >
          <ng-container matColumnDef="provider">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'identities.columns.provider' | transloco }}
            </th>
            <td mat-cell *matCellDef="let r">{{ r.provider }}</td>
          </ng-container>

          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'identities.columns.account' | transloco }}
            </th>
            <td mat-cell *matCellDef="let r">{{ r.label }}</td>
          </ng-container>

          <ng-container matColumnDef="linkedAt">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'admin.users.linkedAccounts.linkedAt' | transloco }}
            </th>
            <td mat-cell *matCellDef="let r">
              @if (r.linkedAt) {
                {{ r.linkedAt | date: 'short' }}
              } @else {
                <span class="muted">—</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.status' | transloco }}</th>
            <td mat-cell *matCellDef="let r">
              @if (r.isPrimary) {
                <mat-chip color="primary" disabled>{{ 'identities.primary' | transloco }}</mat-chip>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let r">
              @if (!r.isPrimary) {
                <button
                  mat-icon-button
                  color="warn"
                  (click)="onUnlink(r)"
                  [matTooltip]="'identities.unlink.action' | transloco"
                  [attr.aria-label]="'identities.unlink.action' | transloco"
                  [attr.data-testid]="'linked-accounts-unlink-' + r.id"
                >
                  <mat-icon>link_off</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr
            mat-row
            data-testid="linked-accounts-row"
            *matRowDef="let row; columns: displayedColumns"
          ></tr>
        </table>
      }

      @if (errorMessage()) {
        <mat-error class="error-message">{{ errorMessage() }}</mat-error>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close data-testid="linked-accounts-close">
        <span [transloco]="'common.close'">Close</span>
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .identities-table {
        width: 100%;
      }

      .muted {
        color: var(--theme-text-secondary);
      }

      .error-message {
        display: block;
        margin-top: 16px;
      }

      mat-dialog-actions {
        padding: 16px 24px 16px 0;
        margin: 0;
      }
    `,
  ],
})
export class LinkedAccountsDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  // Signals so async updates mark this OnPush view dirty (see identities-tab)
  readonly rows = signal<IdentityRow[]>([]);
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  displayedColumns = ['provider', 'account', 'linkedAt', 'status', 'actions'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: LinkedAccountsDialogData,
    private dialog: MatDialog,
    private userAdminService: UserAdminService,
    private transloco: TranslocoService,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadIdentities();
  }

  /**
   * Fetch the user's primary and linked identities and build the table rows
   */
  loadIdentities(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.userAdminService
      .listUserIdentities(this.data.internalUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.rows.set(this.buildRows(response));
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.logger.error('Failed to load linked accounts', error);
          this.errorMessage.set(getErrorMessage(error, 'Failed to load linked accounts'));
          this.loading.set(false);
        },
      });
  }

  /**
   * Confirm and unlink a linked identity, then reload the table
   */
  onUnlink(row: IdentityRow): void {
    const confirmRef = this.dialog.open(UnlinkIdentityDialogComponent, {
      width: '420px',
      data: { identityLabel: row.label },
    });

    confirmRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed: boolean | undefined) => {
        if (!confirmed) return;

        this.userAdminService
          .unlinkUserIdentity(this.data.internalUuid, row.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open(this.transloco.translate('identities.unlink.success'), undefined, {
                duration: 3000,
              });
              this.loadIdentities();
            },
            error: (error: unknown) => {
              this.logger.error('Failed to unlink identity', error);
              this.errorMessage.set(getErrorMessage(error, 'Failed to unlink identity'));
            },
          });
      });
  }

  /**
   * Synthesize the non-removable primary row and map linked identities
   */
  private buildRows(response: AdminUserIdentitiesResponse): IdentityRow[] {
    const primary: IdentityRow = {
      id: 'primary',
      provider: response.primary.provider,
      label: response.primary.email || response.primary.name,
      linkedAt: null,
      isPrimary: true,
    };
    const linked = (response.linked ?? []).map(identity => ({
      id: identity.id,
      provider: identity.provider,
      label: identity.email || identity.name || identity.provider_user_id,
      linkedAt: identity.linked_at,
      isPrimary: false,
    }));
    return [primary, ...linked];
  }
}
