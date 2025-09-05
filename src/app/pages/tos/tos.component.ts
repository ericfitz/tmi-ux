import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { COMMON_IMPORTS } from '@app/shared/imports';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [...COMMON_IMPORTS, TranslocoModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.scss',
})
export class TosComponent {}
