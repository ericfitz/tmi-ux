import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { TosComponent } from './tos.component';
import { TranslocoTestingModule } from '../../i18n/testing.module';

describe('TosComponent', () => {
  let component: TosComponent;
  let fixture: ComponentFixture<TosComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TosComponent, RouterTestingModule, TranslocoTestingModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TosComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
