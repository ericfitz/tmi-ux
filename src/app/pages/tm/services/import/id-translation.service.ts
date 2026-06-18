import { Injectable } from '@angular/core';

/**
 * Service for tracking ID translations during threat model import.
 * Maps original IDs from imported JSON to new server-assigned IDs.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: map imported entity ids to server-assigned ids across all entity types during import (mutates shared state)
export class IdTranslationService {
  private _threatModelIdMap = new Map<string, string>();
  private _assetIdMap = new Map<string, string>();
  private _noteIdMap = new Map<string, string>();
  private _diagramIdMap = new Map<string, string>();
  private _threatIdMap = new Map<string, string>();
  private _documentIdMap = new Map<string, string>();
  private _repositoryIdMap = new Map<string, string>();

  /**
   * Clears all ID mappings. Should be called at the start of each import.
   */
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: clear all entity id mappings before a new import run (mutates shared state)
  reset(): void {
    this._threatModelIdMap.clear();
    this._assetIdMap.clear();
    this._noteIdMap.clear();
    this._diagramIdMap.clear();
    this._threatIdMap.clear();
    this._documentIdMap.clear();
    this._repositoryIdMap.clear();
  }

  // Threat Model ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the mapping from an imported threat model id to its server-assigned id (mutates shared state)
  setThreatModelId(oldId: string, newId: string): void {
    this._threatModelIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned threat model id for a given imported id (pure)
  getThreatModelId(oldId: string): string | undefined {
    return this._threatModelIdMap.get(oldId);
  }

  // Asset ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the mapping from an imported asset id to its server-assigned id (mutates shared state)
  setAssetId(oldId: string, newId: string): void {
    this._assetIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned asset ID for an original imported ID (pure)
  getAssetId(oldId: string): string | undefined {
    return this._assetIdMap.get(oldId);
  }

  // Note ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the old-to-new note ID mapping after import (mutates shared state)
  setNoteId(oldId: string, newId: string): void {
    this._noteIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned note ID for an original imported ID (pure)
  getNoteId(oldId: string): string | undefined {
    return this._noteIdMap.get(oldId);
  }

  // Diagram ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the old-to-new diagram ID mapping after import (mutates shared state)
  setDiagramId(oldId: string, newId: string): void {
    this._diagramIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned diagram ID for an original imported ID (pure)
  getDiagramId(oldId: string): string | undefined {
    return this._diagramIdMap.get(oldId);
  }

  // Threat ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the old-to-new threat ID mapping after import (mutates shared state)
  setThreatId(oldId: string, newId: string): void {
    this._threatIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned threat ID for an original imported ID (pure)
  getThreatId(oldId: string): string | undefined {
    return this._threatIdMap.get(oldId);
  }

  // Document ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the old-to-new document ID mapping after import (mutates shared state)
  setDocumentId(oldId: string, newId: string): void {
    this._documentIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned document ID for an original imported ID (pure)
  getDocumentId(oldId: string): string | undefined {
    return this._documentIdMap.get(oldId);
  }

  // Repository ID mappings
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: store the old-to-new repository ID mapping after import (mutates shared state)
  setRepositoryId(oldId: string, newId: string): void {
    this._repositoryIdMap.set(oldId, newId);
  }

  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: fetch the server-assigned repository ID for an original imported ID (pure)
  getRepositoryId(oldId: string): string | undefined {
    return this._repositoryIdMap.get(oldId);
  }

  /**
   * Get import statistics for debugging/logging
   */
  // SEM@6a4147f1cdd39d730dcaa36b63b6eb46b181e330: aggregate counts of all mapped entity IDs for debugging (pure)
  getStats(): {
    threatModels: number;
    assets: number;
    notes: number;
    diagrams: number;
    threats: number;
    documents: number;
    repositories: number;
  } {
    return {
      threatModels: this._threatModelIdMap.size,
      assets: this._assetIdMap.size,
      notes: this._noteIdMap.size,
      diagrams: this._diagramIdMap.size,
      threats: this._threatIdMap.size,
      documents: this._documentIdMap.size,
      repositories: this._repositoryIdMap.size,
    };
  }
}
