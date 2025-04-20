import { Component, OnInit } from '@angular/core';
import { DiagramService } from './services/x6/diagram.service';
import { NodeService } from './services/x6/node.service';
import { EdgeService } from './services/x6/edge.service';
import { HistoryService } from './services/x6/history.service';
import { ExportImportService } from './services/x6/export-import.service';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from './services/theme/theme.service';
import { ThemeMetadata } from './services/theme/theme.interface';
import { TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-diagram-editor',
  template: `
    <div class="diagram-editor">
      <div class="diagram-editor-header">
        <h2>{{ (diagramService.currentDiagram$ | async)?.name || 'Untitled Diagram' }}</h2>
        <div class="diagram-editor-actions">
          <button mat-raised-button color="primary" (click)="createNewDiagram()">
            <mat-icon>add</mat-icon>
            {{ translocoService.translate('editor.header.newDiagram') }}
          </button>
          <button mat-raised-button color="primary" (click)="saveDiagram()">
            <mat-icon>save</mat-icon>
            {{ translocoService.translate('editor.header.save') }}
          </button>
          <button
            mat-raised-button
            color="primary"
            [disabled]="!(historyService.canUndo$ | async)"
            (click)="undo()"
          >
            <mat-icon>undo</mat-icon>
            {{ translocoService.translate('editor.header.undo') }}
          </button>
          <button
            mat-raised-button
            color="primary"
            [disabled]="!(historyService.canRedo$ | async)"
            (click)="redo()"
          >
            <mat-icon>redo</mat-icon>
            {{ translocoService.translate('editor.header.redo') }}
          </button>
          <button mat-raised-button color="primary" [matMenuTriggerFor]="exportMenu">
            <mat-icon>file_download</mat-icon>
            {{ translocoService.translate('editor.header.export') }}
          </button>
          <mat-menu #exportMenu="matMenu">
            <button mat-menu-item (click)="exportAsJson()">
              <mat-icon>code</mat-icon>
              {{ translocoService.translate('editor.header.exportJson') }}
            </button>
            <button mat-menu-item (click)="exportAsPng()">
              <mat-icon>image</mat-icon>
              {{ translocoService.translate('editor.header.exportPng') }}
            </button>
            <button mat-menu-item (click)="exportAsSvg()">
              <mat-icon>image</mat-icon>
              {{ translocoService.translate('editor.header.exportSvg') }}
            </button>
          </mat-menu>
          <input
            type="file"
            #fileInput
            style="display: none"
            accept=".json"
            (change)="importDiagram($event)"
          />
          <button mat-raised-button color="primary" (click)="fileInput.click()">
            <mat-icon>file_upload</mat-icon>
            {{ translocoService.translate('editor.header.import') }}
          </button>
          <button mat-raised-button color="primary" [matMenuTriggerFor]="themeMenu">
            <mat-icon>palette</mat-icon>
            {{ translocoService.translate('editor.header.theme') }}
          </button>
          <mat-menu #themeMenu="matMenu">
            <button
              mat-menu-item
              *ngFor="let theme of availableThemes"
              (click)="switchTheme(theme.id)"
            >
              {{ theme.name }}
            </button>
          </mat-menu>
        </div>
      </div>
      <div class="diagram-editor-content">
        <div class="diagram-editor-palette">
          <app-x6-palette></app-x6-palette>
        </div>
        <div class="diagram-editor-canvas">
          <app-x6-diagram-canvas></app-x6-diagram-canvas>
        </div>
        <div class="diagram-editor-properties">
          <app-x6-properties-panel></app-x6-properties-panel>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .diagram-editor {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .diagram-editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px;
        border-bottom: 1px solid #e0e0e0;
      }
      .diagram-editor-actions {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .diagram-editor-content {
        display: flex;
        flex: 1;
        overflow: hidden;
      }
      .diagram-editor-palette {
        width: 200px;
        border-right: 1px solid #e0e0e0;
        padding: 10px;
      }
      .diagram-editor-canvas {
        flex: 1;
        overflow: hidden;
      }
      .diagram-editor-properties {
        width: 300px;
        border-left: 1px solid #e0e0e0;
        padding: 10px;
      }
    `,
  ],
  standalone: false,
})
export class DiagramEditorComponent implements OnInit {
  availableThemes: ThemeMetadata[] = [];
  constructor(
    public diagramService: DiagramService,
    private nodeService: NodeService,
    private edgeService: EdgeService,
    public historyService: HistoryService,
    private exportImportService: ExportImportService,
    private logger: LoggerService,
    private themeService: ThemeService,
    public translocoService: TranslocoService,
  ) {}

  ngOnInit(): void {
    // Initialize the theme service first
    this.themeService.initialize().subscribe({
      next: success => {
        if (success) {
          this.logger.info('Theme service initialized successfully');
          // Get available themes
          this.availableThemes = this.themeService.getAvailableThemes();

          // Create a new diagram only after theme service is initialized
          // Add a small delay to ensure all services are properly initialized
          setTimeout(() => {
            this.createNewDiagram();
          }, 100);
        } else {
          this.logger.error('Failed to initialize theme service');
        }
      },
      error: error => {
        this.logger.error('Error initializing theme service', error);
      },
    });
  }

  createNewDiagram(): void {
    this.diagramService.createNewDiagram('New Diagram');
  }

  saveDiagram(): void {
    const savedDiagram = this.diagramService.saveDiagram();
    if (savedDiagram) {
      // In a real application, you would save the diagram to a server or local storage
      this.logger.info('Diagram saved successfully');
    }
  }

  undo(): void {
    this.historyService.undo();
  }

  redo(): void {
    this.historyService.redo();
  }

  exportAsJson(): void {
    this.exportImportService.exportAsJson();
  }

  exportAsPng(): void {
    this.exportImportService.exportAsPng();
  }

  exportAsSvg(): void {
    this.exportImportService.exportAsSvg();
  }

  importDiagram(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.exportImportService
      .importFromJson(file)
      .then(() => {
        this.logger.info('Diagram imported successfully');
        // Reset the file input
        input.value = '';
      })
      .catch(error => {
        this.logger.error('Error importing diagram', error);
        // Reset the file input
        input.value = '';
      });
  }

  /**
   * Switch to a different theme
   * @param themeId The ID of the theme to switch to
   */
  switchTheme(themeId: string): void {
    this.themeService.loadTheme(themeId).subscribe({
      next: success => {
        if (success) {
          this.logger.info(`Switched to theme: ${themeId}`);
        } else {
          this.logger.error(`Failed to switch to theme: ${themeId}`);
        }
      },
      error: error => {
        this.logger.error(`Error switching to theme: ${themeId}`, error);
      },
    });
  }
}
