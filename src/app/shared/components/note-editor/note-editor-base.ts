import { ElementRef } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { MermaidViewerService } from '@app/shared/services/mermaid-viewer.service';

/**
 * Abstract base for markdown note editors (full-page and dialog variants).
 *
 * Implements the clipboard (cut/copy/paste), task-list checkbox toggling,
 * anchor-link navigation, and markdown-preview lifecycle logic that was
 * previously duplicated verbatim across the note editors. Concrete subclasses
 * provide the form, view-children, preview/selection state, markdown getter,
 * and snackbar messaging.
 *
 * Subclasses keep their own `@ViewChild` decorators on `contentTextarea` and
 * `markdownPreview`; the base only declares the shapes it consumes.
 */
export abstract class NoteEditorBase {
  /** Textarea holding the raw markdown; `@ViewChild` lives in the subclass. */
  abstract contentTextarea?: ElementRef<HTMLTextAreaElement>;
  /** Rendered markdown preview container; `@ViewChild` lives in the subclass. */
  abstract markdownPreview?: ElementRef<HTMLDivElement>;

  /** Reactive form whose `content` control holds the markdown source. */
  abstract noteForm: FormGroup;
  /** True when the editor is showing the rendered preview rather than the textarea. */
  abstract previewMode: boolean;
  /** True when the textarea currently has a non-empty selection. */
  abstract hasSelection: boolean;

  /** Raw markdown content used for preview rendering. */
  abstract get markdownContent(): string;

  /** Optional service that wires up interactive mermaid diagram viewers. */
  protected abstract mermaidViewerService?: MermaidViewerService;

  /**
   * Show a snackbar message. Abstract so each subclass can localize/route it,
   * though both current implementations are identical.
   */
  abstract showMessage(key: string, isError?: boolean): void;

  /** True when the clipboard was readable and held content at init time. */
  clipboardHasContent = false;

  protected taskListCheckboxesInitialized = false;
  protected anchorClickHandler?: (event: Event) => void;
  protected mermaidViewersInitialized = false;
  protected mermaidCleanup?: () => void;

  /**
   * Shared `AfterViewChecked` body: (re)initializes task-list checkboxes,
   * anchor links, and mermaid viewers whenever preview mode is entered, and
   * tears them down when it is left.
   */
  ngAfterViewChecked(): void {
    // Initialize task list checkboxes and anchor links after markdown is rendered
    if (this.previewMode && !this.taskListCheckboxesInitialized) {
      this.initializeTaskListCheckboxes();
      this.initializeAnchorLinks();
      this.taskListCheckboxesInitialized = true;
    } else if (!this.previewMode) {
      this.taskListCheckboxesInitialized = false;
    }

    // Initialize mermaid diagram viewers
    if (this.previewMode && !this.mermaidViewersInitialized && this.markdownPreview) {
      const cleanup = this.mermaidViewerService?.initialize(this.markdownPreview);
      if (cleanup) {
        this.mermaidCleanup = cleanup;
        this.mermaidViewersInitialized = true;
      }
    } else if (!this.previewMode && this.mermaidViewersInitialized) {
      this.mermaidCleanup?.();
      this.mermaidViewersInitialized = false;
    }
  }

