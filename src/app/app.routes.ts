import { Routes } from '@angular/router';
import { authGuard } from './auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./pages/home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'about',
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutModule)
  },
  {
    path: 'tos',
    loadChildren: () => import('./pages/tos/tos.module').then(m => m.TosModule)
  },
  {
    path: 'privacy',
    loadChildren: () => import('./pages/privacy/privacy.module').then(m => m.PrivacyModule)
  },
  {
    path: 'diagram-management',
    loadChildren: () => import('./pages/diagram-management/diagram-management.module').then(m => m.DiagramManagementModule),
    canActivate: [authGuard]
  },
  {
    path: 'diagram-editor/:id',
    loadChildren: () => import('./pages/diagram-editor/diagram-editor.module').then(m => m.DiagramEditorModule),
    canActivate: [authGuard]
  },
  { 
    path: '**', 
    redirectTo: '' 
  }
];
