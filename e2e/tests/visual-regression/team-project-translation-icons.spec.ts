import { userTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';

userTest.describe('Team/Project Translation & Icon Integrity', () => {
  userTest.setTimeout(30000);

  userTest('teams list', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('projects list', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });
});
