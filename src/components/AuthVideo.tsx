import React, { useEffect, useState, useRef } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';
import { fetchMxcBlob } from '../utils/media';
import { Film } from 'lucide-react';

interface AuthVideoProps {
  mxcUrl: string;
  posterMxcUrl?: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renders an HTML5 Video from a Matrix mxc:// URL using authenticated fetch + blob URL.
 * Supports HTTP Range Requests (206 Partial Content) when served by Nginx backend.
 */
export const AuthVideo: React.FC<AuthVideoProps> = ({
  mxcUrl,
  posterMxcUrl,
  alt: _alt,
  style,
  className,
}) => {
  const { client } = useMatrix();
  const [videoBlobUrl, setVideoBlobUrl] = useState<string>('');
  const [posterBlobUrl, setPosterBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoUrlRef = useRef<string>('');
  const posterUrlRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    const loadMedia = async () => {
      setLoading(true);
      setError(false);

      // Load poster if provided
      if (posterMxcUrl) {
        if (!posterMxcUrl.startsWith('mxc://')) {
          setPosterBlobUrl(posterMxcUrl);
        } else {
          fetchMxcBlob(client, posterMxcUrl).then((posterBlob) => {
            if (cancelled || !posterBlob) return;
            if (posterUrlRef.current) URL.revokeObjectURL(posterUrlRef.current);
            const pUrl = URL.createObjectURL(posterBlob);
            posterUrlRef.current = pUrl;
            setPosterBlobUrl(pUrl);
          });
        }
      }

      // Load video blob
      if (!mxcUrl.startsWith('mxc://')) {
        setVideoBlobUrl(mxcUrl);
        setLoading(false);
        setError(false);
        return;
      }

      const videoBlob = await fetchMxcBlob(client, mxcUrl);
      if (cancelled) return;

      if (videoBlob) {
        if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
        const vUrl = URL.createObjectURL(videoBlob);
        videoUrlRef.current = vUrl;
        setVideoBlobUrl(vUrl);
        setLoading(false);
        setError(false);
      } else {
        setLoading(false);
        setError(true);
      }
    };

    loadMedia();

    return () => {
      cancelled = true;
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
        videoUrlRef.current = '';
      }
      if (posterUrlRef.current) {
        URL.revokeObjectURL(posterUrlRef.current);
        posterUrlRef.current = '';
      }
    };
  }, [client, mxcUrl, posterMxcUrl]);

  if (loading) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-secondary)',
          minHeight: '180px',
          minWidth: '240px',
          borderRadius: '8px',
          gap: '8px',
        }}
      >
        <Film size={24} style={{ opacity: 0.5, color: 'var(--color-text-secondary)' }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', opacity: 0.8 }}>
          동영상 불러오는 중 (스트리밍 최적화)...
        </span>
      </div>
    );
  }

  if (error || !videoBlobUrl) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-secondary)',
          minHeight: '120px',
          minWidth: '200px',
          borderRadius: '8px',
          padding: '12px',
          gap: '6px',
        }}
      >
        <Film size={20} style={{ color: 'var(--color-functional-red)' }} />
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          동영상을 재생할 수 없습니다.
        </span>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <video
        src={videoBlobUrl}
        poster={posterBlobUrl || undefined}
        controls
        preload="metadata"
        playsInline
        style={{
          maxHeight: '360px',
          maxWidth: '100%',
          borderRadius: '8px',
          display: 'block',
          background: '#000',
          ...style,
        }}
        className={className}
      >
        Your browser does not support HTML5 video.
      </video>
    </div>
  );
};
