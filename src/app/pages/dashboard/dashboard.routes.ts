import { Routes } from '@angular/router';

/**
 * Dashboard route configuration
 * Displays the threat model dashboard/list view
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import(/* webpackChunkName: "dashboard" */ './dashboard.component').then(
        c => c.DashboardComponent,
      ),
  },
];
