import { Routes } from '@angular/router';

import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(/* webpackChunkName: "home" */ './pages/home/home.component').then(
        c => c.HomeComponent,
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import(/* webpackChunkName: "about" */ './pages/about/about.component').then(
        c => c.AboutComponent,
      ),
  },
  {
    path: 'tos',
    loadComponent: () =>
      import(/* webpackChunkName: "tos" */ './pages/tos/tos.component').then(c => c.TosComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import(/* webpackChunkName: "privacy" */ './pages/privacy/privacy.component').then(
        c => c.PrivacyComponent,
      ),
  },
  {
    path: 'threat-models',
    loadComponent: () =>
      import(
        /* webpackChunkName: "threat-models" */ './pages/threat-models/threat-models.component'
      ).then(c => c.ThreatModelsComponent),
    canActivate: [authGuard],
  },
  {
    path: 'dfd/:id',
    loadComponent: () =>
      import(/* webpackChunkName: "dfd" */ './pages/dfd/dfd.component').then(c => c.DfdComponent),
    canActivate: [authGuard],
  },
  {
    path: 'dfd',
    loadComponent: () =>
      import(/* webpackChunkName: "dfd" */ './pages/dfd/dfd.component').then(c => c.DfdComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
