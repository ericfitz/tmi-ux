import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { ZzzRoutingModule } from './zzz-routing.module';
import { ZzzComponent } from './zzz.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, SharedModule, ZzzRoutingModule, ZzzComponent],
})
export class ZzzModule {}
