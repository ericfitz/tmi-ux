import { Routes } from '@angular/router';
import { authGuard } from '../../auth/guards/auth.guard';
import { threatModelResolver } from './resolvers/threat-model.resolver';

/**
 * Threat Model routes
 * /tm/:id - Threat model editor
 * /tm/:id/threat/:threatId - Threat detail page
 * /tm/:id/dfd/:dfdId - Data flow diagram editor
 */
export const TM_ROUTES: Routes = [
  {
    path: ':id',
    loadComponent: () =>
      import(/* webpackChunkName: "tm-edit" */ './tm-edit.component').then(c => c.TmEditComponent),
    resolve: {
      threatModel: threatModelResolver,
    },
  },
  {
    path: ':id/threat/:threatId',
    loadComponent: () =>
      import(
        /* webpackChunkName: "threat-page" */ './components/threat-page/threat-page.component'
      ).then(c => c.ThreatPageComponent),
    canActivate: [authGuard],
    resolve: {
      threatModel: threatModelResolver,
    },
  },
  {
    path: ':id/dfd/:dfdId',
    loadComponent: () =>
      import(/* webpackChunkName: "dfd" */ '../dfd/presentation/components/dfd.component').then(
        c => c.DfdComponent,
      ),
    canActivate: [authGuard],
    resolve: {
      threatModel: threatModelResolver,
    },
  },
];
