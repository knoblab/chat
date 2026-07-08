import { describe, it, expect, vi } from 'vitest';
import { getUserCode, isRoomDirect } from './rooms';

describe('rooms utilities', () => {
  describe('getUserCode', () => {
    it('extracts username from a Matrix user ID (@user:domain)', () => {
      expect(getUserCode('@alice:matrix.org')).toBe('alice');
      expect(getUserCode('@bob_123:synapse.server.local')).toBe('bob_123');
    });

    it('returns the raw ID if it does not start with @', () => {
      expect(getUserCode('charlie:matrix.org')).toBe('charlie:matrix.org');
      expect(getUserCode('plainuser')).toBe('plainuser');
    });

    it('returns empty string for null or undefined', () => {
      expect(getUserCode(null)).toBe('');
      expect(getUserCode(undefined)).toBe('');
      expect(getUserCode('')).toBe('');
    });
  });

  describe('isRoomDirect', () => {
    it('returns false when client or roomId is missing', () => {
      expect(isRoomDirect(null, '!room:test')).toBe(false);
      expect(isRoomDirect({}, '')).toBe(false);
    });

    it('returns true when room is found in m.direct account data', () => {
      const mockRoom = {
        getMembers: () => [{ userId: '@me:test' }, { userId: '@other:test' }, { userId: '@third:test' }],
        currentState: {
          getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ name: 'Group Room' }) })
        }
      };

      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom),
        getAccountData: vi.fn().mockReturnValue({
          getContent: () => ({
            '@alice:test': ['!other:test', '!directRoom:test'],
            '@bob:test': ['!room3:test']
          })
        })
      };

      expect(isRoomDirect(mockClient, '!directRoom:test')).toBe(true);
      expect(isRoomDirect(mockClient, '!notDirect:test')).toBe(false);
    });

    it('falls back to heuristics (<= 2 members and no explicit name) if m.direct not set', () => {
      const mockRoom = {
        getMembers: () => [{ userId: '@me:test' }, { userId: '@other:test' }],
        currentState: {
          getStateEvents: vi.fn().mockReturnValue(null) // no room name set
        }
      };

      const mockClient = {
        getRoom: vi.fn().mockReturnValue(mockRoom),
        getAccountData: vi.fn().mockReturnValue(null) // no m.direct account data
      };

      expect(isRoomDirect(mockClient, '!fallbackRoom:test')).toBe(true);
    });
  });
});
