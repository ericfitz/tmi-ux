# Mock Data Centralization Plan

## Overview

This document outlines the strategy for centralizing mock data in the TMI-UX project. The goal is to create a consistent, maintainable approach to mock data that can be used both during development and in tests.

## Requirements

1. Create 3 mock threat model objects
2. Each threat model should have 1-3 diagrams
3. Each diagram should have 4-6 cells
4. Each threat model should have 2-4 threats
5. Mock data should be available for tests
6. Mock data should be used during development when APIs aren't available
7. UI toggle in the navbar to switch between mock and real data

## Implementation Strategy

### 1. Directory Structure

```
src/
└── app/
    └── mocks/
        ├── index.ts                  # Exports all mock factories and instances
        ├── mock-data.service.ts      # Service to manage mock data and toggle
        ├── factories/                # Factory functions for creating mock objects
        │   ├── threat-model.factory.ts
        │   ├── diagram.factory.ts
        │   ├── cell.factory.ts
        │   └── threat.factory.ts
        └── instances/                # Pre-configured mock instances
            ├── threat-model-1.ts     # First complete threat model with diagrams, cells, threats
            ├── threat-model-2.ts     # Second complete threat model
            └── threat-model-3.ts     # Third complete threat model
```

### 2. Factory Functions

Create factory functions that generate mock objects with customizable properties:

```typescript
// threat-model.factory.ts
import { v4 as uuidv4 } from 'uuid';
import { ThreatModel, Authorization } from '../../pages/tm/models/threat-model.model';

export function createMockThreatModel(overrides?: Partial<ThreatModel>): ThreatModel {
  const defaultThreatModel: ThreatModel = {
    id: uuidv4(),
    name: 'Mock Threat Model',
    description: 'Auto-generated mock threat model',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    owner: 'user@example.com',
    created_by: 'user@example.com',
    threat_model_framework: 'STRIDE',
    authorization: [{ subject: 'user@example.com', role: 'owner' }],
    metadata: [],
    diagrams: [],
    threats: [],
  };

  return { ...defaultThreatModel, ...overrides };
}

// diagram.factory.ts
import { v4 as uuidv4 } from 'uuid';
import { Diagram } from '../../pages/tm/models/diagram.model';

export function createMockDiagram(overrides?: Partial<Diagram>): Diagram {
  const defaultDiagram: Diagram = {
    id: uuidv4(),
    name: 'Mock Diagram',
    description: 'Auto-generated mock diagram',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  };

  return { ...defaultDiagram, ...overrides };
}

// cell.factory.ts
import { v4 as uuidv4 } from 'uuid';
import { Cell } from '../../pages/tm/models/diagram.model';

export function createMockCell(
  type: 'process' | 'store' | 'actor' | 'edge' = 'process',
  overrides?: Partial<Cell>,
): Cell {
  const id = uuidv4();
  const isEdge = type === 'edge';

  const defaultCell: Cell = {
    id,
    value: isEdge ? '' : `Mock ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    geometry: isEdge
      ? undefined
      : {
          x: Math.floor(Math.random() * 500),
          y: Math.floor(Math.random() * 300),
          width: 120,
          height: 60,
        },
    style: isEdge ? 'endArrow=classic;html=1;' : `shape=${type};whiteSpace=wrap;html=1;`,
    vertex: !isEdge,
    edge: isEdge,
    parent: null,
    source: isEdge ? 'source_id' : null,
    target: isEdge ? 'target_id' : null,
  };

  return { ...defaultCell, ...overrides };
}

// threat.factory.ts
import { v4 as uuidv4 } from 'uuid';
import { Threat } from '../../pages/tm/models/threat-model.model';

export function createMockThreat(overrides?: Partial<Threat>): Threat {
  const defaultThreat: Threat = {
    id: uuidv4(),
    threat_model_id: uuidv4(),
    name: 'Mock Threat',
    description: 'Auto-generated mock threat',
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    severity: 'Medium',
    threat_type: 'Information Disclosure',
    metadata: [],
  };

  return { ...defaultThreat, ...overrides };
}
```

### 3. Pre-configured Mock Instances

Create three complete threat model instances with diagrams, cells, and threats:

```typescript
// threat-model-1.ts
import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import { createMockDiagram } from '../factories/diagram.factory';
import { createMockCell } from '../factories/cell.factory';
import { createMockThreat } from '../factories/threat.factory';

// Create cells for the first diagram
const diagram1Cells = [
  createMockCell('process', { id: 'cell1', value: 'User Authentication' }),
  createMockCell('store', { id: 'cell2', value: 'User Database' }),
  createMockCell('actor', { id: 'cell3', value: 'End User' }),
  createMockCell('edge', {
    id: 'edge1',
    source: 'cell3',
    target: 'cell1',
    value: 'Login Request',
  }),
  createMockCell('edge', {
    id: 'edge2',
    source: 'cell1',
    target: 'cell2',
    value: 'Verify Credentials',
  }),
];

