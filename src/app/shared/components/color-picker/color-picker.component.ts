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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { TranslocoModule } from '@jsverse/transloco';

import { DefaultColorsConfig } from '../../../pages/dfd/constants/default-colors';
import { isValidColor } from '../../utils/color-validation.util';

/** Maximum number of diagram-specific colors */
const MAX_DIAGRAM_COLORS = 8;

/** Placeholder color for new diagram color slots */
const PLACEHOLDER_COLOR = '#9E9E9E';

export interface ColorPickerSelection {
  color: string;
  source: 'default' | 'diagram';
}

@Component({
  selector: 'app-color-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
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
  @Input() diagramPalette: string[] = [];
  @Input() disabled = false;

  @Output() colorSelected = new EventEmitter<string>();
  @Output() diagramPaletteChanged = new EventEmitter<string[]>();

  @ViewChild('osColorInput') osColorInput!: ElementRef<HTMLInputElement>;

  readonly defaultColors = DefaultColorsConfig.getColors();
  readonly maxDiagramColors = MAX_DIAGRAM_COLORS;

  hexInputValue = '';
  selectedDiagramIndex: number | null = null;
  selectedSource: 'default' | 'diagram' | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  get isHexInputEnabled(): boolean {
    return (
      !this.disabled && this.selectedSource === 'diagram' && this.selectedDiagramIndex !== null
    );
  }

  get canAddDiagramColor(): boolean {
    return !this.disabled && this.diagramPalette.length < MAX_DIAGRAM_COLORS;
  }

  get emptySlotCount(): number {
    return MAX_DIAGRAM_COLORS - this.diagramPalette.length;
  }

  isSelected(color: string, source: 'default' | 'diagram', index?: number): boolean {
    if (source === 'default') {
      return this.selectedSource === 'default' && this.selectedColor === color;
    }
    return this.selectedSource === 'diagram' && this.selectedDiagramIndex === index;
  }

  onDefaultColorClick(color: string): void {
    if (this.disabled) return;
    this.selectedSource = 'default';
    this.selectedDiagramIndex = null;
    this.selectedColor = color;
    this.hexInputValue = color;
    this.colorSelected.emit(color);
  }

  onDiagramColorClick(index: number): void {
    if (this.disabled) return;
    this.selectedSource = 'diagram';
    this.selectedDiagramIndex = index;
    this.selectedColor = this.diagramPalette[index];
    this.hexInputValue = this.diagramPalette[index];
    this.colorSelected.emit(this.diagramPalette[index]);
  }

  onEmptySlotClick(): void {
    if (this.disabled || !this.canAddDiagramColor) return;
    const newPalette = [...this.diagramPalette, PLACEHOLDER_COLOR];
    const newIndex = newPalette.length - 1;
    this.diagramPalette = newPalette;
    this.selectedSource = 'diagram';
    this.selectedDiagramIndex = newIndex;
    this.selectedColor = PLACEHOLDER_COLOR;
    this.hexInputValue = PLACEHOLDER_COLOR;
    this.diagramPaletteChanged.emit(newPalette);
    this.colorSelected.emit(PLACEHOLDER_COLOR);
    this.cdr.markForCheck();
  }

  onRemoveDiagramColor(event: MouseEvent, index: number): void {
    event.stopPropagation();
    if (this.disabled) return;
    const newPalette = this.diagramPalette.filter((_, i) => i !== index);
    if (this.selectedDiagramIndex === index) {
      this.selectedDiagramIndex = null;
      this.selectedSource = null;
      this.hexInputValue = '';
    } else if (this.selectedDiagramIndex !== null && this.selectedDiagramIndex > index) {
      this.selectedDiagramIndex--;
    }
    this.diagramPalette = newPalette;
    this.diagramPaletteChanged.emit(newPalette);
    this.cdr.markForCheck();
  }

  onHexInput(value: string): void {
    if (!this.isHexInputEnabled || this.selectedDiagramIndex === null) return;
    this.hexInputValue = value;
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (isValidColor(normalized)) {
      const upperColor = normalized.toUpperCase();
      const newPalette = [...this.diagramPalette];
      newPalette[this.selectedDiagramIndex] = upperColor;
      this.diagramPalette = newPalette;
      this.selectedColor = upperColor;
      this.diagramPaletteChanged.emit(newPalette);
      this.colorSelected.emit(upperColor);
      this.cdr.markForCheck();
    }
  }

  onOsColorPickerClick(): void {
    if (!this.isHexInputEnabled) return;
    this.osColorInput.nativeElement.click();
  }

  onOsColorChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const color = input.value.toUpperCase();
    if (this.selectedDiagramIndex === null) return;
    this.hexInputValue = color;
    const newPalette = [...this.diagramPalette];
    newPalette[this.selectedDiagramIndex] = color;
    this.diagramPalette = newPalette;
    this.selectedColor = color;
    this.diagramPaletteChanged.emit(newPalette);
    this.colorSelected.emit(color);
    this.cdr.markForCheck();
  }
}
