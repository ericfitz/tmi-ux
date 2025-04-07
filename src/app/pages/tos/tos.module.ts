import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TosRoutingModule } from './tos-routing.module';
import { TosComponent } from './tos.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [
    TosComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    TosRoutingModule
  ]
})
export class TosModule { }
