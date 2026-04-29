import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { LoggerService } from '@app/core/services/logger.service';
import type { AccessRemediation } from '@app/core/models/content-provider.types';
import {
  buildCurlSnippet,
  buildPowerShellSnippet,
  buildRawSnippet,
  extractShareWithApplicationParams,
  type ShareWithApplicationParams,
} from './share-with-application-remediation.util';

@Component({
  selector: 'app-share-with-application-remediation',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (params) {
      <div class="share-card" data-testid="share-with-application-card">
        <h4 class="share-title">
          {{ 'documentAccess.remediation.shareWithApplication.title' | transloco }}
        </h4>
        <p class="share-explanation">
          {{ 'documentAccess.remediation.shareWithApplication.explanation' | transloco }}
        </p>

        <div class="snippet-block">
          <div class="snippet-header">
            <span class="snippet-label">
              {{ 'documentAccess.remediation.shareWithApplication.rawLabel' | transloco }}
            </span>
            <button
              mat-icon-button
              data-testid="share-copy-raw"
              [matTooltip]="
                'documentAccess.remediation.shareWithApplication.copyButton' | transloco
              "
              (click)="copy(rawSnippet)"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <pre class="snippet">{{ rawSnippet }}</pre>
        </div>

        <div class="snippet-block">
          <div class="snippet-header">
            <span class="snippet-label">
              {{ 'documentAccess.remediation.shareWithApplication.powershellLabel' | transloco }}
            </span>
            <button
              mat-icon-button
              data-testid="share-copy-powershell"
              [matTooltip]="
                'documentAccess.remediation.shareWithApplication.copyButton' | transloco
              "
              (click)="copy(powershellSnippet)"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <pre class="snippet">{{ powershellSnippet }}</pre>
        </div>

        <div class="snippet-block">
          <div class="snippet-header">
            <span class="snippet-label">
              {{ 'documentAccess.remediation.shareWithApplication.curlLabel' | transloco }}
            </span>
            <button
              mat-icon-button
              data-testid="share-copy-curl"
              [matTooltip]="
                'documentAccess.remediation.shareWithApplication.copyButton' | transloco
              "
              (click)="copy(curlSnippet)"
            >
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <pre class="snippet">{{ curlSnippet }}</pre>
        </div>
      </div>
    } @else {
      <p class="share-unavailable" data-testid="share-with-application-unavailable">
        {{ 'documentAccess.remediation.shareWithApplication.unavailable' | transloco }}
      </p>
    }
  `,
  styles: [
    `
      .share-card {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
      }

      .share-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .share-explanation {
        margin: 0;
        font-size: 13px;
      }

      .snippet-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .snippet-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .snippet-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--theme-on-surface-variant, rgba(0, 0, 0, 0.6));
      }

      .snippet {
        margin: 0;
        padding: 8px 12px;
        font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
        font-size: 12px;
        background: rgba(0, 0, 0, 0.04);
        border-radius: 4px;
        overflow-x: auto;
        white-space: pre;
      }

      .share-unavailable {
        margin: 0;
        font-size: 13px;
        font-style: italic;
      }
    `,
  ],
})
export class ShareWithApplicationRemediationComponent implements OnChanges {
  @Input({ required: true }) remediation!: AccessRemediation;

  params: ShareWithApplicationParams | null = null;
  rawSnippet = '';
  powershellSnippet = '';
  curlSnippet = '';

  constructor(
    private clipboard: Clipboard,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}

  ngOnChanges(): void {
    this.params = extractShareWithApplicationParams(this.remediation?.params);
    if (!this.params) {
      this.rawSnippet = '';
      this.powershellSnippet = '';
      this.curlSnippet = '';
      this.logger.warn(
        'share_with_application remediation missing required params; rendering fallback',
      );
      return;
    }
    this.rawSnippet = buildRawSnippet(this.params);
    this.powershellSnippet = buildPowerShellSnippet(this.params);
    this.curlSnippet = buildCurlSnippet(this.params);
  }

  copy(snippet: string): void {
    const ok = this.clipboard.copy(snippet);
    const key = ok
      ? 'documentAccess.remediation.shareWithApplication.copied'
      : 'documentAccess.remediation.shareWithApplication.copyFailed';
    this.snackBar.open(this.transloco.translate(key), undefined, { duration: 2000 });
  }
}
