import { Routes } from '@angular/router';
import { provideMarkdownConfig } from '@app/shared/markdown-providers';

/**
 * Routes for the triage feature
 *
 * Markdown/Mermaid/Prism providers are loaded here (not at app root)
 * to keep them out of the initial bundle.
 */
export const TRIAGE_ROUTES: Routes = [
  {
    path: '',
    providers: [...provideMarkdownConfig()],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/triage-list/triage-list.component').then(c => c.TriageListComponent),
      },
      {
        path: ':responseId',
        loadComponent: () =>
          import('./components/triage-detail/triage-detail.component').then(
            c => c.TriageDetailComponent,
          ),
      },
    ],
  },
];
