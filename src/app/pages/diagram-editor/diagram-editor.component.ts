import { Component, OnInit } from '@angular/core';
import { DiagramService } from './services/x6/diagram.service';
import { NodeService } from './services/x6/node.service';
import { EdgeService } from './services/x6/edge.service';
import { HistoryService } from './services/x6/history.service';
import { ExportImportService } from './services/x6/export-import.service';
import { LoggerService } from '../../core/services/logger.service';
import { ThemeService } from './services/theme/theme.service';
import { ThemeMetadata } from './services/theme/theme.interface';

@Component({
  selector: 'app-diagram-editor',
  template: `
    <div class="diagram-editor">
      <div class="diagram-editor-header">
        <h2>{{ (diagramService.currentDiagram$ | async)?.name || 'Untitled Diagram' }}</h2>
        <div class="diagram-editor-actions">
          <button (click)="createNewDiagram()">New Diagram</button>
          <button (click)="saveDiagram()">Save</button>
          <button [disabled]="!(historyService.canUndo$ | async)" (click)="undo()">Undo</button>
          <button [disabled]="!(historyService.canRedo$ | async)" (click)="redo()">Redo</button>
          <div class="dropdown">
            <button class="dropdown-toggle">Export</button>
            <div class="dropdown-menu">
              <button (click)="exportAsJson()">Export as JSON</button>
              <button (click)="exportAsPng()">Export as PNG</button>
              <button (click)="exportAsSvg()">Export as SVG</button>
            </div>
          </div>
          <input
            type="file"
            #fileInput
            style="display: none"
            accept=".json"
            (change)="importDiagram($event)"
          />
          <button (click)="fileInput.click()">Import</button>
          <div class="dropdown">
            <button class="dropdown-toggle">Theme</button>
            <div class="dropdown-menu">
              <button *ngFor="let theme of availableThemes" (click)="switchTheme(theme.id)">
                {{ theme.name }}
              </button>
            </div>
          </div>
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
      button {
        padding: 8px 12px;
        background-color: #5f95ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
      }
      .dropdown {
        position: relative;
        display: inline-block;
      }
      .dropdown-toggle {
        padding: 8px 12px;
        background-color: #5f95ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .dropdown-menu {
        display: none;
        position: absolute;
        background-color: #f9f9f9;
        min-width: 160px;
        box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
        z-index: 1;
      }
      .dropdown-menu button {
        width: 100%;
        text-align: left;
        background-color: transparent;
        color: black;
        padding: 8px 12px;
      }
      .dropdown-menu button:hover {
        background-color: #f1f1f1;
      }
      .dropdown:hover .dropdown-menu {
        display: block;
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
