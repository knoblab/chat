import * as sdk from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

export const HOMESERVER_URL = 'https://matrix.qpi.digital';

let matrixClient: MatrixClient | null = null;

const joinOrCreateGeneralRoom = async (client: MatrixClient, userId: string) => {
  try {
    const domain = userId.split(':')[1];
    const generalAlias = `#general:${domain}`;

    // Get current visible rooms
    const rooms = client.getVisibleRooms();
    const isAlreadyJoined = rooms.some(room => 
      room.getCanonicalAlias() === generalAlias || 
      room.getAltAliases().includes(generalAlias)
    );

    if (isAlreadyJoined) {
      console.log(`Already in general room: ${generalAlias}`);
      return;
    }

    console.log(`Attempting to join general room: ${generalAlias}`);
    try {
      await client.joinRoom(generalAlias);
      console.log(`Successfully joined general room: ${generalAlias}`);
    } catch (joinErr: any) {
      // If the room doesn't exist (M_NOT_FOUND / 404), create it!
      if (joinErr.errcode === 'M_NOT_FOUND' || joinErr.httpStatus === 404) {
        console.log(`General room not found. Creating it...`);
        try {
          await client.createRoom({
            room_alias_name: 'general',
            name: 'General Chat',
            preset: 'public_chat' as any,
            visibility: 'public' as any,
            initial_state: [
              {
                type: 'm.room.history_visibility',
                state_key: '',
                content: {
                  history_visibility: 'shared'
                }
              }
            ]
          });
          console.log(`General room created and joined successfully.`);
        } catch (createErr) {
          console.error(`Failed to create general room:`, createErr);
        }
      } else {
        console.error(`Failed to join general room:`, joinErr);
      }
    }
  } catch (err) {
    console.error(`Error in joinOrCreateGeneralRoom:`, err);
  }
};

/**
 * Create an IndexedDB-backed store for persisting sync state and crypto keys.
 * Falls back to MemoryStore if IndexedDB is unavailable.
 */
const createStore = () => {
  try {
    return new sdk.IndexedDBStore({
      indexedDB: globalThis.indexedDB,
      dbName: 'qpi-chat-sync',
      localStorage: globalThis.localStorage,
    });
  } catch (err) {
    console.warn('IndexedDBStore unavailable, falling back to MemoryStore:', err);
    return new sdk.MemoryStore();
  }
};

export const initMatrixClient = async (
  accessToken: string,
  userId: string,
  deviceId: string
): Promise<MatrixClient> => {
  if (matrixClient) {
    matrixClient.stopClient();
  }

  const store = createStore();

  matrixClient = sdk.createClient({
    baseUrl: HOMESERVER_URL,
    accessToken,
    userId,
    deviceId,
    store,
    timelineSupport: true,
  });

  if (store instanceof sdk.IndexedDBStore) {
    try {
      await store.startup();
    } catch (err) {
      console.warn('IndexedDBStore startup failed, falling back to MemoryStore:', err);
      matrixClient = sdk.createClient({
        baseUrl: HOMESERVER_URL,
        accessToken,
        userId,
        deviceId,
        store: new sdk.MemoryStore(),
        timelineSupport: true,
      });
    }
  }

  try {
    // Initialize Rust crypto layer for E2EE support
    await matrixClient.initRustCrypto();
    
    // Configure trust: allow sending to unverified devices
    const crypto = matrixClient.getCrypto();
    if (crypto) {
      // Rust crypto: disable blacklisting unverified devices
      if ('globalBlacklistUnverifiedDevices' in crypto) {
        (crypto as any).globalBlacklistUnverifiedDevices = false;
      }
    }
    
    // Legacy JS crypto fallbacks (kept for compatibility)
    if ((matrixClient as any).setGlobalErrorOnUnknownDevices) {
      (matrixClient as any).setGlobalErrorOnUnknownDevices(false);
    }
    if ((matrixClient as any).setCryptoTrustAllDevices) {
      (matrixClient as any).setCryptoTrustAllDevices(true);
    }
  } catch (error) {
    console.warn("Could not init rust crypto. It might be already initialized or not supported", error);
  }

  // Start syncing with larger limit for history
  await matrixClient.startClient({ initialSyncLimit: 30 });

  return new Promise<MatrixClient>((resolve, reject) => {
    // Timeout of 15 seconds to prevent hanging the UI on sync failure
    const timeoutId = setTimeout(() => {
      matrixClient!.removeListener('sync' as any, syncListener);
      reject(new Error('Matrix client sync timeout'));
    }, 15000);

    const syncListener = async (state: string, _prevState: string | null, data: any) => {
      console.log(`Matrix Client Sync State: ${state}`);
      if (state === 'PREPARED' || state === 'SYNCING') {
        clearTimeout(timeoutId);
        matrixClient!.removeListener('sync' as any, syncListener);
        try {
          const rooms = matrixClient!.getVisibleRooms();
          const allUserIds = new Set<string>();
          rooms.forEach(room => {
            if (matrixClient!.isRoomEncrypted(room.roomId)) {
              room.getMembers().forEach(m => {
                if (m.membership === 'join') {
                  allUserIds.add(m.userId);
                }
              });
            }
          });
          
          if (allUserIds.size > 0) {
            const crypto = matrixClient!.getCrypto();
            if (crypto) {
              await crypto.getUserDeviceInfo(Array.from(allUserIds), true);
              console.log(`Pre-downloaded crypto keys for ${allUserIds.size} users via Rust crypto`);
            } else if ((matrixClient as any).downloadKeys) {
              await (matrixClient as any).downloadKeys(Array.from(allUserIds));
              console.log(`Pre-downloaded crypto keys for ${allUserIds.size} users via legacy crypto`);
            }
          }
        } catch (err) {
          console.warn('Failed to pre-download crypto keys:', err);
        }

        // Auto-join/create general room in background
        joinOrCreateGeneralRoom(matrixClient!, userId);
        
        // Resolve only when sync is ready
        resolve(matrixClient!);
      } else if (state === 'ERROR') {
        const error = data?.error;
        const isAuthError = error?.errcode === 'M_UNKNOWN_TOKEN' || error?.httpStatus === 401;
        if (isAuthError) {
          clearTimeout(timeoutId);
          matrixClient!.removeListener('sync' as any, syncListener);
          matrixClient!.stopClient();
          reject(new Error(error?.message || 'Invalid access token'));
        }
      }
    };

    matrixClient!.on('sync' as any, syncListener);
  });
};

export const getMatrixClient = (): MatrixClient | null => {
  return matrixClient;
};

export const clearMatrixClient = () => {
  if (matrixClient) {
    matrixClient.stopClient();
    matrixClient = null;
  }
  localStorage.removeItem('matrix_access_token');
  localStorage.removeItem('matrix_user_id');
  localStorage.removeItem('matrix_device_id');
};
