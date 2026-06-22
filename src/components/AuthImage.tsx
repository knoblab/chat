import React, { useEffect, useState, useRef } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';

interface AuthImageProps {
  mxcUrl: string;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

/**
 * Renders an image from a Matrix mxc:// URL using authenticated fetch + blob URL.
 * This handles newer Synapse servers that require auth for media download.
 */
export const AuthImage: React.FC<AuthImageProps> = ({ mxcUrl, alt, style, className, onClick }) => {
  const { client } = useMatrix();
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const blobUrlRef = useRef<string>('');

  useEffect(() => {
    if (!client || !mxcUrl || !mxcUrl.startsWith('mxc://')) {
      setLoading(false);
      setError(true);
      return;
    }

    const token = client.getAccessToken();
    const baseUrl = client.baseUrl;
    const parts = mxcUrl.substring(6).split('/');
    if (parts.length < 2) {
      setLoading(false);
      setError(true);
      return;
    }
    const serverName = parts[0];
    const mediaId = parts.slice(1).join('/');

    let cancelled = false;

    const loadImage = async () => {
      // Try endpoints in order: authenticated client API first, then legacy media API
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
            const blob = await res.blob();
            if (!cancelled) {
              // Revoke previous blob URL if any
              if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
              }
              const objUrl = URL.createObjectURL(blob);
              blobUrlRef.current = objUrl;
              setBlobUrl(objUrl);
              setLoading(false);
              setError(false);
            }
            return;
          }
        } catch {
          // Try next endpoint
          continue;
        }
      }

      // All endpoints failed
      if (!cancelled) {
        setLoading(false);
        setError(true);
      }
    };

    setLoading(true);
    setError(false);
    loadImage();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = '';
      }
    };
  }, [client, mxcUrl]);

  if (loading) {
    return (
      <div style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg-secondary)',
        minHeight: '60px', borderRadius: '4px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', opacity: 0.7 }}>Loading...</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div style={{
        ...style,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--color-bg-secondary)',
        minHeight: '40px', borderRadius: '4px', padding: '8px',
      }}>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Image unavailable</span>
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} style={style} className={className} onClick={onClick} />;
};

/**
 * Check if a room is a Direct Message room by querying m.direct account data.
 * This is the correct way per the Matrix spec (not m.room.create content).
 */
export const isRoomDirect = (client: any, roomId: string): boolean => {
  const directEvent = client.getAccountData('m.direct');
  if (!directEvent) return false;
  const content = directEvent.getContent();
  return Object.values(content).some((roomIds: any) =>
    Array.isArray(roomIds) && (roomIds as string[]).includes(roomId)
  );
};
