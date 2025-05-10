import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ThreatModelsComponent } from './threat-models.component';

const routes: Routes = [
  {
    path: '',
    component: ThreatModelsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ThreatModelsRoutingModule {}
