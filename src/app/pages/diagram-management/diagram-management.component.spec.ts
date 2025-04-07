import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiagramManagementComponent } from './diagram-management.component';

describe('DiagramManagementComponent', () => {
  let component: DiagramManagementComponent;
  let fixture: ComponentFixture<DiagramManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
