import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './privacy.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './privacy.component.scss',
})
// SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: display the privacy policy page with back navigation
export class PrivacyComponent {
  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: inject Location service for browser history navigation (pure)
  constructor(private location: Location) {}

  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: navigate back to the previous browser history entry (pure)
  goBack(): void {
    this.location.back();
  }
}
