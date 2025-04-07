import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'about',
    loadComponent: () => import('./pages/about/about.component').then(c => c.AboutComponent)
  },
  {
    path: 'tos',
    loadComponent: () => import('./pages/tos/tos.component').then(c => c.TosComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.component').then(c => c.PrivacyComponent)
  },
  {
    path: 'diagram-management',
    loadComponent: () => import('./pages/diagram-management/diagram-management.component').then(c => c.DiagramManagementComponent),
    canActivate: [authGuard]
  },
  {
    path: 'diagram-editor/:id',
    loadComponent: () => import('./pages/diagram-editor/diagram-editor.component').then(c => c.DiagramEditorComponent),
    canActivate: [authGuard]
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];
