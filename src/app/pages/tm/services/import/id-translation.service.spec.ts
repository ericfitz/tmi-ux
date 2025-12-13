// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { IdTranslationService } from './id-translation.service';

describe('IdTranslationService', () => {
  let service: IdTranslationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new IdTranslationService();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty stats', () => {
      const stats = service.getStats();

      expect(stats).toEqual({
        threatModels: 0,
        assets: 0,
        notes: 0,
        diagrams: 0,
        threats: 0,
        documents: 0,
        repositories: 0,
      });
    });
  });

  describe('reset()', () => {
    it('should clear all ID mappings', () => {
      // Set some mappings
      service.setThreatModelId('old-tm-1', 'new-tm-1');
      service.setAssetId('old-asset-1', 'new-asset-1');
      service.setNoteId('old-note-1', 'new-note-1');
      service.setDiagramId('old-diagram-1', 'new-diagram-1');
      service.setThreatId('old-threat-1', 'new-threat-1');
      service.setDocumentId('old-doc-1', 'new-doc-1');
      service.setRepositoryId('old-repo-1', 'new-repo-1');

      // Verify mappings exist
      expect(service.getStats().threatModels).toBe(1);
      expect(service.getStats().assets).toBe(1);

      // Reset
      service.reset();

      // Verify all cleared
      const stats = service.getStats();
      expect(stats).toEqual({
        threatModels: 0,
        assets: 0,
        notes: 0,
        diagrams: 0,
        threats: 0,
        documents: 0,
        repositories: 0,
      });
    });

    it('should clear all mappings and return undefined for old IDs', () => {
      service.setThreatModelId('old-tm-1', 'new-tm-1');
      service.setAssetId('old-asset-1', 'new-asset-1');

      service.reset();

      expect(service.getThreatModelId('old-tm-1')).toBeUndefined();
      expect(service.getAssetId('old-asset-1')).toBeUndefined();
    });
  });

  describe('Threat Model ID Mappings', () => {
    it('should set and get threat model ID mapping', () => {
      service.setThreatModelId('old-tm-1', 'new-tm-1');

      expect(service.getThreatModelId('old-tm-1')).toBe('new-tm-1');
    });

    it('should return undefined for unmapped threat model ID', () => {
      expect(service.getThreatModelId('non-existent')).toBeUndefined();
    });

    it('should update existing threat model ID mapping', () => {
      service.setThreatModelId('old-tm-1', 'new-tm-1');
      service.setThreatModelId('old-tm-1', 'updated-tm-1');

      expect(service.getThreatModelId('old-tm-1')).toBe('updated-tm-1');
      expect(service.getStats().threatModels).toBe(1);
    });

    it('should handle multiple threat model ID mappings', () => {
      service.setThreatModelId('old-tm-1', 'new-tm-1');
      service.setThreatModelId('old-tm-2', 'new-tm-2');

      expect(service.getThreatModelId('old-tm-1')).toBe('new-tm-1');
      expect(service.getThreatModelId('old-tm-2')).toBe('new-tm-2');
      expect(service.getStats().threatModels).toBe(2);
    });
  });

  describe('Asset ID Mappings', () => {
    it('should set and get asset ID mapping', () => {
      service.setAssetId('old-asset-1', 'new-asset-1');

      expect(service.getAssetId('old-asset-1')).toBe('new-asset-1');
    });

    it('should return undefined for unmapped asset ID', () => {
      expect(service.getAssetId('non-existent')).toBeUndefined();
    });

    it('should update existing asset ID mapping', () => {
      service.setAssetId('old-asset-1', 'new-asset-1');
      service.setAssetId('old-asset-1', 'updated-asset-1');

      expect(service.getAssetId('old-asset-1')).toBe('updated-asset-1');
      expect(service.getStats().assets).toBe(1);
    });

    it('should handle multiple asset ID mappings', () => {
      service.setAssetId('old-asset-1', 'new-asset-1');
      service.setAssetId('old-asset-2', 'new-asset-2');
      service.setAssetId('old-asset-3', 'new-asset-3');

      expect(service.getStats().assets).toBe(3);
    });
  });

  describe('Note ID Mappings', () => {
    it('should set and get note ID mapping', () => {
      service.setNoteId('old-note-1', 'new-note-1');

      expect(service.getNoteId('old-note-1')).toBe('new-note-1');
    });

    it('should return undefined for unmapped note ID', () => {
      expect(service.getNoteId('non-existent')).toBeUndefined();
    });

    it('should handle multiple note ID mappings', () => {
      service.setNoteId('old-note-1', 'new-note-1');
      service.setNoteId('old-note-2', 'new-note-2');

      expect(service.getStats().notes).toBe(2);
    });
  });

  describe('Diagram ID Mappings', () => {
    it('should set and get diagram ID mapping', () => {
      service.setDiagramId('old-diagram-1', 'new-diagram-1');

      expect(service.getDiagramId('old-diagram-1')).toBe('new-diagram-1');
    });

    it('should return undefined for unmapped diagram ID', () => {
      expect(service.getDiagramId('non-existent')).toBeUndefined();
    });

    it('should handle multiple diagram ID mappings', () => {
      service.setDiagramId('old-diagram-1', 'new-diagram-1');
      service.setDiagramId('old-diagram-2', 'new-diagram-2');

      expect(service.getStats().diagrams).toBe(2);
    });
  });

  describe('Threat ID Mappings', () => {
    it('should set and get threat ID mapping', () => {
      service.setThreatId('old-threat-1', 'new-threat-1');

      expect(service.getThreatId('old-threat-1')).toBe('new-threat-1');
    });

    it('should return undefined for unmapped threat ID', () => {
      expect(service.getThreatId('non-existent')).toBeUndefined();
    });

    it('should handle multiple threat ID mappings', () => {
      service.setThreatId('old-threat-1', 'new-threat-1');
      service.setThreatId('old-threat-2', 'new-threat-2');

      expect(service.getStats().threats).toBe(2);
    });
  });

  describe('Document ID Mappings', () => {
    it('should set and get document ID mapping', () => {
      service.setDocumentId('old-doc-1', 'new-doc-1');

      expect(service.getDocumentId('old-doc-1')).toBe('new-doc-1');
    });

    it('should return undefined for unmapped document ID', () => {
      expect(service.getDocumentId('non-existent')).toBeUndefined();
    });

    it('should handle multiple document ID mappings', () => {
      service.setDocumentId('old-doc-1', 'new-doc-1');
      service.setDocumentId('old-doc-2', 'new-doc-2');

      expect(service.getStats().documents).toBe(2);
    });
  });

  describe('Repository ID Mappings', () => {
    it('should set and get repository ID mapping', () => {
      service.setRepositoryId('old-repo-1', 'new-repo-1');

      expect(service.getRepositoryId('old-repo-1')).toBe('new-repo-1');
    });

    it('should return undefined for unmapped repository ID', () => {
      expect(service.getRepositoryId('non-existent')).toBeUndefined();
    });

    it('should handle multiple repository ID mappings', () => {
      service.setRepositoryId('old-repo-1', 'new-repo-1');
      service.setRepositoryId('old-repo-2', 'new-repo-2');

      expect(service.getStats().repositories).toBe(2);
    });
  });

  describe('getStats()', () => {
    it('should return accurate counts for all ID types', () => {
      service.setThreatModelId('tm-1', 'new-tm-1');
      service.setAssetId('asset-1', 'new-asset-1');
      service.setAssetId('asset-2', 'new-asset-2');
      service.setNoteId('note-1', 'new-note-1');
      service.setNoteId('note-2', 'new-note-2');
      service.setNoteId('note-3', 'new-note-3');
      service.setDiagramId('diagram-1', 'new-diagram-1');
      service.setThreatId('threat-1', 'new-threat-1');
      service.setThreatId('threat-2', 'new-threat-2');
      service.setDocumentId('doc-1', 'new-doc-1');
      service.setRepositoryId('repo-1', 'new-repo-1');

      const stats = service.getStats();

      expect(stats.threatModels).toBe(1);
      expect(stats.assets).toBe(2);
      expect(stats.notes).toBe(3);
      expect(stats.diagrams).toBe(1);
      expect(stats.threats).toBe(2);
      expect(stats.documents).toBe(1);
      expect(stats.repositories).toBe(1);
    });

    it('should return zeros when no mappings exist', () => {
      const stats = service.getStats();

      expect(stats.threatModels).toBe(0);
      expect(stats.assets).toBe(0);
      expect(stats.notes).toBe(0);
      expect(stats.diagrams).toBe(0);
      expect(stats.threats).toBe(0);
      expect(stats.documents).toBe(0);
      expect(stats.repositories).toBe(0);
    });
  });

  describe('Cross-Type Independence', () => {
    it('should maintain separate mappings for different entity types', () => {
      const sameOldId = 'old-id-1';

      // Use same old ID across different types
      service.setThreatModelId(sameOldId, 'new-tm-1');
      service.setAssetId(sameOldId, 'new-asset-1');
      service.setNoteId(sameOldId, 'new-note-1');

      // Verify each type returns its own mapping
      expect(service.getThreatModelId(sameOldId)).toBe('new-tm-1');
      expect(service.getAssetId(sameOldId)).toBe('new-asset-1');
      expect(service.getNoteId(sameOldId)).toBe('new-note-1');
    });

    it('should not affect other types when updating one type', () => {
      const oldId = 'old-id-1';

      service.setThreatModelId(oldId, 'new-tm-1');
      service.setAssetId(oldId, 'new-asset-1');

      // Update threat model mapping
      service.setThreatModelId(oldId, 'updated-tm-1');

      // Verify only threat model was updated
      expect(service.getThreatModelId(oldId)).toBe('updated-tm-1');
      expect(service.getAssetId(oldId)).toBe('new-asset-1');
    });
  });
});
