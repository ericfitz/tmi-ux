import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { ThreatModel } from './models/threat-model.model';
import { ThreatModelService } from './services/threat-model.service';

@Component({
  selector: 'app-tm',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './tm.component.html',
  styleUrl: './tm.component.scss',
})
export class TmComponent implements OnInit, OnDestroy {
  threatModels: ThreatModel[] = [];
  private subscription: Subscription | null = null;

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
  ) {}

  ngOnInit(): void {
    this.subscription = this.threatModelService.getThreatModels().subscribe(models => {
      this.threatModels = models;
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  createThreatModel(): void {
    // Create a new threat model and navigate to the edit page
    this.threatModelService.createThreatModel('New Threat Model').subscribe(model => {
      void this.router.navigate(['/tm', model.id]);
    });
  }

  openThreatModel(id: string): void {
    void this.router.navigate(['/tm', id]);
  }

  deleteThreatModel(id: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent opening threat model when clicking delete

    this.threatModelService.deleteThreatModel(id).subscribe(success => {
      if (success) {
        this.threatModels = this.threatModels.filter(tm => tm.id !== id);
      }
    });
  }
}
