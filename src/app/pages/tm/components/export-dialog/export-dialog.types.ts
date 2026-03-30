import { Observable } from 'rxjs';
import { ThreatModel } from '../../models/threat-model.model';

/**
 * Data passed to the ExportDialogComponent when opened.
 */
export interface ExportDialogData {
  /** Display name of the threat model being exported */
  threatModelName: string;
  /** Observable that fetches the full threat model data for export */
  fetchObservable: Observable<ThreatModel | undefined>;
}

/**
 * Result returned when the export dialog closes.
 * Undefined if the user cancelled.
 */
export interface ExportDialogResult {
  /** The prepared JSON blob ready for download */
  blob: Blob;
  /** The suggested filename */
  filename: string;
}
