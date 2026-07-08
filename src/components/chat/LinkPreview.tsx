import React, { useEffect, useState } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { fetchLinkPreview, type LinkPreviewData } from '../../utils/urlPreview';
import { AuthImage } from '../AuthImage';

interface LinkPreviewProps {
  url: string;
  isMe: boolean;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url, isMe }) => {
  const { client } = useMatrix();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);

  useEffect(() => {
    let active = true;

    const loadPreview = async () => {
      setLoading(true);
      try {
        const data = await fetchLinkPreview(client, url);
        if (active) {
          setPreview(data);
        }
      } catch (err) {
        console.warn('Failed to load link preview', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
    };
  }, [client, url]);

  const getDomain = (urlStr: string) => {
    try {
      const parsed = new URL(urlStr);
      return parsed.hostname.replace('www.', '');
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div style={{
        marginTop: 'var(--space-100)',
        padding: 'var(--space-100)',
        border: '1px solid ' + (isMe ? 'rgba(255,255,255,0.2)' : 'var(--color-border-default)'),
        borderRadius: '8px',
        background: isMe ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.02)',
        display: 'flex',
        gap: 'var(--space-100)',
        alignItems: 'center',
        maxWidth: '400px',
        width: '100%',
        minWidth: '240px',
      }}>
        <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '4px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton" style={{ height: '12px', width: '40%', borderRadius: '2px' }} />
          <div className="skeleton" style={{ height: '14px', width: '80%', borderRadius: '2px' }} />
          <div className="skeleton" style={{ height: '10px', width: '90%', borderRadius: '2px' }} />
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const domain = getDomain(url);
  const displaySiteName = preview.siteName || domain;
  const isMxcImage = preview.image?.startsWith('mxc://');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        marginTop: 'var(--space-100)',
        border: '1px solid ' + (isMe ? 'rgba(255,255,255,0.2)' : 'var(--color-border-default)'),
        borderRadius: '8px',
        overflow: 'hidden',
        background: isMe ? 'rgba(0, 0, 0, 0.15)' : 'var(--color-bg-primary)',
        textDecoration: 'none',
        color: 'inherit',
        maxWidth: '400px',
        width: '100%',
        minWidth: '240px',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-hardware-bevel)'
      }}
      className="link-preview-card"
    >
      <div style={{
        padding: 'var(--space-100)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        minWidth: 0,
        gap: '2px'
      }}>
        {displaySiteName && (
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: isMe ? 'rgba(255,255,255,0.6)' : 'var(--color-text-secondary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {displaySiteName}
          </span>
        )}
        {preview.title && (
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: isMe ? '#ffffff' : 'var(--color-text-primary)',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-all'
          }}>
            {preview.title}
          </span>
        )}
        {preview.description && (
          <span style={{
            fontSize: '11px',
            color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4',
            marginTop: '2px',
            wordBreak: 'break-all'
          }}>
            {preview.description}
          </span>
        )}
      </div>
      {preview.image && (
        <div style={{
          width: '80px',
          height: '80px',
          flexShrink: 0,
          borderLeft: '1px solid ' + (isMe ? 'rgba(255,255,255,0.25)' : 'var(--color-border-default)'),
          background: 'rgba(0,0,0,0.1)'
        }}>
          {isMxcImage ? (
            <AuthImage
              mxcUrl={preview.image}
              alt={preview.title || 'Preview Thumbnail'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src={preview.image}
              alt={preview.title || 'Preview Thumbnail'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                // If external image fails to load (e.g. CORS block on image files or bad URL), hide this container
                (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
              }}
            />
          )}
        </div>
      )}
    </a>
  );
};
