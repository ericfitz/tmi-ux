import { ThreatTypeModel } from '../../../../shared/models/framework.model';

/** Data passed into the framework mapping picker dialog */
export interface FrameworkMappingPickerDialogData {
  /** All threat types from the current framework */
  availableTypes: ThreatTypeModel[];
  /** Currently selected threat type names */
  selectedTypes: string[];
  /** Current cell shape/type for appliesTo filtering (null if no cell associated) */
  cellType: string | null;
}

/** Result returned from the framework mapping picker dialog */
export interface FrameworkMappingPickerDialogResult {
  /** Updated full list of selected threat type names */
  selectedTypes: string[];
}
