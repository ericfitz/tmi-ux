import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';

/**
 * Inline edit component for click-to-edit text fields.
 * Displays text normally and switches to an input field when clicked.
 * Emits valueChange on blur or Enter key.
 */
@Component({
  selector: 'app-inline-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, TooltipAriaLabelDirective],
  templateUrl: './inline-edit.component.html',
  styleUrl: './inline-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: inline text field that toggles between display and edit mode, emitting on commit (pure)
export class InlineEditComponent {
  /** The current value to display/edit */
  @Input() value: string | null = null;

  /** Placeholder text when value is empty */
  @Input() placeholder = 'Click to edit';

  /** Whether editing is disabled */
  @Input() disabled = false;

  /** Tooltip to show when hovering over the edit icon */
  @Input() editTooltip = 'Click to edit';

  /** Tooltip to show when editing is disabled */
  @Input() disabledTooltip = 'Editing disabled during collaboration';

  /** CSS class to apply to the display text */
  @Input() displayClass = '';

  /** Emitted when the value changes (on blur or Enter) */
  @Output() valueChange = new EventEmitter<string>();

  @ViewChild('inputField') inputField!: ElementRef<HTMLInputElement>;

  isEditing = false;
  editValue = '';

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: inject ChangeDetectorRef for manual view updates (pure)
  constructor(private cdr: ChangeDetectorRef) {}

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: switch to edit mode and focus the input field (mutates shared state)
  startEditing(): void {
    if (this.disabled) {
      return;
    }
    this.isEditing = true;
    this.editValue = this.value ?? '';
    this.cdr.detectChanges();
    // Focus the input field after it's rendered
    setTimeout(() => {
      this.inputField?.nativeElement?.focus();
      this.inputField?.nativeElement?.select();
    });
  }

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: exit edit mode discarding any pending changes (mutates shared state)
  cancelEditing(): void {
    this.isEditing = false;
    this.editValue = '';
    this.cdr.detectChanges();
  }

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: commit trimmed edit value and emit valueChange if the value changed (pure)
  saveValue(): void {
    const trimmedValue = this.editValue.trim();
    this.isEditing = false;

    // Only emit if value actually changed
    if (trimmedValue !== (this.value ?? '')) {
      this.valueChange.emit(trimmedValue);
    }

    this.editValue = '';
    this.cdr.detectChanges();
  }

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: handle Enter to save and Escape to cancel inline editing (pure)
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.saveValue();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEditing();
    }
  }

  // SEM@98bc5be49f8f36357e8b2199a1a554b5bd5760ce: save the inline edit value when the input loses focus (pure)
  onBlur(): void {
    this.saveValue();
  }
}