  /**
   * Cut the current textarea selection to the clipboard, removing it from the
   * form content. No-op in preview mode or when nothing is selected.
   */
  async onCut(): Promise<void> {
    if (this.previewMode || !this.hasSelection) {
      return;
    }

    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (!selectedText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedText);
      const newValue = textarea.value.substring(0, start) + textarea.value.substring(end);
      this.noteForm.get('content')?.setValue(newValue);
      textarea.focus();
      textarea.setSelectionRange(start, start);
      this.hasSelection = false;
    } catch {
      this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
    }
  }

  /**
   * Copy the full markdown content (preview mode) or the current textarea
   * selection (edit mode) to the clipboard.
   */
  async onCopy(): Promise<void> {
    if (this.previewMode) {
      // Copy the entire markdown content in preview mode
      const content = this.markdownContent;
      try {
        await navigator.clipboard.writeText(content);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    } else {
      // Copy selected text in edit mode
      const textarea = this.contentTextarea?.nativeElement;
      if (!textarea || !this.hasSelection) {
        return;
      }

      const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);

      if (!selectedText) {
        return;
      }

      try {
        await navigator.clipboard.writeText(selectedText);
        this.showMessage('noteEditor.copiedToClipboard');
      } catch {
        this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
      }
    }
  }

  /**
   * Paste clipboard text into the textarea at the current caret/selection.
   * No-op in preview mode.
   */
  async onPaste(): Promise<void> {
    if (this.previewMode) {
      return;
    }

    const textarea = this.contentTextarea?.nativeElement;
    if (!textarea) {
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentValue = textarea.value;
      const newValue =
        currentValue.substring(0, start) + clipboardText + currentValue.substring(end);

      this.noteForm.get('content')?.setValue(newValue);
      textarea.focus();
      const newPosition = start + clipboardText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    } catch {
      this.showMessage('noteEditor.errors.clipboardAccessDenied', true);
    }
  }

  /**
   * Probe clipboard read access on init and record whether it holds content.
   * A denied read is expected and silently treated as "no content".
   */
  protected async checkClipboardPermissions(): Promise<void> {
    try {
      const text = await navigator.clipboard.readText();
      this.clipboardHasContent = !!text;
    } catch {
      // Clipboard access might be denied, that's okay
      this.clipboardHasContent = false;
    }
  }

  /**
   * Initialize event listeners for task list checkboxes to make them interactive
   */
  protected initializeTaskListCheckboxes(): void {
    if (!this.markdownPreview) {
      return;
    }

    const checkboxes =
      this.markdownPreview.nativeElement.querySelectorAll('input[type="checkbox"]');

    checkboxes.forEach((checkbox, index) => {
      const htmlCheckbox = checkbox as HTMLInputElement;
      // Remove any existing listeners
      htmlCheckbox.onclick = null;

      // Add click listener to update markdown content
      htmlCheckbox.onclick = (event): void => {
        event.preventDefault();
        this.toggleTaskListItem(index, !htmlCheckbox.checked);
      };
    });
  }

  /**
   * Toggle a task list item in the markdown content
   */
  protected toggleTaskListItem(index: number, checked: boolean): void {
    const content = this.markdownContent;
    const lines = content.split('\n');
    let taskListIndex = -1;

    // Find the task list item by index
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match task list items: - [ ] or - [x] or - [X]
      if (/^(\s*)-\s\[([ xX])\]/.test(line)) {
        taskListIndex++;
        if (taskListIndex === index) {
          // Toggle the checkbox
          lines[i] = line.replace(/^(\s*)-\s\[([ xX])\]/, `$1- [${checked ? 'x' : ' '}]`);
          break;
        }
      }
    }

    // Update the form content
    const newContent = lines.join('\n');
    this.noteForm.get('content')?.setValue(newContent);

    // Reset initialization flag to re-initialize checkboxes after re-render
    this.taskListCheckboxesInitialized = false;
  }

  /**
   * Initialize event listeners for anchor links to handle internal navigation
   */
  protected initializeAnchorLinks(): void {
    if (!this.markdownPreview) {
      return;
    }

    // Remove existing handler if present
    if (this.anchorClickHandler) {
      this.markdownPreview.nativeElement.removeEventListener(
        'click',
        this.anchorClickHandler,
        true,
      );
    }

    // Create delegated event handler for all anchor clicks
    this.anchorClickHandler = (event: Event): void => {
      const target = event.target as HTMLElement;

      // Find the closest anchor element (in case user clicked on child element)
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');

        if (href && href.startsWith('#')) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();

          const targetId = href.substring(1);

          if (!targetId) {
            return;
          }

          // Find the target element within the preview
          const targetElement = this.markdownPreview?.nativeElement.querySelector(
            `#${CSS.escape(targetId)}`,
          );

          if (targetElement) {
            // Scroll to the target element with smooth behavior
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    };

    // Add click listener to the preview container (event delegation)
    this.markdownPreview.nativeElement.addEventListener('click', this.anchorClickHandler, true);
  }
}
