import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
  Optional,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatListOption, MatSelectionListChange } from '@angular/material/list';
import { TranslocoModule } from '@jsverse/transloco';
import { debounceTime, identity, MonoTypeOperatorFunction } from 'rxjs';

import {
  DIALOG_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { CweWeakness } from '../../../../shared/models/cwe.model';
import { CweService } from '../../../../shared/services/cwe.service';
import { CwePickerDialogData, CwePickerDialogResult } from './cwe-picker-dialog.types';

@Component({
  selector: 'app-cwe-picker-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './cwe-picker-dialog.component.html',
  styleUrls: ['./cwe-picker-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@cee4a5ff46c0649755a9808fdf31ce0eea5f0a3e: dialog for searching and selecting a CWE weakness to attach to a threat
export class CwePickerDialogComponent implements OnInit {
  searchControl = new FormControl('');
  allWeaknesses: CweWeakness[] = [];
  filteredWeaknesses: CweWeakness[] = [];
  selectedCwe: CweWeakness | null = null;
  isLoading = true;
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: inject dialog, CWE service, and supporting services for the CWE picker (pure)
  constructor(
    public dialogRef: MatDialogRef<CwePickerDialogComponent, CwePickerDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: CwePickerDialogData,
    private cweService: CweService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private languageService: LanguageService,
    @Optional() private destroyRef?: DestroyRef,
  ) {}

  // SEM@cee4a5ff46c0649755a9808fdf31ce0eea5f0a3e: load all CWE weaknesses, subscribe to search input and text direction (mutates shared state)
  ngOnInit(): void {
    this.languageService.direction$.pipe(this._untilDestroyed()).subscribe(direction => {
      this.currentDirection = direction;
      this.cdr.markForCheck();
    });

    this.cweService
      .loadWeaknesses()
      .pipe(this._untilDestroyed())
      .subscribe({
        next: weaknesses => {
          this.allWeaknesses = weaknesses;
          this.filteredWeaknesses = weaknesses;
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.logger.error('Failed to load CWE weaknesses', { error: err });
          this.isLoading = false;
          this.cdr.markForCheck();
        },
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(200), this._untilDestroyed())
      .subscribe(query => {
        this.filteredWeaknesses = this.cweService.search(this.allWeaknesses, query || '');
        // Clear selection when search changes
        this.selectedCwe = null;
        this.cdr.markForCheck();
      });
  }

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: update the selected CWE weakness from a list selection event (mutates shared state)
  onSelectionChange(event: MatSelectionListChange): void {
    const selected = event.options.find((o: MatListOption) => o.selected);
    this.selectedCwe = selected ? (selected.value as CweWeakness) : null;
    this.cdr.markForCheck();
  }

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: close the dialog without returning a result (pure)
  cancel(): void {
    this.dialogRef.close();
  }

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: close the dialog and return the selected CWE identifier (pure)
  addCwe(): void {
    if (!this.selectedCwe) return;
    this.dialogRef.close({ cweId: this.selectedCwe.cwe_id });
  }

  // SEM@dd4f585071231faa7be62ea453727e96148a393a: return an operator that completes a stream on component destroy (pure)
  private _untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
