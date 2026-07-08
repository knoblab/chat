export const HOMESERVER_URL = import.meta.env.VITE_MATRIX_HOMESERVER_URL || 'https://matrix.qpi.digital';

export const MATRIX_ALGORITHM = {
  MEGOLM_V1_AES_SHA2: 'm.megolm.v1.aes-sha2',
} as const;

export const MATRIX_EVENT_TYPE = {
  ROOM_ENCRYPTION: 'm.room.encryption',
  ROOM_JOIN_RULES: 'm.room.join_rules',
  ROOM_HISTORY_VISIBILITY: 'm.room.history_visibility',
  ROOM_NAME: 'm.room.name',
  DIRECT: 'm.direct',
  REACTION: 'm.reaction',
} as const;

export const DEFAULT_SYNC_LIMIT = 30;
