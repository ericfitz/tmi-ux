import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

import { TmRoutingModule } from './tm-routing.module.js';
import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, TmRoutingModule, MaterialModule, SharedModule, TranslocoModule],
})
export class TmModule {}
