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
import { DfdCollaborationService } from '../dfd/services/dfd-collaboration.service';
import { LoggerService } from '../../core/services/logger.service';

/**
 * Interface for collaboration session data
 */
export interface CollaborationSession {
  id: string;
  threatModelId: string;
  threatModelName: string;
  diagramId: string;
  diagramName: string;
  hostUser: string;
  startedAt: Date;
  activeUsers: number;
}

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
  collaborationSessions: CollaborationSession[] = [];
  private subscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private collaborationSubscription: Subscription | null = null;
  private currentLocale: string = 'en-US';

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private languageService: LanguageService,
    private collaborationService: DfdCollaborationService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    console.log('[CYPRESS-DEBUG] TmComponent.ngOnInit called');
    this.subscription = this.threatModelService.getThreatModels().subscribe(models => {
      this.threatModels = models;
      console.log('[CYPRESS-DEBUG] TmComponent received threat models', { 
        count: models.length,
        models: models.map(tm => ({ id: tm.id, name: tm.name }))
      });
      // Trigger change detection to update the view
      this.cdr.detectChanges();
    });

    // Subscribe to language changes to refresh date formatting
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      // Update current locale
      this.currentLocale = language.code;
      // Force change detection to re-evaluate date formatting
      this.cdr.detectChanges();
    });

    // Load active collaboration sessions
    this.loadCollaborationSessions();
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.collaborationSubscription) {
      this.collaborationSubscription.unsubscribe();
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

  /**
   * Load active collaboration sessions
   */
  private loadCollaborationSessions(): void {
    // For now, we'll use mock data since the actual implementation would depend on the backend API
    // In a real implementation, this would fetch active sessions from the server

    // Mock data for demonstration purposes
    this.collaborationSessions = [
      {
        id: '1',
        threatModelId: '550e8400-e29b-41d4-a716-446655440000',
        threatModelName: 'System Threat Model',
        diagramId: '123e4567-e89b-12d3-a456-426614174000',
        diagramName: 'System Architecture',
        hostUser: 'John Doe',
        startedAt: new Date(),
        activeUsers: 3,
      },
      {
        id: '2',
        threatModelId: '550e8400-e29b-41d4-a716-446655440001',
        threatModelName: 'Cloud Infrastructure Threat Model',
        diagramId: '223e4567-e89b-12d3-a456-426614174000',
        diagramName: 'Cloud Infrastructure',
        hostUser: 'Jane Smith',
        startedAt: new Date(),
        activeUsers: 2,
      },
    ];

    this.logger.info('Loaded collaboration sessions', { count: this.collaborationSessions.length });
    this.cdr.detectChanges();
  }

  /**
   * Navigate to the DFD page for a specific diagram
   * @param diagramId The ID of the diagram to open
   */
  openCollaborationSession(diagramId: string): void {
    this.logger.info('Opening collaboration session', { diagramId });
    void this.router.navigate(['/dfd', diagramId]);
  }
}
