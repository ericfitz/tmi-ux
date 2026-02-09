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

import { adminGuard } from './auth/guards/admin.guard';
import { authGuard } from './auth/guards/auth.guard';
import { homeGuard } from './auth/guards/home.guard';
import { reviewerGuard } from './auth/guards/reviewer.guard';

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
      import(
        /* webpackChunkName: "auth-callback" */ './auth/components/auth-callback/auth-callback.component'
      ).then(c => c.AuthCallbackComponent),
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
    path: 'dashboard',
    loadComponent: () =>
      import(/* webpackChunkName: "dashboard" */ './pages/dashboard/dashboard.component').then(
        c => c.DashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import(/* webpackChunkName: "admin" */ './pages/admin/admin.component').then(
            c => c.AdminComponent,
          ),
        canActivate: [adminGuard],
      },
      {
        path: 'users',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-users" */ './pages/admin/users/admin-users.component'
          ).then(c => c.AdminUsersComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'groups',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-groups" */ './pages/admin/groups/admin-groups.component'
          ).then(c => c.AdminGroupsComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'quotas',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-quotas" */ './pages/admin/quotas/admin-quotas.component'
          ).then(c => c.AdminQuotasComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'webhooks',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-webhooks" */ './pages/admin/webhooks/admin-webhooks.component'
          ).then(c => c.AdminWebhooksComponent),
      },
      {
        path: 'addons',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-addons" */ './pages/admin/addons/admin-addons.component'
          ).then(c => c.AdminAddonsComponent),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-settings" */ './pages/admin/settings/admin-settings.component'
          ).then(c => c.AdminSettingsComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'surveys',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-surveys" */ './pages/admin/surveys/admin-surveys.component'
          ).then(c => c.AdminSurveysComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'surveys/new',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-survey-builder" */ './pages/admin/surveys/components/template-builder/template-builder.component'
          ).then(c => c.TemplateBuilderComponent),
        canActivate: [adminGuard],
      },
      {
        path: 'surveys/:surveyId',
        loadComponent: () =>
          import(
            /* webpackChunkName: "admin-survey-builder" */ './pages/admin/surveys/components/template-builder/template-builder.component'
          ).then(c => c.TemplateBuilderComponent),
        canActivate: [adminGuard],
      },
    ],
  },
  {
    path: 'tm',
    loadChildren: () => import('./pages/tm/tm.routes').then(m => m.TM_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'intake',
    loadChildren: () =>
      import(/* webpackChunkName: "intake" */ './pages/surveys/surveys.routes').then(
        m => m.SURVEY_ROUTES,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'triage',
    loadChildren: () =>
      import(/* webpackChunkName: "triage" */ './pages/triage/triage.routes').then(
        m => m.TRIAGE_ROUTES,
      ),
    canActivate: [authGuard, reviewerGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
