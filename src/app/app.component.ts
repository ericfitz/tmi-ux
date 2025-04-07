import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CoreModule } from './core/core.module';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CoreModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'TMI: Threat Modeling Interface';
}
