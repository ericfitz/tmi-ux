import { Routes } from '@angular/router';

/**
 * Routes for the survey feature (respondent experience)
 */
export const SURVEY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/survey-list/survey-list.component').then(c => c.SurveyListComponent),
  },
  {
    path: 'my-submissions',
    loadComponent: () =>
      import('./components/my-submissions/my-submissions.component').then(
        c => c.MySubmissionsComponent,
      ),
  },
  {
    path: 'fill/:templateId/:submissionId',
    loadComponent: () =>
      import('./components/survey-fill/survey-fill.component').then(c => c.SurveyFillComponent),
  },
  {
    path: 'submission/:submissionId',
    loadComponent: () =>
      import('./components/submission-detail/submission-detail.component').then(
        c => c.SubmissionDetailComponent,
      ),
  },
];
