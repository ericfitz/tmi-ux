import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { TranslocoTestingModule } from '../../i18n/testing.module';

import { TmComponent } from './tm.component';

describe('TmComponent', () => {
  let component: TmComponent;
  let fixture: ComponentFixture<TmComponent>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj<Router>('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [TranslocoTestingModule],
      providers: [{ provide: Router, useValue: routerSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(TmComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to threat model editor when creating a new threat model', () => {
    component.createThreatModel();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tm', jasmine.any(String)]);
  });

  it('should navigate to threat model editor when opening a threat model', () => {
    const testId = '123';
    component.openThreatModel(testId);
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/tm', testId]);
  });

  it('should remove threat model from list when deleted', () => {
    const initialLength = component.threatModels.length;
    const idToDelete = component.threatModels[0].id;
    const event = new MouseEvent('click');

    spyOn(event, 'stopPropagation');
    component.deleteThreatModel(idToDelete, event);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.threatModels.length).toBe(initialLength - 1);
    expect(component.threatModels.find(tm => tm.id === idToDelete)).toBeUndefined();
  });
});
