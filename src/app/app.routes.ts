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
    path: 'diagram-management',
    loadComponent: () =>
      import(
        /* webpackChunkName: "diagram-management" */ './pages/diagram-management/diagram-management.component'
      ).then(c => c.DiagramManagementComponent),
    canActivate: [authGuard],
  },
  {
    path: 'diagram-editor/:id',
    loadChildren: () =>
      import(
        /* webpackChunkName: "diagram-editor" */ './pages/diagram-editor/diagram-editor.module'
      ).then(m => m.DiagramEditorModule),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
