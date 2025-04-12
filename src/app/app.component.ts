import { CommonModule } from '@angular/common';
import { Component, Injector, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FooterComponent } from './core/components/footer/footer.component';
import { setInjector } from './core/utils/dynamic-material-loader';
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

  constructor(
    private logger: LoggerService,
    private injector: Injector,
  ) {
    // Set the injector for dynamic material loading
    setInjector(injector);
  }

  ngOnInit(): void {
    this.logger.info('Application initialized');
    this.logger.debug('Environment configuration', environment);

    // Log application startup with environment info
    this.logger.info(`Running in ${environment.production ? 'production' : 'development'} mode`);
    this.logger.info(`API URL: ${environment.apiUrl}`);
  }
}
