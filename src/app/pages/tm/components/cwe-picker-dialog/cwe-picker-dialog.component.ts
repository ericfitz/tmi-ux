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
export class CwePickerDialogComponent implements OnInit {
  searchControl = new FormControl('');
  allWeaknesses: CweWeakness[] = [];
  filteredWeaknesses: CweWeakness[] = [];
  selectedCwe: CweWeakness | null = null;
  isLoading = true;
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  constructor(
    public dialogRef: MatDialogRef<CwePickerDialogComponent, CwePickerDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: CwePickerDialogData,
    private cweService: CweService,
    private cdr: ChangeDetectorRef,
    private logger: LoggerService,
    private languageService: LanguageService,
    @Optional() private destroyRef?: DestroyRef,
  ) {}

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

  onSelectionChange(event: MatSelectionListChange): void {
    const selected = event.options.find((o: MatListOption) => o.selected);
    this.selectedCwe = selected ? (selected.value as CweWeakness) : null;
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  addCwe(): void {
    if (!this.selectedCwe) return;
    this.dialogRef.close({ cweId: this.selectedCwe.cwe_id });
  }

  private _untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
