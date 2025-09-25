// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { InfraNodeConfigurationService } from './infra-node-configuration.service';
import { expect, beforeEach, describe, it } from 'vitest';

describe('InfraNodeConfigurationService', () => {
  let service: InfraNodeConfigurationService;

  beforeEach(() => {
    service = new InfraNodeConfigurationService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getNodePorts', () => {
    it('should return empty ports configuration for text-box nodes', () => {
      const result = service.getNodePorts('text-box');

      expect(result).toEqual({
        groups: {},
        items: [],
      });
    });

    it('should return ports configuration for other node types', () => {
      const nodeTypes = ['process', 'store', 'actor', 'security-boundary'];

      nodeTypes.forEach(nodeType => {
        const result = service.getNodePorts(nodeType);

        expect(result.groups).toBeDefined();
        expect(result.items).toBeDefined();
        expect(result.items.length).toBe(4); // top, right, bottom, left
        expect(result.items).toEqual([
          { group: 'top', id: 'top' },
          { group: 'right', id: 'right' },
          { group: 'bottom', id: 'bottom' },
          { group: 'left', id: 'left' },
        ]);
      });
    });
  });

  describe('getNodeTypeInfo', () => {
    it('should indicate text-box nodes do not have ports', () => {
      const result = service.getNodeTypeInfo('text-box');

      expect(result.hasPorts).toBe(false);
      expect(result.isTextbox).toBe(true);
    });

    it('should indicate other node types have ports', () => {
      const nodeTypes = ['process', 'store', 'actor', 'security-boundary'];

      nodeTypes.forEach(nodeType => {
        const result = service.getNodeTypeInfo(nodeType);

        expect(result.hasPorts).toBe(true);
        expect(result.isTextbox).toBe(false);
      });
    });
  });
});
