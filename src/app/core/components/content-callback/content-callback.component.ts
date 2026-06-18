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
// SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: handle OAuth content-provider callback, notify user, and redirect to return URL
export class ContentCallbackComponent implements OnInit {
  // SEM@a3bcde0177cf5a6d478690770e6cce73ca9cb74d: inject routing, notification, content-token, and logging dependencies (pure)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {}

  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: parse callback query params, refresh content token on success, and redirect to return URL
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

      void this.router.navigateByUrl(returnTo);
    });
  }
}
