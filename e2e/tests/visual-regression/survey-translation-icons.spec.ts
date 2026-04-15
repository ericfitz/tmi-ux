import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';
import { SurveyListPage } from '../../pages/survey-list.page';
import { SurveyFillFlow } from '../../flows/survey-fill.flow';

userTest.describe('Survey Translation & Icon Integrity (User)', () => {
  userTest.setTimeout(30000);

  userTest('survey list', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('survey fill', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    const fillFlow = new SurveyFillFlow(userPage);
    await fillFlow.startSurvey('Kitchen Sink Survey');

    // Note: SurveyJS-rendered content uses its own i18n and may produce
    // false positives in translation scanning. The assertNoMissingTranslations
    // helper should exclude .sd-question containers.
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('my responses', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await new SurveyListPage(userPage).myResponsesButton().click();
    await userPage.waitForURL(/\/intake\/my-responses/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });
});

adminTest.describe('Survey Translation & Icon Integrity (Admin)', () => {
  adminTest.setTimeout(30000);

  adminTest('admin survey list', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(adminPage);
    await assertIconsRendered(adminPage);
  });

  adminTest('template builder', async ({ adminPage }) => {
    await adminPage.goto('/admin/surveys');
    await adminPage.waitForLoadState('networkidle');
    const editButton = adminPage.getByTestId('admin-surveys-edit-button').first();
    await editButton.click();
    await adminPage.waitForURL(/\/admin\/surveys\/[a-f0-9-]+/, { timeout: 10000 });
    await adminPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(adminPage);
    await assertIconsRendered(adminPage);
  });
});

reviewerTest.describe('Survey Translation & Icon Integrity (Reviewer)', () => {
  reviewerTest.setTimeout(30000);

  reviewerTest('triage list', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(reviewerPage);
    await assertIconsRendered(reviewerPage);
  });

  reviewerTest('triage detail', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    const viewButton = reviewerPage.getByTestId('triage-view-button').first();
    await viewButton.click();
    await reviewerPage.waitForURL(/\/triage\/[a-f0-9-]+/, { timeout: 10000 });
    await reviewerPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(reviewerPage);
    await assertIconsRendered(reviewerPage);
  });
});
