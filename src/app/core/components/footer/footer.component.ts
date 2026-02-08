import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
  standalone: true,
  imports: [...COMMON_IMPORTS, TranslocoModule],
})
export class FooterComponent {
  readonly showAboutLink = !environment.suppressAboutLink;
  readonly showPrivacyTosLinks = !environment.suppressPrivacyTosLinks;
}
