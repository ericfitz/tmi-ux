import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [...COMMON_IMPORTS, TranslocoModule],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {}
