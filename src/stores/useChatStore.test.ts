import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './useChatStore';
import type { Message } from '../types';

describe('useChatStore', () => {
  beforeEach(() => {
    // Reset Zustand store before each test
    useChatStore.setState({
      selectedRoomId: null,
      messages: {},
      unreadCounts: {},
      typingUsers: {}
    });
  });

  it('selects a room and allows clearing its unread count', () => {
    useChatStore.setState({
      unreadCounts: { '!room1:test': 5, '!room2:test': 3 }
    });

    const { selectRoom, clearUnreadCount } = useChatStore.getState();
    selectRoom('!room1:test');
    clearUnreadCount('!room1:test');

    const state = useChatStore.getState();
    expect(state.selectedRoomId).toBe('!room1:test');
    expect(state.unreadCounts['!room1:test']).toBe(0);
    expect(state.unreadCounts['!room2:test']).toBe(3);
  });

  it('sets messages for a specific room', () => {
    const mockMsg: Message = {
      id: '$msg1',
      sender: '@alice:test',
      body: 'Hello',
      timestamp: 12345,
      isEncrypted: false
    };

    const { setMessages } = useChatStore.getState();
    setMessages('!room1:test', [mockMsg]);

    const state = useChatStore.getState();
    expect(state.messages['!room1:test']).toHaveLength(1);
    expect(state.messages['!room1:test'][0].body).toBe('Hello');
  });

  it('increments unread count correctly', () => {
    useChatStore.setState({
      unreadCounts: { '!room1:test': 0, '!room2:test': 2 }
    });

    const { incrementUnreadCount } = useChatStore.getState();

    incrementUnreadCount('!room1:test');
    expect(useChatStore.getState().unreadCounts['!room1:test']).toBe(1);

    incrementUnreadCount('!room2:test');
    expect(useChatStore.getState().unreadCounts['!room2:test']).toBe(3);
  });
});
