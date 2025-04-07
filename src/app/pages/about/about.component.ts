import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent {
  // Simple component without additional logic
}
