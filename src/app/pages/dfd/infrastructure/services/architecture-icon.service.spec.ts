// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { ArchitectureIconService } from './architecture-icon.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';
import { ArchIconData, ArchIconManifest } from '../../types/arch-icon.types';

const MOCK_MANIFEST: ArchIconManifest = {
  icons: [
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'compute',
      icon: 'amazon-ec2',
      label: 'Amazon EC2',
      tokens: ['aws', 'services', 'compute', 'amazon', 'ec2'],
      path: 'aws/services/compute/amazon-ec2.svg',
    },
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'compute',
      icon: 'aws-lambda',
      label: 'AWS Lambda',
      tokens: ['aws', 'services', 'compute', 'lambda'],
      path: 'aws/services/compute/aws-lambda.svg',
    },
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'databases',
      icon: 'amazon-elasticache',
      label: 'Amazon ElastiCache',
      tokens: ['aws', 'services', 'databases', 'amazon', 'elasticache'],
      path: 'aws/services/databases/amazon-elasticache.svg',
    },
    {
      provider: 'azure',
      type: 'services',
      subcategory: 'compute',
      icon: 'virtual-machines',
      label: 'Virtual Machines',
      tokens: ['azure', 'services', 'compute', 'virtual', 'machines'],
      path: 'azure/services/compute/virtual-machines.svg',
    },
    {
      provider: 'azure',
      type: 'services',
      subcategory: 'databases',
      icon: 'azure-cosmos-db',
      label: 'Azure Cosmos DB',
      tokens: ['azure', 'services', 'databases', 'cosmos', 'db'],
      path: 'azure/services/databases/azure-cosmos-db.svg',
    },
  ],
};

function mockFetchSuccess(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MANIFEST),
    }),
  );
}

describe('ArchitectureIconService', () => {
  let service: ArchitectureIconService;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockLogger = createTypedMockLoggerService();
    service = new ArchitectureIconService(mockLogger as unknown as LoggerService);
  });

  describe('search before manifest loaded', () => {
    it('should return empty array', () => {
      const results = service.search('aws');
      expect(results).toEqual([]);
    });
  });

  describe('search with empty/whitespace query', () => {
    it('should return empty for empty string', async () => {
      mockFetchSuccess();
      await service.loadManifest();
      expect(service.search('')).toEqual([]);
    });

    it('should return empty for whitespace', async () => {
      mockFetchSuccess();
      await service.loadManifest();
      expect(service.search('   ')).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      mockFetchSuccess();
      await service.loadManifest();
    });

    it('should match a single token', () => {
      const results = service.search('lambda');
      expect(results).toHaveLength(1);
      expect(results[0].icons).toHaveLength(1);
      expect(results[0].icons[0].icon).toBe('aws-lambda');
    });

    it('should apply multi-token AND logic', () => {
      const results = service.search('aws compute');
      expect(results).toHaveLength(1);
      expect(results[0].subcategory).toBe('compute');
      expect(results[0].icons).toHaveLength(2);
    });

    it('should be case insensitive', () => {
      const results = service.search('AWS Lambda');
      expect(results).toHaveLength(1);
      expect(results[0].icons[0].icon).toBe('aws-lambda');
    });

    it('should be token order independent', () => {
      const resultsA = service.search('compute aws');
      const resultsB = service.search('aws compute');
      expect(resultsA).toEqual(resultsB);
    });

    it('should support prefix matching', () => {
      // "e" should prefix-match "ec2" and "elasticache"
      const results = service.search('aws e');
      const allIcons = results.flatMap(r => r.icons);
      expect(allIcons).toHaveLength(2);
      const iconNames = allIcons.map(i => i.icon).sort();
      expect(iconNames).toEqual(['amazon-ec2', 'amazon-elasticache']);
    });

    it('should group results by provider and subcategory', () => {
      const results = service.search('services');
      // 4 groups: aws/compute, aws/databases, azure/compute, azure/databases
      expect(results).toHaveLength(4);
      for (const group of results) {
        expect(group.provider).toBeTruthy();
        expect(group.subcategory).toBeTruthy();
      }
    });

    it('should sort groups alphabetically', () => {
      const results = service.search('services');
      const keys = results.map(r => `${r.provider}·${r.subcategory}`);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });

    it('should sort icons within groups alphabetically by label', () => {
      const results = service.search('aws compute');
      expect(results).toHaveLength(1);
      const labels = results[0].icons.map(i => i.label);
      expect(labels).toEqual(['Amazon EC2', 'AWS Lambda']);
    });

    it('should support cross-provider matching', () => {
      const results = service.search('compute');
      expect(results).toHaveLength(2);
      const providers = results.map(r => r.provider).sort();
      expect(providers).toEqual(['aws', 'azure']);
    });

    it('should return no results for non-matching query', () => {
      const results = service.search('nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('getIconPath', () => {
    beforeEach(async () => {
      mockFetchSuccess();
      await service.loadManifest();
    });

    it('should resolve path from manifest entry', () => {
      const arch: ArchIconData = {
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      };
      expect(service.getIconPath(arch)).toBe(
        'assets/architecture-icons/aws/services/compute/amazon-ec2.svg',
      );
    });

    it('should fallback to reconstructed path when not in manifest', () => {
      const arch: ArchIconData = {
        provider: 'gcp',
        type: 'services',
        subcategory: 'compute',
        icon: 'cloud-run',
        placement: { vertical: 'middle', horizontal: 'center' },
      };
      expect(service.getIconPath(arch)).toBe(
        'assets/architecture-icons/gcp/services/compute/cloud-run.svg',
      );
    });
  });

  describe('getIconPathFromEntry', () => {
    it('should use entry.path directly', () => {
      const entry = MOCK_MANIFEST.icons[0];
      expect(service.getIconPathFromEntry(entry)).toBe(
        'assets/architecture-icons/aws/services/compute/amazon-ec2.svg',
      );
    });
  });

  describe('getIconBreadcrumb', () => {
    it('should format breadcrumb correctly', () => {
      const arch: ArchIconData = {
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      };
      expect(service.getIconBreadcrumb(arch)).toBe('AWS · Services · Compute');
    });
  });

  describe('getIconLabel', () => {
    beforeEach(async () => {
      mockFetchSuccess();
      await service.loadManifest();
    });

    it('should return manifest label when found', () => {
      const arch: ArchIconData = {
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      };
      expect(service.getIconLabel(arch)).toBe('Amazon EC2');
    });

    it('should fall back to humanized filename when not in manifest', () => {
      const arch: ArchIconData = {
        provider: 'gcp',
        type: 'services',
        subcategory: 'compute',
        icon: 'cloud-run',
        placement: { vertical: 'middle', horizontal: 'center' },
      };
      expect(service.getIconLabel(arch)).toBe('Cloud Run');
    });
  });

  describe('loadManifest', () => {
    it('should handle fetch failure gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        }),
      );
      await service.loadManifest();
      expect(service.isLoaded()).toBe(false);
      expect(service.search('aws')).toEqual([]);
    });

    it('should not fetch twice', async () => {
      mockFetchSuccess();
      await service.loadManifest();
      await service.loadManifest();
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
