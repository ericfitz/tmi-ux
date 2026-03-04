/** Data passed into the CWE picker dialog */
export interface CwePickerDialogData {
  /** CWE IDs already present on the threat, used for informational purposes */
  existingCweIds: string[];
}

/** Result returned from the CWE picker dialog */
export interface CwePickerDialogResult {
  /** The selected CWE ID (e.g., "CWE-79") */
  cweId: string;
}
