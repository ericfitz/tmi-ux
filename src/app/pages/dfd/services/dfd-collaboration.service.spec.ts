import { TestBed } from '@angular/core/testing';
import { take } from 'rxjs/operators';

import { DfdCollaborationService } from './dfd-collaboration.service';
import { LoggerService } from '../../../core/services/logger.service';

describe('DfdCollaborationService', () => {
  let service: DfdCollaborationService;
  let loggerServiceSpy: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    // Create a spy for the logger service
    loggerServiceSpy = jasmine.createSpyObj<LoggerService>('LoggerService', [
      'info',
      'error',
      'warn',
    ]);

    TestBed.configureTestingModule({
      providers: [DfdCollaborationService, { provide: LoggerService, useValue: loggerServiceSpy }],
    });

    service = TestBed.inject(DfdCollaborationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start collaboration', (done: DoneFn) => {
    // Initially, collaboration should be off
    service.isCollaborating$.pipe(take(1)).subscribe(isCollaborating => {
      expect(isCollaborating).toBeFalse();
    });

    // Start collaboration
    service.startCollaboration().subscribe(success => {
      expect(success).toBeTrue();

      // Check that collaboration is now on
      service.isCollaborating$.pipe(take(1)).subscribe(isCollaborating => {
        expect(isCollaborating).toBeTrue();
        done();
      });
    });
  });

  it('should end collaboration', (done: DoneFn) => {
    // Start collaboration first
    service.startCollaboration().subscribe(() => {
      // Then end it
      service.endCollaboration().subscribe(success => {
        expect(success).toBeTrue();

        // Check that collaboration is now off
        service.isCollaborating$.pipe(take(1)).subscribe(isCollaborating => {
          expect(isCollaborating).toBeFalse();
          done();
        });
      });
    });
  });

  it('should invite a user', (done: DoneFn) => {
    // Start collaboration first
    service.startCollaboration().subscribe(() => {
      // Initial user count should be 1 (current user)
      service.collaborationUsers$.pipe(take(1)).subscribe(users => {
        expect(users.length).toBe(1);

        // Invite a new user
        service.inviteUser('test@example.com', 'writer').subscribe(success => {
          expect(success).toBeTrue();

          // Check that the user was added
          service.collaborationUsers$.pipe(take(1)).subscribe(updatedUsers => {
            expect(updatedUsers.length).toBe(2);
            expect(updatedUsers[1].name).toBe('test');
            expect(updatedUsers[1].role).toBe('writer');
            done();
          });
        });
      });
    });
  });

  it('should remove a user', (done: DoneFn) => {
    // Start collaboration and add a user
    service.startCollaboration().subscribe(() => {
      service.inviteUser('test@example.com', 'writer').subscribe(() => {
        // Get the user ID
        service.collaborationUsers$.pipe(take(1)).subscribe(users => {
          const userId = users[1].id;

          // Remove the user
          service.removeUser(userId).subscribe(success => {
            expect(success).toBeTrue();

            // Check that the user was removed
            service.collaborationUsers$.pipe(take(1)).subscribe(updatedUsers => {
              expect(updatedUsers.length).toBe(1);
              expect(updatedUsers[0].id).toBe('current-user');
              done();
            });
          });
        });
      });
    });
  });

  it('should update a user role', (done: DoneFn) => {
    // Start collaboration and add a user
    service.startCollaboration().subscribe(() => {
      service.inviteUser('test@example.com', 'writer').subscribe(() => {
        // Get the user ID
        service.collaborationUsers$.pipe(take(1)).subscribe(users => {
          const userId = users[1].id;

          // Update the user role
          service.updateUserRole(userId, 'reader').subscribe(success => {
            expect(success).toBeTrue();

            // Check that the role was updated
            service.collaborationUsers$.pipe(take(1)).subscribe(updatedUsers => {
              expect(updatedUsers[1].id).toBe(userId);
              expect(updatedUsers[1].role).toBe('reader');
              done();
            });
          });
        });
      });
    });
  });

  it('should check permissions correctly', () => {
    // Start with no permissions
    expect(service.hasPermission('edit')).toBeFalse();
    expect(service.hasPermission('invite')).toBeFalse();
    expect(service.hasPermission('remove')).toBeFalse();
    expect(service.hasPermission('changeRole')).toBeFalse();

    // Mock the getCurrentUserRole method
    spyOn(service, 'getCurrentUserRole').and.returnValue('owner');

    // Owner should have all permissions
    expect(service.hasPermission('edit')).toBeTrue();
    expect(service.hasPermission('invite')).toBeTrue();
    expect(service.hasPermission('remove')).toBeTrue();
    expect(service.hasPermission('changeRole')).toBeTrue();

    // Change to writer
    (service.getCurrentUserRole as jasmine.Spy).and.returnValue('writer');

    // Writer should only have edit permission
    expect(service.hasPermission('edit')).toBeTrue();
    expect(service.hasPermission('invite')).toBeFalse();
    expect(service.hasPermission('remove')).toBeFalse();
    expect(service.hasPermission('changeRole')).toBeFalse();

    // Change to reader
    (service.getCurrentUserRole as jasmine.Spy).and.returnValue('reader');

    // Reader should have no permissions
    expect(service.hasPermission('edit')).toBeFalse();
    expect(service.hasPermission('invite')).toBeFalse();
    expect(service.hasPermission('remove')).toBeFalse();
    expect(service.hasPermission('changeRole')).toBeFalse();
  });
});
