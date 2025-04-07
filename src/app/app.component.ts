import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CoreModule } from './core/core.module';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from './core/components/navbar/navbar.component';
import { FooterComponent } from './core/components/footer/footer.component';
import { LoggerService } from './core/services/logger.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'TMI: Threat Modeling Improved';
  
  constructor(private logger: LoggerService) {}
  
  ngOnInit() {
    this.logger.info('Application initialized');
    this.logger.debug('Environment configuration', environment);
    
    // Log application startup with environment info
    this.logger.info(`Running in ${environment.production ? 'production' : 'development'} mode`);
    this.logger.info(`API URL: ${environment.apiUrl}`);
  }
}
