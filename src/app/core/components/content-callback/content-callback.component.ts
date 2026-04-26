import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { ContentTokenService } from '../../services/content-token.service';
import { LoggerService } from '../../services/logger.service';
import { CONTENT_PROVIDERS } from '../../services/content-provider-registry';
import type { ContentProviderId } from '../../models/content-provider.types';

@Component({
  selector: 'app-content-callback',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule, TranslocoModule],
  templateUrl: './content-callback.component.html',
  styleUrls: ['./content-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const status = params['status'] as string | undefined;
      const returnTo = (params['return_to'] as string | undefined) ?? '/dashboard';
      const providerId = params['provider_id'] as ContentProviderId | undefined;
      const reason = (params['reason'] as string | undefined) ?? '';

      const sourceName = providerId
        ? this.transloco.translate(CONTENT_PROVIDERS[providerId]?.displayNameKey ?? '')
        : '';

      if (status === 'success') {
        this.contentTokens.refresh();
        this.logger.info('Content token linked', { providerId });
        this.snackBar.open(
          this.transloco.translate('documentSources.callback.success', { source: sourceName }),
          undefined,
          { duration: 4000 },
        );
      } else {
        this.logger.warn('Content token link failed', { providerId, reason });
        this.snackBar.open(
          this.transloco.translate('documentSources.callback.error', {
            source: sourceName,
            reason,
          }),
          undefined,
          { duration: 6000 },
        );
      }

      this.router.navigateByUrl(returnTo);
    });
  }
}
