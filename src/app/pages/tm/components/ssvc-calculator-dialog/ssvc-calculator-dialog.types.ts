import { SSVCScore } from '../../models/threat-model.model';

/** Data passed into the SSVC calculator dialog */
export interface SsvcCalculatorDialogData {
  /** Existing SSVC entry to edit, or undefined for new */
  existingEntry?: SSVCScore;
}

/** Result returned from the SSVC calculator dialog */
export interface SsvcCalculatorDialogResult {
  /** The computed SSVC entry */
  entry: SSVCScore;
}
