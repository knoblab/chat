import { create } from 'zustand';
import type { TabType, ThemeType, ToastMessage } from '../types';

interface UIStoreState {
  activeTab: TabType;
  mobileTab: TabType;
  isMobile: boolean;
  theme: ThemeType;
  toasts: ToastMessage[];
  
  setActiveTab: (tab: TabType) => void;
  setMobileTab: (tab: TabType) => void;
  setIsMobile: (isMobile: boolean) => void;
  setTheme: (theme: ThemeType) => void;
  toggleTheme: () => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

const getInitialTheme = (): ThemeType => {
  const saved = localStorage.getItem('theme');
  const theme = (saved === 'light' || saved === 'dark') ? saved : 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  return theme;
};

export const useUIStore = create<UIStoreState>((set, get) => ({
  activeTab: 'chats',
  mobileTab: 'chats',
  isMobile: window.innerWidth <= 1024,
  theme: getInitialTheme(),
  toasts: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setIsMobile: (isMobile) => set({ isMobile }),
  
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  addToast: (message, type = 'info') => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
