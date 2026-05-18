import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { TmEditFormattingService } from './tm-edit-formatting.service';

describe('TmEditFormattingService', () => {
  let service: TmEditFormattingService;

  beforeEach(() => {
    service = new TmEditFormattingService(
      { warn: () => {}, debugComponent: () => {} } as never,
      {
        translate: (k: string) => k,
        getAvailableLangs: () => [],
        getTranslation: () => ({}),
      } as never,
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

  describe('getRepositoryTooltip', () => {
    it('returns just the uri when there is no description or parameters', () => {
      expect(service.getRepositoryTooltip({ uri: 'http://x' } as never)).toBe('http://x');
    });
    it('appends description and parameters', () => {
      const tip = service.getRepositoryTooltip({
        uri: 'http://x',
        description: 'desc',
        parameters: { refType: 'branch', refValue: 'main', subPath: 'src' },
      } as never);
      expect(tip).toBe('http://x\n\ndesc\n\nbranch: main\nPath: src');
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

  describe('isValidBase64Svg', () => {
    const toB64 = (s: string): string => Buffer.from(s, 'utf-8').toString('base64');

    it('returns false for empty input', () => {
      expect(service.isValidBase64Svg('')).toBe(false);
    });
    it('returns true for a well-formed base64 SVG', () => {
      expect(service.isValidBase64Svg(toB64('<svg><rect/></svg>'))).toBe(true);
    });
    it('returns true when content starts with an XML declaration', () => {
      expect(service.isValidBase64Svg(toB64('<?xml version="1.0"?><svg></svg>'))).toBe(true);
    });
    it('returns false when content does not start with <svg or <?xml', () => {
      expect(service.isValidBase64Svg(toB64('<div><svg></svg></div>'))).toBe(false);
    });
    it('returns false when the closing </svg> tag is missing', () => {
      expect(service.isValidBase64Svg(toB64('<svg><rect/>'))).toBe(false);
    });
    it('returns false for invalid base64 input', () => {
      expect(service.isValidBase64Svg('not valid base64 !!!')).toBe(false);
    });
    it('returns false when an xml-declared document lacks an <svg> tag', () => {
      expect(service.isValidBase64Svg(toB64('<?xml version="1.0"?><root></root>'))).toBe(false);
    });
  });

  describe('getThreatSeverityClass', () => {
    it('returns severity-unknown for null/undefined', () => {
      expect(service.getThreatSeverityClass(null)).toBe('severity-unknown');
      expect(service.getThreatSeverityClass(undefined)).toBe('severity-unknown');
    });
    it('prefixes a camelCase key with severity-', () => {
      expect(service.getThreatSeverityClass('high')).toBe('severity-high');
    });
    it('migrates a numeric-key severity through migrateFieldValue', () => {
      expect(service.getThreatSeverityClass('0')).toBe('severity-critical');
    });
    it('returns severity-unknown for an unmapped value', () => {
      expect(service.getThreatSeverityClass('bogus')).toBe('severity-unknown');
    });
  });

  describe('migrateThreatFieldValues', () => {
    it('migrates numeric-key severity to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ severity: '0' } as never);
      expect(result.severity).toBe('critical');
    });
    it('migrates legacy English severity strings', () => {
      const result = service.migrateThreatFieldValues({ severity: 'High' } as never);
      expect(result.severity).toBe('high');
    });
    it('migrates numeric-key status to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ status: '2' } as never);
      expect(result.status).toBe('mitigation_planned');
    });
    it('migrates numeric-key priority to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ priority: '0' } as never);
      expect(result.priority).toBe('immediate');
    });
    it('leaves an already-migrated value unchanged', () => {
      const result = service.migrateThreatFieldValues({ severity: 'low' } as never);
      expect(result.severity).toBe('low');
    });
    it('does not mutate the input threat object', () => {
      const input = { severity: '0' };
      service.migrateThreatFieldValues(input as never);
      expect(input.severity).toBe('0');
    });
    it('migrates legacy English status strings', () => {
      const result = service.migrateThreatFieldValues({ status: 'Mitigation Planned' } as never);
      expect(result.status).toBe('mitigation_planned');
    });
    it('migrates legacy English priority strings', () => {
      const result = service.migrateThreatFieldValues({ priority: 'Immediate (P0)' } as never);
      expect(result.priority).toBe('immediate');
    });
    it('leaves an already-valid priority key unchanged', () => {
      const result = service.migrateThreatFieldValues({ priority: 'immediate' } as never);
      expect(result.priority).toBe('immediate');
    });
    it('leaves an unmapped severity value as-is', () => {
      const result = service.migrateThreatFieldValues({ severity: 'bogus' } as never);
      expect(result.severity).toBe('bogus');
    });
  });
});
