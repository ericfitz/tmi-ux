import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.scss',
})
export class TosComponent {
  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }
}
