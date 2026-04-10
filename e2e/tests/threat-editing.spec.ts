import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { ThreatFlow } from '../flows/threat.flow';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { DashboardPage } from '../pages/dashboard.page';

/**
 * Threat editing integration test.
 *
 * Tests threat CRUD operations, CVSS scoring, and CWE tagging
 * against a live backend. Creates a threat model in beforeAll
 * and cleans up in afterAll.
 */
test.describe.serial('Threat Editing', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let authFlow: AuthFlow;
  let threatModelFlow: ThreatModelFlow;
  let threatFlow: ThreatFlow;
  let tmEditPage: TmEditPage;
  let threatPage: ThreatPage;
  let dashboardPage: DashboardPage;

  const testTmName = `E2E Threat Test TM ${Date.now()}`;
  const testThreatName = `E2E Test Threat ${Date.now()}`;
  const updatedThreatName = `${testThreatName} Updated`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    authFlow = new AuthFlow(page);
    threatModelFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    tmEditPage = new TmEditPage(page);
    threatPage = new ThreatPage(page);
    dashboardPage = new DashboardPage(page);

    // Login and create a threat model for testing
    await authFlow.login();
    await threatModelFlow.createFromDashboard(testTmName);
  });

  test.afterAll(async () => {
    // Clean up: navigate to dashboard and delete the TM
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await threatModelFlow.deleteFromDashboard(testTmName);
      await expect(dashboardPage.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      // Best effort cleanup — don't fail the suite
    }
    await context.close();
  });

  test('create a threat', async () => {
    // We're on the TM edit page from beforeAll
    await threatFlow.createFromTmEdit(testThreatName);

    // Verify threat appears in the threats table
    await expect(tmEditPage.threatRow(testThreatName)).toBeVisible({ timeout: 10000 });
  });

  test('edit threat fields', async () => {
    // Click the threat row to navigate to full threat page
    await threatFlow.openFromTmEdit(testThreatName);

    // Edit fields
    await threatPage.fillName(updatedThreatName);
    await threatPage.fillDescription('A test threat for E2E testing');

    // Wait for the save API response to confirm persistence
    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('/threats/') && resp.request().method() === 'PUT',
    );
    await threatPage.save();
    await saveResponse;

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(threatPage.nameInput()).toHaveValue(updatedThreatName, { timeout: 10000 });
    await expect(threatPage.descriptionInput()).toHaveValue('A test threat for E2E testing');
  });

  test('score with CVSS 3.1', async () => {
    // We're still on the threat page from previous test
    await threatFlow.scoreThreatWithCvss('3.1', {
      AV: 'N', // Attack Vector: Network
      AC: 'L', // Attack Complexity: Low
      PR: 'N', // Privileges Required: None
      UI: 'N', // User Interaction: None
      S: 'U', // Scope: Unchanged
      C: 'H', // Confidentiality: High
      I: 'H', // Integrity: High
      A: 'H', // Availability: High
    });

    // Verify CVSS chip appears
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    // The chip text should contain the score (9.8 for this vector)
    await expect(threatPage.cvssChips().first()).toContainText('9.8');
  });

  test('score with CVSS 4.0', async () => {
    await threatFlow.scoreThreatWithCvss('4.0', {
      AV: 'N', // Attack Vector: Network
      AC: 'L', // Attack Complexity: Low
      AT: 'N', // Attack Requirements: None
      PR: 'N', // Privileges Required: None
      UI: 'N', // User Interaction: None
      VC: 'H', // Vulnerable System Confidentiality: High
      VI: 'H', // Vulnerable System Integrity: High
      VA: 'H', // Vulnerable System Availability: High
      SC: 'N', // Subsequent System Confidentiality: None
      SI: 'N', // Subsequent System Integrity: None
      SA: 'N', // Subsequent System Availability: None
    });

    // Now should have 2 CVSS chips (3.1 + 4.0)
    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });
  });

  test('add CWE reference', async () => {
    await threatFlow.addCweReference('CWE-79');

    // Verify CWE chip appears — the first result for "CWE-79" should be CWE-79
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-79');
  });

  test('delete the threat', async () => {
    await threatFlow.deleteThreatFromPage();

    // Should navigate back to TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });

    // Verify threat is gone from the table
    await expect(tmEditPage.threatRow(updatedThreatName)).toHaveCount(0, { timeout: 10000 });
  });
});
