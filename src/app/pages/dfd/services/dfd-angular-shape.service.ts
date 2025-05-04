import { Injectable, Injector } from '@angular/core';
import { register } from '@antv/x6-angular-shape';
import { LoggerService } from '../../../core/services/logger.service';
import { ActorShapeComponent } from '../components/actor-shape/actor-shape.component';
import { ProcessShapeComponent } from '../components/process-shape/process-shape.component';
import { StoreShapeComponent } from '../components/store-shape/store-shape.component';
import { SecurityBoundaryShapeComponent } from '../components/security-boundary-shape/security-boundary-shape.component';

/**
 * Service for registering Angular components as X6 shapes
 */
@Injectable({
  providedIn: 'root',
})
export class DfdAngularShapeService {
  // Shape names for use in node creation
  readonly ACTOR_SHAPE = 'angular-actor-shape';
  readonly PROCESS_SHAPE = 'angular-process-shape';
  readonly STORE_SHAPE = 'angular-store-shape';
  readonly SECURITY_BOUNDARY_SHAPE = 'angular-security-boundary-shape';

  constructor(
    private logger: LoggerService,
    private injector: Injector,
  ) {}

  /**
   * Register all Angular shape components with X6
   */
  registerShapes(): void {
    this.logger.info('Registering Angular shapes for DFD');

    // Register Actor shape
    register({
      shape: this.ACTOR_SHAPE,
      width: 120,
      height: 40,
      content: ActorShapeComponent,
      injector: this.injector,
    });

    // Register Process shape
    register({
      shape: this.PROCESS_SHAPE,
      width: 80,
      height: 80,
      content: ProcessShapeComponent,
      injector: this.injector,
    });

    // Register Store shape
    register({
      shape: this.STORE_SHAPE,
      width: 120,
      height: 40,
      content: StoreShapeComponent,
      injector: this.injector,
    });

    // Register Security Boundary shape
    register({
      shape: this.SECURITY_BOUNDARY_SHAPE,
      width: 180,
      height: 40,
      content: SecurityBoundaryShapeComponent,
      injector: this.injector,
    });

    this.logger.info('Angular shapes registered successfully');
  }

  /**
   * Get the shape name for a given shape type
   * @param shapeType The type of shape
   * @returns The registered shape name
   */
  getShapeName(shapeType: 'actor' | 'process' | 'store' | 'securityBoundary'): string {
    switch (shapeType) {
      case 'actor':
        return this.ACTOR_SHAPE;
      case 'process':
        return this.PROCESS_SHAPE;
      case 'store':
        return this.STORE_SHAPE;
      case 'securityBoundary':
        return this.SECURITY_BOUNDARY_SHAPE;
      default:
        return this.ACTOR_SHAPE;
    }
  }
}
