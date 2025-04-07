import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-tos',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.scss'
})
export class TosComponent {
  // Simple component without additional logic
}
