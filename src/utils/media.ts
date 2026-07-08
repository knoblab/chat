import { MatrixClient } from 'matrix-js-sdk';

/**
 * Renders or downloads an image/file from a Matrix mxc:// URL using authenticated fetch + blob URL.
 * This avoids exposing the Matrix access token in URL query parameters.
 */
export const fetchMxcBlob = async (
  client: MatrixClient | null,
  mxcUrl: string
): Promise<Blob | null> => {
  if (!client || !mxcUrl || !mxcUrl.startsWith('mxc://')) return null;
  
  const token = client.getAccessToken();
  const baseUrl = client.baseUrl;
  const parts = mxcUrl.substring(6).split('/');
  if (parts.length < 2) return null;
  
  const serverName = parts[0];
  const mediaId = parts.slice(1).join('/');

  const endpoints = [
    `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`,
    `${baseUrl}/_matrix/media/v3/download/${serverName}/${mediaId}`,
    `${baseUrl}/_matrix/media/r0/download/${serverName}/${mediaId}`,
  ];

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        return await res.blob();
      }
    } catch {
      continue;
    }
  }

  return null;
};

/**
 * Trigger browser download of an MXC resource securely using Blob URL.
 */
export const downloadMxcMedia = async (
  client: MatrixClient | null,
  mxcUrl: string,
  filename = 'download'
): Promise<boolean> => {
  try {
    const blob = await fetchMxcBlob(client, mxcUrl);
    if (!blob) return false;

    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    return true;
  } catch (err) {
    console.error('Failed to download MXC media:', err);
    return false;
  }
};
