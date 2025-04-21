import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ZzzComponent } from './zzz.component';

const routes: Routes = [
  {
    path: '',
    component: ZzzComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ZzzRoutingModule {}
