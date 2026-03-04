// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, firstValueFrom } from 'rxjs';

import { CweService } from './cwe.service';
import { CweDataFile } from '../models/cwe.model';

interface MockHttpClient {
  get: ReturnType<typeof vi.fn>;
}

interface MockLoggerService {
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

const MOCK_DATA: CweDataFile = {
  view_id: 'CWE-699',
  view_name: 'Software Development',
  weaknesses: [
    {
      cwe_id: 'CWE-79',
      name: "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
      description: 'The product does not neutralize user-controllable input.',
      extended_description: 'When a web application does not properly validate input...',
      parent_id: 'CWE-707',
    },
    {
      cwe_id: 'CWE-89',
      name: "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
      description: 'The product constructs SQL commands using externally-influenced input.',
      extended_description: 'Without sufficient removal or quoting of SQL syntax...',
      parent_id: 'CWE-943',
    },
    {
      cwe_id: 'CWE-22',
      name: "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
      description: 'The product uses external input to construct a pathname.',
      extended_description:
        'Many file operations are intended to take place within a restricted directory.',
      parent_id: 'CWE-706',
    },
  ],
};

describe('CweService', () => {
  let service: CweService;
  let httpClient: MockHttpClient;
  let loggerService: MockLoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    httpClient = { get: vi.fn() };
    loggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    service = new CweService(httpClient as any, loggerService as any);
  });

  describe('loadWeaknesses', () => {
    it('should load and return weaknesses from the asset file', async () => {
      httpClient.get.mockReturnValue(of(MOCK_DATA));

      const result = await firstValueFrom(service.loadWeaknesses());

      expect(httpClient.get).toHaveBeenCalledWith('/assets/cwe/cwe-699.json');
      expect(result).toHaveLength(3);
      expect(result[0].cwe_id).toBe('CWE-79');
    });

    it('should cache results on subsequent calls', async () => {
      httpClient.get.mockReturnValue(of(MOCK_DATA));

      await firstValueFrom(service.loadWeaknesses());
      await firstValueFrom(service.loadWeaknesses());

      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    const weaknesses = MOCK_DATA.weaknesses;

    it('should return all weaknesses for empty query', () => {
      expect(service.search(weaknesses, '')).toHaveLength(3);
      expect(service.search(weaknesses, '  ')).toHaveLength(3);
    });

    it('should match by CWE ID', () => {
      const result = service.search(weaknesses, 'CWE-79');
      expect(result).toHaveLength(1);
      expect(result[0].cwe_id).toBe('CWE-79');
    });

    it('should match by name (case-insensitive)', () => {
      const result = service.search(weaknesses, 'sql injection');
      expect(result).toHaveLength(1);
      expect(result[0].cwe_id).toBe('CWE-89');
    });

    it('should match by description', () => {
      const result = service.search(weaknesses, 'pathname');
      expect(result).toHaveLength(1);
      expect(result[0].cwe_id).toBe('CWE-22');
    });

    it('should match by extended description', () => {
      const result = service.search(weaknesses, 'quoting of SQL syntax');
      expect(result).toHaveLength(1);
      expect(result[0].cwe_id).toBe('CWE-89');
    });

    it('should match multiple results', () => {
      const result = service.search(weaknesses, 'neutralization');
      expect(result).toHaveLength(2);
    });

    it('should return empty for non-matching query', () => {
      const result = service.search(weaknesses, 'nonexistent');
      expect(result).toHaveLength(0);
    });
  });
});
