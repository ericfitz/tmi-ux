import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { TranslocoModule } from '@jsverse/transloco';

export interface PropertyChange {
  propertyName: string;
  propertyValue: any;
  cellId: string;
}

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatExpansionModule,
    TranslocoModule,
  ],
  template: `
    <div class="properties-container">
      <h3 class="properties-title">{{ 'editor.properties.title' | transloco }}</h3>

      <div *ngIf="!hasSelectedCell" class="no-selection-message">
        {{ 'editor.properties.help' | transloco }}
      </div>

      <div *ngIf="hasSelectedCell" class="properties-form">
        <mat-expansion-panel expanded>
          <mat-expansion-panel-header>
            <mat-panel-title> Basic Properties </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="property-group">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Label</mat-label>
              <input
                matInput
                [(ngModel)]="properties.label"
                (change)="onPropertyChange('label', properties.label)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Description</mat-label>
              <textarea
                matInput
                rows="3"
                [(ngModel)]="properties.description"
                (change)="onPropertyChange('description', properties.description)"
              ></textarea>
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <mat-expansion-panel *ngIf="properties.type === 'vertex'">
          <mat-expansion-panel-header>
            <mat-panel-title> Style Properties </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="property-group">
            <mat-form-field appearance="outline">
              <mat-label>Fill Color</mat-label>
              <input
                matInput
                [(ngModel)]="properties.fillColor"
                (change)="onPropertyChange('fillColor', properties.fillColor)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stroke Color</mat-label>
              <input
                matInput
                [(ngModel)]="properties.strokeColor"
                (change)="onPropertyChange('strokeColor', properties.strokeColor)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stroke Width</mat-label>
              <input
                matInput
                type="number"
                [(ngModel)]="properties.strokeWidth"
                (change)="onPropertyChange('strokeWidth', properties.strokeWidth)"
              />
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <mat-expansion-panel *ngIf="properties.type === 'edge'">
          <mat-expansion-panel-header>
            <mat-panel-title> Edge Properties </mat-panel-title>
          </mat-expansion-panel-header>

          <div class="property-group">
            <mat-form-field appearance="outline">
              <mat-label>Edge Style</mat-label>
              <input
                matInput
                [(ngModel)]="properties.edgeStyle"
                (change)="onPropertyChange('edgeStyle', properties.edgeStyle)"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Edge Color</mat-label>
              <input
                matInput
                [(ngModel)]="properties.edgeColor"
                (change)="onPropertyChange('edgeColor', properties.edgeColor)"
              />
            </mat-form-field>
          </div>
        </mat-expansion-panel>

        <div class="properties-actions">
          <button mat-raised-button color="primary" (click)="onApplyChanges()">
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .properties-container {
        padding: 16px;
        background-color: #f5f5f5;
        border-radius: 8px;
      }

      .properties-title {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 18px;
        font-weight: 500;
      }

      .no-selection-message {
        color: #757575;
        font-style: italic;
        padding: 16px 0;
      }

      .properties-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .property-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .full-width {
        width: 100%;
      }

      .properties-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 16px;
      }
    `,
  ],
})
export class PropertiesPanelComponent {
  @Input() hasSelectedCell = false;
  @Input() selectedCellId = '';
  @Input() properties: any = {
    label: '',
    description: '',
    type: 'vertex',
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1,
    edgeStyle: 'straight',
    edgeColor: '#000000',
  };

  @Output() propertyChanged = new EventEmitter<PropertyChange>();
  @Output() applyChanges = new EventEmitter<void>();

  onPropertyChange(propertyName: string, propertyValue: any): void {
    this.propertyChanged.emit({
      propertyName,
      propertyValue,
      cellId: this.selectedCellId,
    });
  }

  onApplyChanges(): void {
    this.applyChanges.emit();
  }
}
