import { create } from 'zustand';
import type { Message } from '../types';

interface ChatStoreState {
  selectedRoomId: string | null;
  messages: Record<string, Message[]>; // roomId -> Message[]
  unreadCounts: Record<string, number>; // roomId -> unread count
  typingUsers: Record<string, string[]>; // roomId -> display names
  disappearingMode: Record<string, boolean>; // roomId -> is disappearing mode enabled
  
  selectRoom: (roomId: string | null) => void;
  setMessages: (roomId: string, messages: Message[]) => void;
  addMessage: (roomId: string, message: Message) => void;
  updateMessage: (roomId: string, messageId: string, updater: (msg: Message) => Message) => void;
  removeMessage: (roomId: string, messageId: string) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  incrementUnreadCount: (roomId: string) => void;
  clearUnreadCount: (roomId: string) => void;
  setTypingUsers: (roomId: string, users: string[]) => void;
  toggleDisappearingMode: (roomId: string, enabled?: boolean) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  selectedRoomId: null,
  messages: {},
  unreadCounts: {},
  typingUsers: {},
  disappearingMode: {},

  toggleDisappearingMode: (roomId, enabled) =>
    set((state) => ({
      disappearingMode: {
        ...state.disappearingMode,
        [roomId]: enabled !== undefined ? enabled : !state.disappearingMode[roomId],
      },
    })),

  selectRoom: (roomId) => set({ selectedRoomId: roomId }),

  setMessages: (roomId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: messages,
      },
    })),

  addMessage: (roomId, message) =>
    set((state) => {
      const existing = state.messages[roomId] || [];
      // Prevent duplicates by ID
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [roomId]: [...existing, message],
        },
      };
    }),

  updateMessage: (roomId, messageId, updater) =>
    set((state) => {
      const existing = state.messages[roomId] || [];
      return {
        messages: {
          ...state.messages,
          [roomId]: existing.map((m) => (m.id === messageId ? updater(m) : m)),
        },
      };
    }),

  removeMessage: (roomId, messageId) =>
    set((state) => {
      const existing = state.messages[roomId] || [];
      return {
        messages: {
          ...state.messages,
          [roomId]: existing.filter((m) => m.id !== messageId),
        },
      };
    }),

  setUnreadCount: (roomId, count) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [roomId]: count,
      },
    })),

  incrementUnreadCount: (roomId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [roomId]: (state.unreadCounts[roomId] || 0) + 1,
      },
    })),

  clearUnreadCount: (roomId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [roomId]: 0,
      },
    })),

  setTypingUsers: (roomId, users) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [roomId]: users,
      },
    })),
}));
