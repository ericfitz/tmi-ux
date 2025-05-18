import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { LanguageService } from '../../i18n/language.service';
import { ThreatModel } from './models/threat-model.model';
import { ThreatModelService } from './services/threat-model.service';

@Component({
  selector: 'app-tm',
  standalone: true,
  imports: [CommonModule, SharedModule, MaterialModule, TranslocoModule],
  templateUrl: './tm.component.html',
  styleUrl: './tm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TmComponent implements OnInit, OnDestroy {
  threatModels: ThreatModel[] = [];
  private subscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private currentLocale: string = 'en-US';

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private languageService: LanguageService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.subscription = this.threatModelService.getThreatModels().subscribe(models => {
      this.threatModels = models;
    });

    // Subscribe to language changes to refresh date formatting
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      // Update current locale
      this.currentLocale = language.code;
      // Force change detection to re-evaluate date formatting
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
  }

  createThreatModel(): void {
    // Create a new threat model and navigate to the edit page
    this.threatModelService
      .createThreatModel('New Threat Model', 'Description of the threat model', 'STRIDE')
      .subscribe(model => {
        void this.router.navigate(['/tm', model.id]);
      });
  }

  openThreatModel(id: string): void {
    void this.router.navigate(['/tm', id]);
  }

  /**
   * Format a date according to the current locale
   */
  formatDate(date: string): string {
    const dateObj = new Date(date);
    // Use Intl.DateTimeFormat for more consistent locale-based formatting
    return new Intl.DateTimeFormat(this.currentLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(dateObj);
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
