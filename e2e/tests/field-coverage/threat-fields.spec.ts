import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { THREAT_FIELDS } from '../../schema/field-definitions';
import { FieldSkip, withoutSkipped } from '../../schema/field-skips';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';

const SKIPS: FieldSkip[] = [
  {
    apiName: 'threat_type',
    reason: 'covered-elsewhere',
    note:
      'scoring-systems.spec.ts ("framework mappings") adds/removes threat-page-threat-type-chip ' +
      'entries via threatPage.threatTypeChips() on a freshly created threat. The comment this ' +
      "skip previously carried ('chips only render when values exist') was never actually true " +
      `for the reason it was skipped here: the seed threat ('${SEEDED_THREAT}') populates ` +
      'threat_type (["spoofing","tampering"]), so the chips would render on the seeded threat too.',
  },
  {
    apiName: 'cwe_id',
    reason: 'covered-elsewhere',
    note:
      'scoring-systems.spec.ts ("multiple CWE references") adds/removes threat-page-cwe-chip ' +
      'entries via threatPage.cweChips() and asserts their text. Like threat_type, the seed ' +
      'threat also populates cwe_id, so the original "only renders when populated" rationale ' +
      'was not the real reason this passes.',
  },
  {
    apiName: 'cvss',
    reason: 'covered-elsewhere',
    note:
      'scoring-systems.spec.ts ("multiple CVSS scores (3.1 + 4.0)") adds/removes ' +
      'threat-page-cvss-chip entries via threatPage.cvssChips() and asserts their score text.',
  },
  {
    apiName: 'ssvc',
    reason: 'covered-elsewhere',
    note:
      'scoring-systems.spec.ts ("SSVC calculator full workflow") drives the SSVC calculator and ' +
      'applies a decision. Unlike threat_type/cwe_id/cvss, ssvc genuinely has no value in the ' +
      `seed threat ('${SEEDED_THREAT}'), so the threat-page-ssvc-section chip legitimately does ` +
      'not render for a field-coverage visibility check here.',
  },
  {
    apiName: 'metadata',
    reason: 'known-gap',
    note:
      'No spec exercises threat-page-metadata-button anywhere in the suite — the prior comment ' +
      "claiming this was 'covered by scoring-systems workflow tests' was inaccurate; that spec " +
      'only covers cwe_id/cvss/ssvc/threat_type. Threat-level metadata (as opposed to threat ' +
      'model-level metadata) has no coverage.',
  },
];

userTest.describe('Threat Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of withoutSkipped(THREAT_FIELDS, SKIPS).filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).openByName(SEEDED_TM);
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      const tmEdit = new TmEditPage(userPage);
      await tmEdit.threatRow(SEEDED_THREAT).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
