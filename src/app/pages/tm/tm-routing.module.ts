import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TmComponent } from './tm.component';
import { TmEditComponent } from './tm-edit/tm-edit.component';
import { authGuard } from '../../auth/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: TmComponent,
  },
  {
    path: ':id',
    component: TmEditComponent,
  },
  {
    path: ':id/dfd/:dfdId',
    loadComponent: () =>
      import(/* webpackChunkName: "dfd" */ '../dfd/dfd.component').then(c => c.DfdComponent),
    canActivate: [authGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TmRoutingModule {}
