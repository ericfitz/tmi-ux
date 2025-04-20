import { Injectable, Injector } from '@angular/core';
import { Graph } from '@antv/x6';
import { register } from '@antv/x6-angular-shape';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThemeService } from '../theme/theme.service';

@Injectable({
  providedIn: 'root',
})
export class NodeRegistryService {
  private registered = false;

  constructor(
    private injector: Injector,
    private logger: LoggerService,
    private themeService: ThemeService,
  ) {}

  /**
   * Register all node shapes
   */
  registerNodeShapes(): void {
    if (this.registered) {
      return;
    }

    try {
      // Use the theme service to register node shapes
      this.themeService.registerNodeShapes();

      this.registered = true;
      this.logger.info('Node shapes registered successfully');
    } catch (error) {
      this.logger.error('Error registering node shapes', error);
    }
  }

  /**
   * Check if node shapes are registered
   */
  areShapesRegistered(): boolean {
    return this.registered;
  }
}
