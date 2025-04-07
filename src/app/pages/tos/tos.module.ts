import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TosRoutingModule } from './tos-routing.module';
import { TosComponent } from './tos.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    SharedModule,
    TosRoutingModule,
    TosComponent
  ]
})
export class TosModule { }
