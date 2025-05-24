import { Routes } from '@angular/router';

import { authGuard } from './auth/guards/auth.guard';
import { homeGuard } from './auth/guards/home.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(/* webpackChunkName: "home" */ './pages/home/home.component').then(
        c => c.HomeComponent,
      ),
    canActivate: [homeGuard],
  },
  {
    path: 'login',
    loadComponent: () =>
      import(/* webpackChunkName: "login" */ './auth/components/login/login.component').then(
        c => c.LoginComponent,
      ),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import(/* webpackChunkName: "login" */ './auth/components/login/login.component').then(
        c => c.LoginComponent,
      ),
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import(
        /* webpackChunkName: "unauthorized" */ './auth/components/unauthorized/unauthorized.component'
      ).then(c => c.UnauthorizedComponent),
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
    path: 'tm',
    loadChildren: () => import('./pages/tm/tm-routing.module').then(m => m.TmRoutingModule),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
