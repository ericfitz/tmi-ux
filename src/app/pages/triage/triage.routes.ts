import { Routes } from '@angular/router';

/**
 * Routes for the triage feature
 */
export const TRIAGE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/triage-list/triage-list.component').then(c => c.TriageListComponent),
  },
  {
    path: ':submissionId',
    loadComponent: () =>
      import('./components/triage-detail/triage-detail.component').then(
        c => c.TriageDetailComponent,
      ),
  },
];
