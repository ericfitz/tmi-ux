import { Component } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';

@Component({
  selector: 'app-tos',
  imports: [SharedModule],
  templateUrl: './tos.component.html',
  styleUrl: './tos.component.scss'
})
export class TosComponent {
  // Simple component without additional logic
}
