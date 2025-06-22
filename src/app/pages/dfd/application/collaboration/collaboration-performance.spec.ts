/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { firstValueFrom, take } from 'rxjs';

import { CollaborationApplicationService } from './collaboration-application.service';
import { User } from '../../domain/collaboration/user';
import {
  UserPresence,
  PresenceStatus,
  UserActivity,
} from '../../domain/collaboration/user-presence';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { NodeData } from '../../domain/value-objects/node-data';
import { Point } from '../../domain/value-objects/point';

// Import testing utilities
import { waitForAsync } from '../../../../../testing/async-utils';

describe('CollaborationApplicationService - Performance Benchmarks', () => {
  let service: CollaborationApplicationService;

  beforeEach(() => {
    service = new CollaborationApplicationService();
  });

  afterEach(() => {
    service.dispose();
    vi.clearAllMocks();
  });

  describe('Session Creation Performance', () => {
    it('should create sessions efficiently at scale', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const sessionCount = 100;
        const testUser = User.create('test-user', 'Test User', 'test@example.com');
        service.setCurrentUser(testUser);

        const startTime = performance.now();
        let createdCount = 0;

        const createNextSession = () => {
          if (createdCount >= sessionCount) {
            const endTime = performance.now();
            const duration = endTime - startTime;
            const avgTimePerSession = duration / sessionCount;

            // Performance assertions
            expect(duration).toBeLessThan(5000); // Total time under 5 seconds
            expect(avgTimePerSession).toBeLessThan(50); // Average under 50ms per session
            expect(service.getActiveSessions()).toHaveLength(sessionCount);

            console.log(`Created ${sessionCount} sessions in ${duration.toFixed(2)}ms`);
            console.log(`Average time per session: ${avgTimePerSession.toFixed(2)}ms`);
            resolve();
            return;
          }

          const sessionId = `session-${createdCount}`;
          const diagramId = `diagram-${createdCount}`;

          service.createSession(sessionId, diagramId, testUser).subscribe({
            next: () => {
              createdCount++;
              // Use setTimeout to avoid stack overflow
              setTimeout(createNextSession, 0);
            },
            error: reject,
          });
        };

        createNextSession();
      });
    }));

    it('should handle concurrent session creation', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const concurrentSessions = 50;
        const testUser = User.create('test-user', 'Test User', 'test@example.com');
        service.setCurrentUser(testUser);

        const startTime = performance.now();
        const sessionPromises: Promise<any>[] = [];

        for (let i = 0; i < concurrentSessions; i++) {
          const sessionId = `concurrent-session-${i}`;
          const diagramId = `concurrent-diagram-${i}`;

          sessionPromises.push(
            firstValueFrom(service.createSession(sessionId, diagramId, testUser)),
          );
        }

        Promise.all(sessionPromises)
          .then(() => {
            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(3000); // Under 3 seconds for concurrent creation
            expect(service.getActiveSessions()).toHaveLength(concurrentSessions);

            console.log(
              `Created ${concurrentSessions} concurrent sessions in ${duration.toFixed(2)}ms`,
            );
            resolve();
          })
          .catch(reject);
      });
    }));
  });

  describe('User Management Performance', () => {
    it('should handle large numbers of users joining sessions', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const userCount = 200;
        const sessionId = 'large-user-session';
        const diagramId = 'large-user-diagram';

        const creator = User.create('creator', 'Creator', 'creator@example.com');
        service.setCurrentUser(creator);

        service.createSession(sessionId, diagramId, creator).subscribe({
          next: () => {
            const users: User[] = [];
            for (let i = 0; i < userCount; i++) {
              users.push(User.create(`user-${i}`, `User ${i}`, `user${i}@example.com`));
            }

            const startTime = performance.now();
            let joinedCount = 0;

            const joinNextUser = () => {
              if (joinedCount >= userCount) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                const avgTimePerJoin = duration / userCount;

                expect(duration).toBeLessThan(10000); // Under 10 seconds total
                expect(avgTimePerJoin).toBeLessThan(50); // Under 50ms per join

                const session = service.getSession(sessionId);
                expect(session?.participantCount).toBe(userCount + 1); // +1 for creator

                console.log(`${userCount} users joined in ${duration.toFixed(2)}ms`);
                console.log(`Average time per join: ${avgTimePerJoin.toFixed(2)}ms`);
                resolve();
                return;
              }

              service.joinSession(sessionId, users[joinedCount]).subscribe({
                next: () => {
                  joinedCount++;
                  setTimeout(joinNextUser, 0);
                },
                error: reject,
              });
            };

            joinNextUser();
          },
          error: reject,
        });
      });
    }));

    it('should efficiently update presence for many users', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const userCount = 100;
        const sessionId = 'presence-performance-session';
        const diagramId = 'presence-performance-diagram';

        const creator = User.create('creator', 'Creator', 'creator@example.com');
        service.setCurrentUser(creator);

        service.createSession(sessionId, diagramId, creator).subscribe({
          next: () => {
            const users: User[] = [];
            for (let i = 0; i < userCount; i++) {
              users.push(User.create(`user-${i}`, `User ${i}`, `user${i}@example.com`));
            }

            // Join all users first
            let joinedCount = 0;
            const joinNextUser = () => {
              if (joinedCount >= userCount) {
                // Now test presence updates
                const startTime = performance.now();
                let updatedCount = 0;

                const updateNextPresence = () => {
                  if (updatedCount >= userCount) {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    const avgTimePerUpdate = duration / userCount;

                    expect(duration).toBeLessThan(5000); // Under 5 seconds
                    expect(avgTimePerUpdate).toBeLessThan(50); // Under 50ms per update

                    console.log(
                      `Updated presence for ${userCount} users in ${duration.toFixed(2)}ms`,
                    );
                    console.log(`Average time per update: ${avgTimePerUpdate.toFixed(2)}ms`);
                    resolve();
                    return;
                  }

                  const presence = UserPresence.createInitial(users[updatedCount])
                    .withStatus(PresenceStatus.ONLINE)
                    .withActivity(UserActivity.EDITING);

                  service.updateUserPresence(`user-${updatedCount}`, presence).subscribe({
                    next: () => {
                      updatedCount++;
                      setTimeout(updateNextPresence, 0);
                    },
                    error: reject,
                  });
                };

                updateNextPresence();
                return;
              }

              service.joinSession(sessionId, users[joinedCount]).subscribe({
                next: () => {
                  joinedCount++;
                  setTimeout(joinNextUser, 0);
                },
                error: reject,
              });
            };

            joinNextUser();
          },
          error: reject,
        });
      });
    }));
  });

  describe('Command Execution Performance', () => {
    it('should handle rapid command execution', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const commandCount = 500;
        const sessionId = 'command-performance-session';
        const diagramId = 'command-performance-diagram';

        const testUser = User.create('test-user', 'Test User', 'test@example.com');
        service.setCurrentUser(testUser);

        service.createSession(sessionId, diagramId, testUser).subscribe({
          next: () => {
            const startTime = performance.now();
            let executedCount = 0;

            const executeNextCommand = () => {
              if (executedCount >= commandCount) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                const avgTimePerCommand = duration / commandCount;

                expect(duration).toBeLessThan(15000); // Under 15 seconds
                expect(avgTimePerCommand).toBeLessThan(30); // Under 30ms per command

                console.log(`Executed ${commandCount} commands in ${duration.toFixed(2)}ms`);
                console.log(`Average time per command: ${avgTimePerCommand.toFixed(2)}ms`);
                resolve();
                return;
              }

              const nodeId = `node-${executedCount}`;
              const position = new Point(Math.random() * 1000, Math.random() * 1000);
              const nodeData = NodeData.createDefault(nodeId, 'process', position);
              const command = DiagramCommandFactory.addNode(
                diagramId,
                testUser.id,
                nodeId,
                position,
                nodeData,
              );

              service.executeCollaborativeCommand(command).subscribe({
                next: () => {
                  executedCount++;
                  setTimeout(executeNextCommand, 0);
                },
                error: reject,
              });
            };

            executeNextCommand();
          },
          error: reject,
        });
      });
    }));

    it('should handle concurrent command execution from multiple users', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const userCount = 10;
        const commandsPerUser = 20;
        const totalCommands = userCount * commandsPerUser;
        const sessionId = 'concurrent-command-session';
        const diagramId = 'concurrent-command-diagram';

        const creator = User.create('creator', 'Creator', 'creator@example.com');
        service.setCurrentUser(creator);

        service.createSession(sessionId, diagramId, creator).subscribe({
          next: () => {
            const users: User[] = [];
            for (let i = 0; i < userCount; i++) {
              users.push(User.create(`user-${i}`, `User ${i}`, `user${i}@example.com`));
            }

            // Join all users first
            const joinPromises = users.map(user =>
              firstValueFrom(service.joinSession(sessionId, user)),
            );

            Promise.all(joinPromises)
              .then(() => {
                const startTime = performance.now();
                const commandPromises: Promise<any>[] = [];

                // Create concurrent commands from all users
                for (let userIndex = 0; userIndex < userCount; userIndex++) {
                  for (let cmdIndex = 0; cmdIndex < commandsPerUser; cmdIndex++) {
                    const nodeId = `node-${userIndex}-${cmdIndex}`;
                    const position = new Point(
                      userIndex * 100 + Math.random() * 50,
                      cmdIndex * 50 + Math.random() * 25,
                    );
                    const nodeData = NodeData.createDefault(nodeId, 'process', position);
                    const command = DiagramCommandFactory.addNode(
                      diagramId,
                      users[userIndex].id,
                      nodeId,
                      position,
                      nodeData,
                    );

                    commandPromises.push(
                      firstValueFrom(service.executeCollaborativeCommand(command)),
                    );
                  }
                }

                Promise.all(commandPromises)
                  .then(() => {
                    const endTime = performance.now();
                    const duration = endTime - startTime;
                    const avgTimePerCommand = duration / totalCommands;

                    expect(duration).toBeLessThan(20000); // Under 20 seconds
                    expect(avgTimePerCommand).toBeLessThan(100); // Under 100ms per command

                    console.log(
                      `Executed ${totalCommands} concurrent commands in ${duration.toFixed(2)}ms`,
                    );
                    console.log(`Average time per command: ${avgTimePerCommand.toFixed(2)}ms`);
                    resolve();
                  })
                  .catch(reject);
              })
              .catch(reject);
          },
          error: reject,
        });
      });
    }));
  });

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage with large sessions', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const sessionCount = 50;
        const usersPerSession = 20;

        const creator = User.create('creator', 'Creator', 'creator@example.com');
        service.setCurrentUser(creator);

        let createdSessions = 0;
        const createNextSession = () => {
          if (createdSessions >= sessionCount) {
            // Measure memory usage (approximate)
            const activeSessions = service.getActiveSessions();
            expect(activeSessions).toHaveLength(sessionCount);

            // Each session should have the expected number of participants
            activeSessions.forEach(session => {
              expect(session.participantCount).toBe(usersPerSession + 1); // +1 for creator
            });

            console.log(`Created ${sessionCount} sessions with ${usersPerSession} users each`);
            console.log(`Total active sessions: ${activeSessions.length}`);
            console.log(
              `Total participants across all sessions: ${activeSessions.reduce((sum, s) => sum + s.participantCount, 0)}`,
            );

            resolve();
            return;
          }

          const sessionId = `memory-session-${createdSessions}`;
          const diagramId = `memory-diagram-${createdSessions}`;

          service.createSession(sessionId, diagramId, creator).subscribe({
            next: () => {
              // Add users to this session
              const users: User[] = [];
              for (let i = 0; i < usersPerSession; i++) {
                users.push(
                  User.create(`user-${createdSessions}-${i}`, `User ${i}`, `user${i}@example.com`),
                );
              }

              let joinedUsers = 0;
              const joinNextUser = () => {
                if (joinedUsers >= usersPerSession) {
                  createdSessions++;
                  setTimeout(createNextSession, 0);
                  return;
                }

                service.joinSession(sessionId, users[joinedUsers]).subscribe({
                  next: () => {
                    joinedUsers++;
                    setTimeout(joinNextUser, 0);
                  },
                  error: reject,
                });
              };

              joinNextUser();
            },
            error: reject,
          });
        };

        createNextSession();
      });
    }));

    it('should cleanup resources efficiently', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const sessionCount = 30;
        const creator = User.create('creator', 'Creator', 'creator@example.com');
        service.setCurrentUser(creator);

        // Create sessions
        let createdCount = 0;
        const createNextSession = () => {
          if (createdCount >= sessionCount) {
            expect(service.getActiveSessions()).toHaveLength(sessionCount);

            // Now test cleanup performance
            const startTime = performance.now();

            // Leave all sessions to trigger cleanup
            service.leaveSession(creator.id).subscribe({
              next: () => {
                // Force cleanup
                service.cleanupInactiveSessions(0);

                const endTime = performance.now();
                const duration = endTime - startTime;

                expect(service.getActiveSessions()).toHaveLength(0);
                expect(duration).toBeLessThan(1000); // Cleanup should be fast

                console.log(`Cleaned up ${sessionCount} sessions in ${duration.toFixed(2)}ms`);
                resolve();
              },
              error: reject,
            });
            return;
          }

          const sessionId = `cleanup-session-${createdCount}`;
          const diagramId = `cleanup-diagram-${createdCount}`;

          service.createSession(sessionId, diagramId, creator).subscribe({
            next: () => {
              createdCount++;
              setTimeout(createNextSession, 0);
            },
            error: reject,
          });
        };

        createNextSession();
      });
    }));
  });

  describe('Observable Performance', () => {
    it('should handle high-frequency observable emissions efficiently', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const sessionId = 'observable-performance-session';
        const diagramId = 'observable-performance-diagram';
        const updateCount = 1000;

        const testUser = User.create('test-user', 'Test User', 'test@example.com');
        service.setCurrentUser(testUser);

        service.createSession(sessionId, diagramId, testUser).subscribe({
          next: () => {
            let receivedEvents = 0;
            const startTime = performance.now();

            // Subscribe to events
            service.collaborationEvents$.subscribe(() => {
              receivedEvents++;
              if (receivedEvents >= updateCount) {
                const endTime = performance.now();
                const duration = endTime - startTime;
                const avgTimePerEvent = duration / updateCount;

                expect(duration).toBeLessThan(5000); // Under 5 seconds
                expect(avgTimePerEvent).toBeLessThan(5); // Under 5ms per event

                console.log(`Processed ${updateCount} events in ${duration.toFixed(2)}ms`);
                console.log(`Average time per event: ${avgTimePerEvent.toFixed(2)}ms`);
                resolve();
              }
            });

            // Generate rapid updates
            let updatesSent = 0;
            const sendNextUpdate = () => {
              if (updatesSent >= updateCount) {
                return;
              }

              const presence = UserPresence.createInitial(testUser)
                .withStatus(PresenceStatus.ONLINE)
                .withActivity(updatesSent % 2 === 0 ? UserActivity.EDITING : UserActivity.VIEWING);

              service.updateUserPresence(testUser.id, presence).subscribe({
                next: () => {
                  updatesSent++;
                  if (updatesSent < updateCount) {
                    setTimeout(sendNextUpdate, 0);
                  }
                },
                error: reject,
              });
            };

            sendNextUpdate();
          },
          error: reject,
        });
      });
    }));
  });
});
