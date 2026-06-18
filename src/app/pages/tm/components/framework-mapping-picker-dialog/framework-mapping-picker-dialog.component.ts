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
// SEM@09e7b113d6c053823c3591cfc622f93c770edf25: dialog component for selecting framework threat type mappings for a diagram cell
export class FrameworkMappingPickerDialogComponent implements OnInit {
  options: MappingOption[] = [];
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: inject dialog ref, mapping data, change detector, language service, and destroy ref
  constructor(
    public dialogRef: MatDialogRef<FrameworkMappingPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FrameworkMappingPickerDialogData,
    private _cdr: ChangeDetectorRef,
    private _languageService: LanguageService,
    private _destroyRef: DestroyRef,
  ) {}

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: subscribe to text direction and build the initial framework mapping options
  ngOnInit(): void {
    this._languageService.direction$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(dir => {
      this.currentDirection = dir;
      this._cdr.markForCheck();
    });

    this._buildOptions();
  }

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: update the checked state of a framework mapping option by index (mutates shared state)
  onCheckChange(index: number, checked: boolean): void {
    this.options[index].checked = checked;
  }

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: close dialog returning selected framework mapping types (pure)
  apply(): void {
    const selected = this.options.filter(o => o.checked).map(o => o.name);
    const result: FrameworkMappingPickerDialogResult = { selectedTypes: selected };
    this.dialogRef.close(result);
  }

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: close dialog without returning a selection (pure)
  cancel(): void {
    this.dialogRef.close();
  }

  // SEM@09e7b113d6c053823c3591cfc622f93c770edf25: build checkbox option list from available and selected framework types (mutates shared state)
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
