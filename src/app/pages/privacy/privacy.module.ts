import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';

import { PrivacyRoutingModule } from './privacy-routing.module';
import { PrivacyComponent } from './privacy.component';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [CommonModule, SharedModule, PrivacyRoutingModule, PrivacyComponent],
})
export class PrivacyModule {}
