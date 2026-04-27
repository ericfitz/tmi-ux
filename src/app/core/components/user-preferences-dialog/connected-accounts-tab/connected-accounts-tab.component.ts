import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
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
import { Observable, Subject, switchMap, of, takeUntil } from 'rxjs';

import { ContentTokenService } from '../../../services/content-token.service';
import { LoggerService } from '../../../services/logger.service';
import { CONTENT_PROVIDERS } from '../../../services/content-provider-registry';
import type {
  ContentProviderId,
  ContentProviderMetadata,
  ContentTokenInfo,
} from '../../../models/content-provider.types';
import {
  UnlinkConfirmDialogComponent,
  type UnlinkConfirmDialogData,
} from './unlink-confirm-dialog.component';

@Component({
  selector: 'app-connected-accounts-tab',
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
    <div class="document-sources-tab">
      <h3 class="section-header" [transloco]="'documentSources.tabTitle'">Document sources</h3>

      @if ((tokens$ | async)?.length === 0) {
        <div class="document-sources-empty" data-testid="document-sources-empty">
          <mat-icon class="empty-icon">cloud_off</mat-icon>
          <p class="empty-text" [transloco]="'documentSources.empty.title'">
            No document sources connected
          </p>
          <p class="empty-description" [transloco]="'documentSources.empty.description'">
            Link a cloud storage account...
          </p>
        </div>
      } @else {
        <table mat-table [dataSource]="(tokens$ | async) ?? []" class="document-sources-table">
          <ng-container matColumnDef="source">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'documentSources.columns.source' | transloco }}
            </th>
            <td mat-cell *matCellDef="let token" data-testid="document-sources-row">
              {{ providerName(token.provider_id) | async }}
            </td>
          </ng-container>
          <ng-container matColumnDef="account">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'documentSources.columns.account' | transloco }}
            </th>
            <td mat-cell *matCellDef="let token">
              {{ token.provider_account_label || '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>
              {{ 'documentSources.columns.status' | transloco }}
            </th>
            <td mat-cell *matCellDef="let token">
              <mat-chip [color]="token.status === 'active' ? 'primary' : 'warn'" [disabled]="true">
                {{
                  'documentSources.status.' +
                    (token.status === 'active' ? 'active' : 'refreshFailed') | transloco
                }}
              </mat-chip>
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let token">
              @if (token.status !== 'active') {
                <button mat-stroked-button color="primary" (click)="onConnect(token.provider_id)">
                  {{ 'documentSources.relink' | transloco }}
                </button>
              }
              <button
                mat-icon-button
                color="warn"
                (click)="onUnlink(token.provider_id)"
                [matTooltip]="'documentSources.unlink' | transloco"
              >
                <mat-icon>link_off</mat-icon>
              </button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        </table>
      }

      <div class="document-sources-actions">
        @if (connectableProviders.length === 1) {
          <button mat-raised-button color="primary" (click)="onConnect(connectableProviders[0].id)">
            <mat-icon>add_link</mat-icon>
            <span [transloco]="'documentSources.add'">Connect a source</span>
          </button>
        } @else {
          <button
            mat-raised-button
            color="primary"
            [matMenuTriggerFor]="availableProvidersMenu"
            [disabled]="connectableProviders.length === 0"
          >
            <mat-icon>add_link</mat-icon>
            <span [transloco]="'documentSources.add'">Connect a source</span>
          </button>
          <mat-menu #availableProvidersMenu="matMenu">
            @for (p of connectableProviders; track p.id) {
              <button mat-menu-item (click)="onConnect(p.id)">
                {{ p.displayNameKey | transloco }}
              </button>
            }
          </mat-menu>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .document-sources-tab {
        padding: 16px 0;
      }

      .section-header {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 500;
      }

      .document-sources-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 24px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.02));
        border-radius: 8px;
        border: 1px dashed var(--theme-divider);
      }

      .empty-icon {
        font-size: 36px;
        width: 36px;
        height: 36px;
        color: var(--theme-text-secondary);
        margin-bottom: 12px;
      }

      .empty-text {
        margin: 0 0 8px 0;
        font-weight: 500;
      }

      .empty-description {
        margin: 0;
        font-size: 13px;
        color: var(--theme-text-secondary);
      }

      .document-sources-table {
        width: 100%;
        margin-bottom: 16px;
      }

      .document-sources-actions {
        margin-top: 12px;
      }
    `,
  ],
})
export class ConnectedAccountsTabComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  readonly displayedColumns = ['source', 'account', 'status', 'actions'];
  readonly connectableProviders: ContentProviderMetadata[] = Object.values(CONTENT_PROVIDERS);
  readonly tokens$: Observable<ContentTokenInfo[]>;

  constructor(
    private tokenService: ContentTokenService,
    private transloco: TranslocoService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {
    this.tokens$ = this.tokenService.contentTokens$;
  }

  ngOnInit(): void {
    this.tokenService.refresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  providerName(id: ContentProviderId): Observable<string> {
    const meta = CONTENT_PROVIDERS[id];
    if (!meta) return of(id);
    return this.transloco.selectTranslate(meta.displayNameKey);
  }

  onConnect(providerId: ContentProviderId): void {
    const returnTo = `/dashboard?openPrefs=document-sources`;
    this.tokenService
      .authorize(providerId, returnTo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
        error: (err: unknown) => {
          this.logger.error('Failed to initiate content authorize', err);
          this.snackBar.open(
            this.transloco.translate('documentSources.callback.error', {
              source: '',
              reason: '',
            }),
            undefined,
            { duration: 6000 },
          );
        },
      });
  }

  onUnlink(providerId: ContentProviderId): void {
    const meta = CONTENT_PROVIDERS[providerId];
    const sourceName = meta ? this.transloco.translate(meta.displayNameKey) : providerId;
    const data: UnlinkConfirmDialogData = { sourceName };
    const ref = this.dialog.open<UnlinkConfirmDialogComponent, UnlinkConfirmDialogData, boolean>(
      UnlinkConfirmDialogComponent,
      { width: '420px', data },
    );
    ref
      .afterClosed()
      .pipe(
        takeUntil(this.destroy$),
        switchMap(confirmed => (confirmed ? this.tokenService.unlink(providerId) : of(null))),
      )
      .subscribe({
        next: () => this.tokenService.refresh(),
        error: (err: unknown) => this.logger.error('Failed to unlink', err),
      });
  }
}
