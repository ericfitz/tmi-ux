import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatListModule } from '@angular/material/list';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../../shared/material/material.module';
import { SharedModule } from '../../../shared/shared.module';
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
  ],
  templateUrl: './tm-edit.component.html',
  styleUrl: './tm-edit.component.scss',
})
export class TmEditComponent implements OnInit, OnDestroy {
  threatModel: ThreatModel | undefined;
  threatModelForm: FormGroup;
  isNewThreatModel = false;
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
