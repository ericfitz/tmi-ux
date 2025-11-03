import { Injectable } from '@angular/core';

/**
 * Service for tracking ID translations during threat model import.
 * Maps original IDs from imported JSON to new server-assigned IDs.
 */
@Injectable({
  providedIn: 'root',
})
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
  setThreatModelId(oldId: string, newId: string): void {
    this._threatModelIdMap.set(oldId, newId);
  }

  getThreatModelId(oldId: string): string | undefined {
    return this._threatModelIdMap.get(oldId);
  }

  // Asset ID mappings
  setAssetId(oldId: string, newId: string): void {
    this._assetIdMap.set(oldId, newId);
  }

  getAssetId(oldId: string): string | undefined {
    return this._assetIdMap.get(oldId);
  }

  // Note ID mappings
  setNoteId(oldId: string, newId: string): void {
    this._noteIdMap.set(oldId, newId);
  }

  getNoteId(oldId: string): string | undefined {
    return this._noteIdMap.get(oldId);
  }

  // Diagram ID mappings
  setDiagramId(oldId: string, newId: string): void {
    this._diagramIdMap.set(oldId, newId);
  }

  getDiagramId(oldId: string): string | undefined {
    return this._diagramIdMap.get(oldId);
  }

  // Threat ID mappings
  setThreatId(oldId: string, newId: string): void {
    this._threatIdMap.set(oldId, newId);
  }

  getThreatId(oldId: string): string | undefined {
    return this._threatIdMap.get(oldId);
  }

  // Document ID mappings
  setDocumentId(oldId: string, newId: string): void {
    this._documentIdMap.set(oldId, newId);
  }

  getDocumentId(oldId: string): string | undefined {
    return this._documentIdMap.get(oldId);
  }

  // Repository ID mappings
  setRepositoryId(oldId: string, newId: string): void {
    this._repositoryIdMap.set(oldId, newId);
  }

  getRepositoryId(oldId: string): string | undefined {
    return this._repositoryIdMap.get(oldId);
  }

  /**
   * Get import statistics for debugging/logging
   */
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
