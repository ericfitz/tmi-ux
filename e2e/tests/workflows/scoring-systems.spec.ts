import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { ThreatFlow } from '../../flows/threat.flow';
import { ScoringFlow } from '../../flows/scoring.flow';
import { ThreatPage } from '../../pages/threat-page.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { SsvcCalculatorDialog } from '../../dialogs/ssvc-calculator.dialog';

test.describe.serial('Scoring Systems', () => {
  test.setTimeout(120000);

  let context: BrowserContext;
  let page: Page;
  let tmFlow: ThreatModelFlow;
  let threatFlow: ThreatFlow;
  let scoringFlow: ScoringFlow;
  let threatPage: ThreatPage;
  let tmEdit: TmEditPage;
  let dashboard: DashboardPage;

  const testTmName = `E2E Scoring TM ${Date.now()}`;
  const testThreatName = `E2E Scoring Threat ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    tmFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    scoringFlow = new ScoringFlow(page);
    threatPage = new ThreatPage(page);
    tmEdit = new TmEditPage(page);
    dashboard = new DashboardPage(page);

    await new AuthFlow(page).loginAs('test-user');
    await tmFlow.createFromDashboard(testTmName);
    await threatFlow.createFromTmEdit(testThreatName);
    await threatFlow.openFromTmEdit(testThreatName);
  });

  test.afterAll(async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testTmName);
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('SSVC calculator full workflow', async () => {
    // The SSVC button renders as a stroked button labelled "Add SSVC"
    // (i18n key: ssvcCalculator.openCalculator = "Add SSVC")
    const ssvcButton = page.locator('button').filter({ hasText: /add ssvc/i });
    await ssvcButton.click();

    const ssvcDialog = new SsvcCalculatorDialog(page);

    // Step 1 — Exploitation: Active (shortName A)
    await ssvcDialog.selectValue('Active');
    await ssvcDialog.next();

    // Step 2 — Utility: Super Effective (shortName S)
    await ssvcDialog.selectValue('Super Effective');
    await ssvcDialog.next();

    // Step 3 — Technical Impact: Total (shortName T)
    await ssvcDialog.selectValue('Total');
    await ssvcDialog.next();

    // Step 4 — Public Safety Impact: Significant (shortName S)
    // Combination A:S:T:S → decision = "Immediate"
    await ssvcDialog.selectValue('Significant');
    await ssvcDialog.next();

    // Now on summary step — verify the decision badge
    await expect(ssvcDialog.decisionBadge()).toBeVisible();
    await expect(ssvcDialog.decisionBadge()).toContainText('Immediate');

    // Apply
    await ssvcDialog.apply();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  });

  test('multiple CVSS scores (3.1 + 4.0)', async () => {
    await threatFlow.scoreThreatWithCvss('3.1', {
      AV: 'N',
      AC: 'L',
      PR: 'N',
      UI: 'N',
      S: 'U',
      C: 'H',
      I: 'H',
      A: 'H',
    });
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cvssChips().first()).toContainText('9.8');

    await threatFlow.scoreThreatWithCvss('4.0', {
      AV: 'N',
      AC: 'L',
      AT: 'N',
      PR: 'N',
      UI: 'N',
      VC: 'H',
      VI: 'H',
      VA: 'H',
      SC: 'N',
      SI: 'N',
      SA: 'N',
    });
    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });

    // Remove first CVSS chip via the matChipRemove button inside it
    const firstChipRemove = threatPage
      .cvssChips()
      .first()
      .locator('[matChipRemove], button[aria-label="Remove CVSS entry"]');
    await firstChipRemove.click();
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
  });

  test('multiple CWE references', async () => {
    await threatFlow.addCweReference('CWE-79');
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-79');

    await threatFlow.addCweReference('CWE-352');
    await expect(threatPage.cweChips()).toHaveCount(2, { timeout: 5000 });

    // Remove first CWE chip via the matChipRemove button inside it
    const firstCweRemove = threatPage
      .cweChips()
      .first()
      .locator('[matChipRemove], button[aria-label*="Remove CWE"]');
    await firstCweRemove.click();
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-352');
  });

  test('framework mappings', async () => {
    // The add mapping button opens the framework mapping picker dialog.
    // When no framework is set on the TM, STRIDE defaults are used:
    // Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service,
    // Elevation of Privilege
    await threatPage.addMappingButton().click();
    await scoringFlow.addFrameworkMapping(['Spoofing', 'Tampering']);

    await expect(threatPage.threatTypeChips()).toHaveCount(2, { timeout: 5000 });

    // Remove first threat type chip
    const firstTypeChipRemove = threatPage
      .threatTypeChips()
      .first()
      .locator('[matChipRemove], button[aria-label*="Remove"]');
    await firstTypeChipRemove.click();
    await expect(threatPage.threatTypeChips()).toHaveCount(1, { timeout: 5000 });
  });
});
