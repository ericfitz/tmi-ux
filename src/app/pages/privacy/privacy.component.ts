import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {}

