import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TosComponent } from './tos.component';

const routes: Routes = [
  {
    path: '',
    component: TosComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TosRoutingModule {}
