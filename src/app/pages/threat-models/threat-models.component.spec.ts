import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { TranslocoTestingModule } from '../../i18n/testing.module';

import { ThreatModelsComponent } from './threat-models.component';

describe('ThreatModelsComponent', () => {
  let component: ThreatModelsComponent;
  let fixture: ComponentFixture<ThreatModelsComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [TranslocoTestingModule],
      providers: [{ provide: Router, useValue: routerSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(ThreatModelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to DFD editor when creating a new diagram', () => {
    component.createDiagram();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dfd', jasmine.any(String)]);
  });

  it('should navigate to DFD editor when opening a diagram', () => {
    const testId = '123';
    component.openDiagram(testId);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dfd', testId]);
  });

  it('should remove diagram from list when deleted', () => {
    const initialLength = component.diagrams.length;
    const idToDelete = component.diagrams[0].id;
    const event = new MouseEvent('click');

    spyOn(event, 'stopPropagation');
    component.deleteDiagram(idToDelete, event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.diagrams.length).toBe(initialLength - 1);
    expect(component.diagrams.find(d => d.id === idToDelete)).toBeUndefined();
  });
});
