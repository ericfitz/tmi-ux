import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';

import { ThreatModelsRoutingModule } from './threat-models-routing.module';
import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, ThreatModelsRoutingModule, MaterialModule, SharedModule, TranslocoModule],
})
export class ThreatModelsModule {}
