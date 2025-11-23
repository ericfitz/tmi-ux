// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { PrincipalTypeIconComponent } from './principal-type-icon.component';

describe('PrincipalTypeIconComponent', () => {
  let component: PrincipalTypeIconComponent;
  let fixture: ComponentFixture<PrincipalTypeIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrincipalTypeIconComponent, MatIconModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PrincipalTypeIconComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getIconName', () => {
    it('should return "person" for user principal type', () => {
      component.principalType = 'user';
      expect(component.getIconName()).toBe('person');
    });

    it('should return "group" for group principal type', () => {
      component.principalType = 'group';
      expect(component.getIconName()).toBe('group');
    });

    it('should default to "person" when principalType is not set', () => {
      expect(component.getIconName()).toBe('person');
    });
  });

  describe('template rendering', () => {
    it('should render person icon for user type', () => {
      component.principalType = 'user';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const icon = compiled.querySelector('mat-icon');

      expect(icon?.textContent?.trim()).toBe('person');
    });

    it('should render group icon for group type', () => {
      component.principalType = 'group';
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const icon = compiled.querySelector('mat-icon');

      expect(icon?.textContent?.trim()).toBe('group');
    });
  });
});
