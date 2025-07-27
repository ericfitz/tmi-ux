/// <reference types="cypress" />

import { MountConfig } from 'cypress/angular';
import { TmComponent } from './tm.component';
import { MockDataService } from '../../mocks/mock-data.service';
import { ThreatModelService } from './services/threat-model.service';
import { provideHttpClient } from '@angular/common/http';
import { LoggerService } from '../../core/services/logger.service';
import { BehaviorSubject, of } from 'rxjs';
import { MOCK_THREAT_MODELS } from './models/threat-model.model';

describe('TmComponent', () => {
  const [mockThreatModel1, mockThreatModel2, mockThreatModel3] = MOCK_THREAT_MODELS;

  const mockDataServiceStub = {
    useMockData$: new BehaviorSubject<boolean>(true),
    getMockThreatModels: () => [mockThreatModel1, mockThreatModel2, mockThreatModel3],
    toggleMockData: (_useMock: boolean) => {},
  };

  const threatModelServiceStub = {
    getThreatModels: () => of([mockThreatModel1, mockThreatModel2, mockThreatModel3]),
  };

  const loggerServiceStub = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const mountConfig: MountConfig<TmComponent> = {
    providers: [
      provideHttpClient(),
      { provide: MockDataService, useValue: mockDataServiceStub },
      { provide: ThreatModelService, useValue: threatModelServiceStub },
      { provide: LoggerService, useValue: loggerServiceStub },
    ],
  };

  it('should display the threat model list', () => {
    cy.mount(TmComponent, mountConfig);

    // Check that the page title is displayed
    cy.contains('h1', 'Threat Models').should('be.visible');

    // Check that the threat models are displayed
    cy.get('.threat-model-card').should('have.length', 3);

    // Check that the threat model names are displayed
    cy.contains(mockThreatModel1.name).should('be.visible');
    cy.contains(mockThreatModel2.name).should('be.visible');
    cy.contains(mockThreatModel3.name).should('be.visible');
  });

  it('should filter threat models when searching', () => {
    cy.mount(TmComponent, mountConfig);

    // Type in the search box
    cy.get('input[placeholder="Search"]').type('System');

    // Check that only the matching threat models are displayed
    cy.get('.threat-model-card').should('have.length', 1);
    cy.contains(mockThreatModel1.name).should('be.visible');
  });

  it('should navigate to create new threat model when clicking the create button', () => {
    cy.mount(TmComponent, mountConfig);

    // Spy on router navigation
    const navigateSpy = cy.spy().as('navigateSpy');
    cy.wrap(TmComponent.prototype).as('component');
    cy.get('@component').then(component => {
      // @ts-expect-error - Cypress stub
      component.router = { navigate: navigateSpy };
    });

    // Click on the create button
    cy.contains('button', 'Create New').click();

    // Check that the router was called with the correct route
    cy.get('@navigateSpy').should('have.been.calledWith', ['/tm/new']);
  });

  it('should toggle mock data when clicking the toggle', () => {
    cy.spy(mockDataServiceStub, 'toggleMockData').as('toggleSpy');

    cy.mount(TmComponent, mountConfig);

    // Click on the mock data toggle
    cy.get('.mock-data-toggle').click();

    // Check that the toggle method was called with the correct value
    cy.get('@toggleSpy').should('have.been.calledWith', false);
  });
});
