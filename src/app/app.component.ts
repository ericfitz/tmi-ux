import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FooterComponent } from './core/components/footer/footer.component';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { environment } from '../environments/environment';
import { LoggerService } from './core/services/logger.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'TMI: Threat Modeling Improved';

  constructor(private logger: LoggerService) {}

  ngOnInit(): void {
    this.logger.info('Application initialized');
    this.logger.debug('Environment configuration', environment);

    // Log application startup with environment info
    this.logger.info(`Running in ${environment.production ? 'production' : 'development'} mode`);
    this.logger.info(`API URL: ${environment.apiUrl}`);
  }
}
