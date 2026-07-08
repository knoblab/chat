import React, { useEffect, useState, useRef } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';
import { fetchMxcBlob } from '../utils/media';

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
    let cancelled = false;

    const loadImage = async () => {
      setLoading(true);
      setError(false);
      
      const blob = await fetchMxcBlob(client, mxcUrl);
      if (cancelled) return;

      if (blob) {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }
        const objUrl = URL.createObjectURL(blob);
        blobUrlRef.current = objUrl;
        setBlobUrl(objUrl);
        setLoading(false);
        setError(false);
      } else {
        setLoading(false);
        setError(true);
      }
    };

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
