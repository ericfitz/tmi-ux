import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogModule } from '@angular/material/dialog';
import { of } from 'rxjs';

import { DfdCollaborationComponent } from './collaboration.component';
import { DfdCollaborationService } from '../../services/dfd-collaboration.service';
import { LoggerService } from '../../../../core/services/logger.service';

describe('DfdCollaborationComponent', () => {
  let component: DfdCollaborationComponent;
  let fixture: ComponentFixture<DfdCollaborationComponent>;
  let collaborationServiceSpy: jasmine.SpyObj<DfdCollaborationService>;
  let loggerServiceSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(async () => {
    // Create spies for the services
    collaborationServiceSpy = jasmine.createSpyObj<DfdCollaborationService>(
      'DfdCollaborationService',
      [
        'startCollaboration',
        'endCollaboration',
        'inviteUser',
        'removeUser',
        'updateUserRole',
        'hasPermission',
      ],
    );

    // Set up the behavior for the spies
    collaborationServiceSpy.startCollaboration.and.returnValue(of(true));
    collaborationServiceSpy.endCollaboration.and.returnValue(of(true));
    collaborationServiceSpy.inviteUser.and.returnValue(of(true));
    collaborationServiceSpy.removeUser.and.returnValue(of(true));
    collaborationServiceSpy.updateUserRole.and.returnValue(of(true));
    collaborationServiceSpy.hasPermission.and.returnValue(true);

    // Set up the observable properties
    collaborationServiceSpy.isCollaborating$ = of(false);
    collaborationServiceSpy.collaborationUsers$ = of([]);

    loggerServiceSpy = jasmine.createSpyObj<LoggerService>('LoggerService', ['info', 'error']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, MatDialogModule, DfdCollaborationComponent],
      providers: [
        { provide: DfdCollaborationService, useValue: collaborationServiceSpy },
        { provide: LoggerService, useValue: loggerServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DfdCollaborationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle collaboration when button is clicked', () => {
    // Start with collaboration off
    component.isCollaborating = false;

    // Call the toggle method
    component.toggleCollaboration();

    // Should call startCollaboration
    expect(collaborationServiceSpy.startCollaboration).toHaveBeenCalled();

    // Now set collaboration to on
    component.isCollaborating = true;

    // Call the toggle method again
    component.toggleCollaboration();

    // Should call endCollaboration
    expect(collaborationServiceSpy.endCollaboration).toHaveBeenCalled();
  });

  it('should invite a user when inviteUser is called with valid email', () => {
    // Set up the test data
    component.inviteEmail = 'test@example.com';
    component.inviteRole = 'writer';

    // Call the method
    component.inviteUser();

    // Verify the service was called with the correct parameters
    expect(collaborationServiceSpy.inviteUser).toHaveBeenCalledWith('test@example.com', 'writer');

    // Verify the email field is reset
    expect(component.inviteEmail).toBe('');
  });

  it('should not invite a user when inviteUser is called with empty email', () => {
    // Set up the test data
    component.inviteEmail = '';
    component.inviteRole = 'writer';

    // Call the method
    component.inviteUser();

    // Verify the service was not called
    expect(collaborationServiceSpy.inviteUser).not.toHaveBeenCalled();
  });

  it('should remove a user when removeUser is called', () => {
    // Call the method
    component.removeUser('user-123');

    // Verify the service was called with the correct parameter
    expect(collaborationServiceSpy.removeUser).toHaveBeenCalledWith('user-123');
  });

  it('should update a user role when updateUserRole is called', () => {
    // Call the method
    component.updateUserRole('user-123', 'reader');

    // Verify the service was called with the correct parameters
    expect(collaborationServiceSpy.updateUserRole).toHaveBeenCalledWith('user-123', 'reader');
  });

  it('should check permissions correctly', () => {
    // Set up the spy to return different values for different permissions
    const permissionFn = (permission: string): boolean => {
      if (permission === 'edit') return true;
      if (permission === 'invite') return true;
      if (permission === 'remove') return false;
      if (permission === 'changeRole') return false;
      return false;
    };

    // Use arrow function to avoid unbound method lint error
    collaborationServiceSpy.hasPermission.and.callFake(permissionFn);

    // Check each permission
    expect(component.hasPermission('edit')).toBe(true);
    expect(component.hasPermission('invite')).toBe(true);
    expect(component.hasPermission('remove')).toBe(false);
    expect(component.hasPermission('changeRole')).toBe(false);
  });

  it('should return correct status colors', () => {
    expect(component.getStatusColor('active')).toBe('status-active');
    expect(component.getStatusColor('idle')).toBe('status-idle');
    expect(component.getStatusColor('disconnected')).toBe('status-disconnected');
  });

  it('should return correct role display names', () => {
    expect(component.getRoleDisplayName('owner')).toBe('Owner');
    expect(component.getRoleDisplayName('writer')).toBe('Writer');
    expect(component.getRoleDisplayName('reader')).toBe('Reader');
  });
});
