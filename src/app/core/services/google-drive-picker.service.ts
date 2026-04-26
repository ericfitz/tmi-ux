import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import type { IContentPickerService, PickedFile } from '../models/content-provider.types';

/** Real implementation lands in Task 2.2. */
@Injectable({ providedIn: 'root' })
export class GoogleDrivePickerService implements IContentPickerService {
  pick(): Observable<PickedFile | null> {
    return of(null);
  }
}
