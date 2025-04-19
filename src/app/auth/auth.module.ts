import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, SharedModule],
  providers: [
    // AuthService is automatically provided as it has @Injectable({ providedIn: 'root' })
  ],
})
export class AuthModule {}
