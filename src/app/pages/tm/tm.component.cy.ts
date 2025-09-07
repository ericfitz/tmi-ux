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
    getThreatModelList: () =>
      of([
        {
          id: mockThreatModel1.id,
          name: mockThreatModel1.name,
          description: mockThreatModel1.description,
          created_at: mockThreatModel1.created_at,
          modified_at: mockThreatModel1.modified_at,
          owner: mockThreatModel1.owner,
          created_by: mockThreatModel1.created_by,
          threat_model_framework: mockThreatModel1.threat_model_framework,
          issue_url: mockThreatModel1.issue_url,
          document_count: mockThreatModel1.documents?.length || 0,
          source_count: mockThreatModel1.sourceCode?.length || 0,
          diagram_count: mockThreatModel1.diagrams?.length || 0,
          threat_count: mockThreatModel1.threats?.length || 0,
        },
        {
          id: mockThreatModel2.id,
          name: mockThreatModel2.name,
          description: mockThreatModel2.description,
          created_at: mockThreatModel2.created_at,
          modified_at: mockThreatModel2.modified_at,
          owner: mockThreatModel2.owner,
          created_by: mockThreatModel2.created_by,
          threat_model_framework: mockThreatModel2.threat_model_framework,
          issue_url: mockThreatModel2.issue_url,
          document_count: mockThreatModel2.documents?.length || 0,
          source_count: mockThreatModel2.sourceCode?.length || 0,
          diagram_count: mockThreatModel2.diagrams?.length || 0,
          threat_count: mockThreatModel2.threats?.length || 0,
        },
        {
          id: mockThreatModel3.id,
          name: mockThreatModel3.name,
          description: mockThreatModel3.description,
          created_at: mockThreatModel3.created_at,
          modified_at: mockThreatModel3.modified_at,
          owner: mockThreatModel3.owner,
          created_by: mockThreatModel3.created_by,
          threat_model_framework: mockThreatModel3.threat_model_framework,
          issue_url: mockThreatModel3.issue_url,
          document_count: mockThreatModel3.documents?.length || 0,
          source_count: mockThreatModel3.sourceCode?.length || 0,
          diagram_count: mockThreatModel3.diagrams?.length || 0,
          threat_count: mockThreatModel3.threats?.length || 0,
        },
      ]),
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
});
