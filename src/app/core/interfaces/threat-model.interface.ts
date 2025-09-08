import { Observable } from 'rxjs';
import { CollaborationSession } from '../services/dfd-collaboration.service';

/**
 * Interface for threat model service used by core services
 * This interface prevents core services from directly importing feature modules
 */
export interface IThreatModelService {
  /**
   * Get current collaboration session for a diagram
   */
  getDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession | null>;

  /**
   * Create a new collaboration session for a diagram
   */
  createDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession>;

  /**
   * Start a new collaboration session for a diagram
   */
  startDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession>;

  /**
   * Smart method to start a new session or join existing one
   */
  startOrJoinDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<{ session: CollaborationSession; isNewSession: boolean }>;

  /**
   * End a collaboration session for a diagram
   */
  endDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<void>;
}
