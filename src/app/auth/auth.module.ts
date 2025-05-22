import { CommonModule } from '@angular/common';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';
import { JwtInterceptor } from './interceptors/jwt.interceptor';

/**
 * Authentication module
 * Provides authentication services, guards, and interceptors
 */
@NgModule({
  declarations: [],
  imports: [CommonModule, SharedModule],
  providers: [
    // AuthService is automatically provided as it has @Injectable({ providedIn: 'root' })

    // Provide JWT interceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
  ],
})
export class AuthModule {}
