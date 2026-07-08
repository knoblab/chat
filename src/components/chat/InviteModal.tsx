import React, { useState } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { Search, UserPlus, X } from 'lucide-react';
import type { UserSearchResult } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, roomId }) => {
  const { client } = useMatrix();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !client) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setResults([]);

    try {
      const q = query.trim();
      const myUserId = client.getUserId() || '';

      let targetUserId = q;
      if (!q.startsWith('@') && !q.includes(':')) {
        if (q.length >= 5) {
          const colonIndex = myUserId.indexOf(':');
          const suffix = colonIndex !== -1 ? myUserId.substring(colonIndex) : ':qpi.digital';
          targetUserId = `@${q.toLowerCase()}${suffix}`;
        } else {
          setError('Please enter a valid User ID code.');
          return;
        }
      }

      if (targetUserId === myUserId) {
        setError('You cannot invite yourself.');
        return;
      }

      try {
        const profile = await client.getProfileInfo(targetUserId);
        setResults([{
          userId: targetUserId,
          displayName: profile.displayname || undefined,
          avatarUrl: profile.avatar_url || undefined
        }]);
      } catch {
        setError('User ID not found. Ensure the spelling is exact.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (targetUserId: string) => {
    if (!client) return;
    setError('');
    setSuccess('');
    try {
      await client.invite(roomId, targetUserId);
      setSuccess(`Successfully invited ${targetUserId}`);
      setResults([]);
      setQuery('');
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.message || 'Failed to send invite.');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.75)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-200)'
      }}
    >
      <div className="pdf-panel" style={{ width: '100%', maxWidth: '420px', padding: 'var(--space-200)', background: 'var(--color-bg-primary)', boxShadow: 'var(--shadow-hardware-elevated)' }}>
        <div className="pdf-flex-row pdf-items-center pdf-justify-between pdf-mb-200">
          <h3 className="pdf-text-heading-20" style={{ margin: 0 }}>Invite User to Room</h3>
          <button 
            onClick={onClose}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSearch} className="pdf-flex-row pdf-gap-100 pdf-mb-200">
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
            <input
              type="text"
              className="pdf-input pdf-input-sm pdf-font-mono"
              placeholder="Enter User Code..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ paddingLeft: '32px' }}
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0 }}>
            {loading ? '...' : 'Search'}
          </button>
        </form>

        {error && <div className="pdf-text-copy-14 pdf-text-center pdf-mb-150" style={{ color: 'var(--color-functional-red)' }}>{error}</div>}
        {success && <div className="pdf-text-copy-14 pdf-text-center pdf-mb-150" style={{ color: '#10b981' }}>{success}</div>}

        {results.length > 0 && (
          <div className="pdf-flex-col pdf-gap-100">
            <div className="pdf-text-label-14-mono pdf-text-muted">User Found:</div>
            {results.map(result => (
              <div key={result.userId} className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100)', marginBottom: 0 }}>
                <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)' }}>
                  <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{result.displayName || result.userId.split(':')[0].substring(1)}</div>
                  <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>{result.userId}</div>
                </div>
                <button 
                  onClick={() => handleInvite(result.userId)}
                  className="pdf-btn-primary pdf-btn-xs"
                  style={{ flexShrink: 0 }}
                >
                  <UserPlus size={12} /> Invite
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
