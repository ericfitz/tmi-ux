import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';

userTest.describe('Survey Visual Regression (User)', () => {
  userTest.setTimeout(60000);

  userTest('survey list', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(userPage, 'survey-list');
  });

  userTest('survey fill - basic inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Fill some data so the page has content
    await fillFlow.fillTextField('project_name', 'Visual Test Project');
    await fillFlow.fillCommentField('project_description', 'A test project for visual regression');

    await takeThemeScreenshots(userPage, 'survey-fill-basic-inputs', {
      fullPage: true,
    });
  });

  userTest('survey fill - selection inputs page', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');

    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Fill required field and navigate to page 2
    await fillFlow.fillTextField('project_name', 'Visual Test');
    await fillFlow.nextPage();

    await takeThemeScreenshots(userPage, 'survey-fill-selection-inputs', {
      fullPage: true,
    });
  });

  userTest('my responses', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-created, .mat-column-modified');

    await takeThemeScreenshots(userPage, 'survey-my-responses', {
      mask: [timestamps],
    });
  });

  userTest('response detail', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Click on the first response row
    const firstRow = userPage.getByTestId('my-responses-row').first();
    await firstRow.click();
    await userPage.waitForURL(/\/intake\/response\//, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'survey-response-detail', {
      mask: [timestamps],
    });
  });
});

adminTest.describe('Survey Visual Regression (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('admin survey list', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    const timestamps = adminPage.locator('.mat-column-modified');

    await takeThemeScreenshots(adminPage, 'survey-admin-list', {
      mask: [timestamps],
    });
  });

  adminTest('template builder', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');

    // Open the Kitchen Sink Survey in the builder
    const editButton = adminPage.getByTestId('admin-surveys-edit-button').first();
    await editButton.click();
    await adminPage.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');

    await takeThemeScreenshots(adminPage, 'survey-template-builder', {
      fullPage: true,
    });
  });
});

reviewerTest.describe('Survey Visual Regression (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('triage list', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage.locator('.mat-column-submitted_at');

    await takeThemeScreenshots(reviewerPage, 'survey-triage-list', {
      mask: [timestamps],
    });
  });

  reviewerTest('triage detail', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');

    // Open the first response
    const viewButton = reviewerPage.getByTestId('triage-view-button').first();
    await viewButton.click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');

    const timestamps = reviewerPage.locator('.info-value, .timeline-timestamp, .reviewed-date').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(reviewerPage, 'survey-triage-detail', {
      mask: [timestamps],
      fullPage: true,
    });
  });
});
