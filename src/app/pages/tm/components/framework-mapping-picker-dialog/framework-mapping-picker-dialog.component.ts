import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LanguageService } from '../../../../i18n/language.service';
import {
  FrameworkMappingPickerDialogData,
  FrameworkMappingPickerDialogResult,
} from './framework-mapping-picker-dialog.types';

interface MappingOption {
  name: string;
  checked: boolean;
  disabled: boolean;
}

@Component({
  selector: 'app-framework-mapping-picker-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './framework-mapping-picker-dialog.component.html',
  styleUrl: './framework-mapping-picker-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrameworkMappingPickerDialogComponent implements OnInit {
  options: MappingOption[] = [];
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  constructor(
    public dialogRef: MatDialogRef<FrameworkMappingPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FrameworkMappingPickerDialogData,
    private _cdr: ChangeDetectorRef,
    private _languageService: LanguageService,
    private _destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this._languageService.direction$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(dir => {
      this.currentDirection = dir;
      this._cdr.markForCheck();
    });

    this._buildOptions();
  }

  onCheckChange(index: number, checked: boolean): void {
    this.options[index].checked = checked;
  }

  apply(): void {
    const selected = this.options.filter(o => o.checked).map(o => o.name);
    const result: FrameworkMappingPickerDialogResult = { selectedTypes: selected };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  private _buildOptions(): void {
    const cellType = this.data.cellType;

    this.options = this.data.availableTypes.map(tt => {
      const isSelected = this.data.selectedTypes.includes(tt.name);
      const isApplicable =
        !cellType || tt.appliesTo.some(a => a.toLowerCase() === cellType.toLowerCase());

      return {
        name: tt.name,
        checked: isSelected,
        disabled: !isApplicable,
      };
    });
  }
}
