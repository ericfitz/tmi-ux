import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../../shared/material/material.module';
import { SharedModule } from '../../../shared/shared.module';
import { Diagram, DIAGRAMS_BY_ID } from '../models/diagram.model';
import { ThreatModel } from '../models/threat-model.model';
import { ThreatModelService } from '../services/threat-model.service';

// Define form value interface
interface ThreatModelFormValues {
  name: string;
  description: string;
}

@Component({
  selector: 'app-tm-edit',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    MaterialModule,
    MatListModule,
    TranslocoModule,
    ReactiveFormsModule,
    RouterModule,
  ],
  templateUrl: './tm-edit.component.html',
  styleUrl: './tm-edit.component.scss',
})
export class TmEditComponent implements OnInit, OnDestroy {
  threatModel: ThreatModel | undefined;
  threatModelForm: FormGroup;
  isNewThreatModel = false;
  diagrams: Diagram[] = [];
  private subscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private threatModelService: ThreatModelService,
    private fb: FormBuilder,
  ) {
    this.threatModelForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/tm']);
      return;
    }

    this.subscription = this.threatModelService.getThreatModelById(id).subscribe(threatModel => {
      if (threatModel) {
        this.threatModel = threatModel;
        this.threatModelForm.patchValue({
          name: threatModel.name,
          description: threatModel.description || '',
        });

        // Populate diagrams array with diagram objects
        this.diagrams =
          threatModel.diagrams?.map(diagramId => {
            // Look up the diagram by ID
            const diagram = DIAGRAMS_BY_ID.get(diagramId);
            if (diagram) {
              return diagram;
            }
            // If diagram not found, create a placeholder with the ID as name
            return {
              id: diagramId,
              name: `Diagram ${diagramId.substring(0, 8)}...`,
              created_at: new Date().toISOString(),
              modified_at: new Date().toISOString(),
            };
          }) || [];
      } else {
        // Handle case where threat model is not found
        this.isNewThreatModel = true;
        this.threatModel = {
          id,
          name: 'New Threat Model',
          description: '',
          created_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
          owner: 'user@example.com',
          authorization: [
            {
              subject: 'user@example.com',
              role: 'owner',
            },
          ],
          metadata: [],
          diagrams: [],
          threats: [],
        };
        this.threatModelForm.patchValue({
          name: this.threatModel.name,
          description: this.threatModel.description || '',
        });
      }
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  saveThreatModel(): void {
    if (this.threatModelForm.invalid || !this.threatModel) {
      return;
    }

    // Get form values with proper typing
    const formValues = this.threatModelForm.getRawValue() as ThreatModelFormValues;

    const updatedThreatModel: ThreatModel = {
      ...this.threatModel,
      name: formValues.name,
      description: formValues.description,
      modified_at: new Date().toISOString(),
    };

    this.threatModelService.updateThreatModel(updatedThreatModel).subscribe(result => {
      this.threatModel = result;
      // Show success message or navigate back
    });
  }

  addThreat(): void {
    // Implement adding a new threat
    // This would be expanded in a real implementation
  }

  addDiagram(): void {
    // Implement adding a new diagram
    // This would be expanded in a real implementation
  }

  cancel(): void {
    void this.router.navigate(['/tm']);
  }
}
