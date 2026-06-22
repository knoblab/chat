import * as sdk from 'matrix-js-sdk';
import { MatrixClient } from 'matrix-js-sdk';

export const HOMESERVER_URL = 'https://chating.qpi.digital';

let matrixClient: MatrixClient | null = null;

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
