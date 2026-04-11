import { Page } from '@playwright/test';
import { SsvcCalculatorDialog } from '../dialogs/ssvc-calculator.dialog';
import { FrameworkMappingPickerDialog } from '../dialogs/framework-mapping-picker.dialog';

export class ScoringFlow {
  private ssvcCalculatorDialog: SsvcCalculatorDialog;
  private frameworkMappingPickerDialog: FrameworkMappingPickerDialog;

  constructor(private page: Page) {
    this.ssvcCalculatorDialog = new SsvcCalculatorDialog(page);
    this.frameworkMappingPickerDialog = new FrameworkMappingPickerDialog(page);
  }

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

  async addFrameworkMapping(types: string[]) {
    for (const type of types) {
      await this.frameworkMappingPickerDialog.toggleMapping(type);
    }
    await this.frameworkMappingPickerDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
