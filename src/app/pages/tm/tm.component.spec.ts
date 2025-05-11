import { ComponentFixture, TestBed, getTestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CommonModule } from '@angular/common';
import { vi, expect } from 'vitest';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

import { TranslocoTestingModule } from '../../i18n/testing.module';
import { LanguageService, Language } from '../../i18n/language.service';
import { MaterialModule } from '../../shared/material/material.module';
import { SharedModule } from '../../shared/shared.module';
import { TranslocoModule } from '@jsverse/transloco';

import { TmComponent } from './tm.component';
import { ThreatModel } from './models/threat-model.model';
import { ThreatModelService } from './services/threat-model.service';
import { of } from 'rxjs';

// Initialize the Angular testing environment
try {
  getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true },
  });
} catch (e) {
  // Environment already initialized
  console.log('Test environment already initialized');
}

describe('TmComponent', () => {
  let component: TmComponent;
  let fixture: ComponentFixture<TmComponent>;
  let routerSpy: any;
  let languageServiceMock: any;
  let changeDetectorRefMock: any;
  let threatModelServiceMock: any;
  // Define the language subject at the describe level so it's accessible in all tests
  let languageSubject: BehaviorSubject<Language>;

  // Mock threat models for testing
  const mockThreatModels: ThreatModel[] = [
    {
      id: 'test-id-1',
      name: 'Test Threat Model 1',
      description: 'Test Description 1',
      modified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      owner: 'test@example.com',
      authorization: [
        {
          subject: 'test@example.com',
          role: 'owner',
        },
      ],
      diagrams: [],
      threats: [],
    },
    {
      id: 'test-id-2',
      name: 'Test Threat Model 2',
      description: 'Test Description 2',
      modified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      owner: 'test@example.com',
      authorization: [
        {
          subject: 'test@example.com',
          role: 'owner',
        },
      ],
      diagrams: [],
      threats: [],
    },
  ];

  beforeEach(async () => {
    // Create router spy
    routerSpy = {
      navigate: vi.fn(),
    };

    // Create change detector spy
    changeDetectorRefMock = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn(),
    };

    // Create a mock for ThreatModelService
    threatModelServiceMock = {
      getThreatModels: vi.fn().mockReturnValue(of(mockThreatModels)),
      createThreatModel: vi.fn().mockReturnValue(of(mockThreatModels[0])),
      deleteThreatModel: vi.fn().mockReturnValue(of(true)),
    };

    // Create a mock for LanguageService with properly typed language subject
    const mockLanguage: Language = { code: 'en-US', name: 'English', localName: 'English' };
    languageSubject = new BehaviorSubject<Language>(mockLanguage);

    // Create the language service mock
    languageServiceMock = {
      getAvailableLanguages: vi.fn(),
      setLanguage: vi.fn(),
      currentLanguage$: languageSubject.asObservable(),
    };

    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        SharedModule,
        MaterialModule,
        TranslocoModule,
        TranslocoTestingModule,
        TmComponent, // Import the standalone component
      ],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: LanguageService, useValue: languageServiceMock },
        { provide: ChangeDetectorRef, useValue: changeDetectorRefMock },
        { provide: ThreatModelService, useValue: threatModelServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should format dates according to the current locale', () => {
    // Create a test date
    const testDate = new Date(2025, 4, 10).toISOString(); // May 10, 2025

    // Test initial formatting (en-US)
    const initialFormat = component.formatDate(testDate);
    expect(initialFormat).toContain('5/10/2025'); // US format MM/DD/YYYY

    // Change language to German
    const newLanguage: Language = { code: 'de', name: 'German', localName: 'Deutsch' };
    languageSubject.next(newLanguage);

    // Test German formatting
    const germanFormat = component.formatDate(testDate);
    expect(germanFormat).toContain('10.5.2025'); // German format DD.MM.YYYY

    // Verify change detection was triggered
    expect(changeDetectorRefMock.detectChanges).toHaveBeenCalled();
  });

  it('should navigate to threat model editor when creating a new threat model', () => {
    component.createThreatModel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tm', expect.any(String)]);
  });

  it('should navigate to threat model editor when opening a threat model', () => {
    const testId = '123';
    component.openThreatModel(testId);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tm', testId]);
  });

  it('should remove threat model from list when deleted', () => {
    // Ensure component has threat models
    component.threatModels = [...mockThreatModels];

    const initialLength = component.threatModels.length;
    const idToDelete = component.threatModels[0].id;
    const event = new MouseEvent('click');

    // Use Vitest spy instead of Jasmine spy
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

    component.deleteThreatModel(idToDelete, event);

    expect(stopPropagationSpy).toHaveBeenCalled();
    expect(threatModelServiceMock.deleteThreatModel).toHaveBeenCalledWith(idToDelete);
    expect(component.threatModels.length).toBe(initialLength - 1);
    expect(component.threatModels.find(tm => tm.id === idToDelete)).toBeUndefined();
  });
});
