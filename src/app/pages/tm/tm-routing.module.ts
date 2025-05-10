import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TmComponent } from './tm.component';
import { TmEditComponent } from './tm-edit/tm-edit.component';

const routes: Routes = [
  {
    path: '',
    component: TmComponent,
  },
  {
    path: ':id',
    component: TmEditComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TmRoutingModule {}
