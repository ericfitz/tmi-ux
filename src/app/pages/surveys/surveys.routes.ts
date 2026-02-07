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
    path: 'my-responses',
    loadComponent: () =>
      import('./components/my-responses/my-responses.component').then(c => c.MyResponsesComponent),
  },
  {
    path: 'fill/:templateId/:responseId',
    loadComponent: () =>
      import('./components/survey-fill/survey-fill.component').then(c => c.SurveyFillComponent),
  },
  {
    path: 'response/:responseId',
    loadComponent: () =>
      import('./components/response-detail/response-detail.component').then(
        c => c.ResponseDetailComponent,
      ),
  },
];
