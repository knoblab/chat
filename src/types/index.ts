export interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  isEncrypted: boolean;
  msgtype?: string;
  url?: string;
  info?: any;
  isEdited?: boolean;
  isReadByOther?: boolean;
  isDisappearing?: boolean;
  expiryTs?: number;
  formattedBody?: string;
}

export interface UserSearchResult {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export type TabType = 'chats' | 'friends' | 'settings';

export type ThemeType = 'dark' | 'light';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
