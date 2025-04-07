import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss'
})
export class PrivacyComponent {
  // Simple component without additional logic
}
