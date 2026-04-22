import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  ClientCredentialInfo,
  ClientCredentialResponse,
  CreateClientCredentialRequest,
} from '@app/types/client-credential.types';
import { CreateCredentialDialogComponent } from '@app/core/components/user-preferences-dialog/create-credential-dialog/create-credential-dialog.component';
import { CredentialSecretDialogComponent } from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

export interface ManageCredentialsDialogData {
  internalUuid: string;
  userName: string;
}

/**
 * Dialog for managing client credentials of an automation user account.
 * Lists existing credentials, supports adding new ones and deleting existing ones.
 */
@Component({
  selector: 'app-manage-credentials-dialog',
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
      [transloco]="'admin.users.manageCredentials.title'"
      [translocoParams]="{ userName: data.userName }"
    >
      Manage Credentials for {{ data.userName }}
    </h2>
    <mat-dialog-content data-testid="manage-credentials-dialog">
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (credentials.length === 0) {
        <p
          class="no-credentials"
          data-testid="manage-credentials-empty"
          [transloco]="'admin.users.manageCredentials.noCredentials'"
        >
          No credentials found
        </p>
      } @else {
        <table
          mat-table
          [dataSource]="credentials"
          class="credentials-table"
          data-testid="manage-credentials-table"
        >
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.name' | transloco }}</th>
            <td mat-cell *matCellDef="let cred">{{ cred.name }}</td>
          </ng-container>

          <ng-container matColumnDef="client_id">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'userPreferences.credentials.clientId' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">
              <span class="monospace">{{ cred.client_id }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="created_at">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.created' | transloco }}</th>
            <td mat-cell *matCellDef="let cred">
              {{ cred.created_at | date: 'short' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="expires_at">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'userPreferences.credentials.expiresAt' | transloco }}
            </th>
            <td mat-cell *matCellDef="let cred">
              @if (cred.expires_at) {
                {{ cred.expires_at | date: 'short' }}
              } @else {
                <span class="muted" [transloco]="'admin.users.never'">Never</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>{{ 'common.actions' | transloco }}</th>
            <td mat-cell *matCellDef="let cred">
              <button
                mat-icon-button
                (click)="onDeleteCredential(cred)"
                [matTooltip]="'common.delete' | transloco"
                data-testid="manage-credentials-delete-button"
              >
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr
            mat-row
            data-testid="manage-credentials-row"
            *matRowDef="let row; columns: displayedColumns"
          ></tr>
        </table>
      }

      @if (errorMessage) {
        <mat-error class="error-message">{{ errorMessage }}</mat-error>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onAddCredential()" data-testid="manage-credentials-add-button">
        <mat-icon>add</mat-icon>
        <span [transloco]="'admin.users.manageCredentials.addCredential'">Add Credential</span>
      </button>
      <button mat-button mat-dialog-close data-testid="manage-credentials-close">
        <span [transloco]="'common.close'">Close</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        justify-content: center;
        padding: 24px;
      }

      .no-credentials {
        text-align: center;
        color: var(--theme-text-secondary);
        padding: 24px;
      }

      .credentials-table {
        width: 100%;
      }

      .monospace {
        font-family: monospace;
        font-size: 13px;
      }

      .muted {
        color: var(--theme-text-secondary);
        font-style: italic;
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
export class ManageCredentialsDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  credentials: ClientCredentialInfo[] = [];
  loading = false;
  errorMessage = '';
  displayedColumns = ['name', 'client_id', 'created_at', 'expires_at', 'actions'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ManageCredentialsDialogData,
    private dialog: MatDialog,
    private userAdminService: UserAdminService,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadCredentials();
  }

  loadCredentials(): void {
    this.loading = true;
    this.errorMessage = '';

    this.userAdminService
      .listUserCredentials(this.data.internalUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.credentials = response.credentials;
          this.loading = false;
        },
        error: (error: unknown) => {
          this.logger.error('Failed to load credentials', error);
          this.errorMessage = getErrorMessage(error, 'Failed to load credentials');
          this.loading = false;
        },
      });
  }

  onAddCredential(): void {
    const createDialogRef = this.dialog.open(CreateCredentialDialogComponent, {
      data: { returnFormOnly: true },
    });

    createDialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((input: CreateClientCredentialRequest | undefined) => {
        if (!input) return;

        this.userAdminService
          .createUserCredential(this.data.internalUuid, input)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (credential: ClientCredentialResponse) => {
              this.dialog.open(CredentialSecretDialogComponent, {
                data: {
                  clientId: credential.client_id,
                  clientSecret: credential.client_secret,
                },
                disableClose: true,
              });
              this.loadCredentials();
            },
            error: (error: unknown) => {
              this.logger.error('Failed to create credential', error);
              this.errorMessage = getErrorMessage(error, 'Failed to create credential');
            },
          });
      });
  }

  onDeleteCredential(cred: ClientCredentialInfo): void {
    const message = this.transloco.translate('admin.users.manageCredentials.deleteConfirm', {
      name: cred.name,
    });

    if (!confirm(message)) return;

    this.userAdminService
      .deleteUserCredential(this.data.internalUuid, cred.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadCredentials();
        },
        error: (error: unknown) => {
          this.logger.error('Failed to delete credential', error);
          this.errorMessage = getErrorMessage(error, 'Failed to delete credential');
        },
      });
  }
}
