import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  // Simple component without additional logic
}
