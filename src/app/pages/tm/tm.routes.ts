import { Routes } from '@angular/router';
import { authGuard } from '../../auth/guards/auth.guard';
import { threatModelResolver } from './resolvers/threat-model.resolver';

export const TM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(/* webpackChunkName: "tm" */ './tm.component').then(c => c.TmComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import(/* webpackChunkName: "tm-edit" */ './tm-edit/tm-edit.component').then(
        c => c.TmEditComponent,
      ),
    resolve: {
      threatModel: threatModelResolver,
    },
  },
  {
    path: ':id/dfd/:dfdId',
    loadComponent: () =>
      import(/* webpackChunkName: "dfd" */ '../dfd/dfd.component').then(c => c.DfdComponent),
    canActivate: [authGuard],
    resolve: {
      threatModel: threatModelResolver,
    },
  },
];