// Create diagrams
const diagram1 = createMockDiagram({
  id: '123e4567-e89b-12d3-a456-426614174000',
  name: 'Authentication Flow',
  description: 'User authentication process flow',
  graphData: diagram1Cells,
});

// Create threats
const threats = [
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    name: 'Credential Theft',
    description: 'Attacker steals user credentials during transmission',
    severity: 'High',
    threat_type: 'Information Disclosure',
    diagram_id: diagram1.id,
    cell_id: 'edge1',
  }),
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c9',
    name: 'SQL Injection',
    description: 'Attacker injects malicious SQL into authentication queries',
    severity: 'Critical',
    threat_type: 'Elevation of Privilege',
    diagram_id: diagram1.id,
    cell_id: 'cell1',
  }),
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430ca',
    name: 'Brute Force Attack',
    description: 'Attacker attempts to guess passwords through automated attempts',
    severity: 'Medium',
    threat_type: 'Tampering',
    diagram_id: diagram1.id,
    cell_id: 'cell1',
  }),
];

// Create the complete threat model
export const mockThreatModel1: ThreatModel = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'System Authentication',
  description: 'Authentication system security analysis',
  created_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
  modified_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  owner: 'user@example.com',
  created_by: 'user@example.com',
  threat_model_framework: 'STRIDE',
  issue_url: 'https://issues.example.com/browse/TM-123',
  authorization: [
    {
      subject: 'user@example.com',
      role: 'owner',
    },
  ],
  metadata: [
    {
      key: 'Reviewer',
      value: 'John Doe',
    },
    {
      key: 'Priority',
      value: 'High',
    },
  ],
  diagrams: [diagram1.id],
  threats: threats,
};

// Similar implementations for threat-model-2.ts and threat-model-3.ts
```

### 4. Mock Data Service

Create a service to manage mock data and provide a toggle mechanism:

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ThreatModel } from '../pages/tm/models/threat-model.model';
import { Diagram } from '../pages/tm/models/diagram.model';

import { createMockThreatModel } from './factories/threat-model.factory';
import { createMockDiagram } from './factories/diagram.factory';
import { createMockCell } from './factories/cell.factory';
import { createMockThreat } from './factories/threat.factory';

import { mockThreatModel1 } from './instances/threat-model-1';
import { mockThreatModel2 } from './instances/threat-model-2';
import { mockThreatModel3 } from './instances/threat-model-3';

@Injectable({
  providedIn: 'root',
})
export class MockDataService implements OnDestroy {
  private _useMockData = new BehaviorSubject<boolean>(this.getInitialMockState());
  public useMockData$ = this._useMockData.asObservable();

  constructor() {
    // Initialize from localStorage if available
  }

  private getInitialMockState(): boolean {
    const storedValue = localStorage.getItem('useMockData');
    return storedValue !== null ? storedValue === 'true' : true;
  }

  toggleMockData(useMock: boolean): void {
    this._useMockData.next(useMock);
    localStorage.setItem('useMockData', String(useMock));
  }

  // Factory methods that wrap the factory functions
  createThreatModel(overrides?: Partial<ThreatModel>): ThreatModel {
    return createMockThreatModel(overrides);
  }

  createDiagram(overrides?: Partial<Diagram>): Diagram {
    return createMockDiagram(overrides);
  }

  // Methods to get pre-configured mock instances
  getMockThreatModels(): ThreatModel[] {
    return [mockThreatModel1, mockThreatModel2, mockThreatModel3];
  }

  getMockThreatModelById(id: string): ThreatModel | undefined {
    return this.getMockThreatModels().find(tm => tm.id === id);
  }

  getMockDiagrams(): Diagram[] {
    // Collect all diagrams from all threat models
    const diagrams: Diagram[] = [];
    this.getMockThreatModels().forEach(tm => {
      tm.diagrams.forEach(diagramId => {
        // Find the diagram in the mock data
        // This would be implemented to return the actual diagram objects
      });
    });
    return diagrams;
  }

  ngOnDestroy(): void {
    this._useMockData.complete();
  }
}
```

### 5. UI Toggle Component

Create a component for the navbar toggle:

```typescript
import { Component } from '@angular/core';
import { MockDataService } from '../../mocks/mock-data.service';

@Component({
  selector: 'app-mock-data-toggle',
  template: `
    <mat-slide-toggle
      [checked]="useMockData$ | async"
      (change)="toggleMockData($event.checked)"
      color="accent"
      class="mock-data-toggle"
    >
      <span class="mock-data-label">Mock Data</span>
    </mat-slide-toggle>
  `,
  styles: [
    `
      .mock-data-toggle {
        margin-left: 16px;
      }
      .mock-data-label {
        font-size: 12px;
        margin-left: 4px;
      }
    `,
  ],
})
export class MockDataToggleComponent {
  useMockData$ = this.mockDataService.useMockData$;

  constructor(private mockDataService: MockDataService) {}

  toggleMockData(useMock: boolean): void {
    this.mockDataService.toggleMockData(useMock);
  }
}
```

