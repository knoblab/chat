import * as sdk from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

export const HOMESERVER_URL = 'https://chating.qpi.digital';

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
const createStore = async () => {
  try {
    const store = new sdk.IndexedDBStore({
      indexedDB: globalThis.indexedDB,
      dbName: 'qpi-chat-sync',
      localStorage: globalThis.localStorage,
    });
    await store.startup();
    return store;
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

  const store = await createStore();

  matrixClient = sdk.createClient({
    baseUrl: HOMESERVER_URL,
    accessToken,
    userId,
    deviceId,
    store,
    timelineSupport: true,
  });

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

  // When sync completes, pre-download crypto keys for all room members
  matrixClient.once('sync' as any, async (state: string) => {
    if (state === 'PREPARED' || state === 'SYNCING') {
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
            // Rust crypto: getUserDeviceInfo downloads and caches device keys
            await crypto.getUserDeviceInfo(Array.from(allUserIds), true);
            console.log(`Pre-downloaded crypto keys for ${allUserIds.size} users via Rust crypto`);
          } else if ((matrixClient as any).downloadKeys) {
            // Legacy fallback
            await (matrixClient as any).downloadKeys(Array.from(allUserIds));
            console.log(`Pre-downloaded crypto keys for ${allUserIds.size} users via legacy crypto`);
          }
        }
      } catch (err) {
        console.warn('Failed to pre-download crypto keys:', err);
      }
    }
  });

  // Auto-join/create general room in background
  joinOrCreateGeneralRoom(matrixClient, userId);

  return matrixClient;
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
