import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { X6GraphService } from '../../services/x6/x6-graph.service';

@Component({
  selector: 'app-x6-properties-panel',
  template: `
    <div class="properties-panel">
      <div *ngIf="selectedNode" class="properties-section">
        <h3>Node Properties</h3>
        <form [formGroup]="nodeForm" (ngSubmit)="updateNodeProperties()">
          <div class="form-group">
            <label for="label">Label</label>
            <input type="text" id="label" formControlName="label" />
          </div>

          <div class="form-group">
            <label for="fillColor">Fill Color</label>
            <input type="color" id="fillColor" formControlName="fillColor" />
          </div>

          <div class="form-group">
            <label for="strokeColor">Stroke Color</label>
            <input type="color" id="strokeColor" formControlName="strokeColor" />
          </div>

          <div class="form-group">
            <label for="strokeWidth">Stroke Width</label>
            <input type="number" id="strokeWidth" formControlName="strokeWidth" min="1" max="5" />
          </div>

          <button type="submit" [disabled]="nodeForm.pristine">Apply</button>
        </form>
      </div>

      <div *ngIf="selectedEdge" class="properties-section">
        <h3>Edge Properties</h3>
        <form [formGroup]="edgeForm" (ngSubmit)="updateEdgeProperties()">
          <div class="form-group">
            <label for="edgeLabel">Label</label>
            <input type="text" id="edgeLabel" formControlName="label" />
          </div>

          <div class="form-group">
            <label for="edgeStrokeColor">Stroke Color</label>
            <input type="color" id="edgeStrokeColor" formControlName="strokeColor" />
          </div>

          <div class="form-group">
            <label for="edgeStrokeWidth">Stroke Width</label>
            <input
              type="number"
              id="edgeStrokeWidth"
              formControlName="strokeWidth"
              min="1"
              max="5"
            />
          </div>

          <div class="form-group">
            <label for="edgeStyle">Style</label>
            <select id="edgeStyle" formControlName="style">
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>

          <button type="submit" [disabled]="edgeForm.pristine">Apply</button>
        </form>
      </div>

      <div *ngIf="!selectedNode && !selectedEdge" class="no-selection">
        <p>Select a node or edge to edit its properties</p>
      </div>
    </div>
  `,
  styles: [
    `
      .properties-panel {
        height: 100%;
        overflow-y: auto;
        padding: 10px;
      }
      h3 {
        margin: 0 0 15px 0;
        font-size: 16px;
        font-weight: 500;
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
      }
      input,
      select {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      input[type='color'] {
        height: 36px;
      }
      button {
        padding: 8px 16px;
        background-color: #5f95ff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
      }
      button:disabled {
        background-color: #cccccc;
        cursor: not-allowed;
      }
      .no-selection {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
        color: #888;
        font-style: italic;
      }
    `,
  ],
  standalone: false,
})
export class X6PropertiesPanelComponent implements OnInit, OnDestroy {
  selectedNode: any = null;
  selectedEdge: any = null;

  nodeForm: FormGroup;
  edgeForm: FormGroup;

  private nodeSubscription: Subscription | null = null;
  private edgeSubscription: Subscription | null = null;

  constructor(
    private graphService: X6GraphService,
    private fb: FormBuilder,
  ) {
    // Initialize forms
    this.nodeForm = this.fb.group({
      label: [''],
      fillColor: ['#ffffff'],
      strokeColor: ['#5F95FF'],
      strokeWidth: [1],
    });

    this.edgeForm = this.fb.group({
      label: [''],
      strokeColor: ['#5F95FF'],
      strokeWidth: [1],
      style: ['solid'],
    });
  }

  ngOnInit(): void {
    // Subscribe to node selection
    this.nodeSubscription = this.graphService.nodeSelected$.subscribe(node => {
      this.selectedNode = node;
      this.selectedEdge = null;

      if (node) {
        // Get node data
        const data = node.getData() || {};
        const attrs = node.getAttrs() || {};

        // Update form values
        this.nodeForm.patchValue({
          label: data.label || '',
          fillColor: attrs['body']?.['fill'] || '#ffffff',
          strokeColor: attrs['body']?.['stroke'] || '#5F95FF',
          strokeWidth: attrs['body']?.['strokeWidth'] || 1,
        });
      }
    });

    // Subscribe to edge selection
    this.edgeSubscription = this.graphService.edgeSelected$.subscribe(edge => {
      this.selectedEdge = edge;
      this.selectedNode = null;

      if (edge) {
        // Get edge data
        const data = edge.getData() || {};
        const attrs = edge.getAttrs() || {};

        // Determine style
        let style = 'solid';
        if (attrs['line']?.['strokeDasharray'] === '5 5') {
          style = 'dashed';
        } else if (attrs['line']?.['strokeDasharray'] === '1 3') {
          style = 'dotted';
        }

        // Update form values
        this.edgeForm.patchValue({
          label: data.label || '',
          strokeColor: attrs['line']?.['stroke'] || '#5F95FF',
          strokeWidth: attrs['line']?.['strokeWidth'] || 1,
          style,
        });
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions
    if (this.nodeSubscription) {
      this.nodeSubscription.unsubscribe();
    }

    if (this.edgeSubscription) {
      this.edgeSubscription.unsubscribe();
    }
  }

  updateNodeProperties(): void {
    if (!this.selectedNode) return;

    const formValues = this.nodeForm.value;

    // Update node data
    this.selectedNode.setData({
      ...this.selectedNode.getData(),
      label: formValues.label,
    });

    // Update node attributes
    this.selectedNode.setAttrs({
      body: {
        fill: formValues.fillColor,
        stroke: formValues.strokeColor,
        strokeWidth: formValues.strokeWidth,
      },
    });

    // Reset form pristine state
    this.nodeForm.markAsPristine();
  }

  updateEdgeProperties(): void {
    if (!this.selectedEdge) return;

    const formValues = this.edgeForm.value;

    // Determine stroke dash array based on style
    let strokeDasharray = null;
    if (formValues.style === 'dashed') {
      strokeDasharray = '5 5';
    } else if (formValues.style === 'dotted') {
      strokeDasharray = '1 3';
    }

    // Update edge data
    this.selectedEdge.setData({
      ...this.selectedEdge.getData(),
      label: formValues.label,
    });

    // Update edge attributes
    this.selectedEdge.setAttrs({
      line: {
        stroke: formValues.strokeColor,
        strokeWidth: formValues.strokeWidth,
        strokeDasharray,
      },
    });

    // Update edge label
    if (formValues.label) {
      this.selectedEdge.setLabels([{ text: formValues.label }]);
    } else {
      this.selectedEdge.setLabels([]);
    }

    // Reset form pristine state
    this.edgeForm.markAsPristine();
  }
}
