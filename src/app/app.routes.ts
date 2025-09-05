/**
 * Application Route Configuration
 *
 * This file defines the main routing configuration for the Angular application.
 * It uses lazy loading for optimal performance and implements route guards for access control.
 *
 * Key functionality:
 * - Configures lazy-loaded routes for all main application pages
 * - Implements authentication guards to protect secured routes
 * - Uses webpack chunk names for optimized bundle splitting
 * - Provides fallback wildcard route for unmatched URLs
 * - Sets up OAuth callback and authentication flow routes
 * - Protects threat modeling (tm) routes with authentication
 * - Includes public routes for about, privacy, and terms of service pages
 */

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
    path: 'oauth2/callback',
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
    path: 'oauth2/local-select',
    loadComponent: () =>
      import(
        /* webpackChunkName: "local-auth" */ './auth/components/local-user-select/local-user-select.component'
      ).then(c => c.LocalUserSelectComponent),
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
    loadChildren: () => import('./pages/tm/tm.routes').then(m => m.TM_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
