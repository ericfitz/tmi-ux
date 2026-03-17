/**
 * Color Picker Component
 *
 * A reusable color picker with three sections:
 * 1. Default palette — 16 fixed application colors (read-only)
 * 2. Diagram palette — 0-8 user-defined diagram-specific colors (editable)
 * 3. Hex input + OS color picker — enabled only when a diagram color is selected
 *
 * All swatches have a visible border using theme colors for light/dark mode support.
 * Selecting any swatch emits the color and populates the hex input.
 * Diagram colors can be added (up to 8), removed, and edited via hex input or OS picker.
 *
 * Diagram colors use the ColorPaletteEntry schema with stable position identifiers
 * for unambiguous REST/WebSocket updates.
 */

import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TranslocoModule } from '@jsverse/transloco';

import { DefaultColorsConfig } from '../../../pages/dfd/constants/default-colors';
import { isValidColor } from '../../utils/color-validation.util';
import {
  ColorPaletteEntry,
  MAX_DIAGRAM_COLORS,
  PLACEHOLDER_COLOR,
  normalizeHexColor,
  nextAvailablePosition,
} from '../../../pages/dfd/types/color-palette.types';

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TooltipAriaLabelDirective,
    MatFormFieldModule,
    MatInputModule,
    TranslocoModule,
  ],
  templateUrl: './color-picker.component.html',
  styleUrl: './color-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  @Input() selectedColor: string | null = null;
  @Input() diagramPalette: ColorPaletteEntry[] = [];
  @Input() disabled = false;

  @Output() colorSelected = new EventEmitter<string>();
  @Output() diagramPaletteChanged = new EventEmitter<ColorPaletteEntry[]>();

  @ViewChild('osColorInput') osColorInput!: ElementRef<HTMLInputElement>;

  readonly defaultColors = DefaultColorsConfig.getColors();
  readonly maxDiagramColors = MAX_DIAGRAM_COLORS;

  hexInputValue = '';
  selectedDiagramPosition: number | null = null;
  selectedSource: 'default' | 'diagram' | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  get isHexInputEnabled(): boolean {
    return (
      !this.disabled && this.selectedSource === 'diagram' && this.selectedDiagramPosition !== null
    );
  }

  get canAddDiagramColor(): boolean {
    return !this.disabled && this.diagramPalette.length < MAX_DIAGRAM_COLORS;
  }

  /** Diagram entries sorted by position for display */
  get sortedDiagramEntries(): ColorPaletteEntry[] {
    return [...this.diagramPalette].sort((a, b) => a.position - b.position);
  }

  isSelected(color: string, source: 'default' | 'diagram', position?: number): boolean {
    if (source === 'default') {
      return this.selectedSource === 'default' && this.selectedColor === color;
    }
    return this.selectedSource === 'diagram' && this.selectedDiagramPosition === position;
  }

  onDefaultColorClick(color: string): void {
    if (this.disabled) return;
    this.selectedSource = 'default';
    this.selectedDiagramPosition = null;
    this.selectedColor = color;
    this.hexInputValue = color;
    this.colorSelected.emit(color);
  }

  onDiagramColorClick(entry: ColorPaletteEntry): void {
    if (this.disabled) return;
    this.selectedSource = 'diagram';
    this.selectedDiagramPosition = entry.position;
    this.selectedColor = entry.color;
    this.hexInputValue = entry.color;
    this.colorSelected.emit(entry.color);
  }

  onEmptySlotClick(): void {
    if (this.disabled || !this.canAddDiagramColor) return;
    const position = nextAvailablePosition(this.diagramPalette);
    if (position === null) return;

    const newEntry: ColorPaletteEntry = { position, color: PLACEHOLDER_COLOR };
    const newPalette = [...this.diagramPalette, newEntry];
    this.diagramPalette = newPalette;
    this.selectedSource = 'diagram';
    this.selectedDiagramPosition = position;
    this.selectedColor = PLACEHOLDER_COLOR;
    this.hexInputValue = PLACEHOLDER_COLOR;
    this.diagramPaletteChanged.emit(newPalette);
    this.colorSelected.emit(PLACEHOLDER_COLOR);
    this.cdr.markForCheck();
  }

  onRemoveDiagramColor(event: MouseEvent, entry: ColorPaletteEntry): void {
    event.stopPropagation();
    if (this.disabled) return;
    const newPalette = this.diagramPalette.filter(e => e.position !== entry.position);
    if (this.selectedDiagramPosition === entry.position) {
      this.selectedDiagramPosition = null;
      this.selectedSource = null;
      this.hexInputValue = '';
    }
    this.diagramPalette = newPalette;
    this.diagramPaletteChanged.emit(newPalette);
    this.cdr.markForCheck();
  }

  onHexInput(value: string): void {
    if (!this.isHexInputEnabled || this.selectedDiagramPosition === null) return;
    this.hexInputValue = value;
    const prefixed = value.startsWith('#') ? value : `#${value}`;
    if (isValidColor(prefixed)) {
      const normalized = normalizeHexColor(prefixed);
      const newPalette = this.diagramPalette.map(e =>
        e.position === this.selectedDiagramPosition ? { ...e, color: normalized } : e,
      );
      this.diagramPalette = newPalette;
      this.selectedColor = normalized;
      this.diagramPaletteChanged.emit(newPalette);
      this.colorSelected.emit(normalized);
      this.cdr.markForCheck();
    }
  }

  onOsColorPickerClick(): void {
    if (!this.isHexInputEnabled) return;
    this.osColorInput.nativeElement.click();
  }

  onOsColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = normalizeHexColor(input.value);
    if (this.selectedDiagramPosition === null) return;
    this.hexInputValue = color;
    const newPalette = this.diagramPalette.map(e =>
      e.position === this.selectedDiagramPosition ? { ...e, color } : e,
    );
    this.diagramPalette = newPalette;
    this.selectedColor = color;
    this.diagramPaletteChanged.emit(newPalette);
    this.colorSelected.emit(color);
    this.cdr.markForCheck();
  }
}
