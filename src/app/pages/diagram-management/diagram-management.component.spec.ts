import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { DiagramManagementComponent } from './diagram-management.component';
import { TranslocoTestingModule } from '../../i18n/testing.module';

describe('DiagramManagementComponent', () => {
  let component: DiagramManagementComponent;
  let fixture: ComponentFixture<DiagramManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DiagramManagementComponent,
        RouterTestingModule,
        TranslocoTestingModule
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
