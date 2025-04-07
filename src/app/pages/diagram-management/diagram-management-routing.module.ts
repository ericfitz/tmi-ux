import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { DiagramManagementComponent } from './diagram-management.component';

const routes: Routes = [
  {
    path: '',
    component: DiagramManagementComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DiagramManagementRoutingModule {}
