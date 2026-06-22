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

export const initMatrixClient = async (
  accessToken: string,
  userId: string,
  deviceId: string
): Promise<MatrixClient> => {
  if (matrixClient) {
    matrixClient.stopClient();
  }

  matrixClient = sdk.createClient({
    baseUrl: HOMESERVER_URL,
    accessToken,
    userId,
    deviceId,
    // Provide an indexedDB storage for keeping session state across reloads
    store: new sdk.MemoryStore(),
  });

  try {
    // Initialize Rust crypto layer for E2EE support
    await matrixClient.initRustCrypto();
  } catch (error) {
    console.warn("Could not init rust crypto. It might be already initialized or not supported", error);
  }

  // Start syncing
  await matrixClient.startClient({ initialSyncLimit: 20 });

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
