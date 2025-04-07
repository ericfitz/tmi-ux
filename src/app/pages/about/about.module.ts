import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { AboutRoutingModule } from './about-routing.module';
import { AboutComponent } from './about.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, SharedModule, AboutRoutingModule, AboutComponent],
})
export class AboutModule {}