Add the toggle component to the navbar:

```typescript
// navbar.component.html
<mat-toolbar color="primary">
  <span>TMI</span>
  <span class="spacer"></span>
  <app-mock-data-toggle *ngIf="isDevelopmentMode"></app-mock-data-toggle>
  <!-- Other navbar items -->
</mat-toolbar>
```

```typescript
// navbar.component.ts
import { Component, isDevMode } from '@angular/core';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent {
  isDevelopmentMode = isDevMode();
}
```

### 6. Update Services

Update the existing services to use mock data when the toggle is enabled:

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, Subscription } from 'rxjs';
import { ThreatModel } from '../models/threat-model.model';
import { MockDataService } from '../../mocks/mock-data.service';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class ThreatModelService implements OnDestroy {
  private _subscription: Subscription | null = null;
  private _useMockData = false;

  constructor(
    private http: HttpClient,
    private mockDataService: MockDataService,
    private logger: LoggerService,
  ) {
    this._subscription = this.mockDataService.useMockData$.subscribe(useMock => {
      this._useMockData = useMock;
      this.logger.debug(`ThreatModelService using mock data: ${useMock}`);
    });
  }

  getThreatModels(): Observable<ThreatModel[]> {
    if (this._useMockData) {
      this.logger.debug('Returning mock threat models');
      return of(this.mockDataService.getMockThreatModels());
    }

    // Real API call
    this.logger.debug('Fetching threat models from API');
    return this.http.get<ThreatModel[]>('/api/threat-models');
  }

  getThreatModelById(id: string): Observable<ThreatModel | undefined> {
    if (this._useMockData) {
      this.logger.debug(`Returning mock threat model with ID: ${id}`);
      return of(this.mockDataService.getMockThreatModelById(id));
    }

    // Real API call
    this.logger.debug(`Fetching threat model with ID: ${id} from API`);
    return this.http.get<ThreatModel>(`/api/threat-models/${id}`);
  }

  // Other methods...

  ngOnDestroy(): void {
    if (this._subscription) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
  }
}
```

### 7. Testing Approach

For testing, use the factory functions to create customized mock objects:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThreatModelComponent } from './threat-model.component';
import { createMockThreatModel } from 'src/app/mocks/factories/threat-model.factory';
import { createMockThreat } from 'src/app/mocks/factories/threat.factory';
import { ThreatModelService } from '../../services/threat-model.service';
import { of } from 'rxjs';

describe('ThreatModelComponent', () => {
  let component: ThreatModelComponent;
  let fixture: ComponentFixture<ThreatModelComponent>;
  let threatModelServiceSpy: jasmine.SpyObj<ThreatModelService>;

  beforeEach(async () => {
    const spy = jasmine.createSpyObj('ThreatModelService', ['getThreatModelById']);

    await TestBed.configureTestingModule({
      declarations: [ThreatModelComponent],
      providers: [{ provide: ThreatModelService, useValue: spy }],
    }).compileComponents();

    threatModelServiceSpy = TestBed.inject(
      ThreatModelService,
    ) as jasmine.SpyObj<ThreatModelService>;
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ThreatModelComponent);
    component = fixture.componentInstance;
  });

  it('should display threat model details', () => {
    // Create a custom mock threat model for this test
    const mockThreatModel = createMockThreatModel({
      name: 'Test Model',
      threats: [createMockThreat({ name: 'Test Threat' })],
    });

    // Configure the spy to return the mock
    threatModelServiceSpy.getThreatModelById.and.returnValue(of(mockThreatModel));

    // Set the component's input
    component.threatModelId = mockThreatModel.id;

    // Trigger change detection
    fixture.detectChanges();

    // Assert that the component displays the mock data correctly
    const element = fixture.nativeElement;
    expect(element.querySelector('.threat-model-name').textContent).toContain('Test Model');
    expect(element.querySelector('.threat-list-item').textContent).toContain('Test Threat');
  });
});
```

## Implementation Steps

1. Create the mocks directory structure
2. Implement the factory functions
3. Create the pre-configured mock instances
4. Implement the MockDataService
5. Create the UI toggle component
6. Update the existing services to use mock data
7. Update tests to use the factory functions

## Benefits

1. **Centralized**: All mock data is in one place with a clear structure
2. **Consistent**: Mock data is consistent across the application
3. **Flexible**: Factory functions allow for customization in tests
4. **Developer-friendly**: UI toggle makes it easy to switch between mock and real data
5. **Maintainable**: Easy to update mock data in one place
6. **Realistic**: Mock data closely resembles real API responses
7. **Testable**: Factory functions make it easy to create test-specific mock data

## Conclusion

This approach provides a robust solution for centralizing mock data in the TMI-UX project. It ensures that mock data is consistent, maintainable, and available for both development and testing purposes.
