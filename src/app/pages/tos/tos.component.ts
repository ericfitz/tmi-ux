import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Location } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './tos.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './tos.component.scss',
})
// SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: render the terms-of-service page with a back-navigation action (pure)
export class TosComponent {
  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: inject Location service for browser history navigation (pure)
  constructor(private location: Location) {}

  // SEM@79de3a4af9d9b9c63efe276cb3ddce7b2c1dc038: navigate to the previous browser history entry (mutates shared state)
  goBack(): void {
    this.location.back();
  }
}
