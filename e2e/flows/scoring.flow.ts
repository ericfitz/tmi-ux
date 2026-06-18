import { Page } from '@playwright/test';
import { SsvcCalculatorDialog } from '../dialogs/ssvc-calculator.dialog';
import { FrameworkMappingPickerDialog } from '../dialogs/framework-mapping-picker.dialog';

// SEM@b8199819fceead93915fadf869c3a2ed425e042b: E2E page-object flow for SSVC scoring and framework mapping actions (pure)
export class ScoringFlow {
  private ssvcCalculatorDialog: SsvcCalculatorDialog;
  private frameworkMappingPickerDialog: FrameworkMappingPickerDialog;

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: initialize SSVC calculator and framework mapping dialog objects (pure)
  constructor(private page: Page) {
    this.ssvcCalculatorDialog = new SsvcCalculatorDialog(page);
    this.frameworkMappingPickerDialog = new FrameworkMappingPickerDialog(page);
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: complete SSVC scoring wizard with given selections and apply result
  async scoreSsvc(selections: string[]) {
    for (const selection of selections) {
      await this.ssvcCalculatorDialog.selectValue(selection);
      await this.ssvcCalculatorDialog.next();
    }
    // Advance to summary then apply
    await this.ssvcCalculatorDialog.next();
    await this.ssvcCalculatorDialog.apply();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  // SEM@b8199819fceead93915fadf869c3a2ed425e042b: toggle framework mapping types and save the mapping dialog
  async addFrameworkMapping(types: string[]) {
    for (const type of types) {
      await this.frameworkMappingPickerDialog.toggleMapping(type);
    }
    await this.frameworkMappingPickerDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
