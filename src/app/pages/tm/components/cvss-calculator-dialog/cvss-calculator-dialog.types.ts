import { CVSSScore } from '../../models/threat-model.model';

export type CvssVersion = '3.1' | '4.0';

/** Data passed into the CVSS calculator dialog */
export interface CvssCalculatorDialogData {
  /** Existing CVSS entry to edit, or undefined for new */
  existingEntry?: CVSSScore;
  /** Index of existing entry in the array (for replacement) */
  existingIndex?: number;
  /** CVSS versions that already have entries (used to constrain Add mode) */
  existingVersions?: CvssVersion[];
}

/** Result returned from the CVSS calculator dialog */
export interface CvssCalculatorDialogResult {
  /** The computed CVSS entry */
  entry: CVSSScore;
  /** Index if editing (to replace at position) */
  editIndex?: number;
}

/** Template-friendly metric group built from the library */
export interface MetricGroup {
  categoryName: string;
  categoryDescription: string;
  metrics: MetricDefinition[];
  isBase: boolean;
}

/** Individual metric for template rendering */
export interface MetricDefinition {
  shortName: string;
  name: string;
  description: string;
  subCategory?: string;
  values: MetricValue[];
  selectedValue: string | null;
}

/** Individual selectable value for a metric */
export interface MetricValue {
  shortName: string;
  name: string;
  description: string;
}
