import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { TmEditFormattingService } from './tm-edit-formatting.service';

describe('TmEditFormattingService', () => {
  let service: TmEditFormattingService;

  beforeEach(() => {
    service = new TmEditFormattingService(
      { warn: () => {}, debugComponent: () => {} } as never,
      { translate: (k: string) => k } as never,
    );
  });

  describe('getMimeTypeForFormat', () => {
    it('maps json to application/json', () => {
      expect(service.getMimeTypeForFormat('json')).toBe('application/json');
    });
    it('maps yaml to application/x-yaml', () => {
      expect(service.getMimeTypeForFormat('yaml')).toBe('application/x-yaml');
    });
    it('maps graphml to application/xml', () => {
      expect(service.getMimeTypeForFormat('graphml')).toBe('application/xml');
    });
  });

  describe('getExtensionForFormat', () => {
    it('maps json to .json', () => {
      expect(service.getExtensionForFormat('json')).toBe('.json');
    });
    it('maps yaml to .yaml', () => {
      expect(service.getExtensionForFormat('yaml')).toBe('.yaml');
    });
    it('maps graphml to .graphml', () => {
      expect(service.getExtensionForFormat('graphml')).toBe('.graphml');
    });
  });

  describe('getTruncatedUrl', () => {
    it('returns empty string for empty input', () => {
      expect(service.getTruncatedUrl('')).toBe('');
    });
    it('strips protocol and www prefix', () => {
      expect(service.getTruncatedUrl('https://www.example.com/x')).toBe('example.com/x');
    });
    it('truncates URLs longer than 40 chars with ellipsis', () => {
      const long = 'https://example.com/' + 'a'.repeat(60);
      const result = service.getTruncatedUrl(long);
      expect(result.length).toBe(40);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('getDiagramIcon', () => {
    it('returns graph_3 for a DFD diagram type', () => {
      expect(service.getDiagramIcon({ type: 'DFD-1.0' } as never)).toBe('graph_3');
    });
    it('returns fallback icon when type is missing', () => {
      expect(service.getDiagramIcon({} as never)).toBe('indeterminate_question_box');
    });
    it('returns fallback icon for unrecognized type', () => {
      expect(service.getDiagramIcon({ type: 'XYZ' } as never)).toBe('indeterminate_question_box');
    });
  });

  describe('getDiagramTooltip', () => {
    it('returns the diagram type when present', () => {
      expect(service.getDiagramTooltip({ type: 'DFD-1.0' } as never)).toBe('DFD-1.0');
    });
    it('returns Unknown Type when type is missing', () => {
      expect(service.getDiagramTooltip({} as never)).toBe('Unknown Type');
    });
  });

  describe('getAssetTypeIcon', () => {
    it('returns diamond for undefined type', () => {
      expect(service.getAssetTypeIcon(undefined)).toBe('diamond');
    });
    it('maps known asset types to icons', () => {
      expect(service.getAssetTypeIcon('data')).toBe('database');
      expect(service.getAssetTypeIcon('software')).toBe('deployed_code');
      expect(service.getAssetTypeIcon('personnel')).toBe('person');
    });
    it('returns diamond for unknown type', () => {
      expect(service.getAssetTypeIcon('mystery')).toBe('diamond');
    });
  });

  describe('generateDiagramModelFilename', () => {
    it('builds {model}-{diagram}-model{ext} and sanitizes unsafe chars', () => {
      expect(service.generateDiagramModelFilename('My TM', 'Flow:1', '.json')).toBe(
        'My-TM-Flow-1-model.json',
      );
    });
    it('falls back to ThreatModel when the model name is blank', () => {
      expect(service.generateDiagramModelFilename('   ', 'Flow', '.yaml')).toBe(
        'ThreatModel-Flow-model.yaml',
      );
    });
    it('truncates each part to 40 chars', () => {
      const result = service.generateDiagramModelFilename('a'.repeat(60), 'b'.repeat(60), '.json');
      expect(result).toBe('a'.repeat(40) + '-' + 'b'.repeat(40) + '-model.json');
    });
  });
});
