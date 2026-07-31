import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { ThreatFlow } from '../../flows/threat.flow';
import { ScoringFlow } from '../../flows/scoring.flow';
import { ThreatPage } from '../../pages/threat-page.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { SsvcCalculatorDialog } from '../../dialogs/ssvc-calculator.dialog';
import { CvssCalculatorDialog } from '../../dialogs/cvss-calculator.dialog';
import { testConfig } from '../../config/test.config';

/**
 * Minimal shape of the persisted threat as returned by
 * GET /threat_models/{id}/threats/{id}. Kept local to this spec (rather
 * than importing the app's internal Threat model) so assertions are made
 * against the wire format, independent of the client's in-memory state.
 */
interface ApiThreat {
  id: string;
  cvss?: { vector: string; score: number }[];
  ssvc?: { vector: string; decision: string; methodology: string } | null;
  cwe_id?: string[];
  threat_type?: string[];
}

test.describe.serial('Scoring Systems', () => {
  test.setTimeout(120000);

  let context: BrowserContext;
  let page: Page;
  let tmFlow: ThreatModelFlow;
  let threatFlow: ThreatFlow;
  let scoringFlow: ScoringFlow;
  let threatPage: ThreatPage;
  let dashboard: DashboardPage;

  let threatModelId = '';
  let threatId = '';

  const testTmName = `E2E Scoring TM ${Date.now()}`;
  const testThreatName = `E2E Scoring Threat ${Date.now()}`;

  /**
   * Read the threat directly from the API via the browser's authenticated
   * fetch, bypassing the Angular app's cache and rendered DOM entirely.
   * This is the "independent read" half of each persistence check.
   */
  async function fetchThreat(): Promise<ApiThreat> {
    return page.evaluate(
      async (args: { apiUrl: string; tmId: string; threatId: string }) => {
        const res = await fetch(
          `${args.apiUrl}/threat_models/${args.tmId}/threats/${args.threatId}`,
          { credentials: 'include' },
        );
        if (!res.ok) {
          throw new Error(`GET threat failed: ${res.status} ${res.statusText}`);
        }
        return (await res.json()) as ApiThreat;
      },
      { apiUrl: testConfig.apiUrl, tmId: threatModelId, threatId },
    );
  }

  /** Click the page-level Save button and wait for the PUT to succeed. */
  async function saveAndWaitForPersist(): Promise<void> {
    const putResponse = page.waitForResponse(
      resp => resp.url().includes('/threats/') && resp.request().method() === 'PUT',
    );
    await threatPage.save();
    const response = await putResponse;
    expect(response.ok()).toBe(true);
    // Save navigates back to the threat model edit page on success.
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  /**
   * Force a full reload (bypassing any in-memory Angular cache) and
   * reopen the threat detail page for DOM-level verification. Must be
   * called while on the threat model edit page (i.e. right after
   * saveAndWaitForPersist()).
   */
  async function reloadAndReopenThreat(): Promise<void> {
    await page.reload();
    await threatFlow.openFromTmEdit(testThreatName);
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000);
    context = await browser.newContext();
    page = await context.newPage();
    tmFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    scoringFlow = new ScoringFlow(page);
    threatPage = new ThreatPage(page);
    dashboard = new DashboardPage(page);

    await new AuthFlow(page).loginAs('test-user');
    await tmFlow.createFromDashboard(testTmName);
    await threatFlow.createFromTmEdit(testThreatName);
    await threatFlow.openFromTmEdit(testThreatName);

    const match = page.url().match(/\/tm\/([a-f0-9-]+)\/threat\/([a-f0-9-]+)/);
    if (!match) {
      throw new Error(`Could not parse threat model/threat IDs from URL: ${page.url()}`);
    }
    [, threatModelId, threatId] = match;
  });

  test.afterAll(async () => {
    await page.goto('/dashboard');
    await dashboard.waitForReady();
    await tmFlow.deleteFromDashboard(testTmName);
    await expect(dashboard.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    await context.close();
  });

  test('SSVC calculator: add, persist, and remove', async () => {
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
    await ssvcDialog.selectValue('Significant');
    await ssvcDialog.next();

    // Now on summary step. Capture the computed decision from the dialog
    // itself rather than asserting a hardcoded value — the A:S:T:S -> decision
    // mapping is unit-tested in ssvc-decision-tree.spec.ts; this test only
    // cares whether whatever the calculator decided survives persistence.
    await expect(ssvcDialog.decisionBadge()).toBeVisible();
    const decisionText = (await ssvcDialog.decisionBadge().textContent())?.trim();
    expect(decisionText).toBeTruthy();

    await ssvcDialog.apply();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });

    // Persist, then verify via an independent API read.
    await saveAndWaitForPersist();
    const persisted = await fetchThreat();
    expect(persisted.ssvc?.decision).toBe(decisionText);
    // Vector format is SSVCv2/E:<..>/U:<..>/T:<..>/P:<..>/<date>/ (see
    // ssvc-decision-tree.ts buildSsvcVector); the encoding itself is
    // unit-tested, so only check the selections we made round-tripped.
    expect(persisted.ssvc?.vector).toMatch(/^SSVCv2\/E:A\/U:S\/T:T\/P:S\/\d{4}-\d{2}-\d{2}\/$/);

    // Verify via a page reload (not just the DOM state the write produced).
    await reloadAndReopenThreat();
    const ssvcChip = page.locator('[data-testid="threat-page-ssvc-section"] mat-chip');
    await expect(ssvcChip).toContainText(decisionText!);

    // Remove and verify the removal itself persists.
    const ssvcRemoveButton = page.locator(
      '[data-testid="threat-page-ssvc-section"] button[aria-label="Remove SSVC entry"]',
    );
    await ssvcRemoveButton.click();
    await saveAndWaitForPersist();
    const afterRemoval = await fetchThreat();
    expect(afterRemoval.ssvc ?? null).toBeNull();

    await reloadAndReopenThreat();
    await expect(page.locator('[data-testid="threat-page-ssvc-section"]')).toHaveCount(0);
  });

  test('multiple CVSS scores (3.1 + 4.0): persist and remove', async () => {
    const cvssDialog = new CvssCalculatorDialog(page);

    await threatPage.openCvssButton().click();
    await cvssDialog.selectVersion('3.1');
    const cvss31Metrics = { AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H' };
    for (const [metric, value] of Object.entries(cvss31Metrics)) {
      await cvssDialog.setMetric(metric, value);
    }
    // Capture the computed vector/score from the dialog itself rather than
    // hardcoding expected values — that math is unit-tested in
    // cvss-calculator-dialog.component.spec.ts.
    const cvss31Vector = (await cvssDialog.vectorDisplay().textContent())?.trim();
    const cvss31Score = (await cvssDialog.scoreDisplay().textContent())?.trim();
    expect(cvss31Vector).toBeTruthy();
    await cvssDialog.apply();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });

    await threatPage.openCvssButton().click();
    await cvssDialog.selectVersion('4.0');
    const cvss40Metrics = {
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
    };
    for (const [metric, value] of Object.entries(cvss40Metrics)) {
      await cvssDialog.setMetric(metric, value);
    }
    const cvss40Vector = (await cvssDialog.vectorDisplay().textContent())?.trim();
    expect(cvss40Vector).toBeTruthy();
    await cvssDialog.apply();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });

    // Persist both entries, then verify via an independent API read.
    await saveAndWaitForPersist();
    let persisted = await fetchThreat();
    expect(persisted.cvss).toHaveLength(2);
    expect(persisted.cvss?.some(e => e.vector === cvss31Vector)).toBe(true);
    expect(persisted.cvss?.some(e => e.vector === cvss40Vector)).toBe(true);
    const persisted31 = persisted.cvss?.find(e => e.vector === cvss31Vector);
    expect(persisted31?.score).toBe(Number(cvss31Score));

    // Verify via a page reload.
    await reloadAndReopenThreat();
    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });
    const chipTexts = await threatPage.cvssChips().allTextContents();
    expect(chipTexts.some(t => t.includes(cvss31Vector!))).toBe(true);
    expect(chipTexts.some(t => t.includes(cvss40Vector!))).toBe(true);

    // Remove the 3.1 entry and verify only the 4.0 entry survives.
    const cvss31Chip = threatPage.cvssChips().filter({ hasText: cvss31Vector! });
    await cvss31Chip.locator('[matChipRemove], button[aria-label="Remove CVSS entry"]').click();
    await saveAndWaitForPersist();
    persisted = await fetchThreat();
    expect(persisted.cvss).toHaveLength(1);
    expect(persisted.cvss?.[0]?.vector).toBe(cvss40Vector);

    await reloadAndReopenThreat();
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cvssChips().first()).toContainText(cvss40Vector!);
  });

  test('multiple CWE references: persist and remove', async () => {
    await threatFlow.addCweReference('CWE-79');
    // Second CWE (search by partial number). Use a CWE ID that exists in
    // the bundled src/assets/cwe/cwe-699.json view; "352" (CSRF) isn't in
    // that view so pick "306" (Missing Authentication for Critical Function).
    await threatFlow.addCweReference('306');

    // Persist both entries, then verify via an independent API read.
    await saveAndWaitForPersist();
    let persisted = await fetchThreat();
    expect(persisted.cwe_id).toHaveLength(2);
    expect(persisted.cwe_id).toContain('CWE-79');
    expect(persisted.cwe_id).toContain('CWE-306');

    // Verify via a page reload.
    await reloadAndReopenThreat();
    await expect(threatPage.cweChips()).toHaveCount(2, { timeout: 5000 });
    const cweTexts = await threatPage.cweChips().allTextContents();
    expect(cweTexts.some(t => t.includes('CWE-79'))).toBe(true);
    expect(cweTexts.some(t => t.includes('CWE-306'))).toBe(true);

    // Remove CWE-79 and verify only CWE-306 survives.
    const cwe79Chip = threatPage.cweChips().filter({ hasText: 'CWE-79' });
    await cwe79Chip.locator('[matChipRemove], button[aria-label*="Remove"]').click();
    await saveAndWaitForPersist();
    persisted = await fetchThreat();
    expect(persisted.cwe_id).toEqual(['CWE-306']);

    await reloadAndReopenThreat();
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-306');
  });

  test('framework mappings: persist and remove', async () => {
    // The add mapping button opens the framework mapping picker dialog.
    // When no framework is set on the TM, STRIDE defaults are used:
    // Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service,
    // Elevation of Privilege
    await threatPage.addMappingButton().click();
    await scoringFlow.addFrameworkMapping(['Spoofing', 'Tampering']);

    // Persist both entries, then verify via an independent API read.
    await saveAndWaitForPersist();
    let persisted = await fetchThreat();
    expect(persisted.threat_type).toHaveLength(2);
    expect(persisted.threat_type).toContain('Spoofing');
    expect(persisted.threat_type).toContain('Tampering');

    // Verify via a page reload.
    await reloadAndReopenThreat();
    await expect(threatPage.threatTypeChips()).toHaveCount(2, { timeout: 5000 });

    // Remove Spoofing and verify only Tampering survives.
    const spoofingChip = threatPage.threatTypeChips().filter({ hasText: 'Spoofing' });
    await spoofingChip.locator('[matChipRemove], button[aria-label*="Remove"]').click();
    await saveAndWaitForPersist();
    persisted = await fetchThreat();
    expect(persisted.threat_type).toEqual(['Tampering']);

    await reloadAndReopenThreat();
    await expect(threatPage.threatTypeChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.threatTypeChips().first()).toContainText('Tampering');
  });
});
