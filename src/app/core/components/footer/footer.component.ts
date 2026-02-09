import { Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';
import { environment } from '../../../../environments/environment';
import { BrandingConfigService } from '../../services/branding-config.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: true,
  imports: [...COMMON_IMPORTS, TranslocoModule],
})
export class FooterComponent {
  private readonly brandingConfig = inject(BrandingConfigService);

  readonly showAboutLink = !environment.suppressAboutLink;
  readonly showPrivacyTosLinks = !environment.suppressPrivacyTosLinks;

  readonly organizationName$ = this.brandingConfig.organizationName$;
  readonly organizationUrl$ = this.brandingConfig.organizationUrl$;
  readonly supportUrl$ = this.brandingConfig.supportUrl$;
  readonly dataClassification$ = this.brandingConfig.dataClassification$;
}
