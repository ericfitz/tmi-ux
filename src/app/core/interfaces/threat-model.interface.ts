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
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: fetch the current collaboration session for a diagram, or null if none exists
  getDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession | null>;

  /**
   * Create a new collaboration session for a diagram
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: build a new collaboration session for a diagram and return it
  createDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession>;

  /**
   * Start a new collaboration session for a diagram
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: start a new collaboration session for a diagram and return it
  startDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<CollaborationSession>;

  /**
   * Smart method to start a new session or join existing one
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: start or join a diagram collaboration session, indicating whether it is new
  startOrJoinDiagramCollaborationSession(
    threatModelId: string,
    diagramId: string,
  ): Observable<{ session: CollaborationSession; isNewSession: boolean }>;

  /**
   * End a collaboration session for a diagram
   */
  // SEM@8ad43e58ae86a57581df9b84b3533a52b4228ae8: delete the active collaboration session for a diagram
  endDiagramCollaborationSession(threatModelId: string, diagramId: string): Observable<void>;
}
