import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { IdentityLinkService } from '@app/auth/services/identity-link.service';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  LinkedIdentity,
  MyIdentitiesResponse,
  StepUpRequiredError,
} from '@app/auth/models/identity-link.types';
import type { OAuthProviderInfo } from '@app/auth/models/auth.models';
import {
  UnlinkIdentityDialogComponent,
  type UnlinkIdentityDialogData,
} from './unlink-identity-dialog.component';

interface IdentityRow {
  id: string;
  provider: string;
  label: string;
  isPrimary: boolean;
}

/**
 * "Linked accounts" tab of the user-preferences dialog. Lists the primary
 * identity (no unlink) plus any linked identities (with unlink), and offers
 * "Link another account" via a provider menu. Step-up errors raised by the
 * IdentityLinkService are funneled to AuthService.initiateStepUp so the user
 * re-authenticates and returns to this tab.
 */
@Component({
  selector: 'app-identities-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    TranslocoModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="identities-tab">
      <h3 class="section-header" [transloco]="'identities.tabTitle'">Linked accounts</h3>
      <p class="section-help" [transloco]="'identities.help'">
        Accounts you can use to sign in to TMI.
      </p>

      @if (identities(); as ids) {
        <table mat-table [dataSource]="rows(ids)" class="identities-table">
          <ng-container matColumnDef="provider">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'identities.columns.provider' | transloco }}
            </th>
            <td mat-cell *matCellDef="let r" data-testid="identity-row">{{ r.provider }}</td>
          </ng-container>
          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'identities.columns.account' | transloco }}
            </th>
            <td mat-cell *matCellDef="let r">{{ r.label }}</td>
          </ng-container>
          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (r.isPrimary) {
                <mat-chip [disabled]="true" color="primary">
                  {{ 'identities.primary' | transloco }}
                </mat-chip>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              @if (!r.isPrimary) {
                <button
                  mat-icon-button
                  color="warn"
                  (click)="onUnlink(r)"
                  [matTooltip]="'identities.unlink.action' | transloco"
                  [attr.aria-label]="'identities.unlink.action' | transloco"
                  [attr.data-testid]="'identity-unlink-' + r.id"
                >
                  <mat-icon>link_off</mat-icon>
                </button>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }

      <div class="identities-actions">
        <button
          mat-flat-button
          color="primary"
          [matMenuTriggerFor]="providerMenu"
          [disabled]="linkableProviders().length === 0"
          data-testid="identities-link-menu"
        >
          <mat-icon>add_link</mat-icon>
          <span [transloco]="'identities.linkNew'">Link another account</span>
        </button>
        <mat-menu #providerMenu="matMenu">
          @for (p of linkableProviders(); track p.id) {
            <button
              mat-menu-item
              (click)="onLink(p.id)"
              [attr.data-testid]="'identities-link-' + p.id"
            >
              {{ p.name }}
            </button>
          }
        </mat-menu>
      </div>
    </div>
  `,
  styles: [
    `
      .identities-tab {
        padding: 16px 0;
      }
      .section-header {
        margin: 0 0 4px 0;
        font-size: 16px;
        font-weight: 500;
      }
      .section-help {
        margin: 0 0 12px 0;
        font-size: 13px;
        color: var(--theme-text-secondary);
      }
      .identities-table {
        width: 100%;
        margin-bottom: 16px;
      }
      .identities-actions {
        margin-top: 12px;
      }
    `,
  ],
})
// SEM@f13904a7483e210c376e9ef5432cf35606829ea4: display and manage linked OAuth identities for the current user
export class IdentitiesTabComponent implements OnInit {
  private identityLink = inject(IdentityLinkService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);
  private destroyRef = inject(DestroyRef);

  readonly displayedColumns = ['provider', 'account', 'role', 'actions'];
  readonly identities = signal<MyIdentitiesResponse | null>(null);
  readonly linkableProviders = signal<OAuthProviderInfo[]>([]);

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: load linked identities and available OAuth providers on init (reads DB)
  ngOnInit(): void {
    this.refresh();
    this.auth
      .getAvailableProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: providers => this.linkableProviders.set(providers),
        error: (err: unknown) => this.logger.warn('Failed to load providers', err),
      });
  }

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: map identity response to display rows with primary first (pure)
  rows(ids: MyIdentitiesResponse): IdentityRow[] {
    const primary: IdentityRow = {
      id: 'primary',
      provider: ids.primary.provider,
      label: ids.primary.email || ids.primary.name || ids.primary.provider,
      isPrimary: true,
    };
    const linked: IdentityRow[] = (ids.linked ?? []).map((l: LinkedIdentity) => ({
      id: l.id,
      provider: l.provider,
      label: l.email || l.name || l.provider_user_id,
      isPrimary: false,
    }));
    return [primary, ...linked];
  }

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: fetch current linked identities and update display signal (reads DB)
  private refresh(): void {
    this.identityLink
      .listIdentities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ids => this.identities.set(ids),
        error: (err: unknown) => this.logger.warn('Failed to load identities', err),
      });
  }

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: initiate OAuth link flow for a given identity provider
  onLink(idp: string): void {
    this.identityLink
      .startLink(idp)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
        error: (err: unknown) => this.handleStepUpOr(err, 'identities.link.error.startFailed'),
      });
  }

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: confirm and delete a linked identity after user confirmation (reads DB)
  onUnlink(row: IdentityRow): void {
    const data: UnlinkIdentityDialogData = { identityLabel: row.label };
    this.dialog
      .open<UnlinkIdentityDialogComponent, UnlinkIdentityDialogData, boolean>(
        UnlinkIdentityDialogComponent,
        { width: '420px', data },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.identityLink
          .unlink(row.id)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackBar.open(this.transloco.translate('identities.unlink.success'), undefined, {
                duration: 3000,
              });
              this.refresh();
            },
            error: (err: unknown) => this.handleStepUpOr(err, 'identities.unlink.error'),
          });
      });
  }

  // SEM@f13904a7483e210c376e9ef5432cf35606829ea4: route step-up auth errors to re-authentication or show fallback snack
  private handleStepUpOr(err: unknown, fallbackKey: string): void {
    if (err instanceof StepUpRequiredError) {
      void this.auth.initiateStepUp('/dashboard?openPrefs=identities');
      return;
    }
    this.logger.warn('Identity-link action failed', err);
    this.snackBar.open(this.transloco.translate(fallbackKey), undefined, { duration: 5000 });
  }
}
