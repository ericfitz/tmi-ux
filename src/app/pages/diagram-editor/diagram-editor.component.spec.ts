import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiagramEditorComponent } from './diagram-editor.component';

describe('DiagramEditorComponent', () => {
  let component: DiagramEditorComponent;
  let fixture: ComponentFixture<DiagramEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramEditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DiagramEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
