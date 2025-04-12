import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { DiagramEditorComponent } from './diagram-editor.component';
import { TranslocoTestingModule } from '../../i18n/testing.module';

describe('DiagramEditorComponent', () => {
  let component: DiagramEditorComponent;
  let fixture: ComponentFixture<DiagramEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramEditorComponent, RouterTestingModule, TranslocoTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'test-diagram-1' })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
