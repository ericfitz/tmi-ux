import { describe, it, expect } from 'vitest';
import {
  getPrincipalDisplayName,
  getCompositeKey,
  principalsEqual,
  isPrincipalUser,
  isPrincipalGroup,
} from './principal-display.utils';
import { User, Group, Principal } from '@app/pages/tm/models/threat-model.model';

describe('Principal Display Utils', () => {
  describe('getPrincipalDisplayName', () => {
    it('should return "Name (email)" format when both are present', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(getPrincipalDisplayName(user)).toBe('John Doe (john@example.com)');
    });

    it('should return just name when email is missing', () => {
      const principal: Principal = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
      };

      expect(getPrincipalDisplayName(principal)).toBe('John Doe');
    });

    it('should return just name when email is null', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: null as unknown as string,
      };

      expect(getPrincipalDisplayName(user)).toBe('John Doe');
    });

    it('should return just name when email is empty string', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: '',
      };

      expect(getPrincipalDisplayName(user)).toBe('John Doe');
    });

    it('should return just name when email is whitespace', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: '   ',
      };

      expect(getPrincipalDisplayName(user)).toBe('John Doe');
    });

    it('should work with Group principals', () => {
      const group: Group = {
        principal_type: 'group',
        provider: 'google',
        provider_id: 'group-123',
        display_name: 'Engineering Team',
        email: 'eng-team@example.com',
      };

      expect(getPrincipalDisplayName(group)).toBe('Engineering Team (eng-team@example.com)');
    });

    it('should return empty string for null principal', () => {
      expect(getPrincipalDisplayName(null as unknown as Principal)).toBe('');
    });

    it('should return empty string for undefined principal', () => {
      expect(getPrincipalDisplayName(undefined as unknown as Principal)).toBe('');
    });
  });

  describe('getCompositeKey', () => {
    it('should return "provider:provider_id" format', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123456',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(getCompositeKey(user)).toBe('google:123456');
    });

    it('should work with different providers', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'github',
        provider_id: '987654',
        display_name: 'Jane Smith',
        email: 'jane@example.com',
      };

      expect(getCompositeKey(user)).toBe('github:987654');
    });

    it('should work with Group principals', () => {
      const group: Group = {
        principal_type: 'group',
        provider: 'google',
        provider_id: 'group-abc',
        display_name: 'Team',
      };

      expect(getCompositeKey(group)).toBe('google:group-abc');
    });

    it('should return empty string for null principal', () => {
      expect(getCompositeKey(null as unknown as Principal)).toBe('');
    });

    it('should return empty string for undefined principal', () => {
      expect(getCompositeKey(undefined as unknown as Principal)).toBe('');
    });
  });

  describe('principalsEqual', () => {
    it('should return true for principals with same provider and provider_id', () => {
      const user1: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      const user2: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'Different Name', // Different display name shouldn't matter
        email: 'different@example.com', // Different email shouldn't matter
      };

      expect(principalsEqual(user1, user2)).toBe(true);
    });

    it('should return false for principals with different provider_id', () => {
      const user1: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      const user2: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '456',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(principalsEqual(user1, user2)).toBe(false);
    });

    it('should return false for principals with different provider', () => {
      const user1: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      const user2: User = {
        principal_type: 'user',
        provider: 'github',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(principalsEqual(user1, user2)).toBe(false);
    });

    it('should return false if first principal is null', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(principalsEqual(null, user)).toBe(false);
    });

    it('should return false if second principal is null', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(principalsEqual(user, null)).toBe(false);
    });

    it('should return false if both principals are null', () => {
      expect(principalsEqual(null, null)).toBe(false);
    });

    it('should return false if both principals are undefined', () => {
      expect(principalsEqual(undefined, undefined)).toBe(false);
    });

    it('should work comparing User and Group with same composite key', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      const group: Group = {
        principal_type: 'group',
        provider: 'google',
        provider_id: '123',
        display_name: 'Team',
      };

      // They have the same composite key, so they're equal
      expect(principalsEqual(user, group)).toBe(true);
    });
  });

  describe('isPrincipalUser', () => {
    it('should return true for User principals', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(isPrincipalUser(user)).toBe(true);
    });

    it('should return false for Group principals', () => {
      const group: Group = {
        principal_type: 'group',
        provider: 'google',
        provider_id: 'group-123',
        display_name: 'Team',
      };

      expect(isPrincipalUser(group)).toBe(false);
    });
  });

  describe('isPrincipalGroup', () => {
    it('should return true for Group principals', () => {
      const group: Group = {
        principal_type: 'group',
        provider: 'google',
        provider_id: 'group-123',
        display_name: 'Team',
      };

      expect(isPrincipalGroup(group)).toBe(true);
    });

    it('should return false for User principals', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        display_name: 'John Doe',
        email: 'john@example.com',
      };

      expect(isPrincipalGroup(user)).toBe(false);
    });
  });
});
