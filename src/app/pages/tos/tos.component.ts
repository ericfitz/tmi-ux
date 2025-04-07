import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.scss',
})
export class TosComponent {}

