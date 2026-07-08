import React from 'react';
import { useFriends } from '../hooks/useFriends';
import { UserPlus, Check, X, Search, Clock, User, MessageSquare, Trash2 } from 'lucide-react';

interface FriendListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  onSwitchToChats?: () => void;
}

export const FriendList: React.FC<FriendListProps> = ({ onSelectRoom, onSwitchToChats }) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    inviteError,
    friends,
    incomingRequests,
    handleSearch,
    handleAddFriend,
    handleAcceptInvite,
    handleRejectInvite,
    handleRemoveFriend,
    getOtherMemberInfo,
  } = useFriends(onSelectRoom, onSwitchToChats);

  const handleOpenChat = (roomId: string) => {
    onSelectRoom(roomId);
    if (onSwitchToChats) {
      onSwitchToChats();
    }
  };

  return (
    <div className="pdf-flex-col" style={{ height: '100%', padding: 'var(--space-200)' }}>
      
      {/* Search/Add Friend Form */}
      <form onSubmit={handleSearch} className="pdf-flex-row pdf-gap-100" style={{ marginBottom: 'var(--space-200)' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            className="pdf-input pdf-input-sm pdf-font-mono"
            placeholder="Enter User Code..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <button type="submit" disabled={isSearching} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0 }}>
          {isSearching ? '...' : 'Search'}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="pdf-panel" style={{ padding: 'var(--space-100)', marginBottom: 'var(--space-200)', maxHeight: '200px', overflowY: 'auto' }}>
          <div className="pdf-text-label-14-mono pdf-text-muted" style={{ padding: 'var(--space-050) var(--space-100)', borderBottom: '1px solid var(--color-border-default)' }}>Search Results</div>
          {searchResults.map(result => (
            <div key={result.userId} className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100) var(--space-050)', borderBottom: '1px solid var(--color-border-default)' }}>
              <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)' }}>
                <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{result.displayName || result.userId.split(':')[0].substring(1)}</div>
                <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>{result.userId}</div>
              </div>
              <button 
                onClick={() => handleAddFriend(result.userId)}
                className="pdf-btn-primary pdf-btn-xs"
                style={{ flexShrink: 0 }}
              >
                <UserPlus size={12} /> Add
              </button>
            </div>
          ))}
        </div>
      )}

      {inviteError && (
        <div className="pdf-text-copy-14 pdf-text-center pdf-mb-150" style={{ color: 'var(--color-functional-red)' }}>
          {inviteError}
        </div>
      )}

      {/* Main Lists container */}
      <div className="pdf-flex-col pdf-gap-200" style={{ flex: 1, overflowY: 'auto' }}>
        
        {/* Incoming Friend Requests */}
        {incomingRequests.length > 0 && (
          <div>
            <div className="pdf-text-label-16 pdf-text-red pdf-mb-100" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-050)', color: '#f59e0b' }}>
              <Clock size={12} /> Requests ({incomingRequests.length})
            </div>
            <div className="pdf-flex-col pdf-gap-100">
              {incomingRequests.map(room => {
                const info = getOtherMemberInfo(room);
                return (
                  <div key={room.roomId} className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100)', marginBottom: 0 }}>
                    <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)' }}>
                      <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{info.name}</div>
                      <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>{info.userId}</div>
                    </div>
                    <div className="pdf-flex-row pdf-gap-050" style={{ flexShrink: 0 }}>
                      <button 
                        onClick={() => handleAcceptInvite(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ background: '#10b981', width: '28px', height: '28px', padding: 0 }}
                        title="Accept"
                      >
                        <Check size={12} />
                      </button>
                      <button 
                        onClick={() => handleRejectInvite(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ background: '#ef4444', width: '28px', height: '28px', padding: 0 }}
                        title="Decline"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Friends List (Merged DMs) */}
        <div>
          <div className="pdf-text-label-16 pdf-text-muted pdf-mb-100">
            Chats ({friends.length})
          </div>
          {friends.length === 0 ? (
            <div className="pdf-flex-col pdf-justify-center pdf-items-center" style={{ padding: 'var(--space-300)', border: '1px dashed var(--color-border-default)', borderRadius: '8px' }}>
              <User size={24} style={{ color: 'var(--color-text-secondary)', opacity: 0.5, marginBottom: 'var(--space-100)' }} />
              <p className="pdf-text-copy-14">No friends added yet.</p>
            </div>
          ) : (
            <div className="pdf-flex-col" style={{ gap: 'var(--space-025)' }}>
              {friends.map(room => {
                const info = getOtherMemberInfo(room);
                return (
                  <div
                    key={room.roomId}
                    className="pdf-panel pdf-flex-row pdf-items-center"
                    style={{ padding: 'var(--space-100) var(--space-150)', marginBottom: 0, gap: 'var(--space-100)' }}
                  >
                    {/* Avatar */}
                    <div style={{ 
                      width: '32px', height: '32px', 
                      borderRadius: '50%', background: 'var(--color-functional-red)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      flexShrink: 0,
                    }}>
                      {info.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: '0.9rem' }}>
                        {info.name}
                      </div>
                      <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>
                        {info.userId}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="pdf-flex-row pdf-gap-050" style={{ flexShrink: 0 }}>
                      <button 
                        onClick={() => handleOpenChat(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ height: '26px', padding: '0 8px', fontSize: '11px', gap: '4px' }}
                        title="Open Chat"
                      >
                        <MessageSquare size={11} /> Chat
                      </button>
                      <button 
                        onClick={(e) => handleRemoveFriend(e, room.roomId)}
                        className="pdf-secondary-btn pdf-btn-xs"
                        style={{ width: '26px', height: '26px', padding: 0, justifyContent: 'center', border: 'none', background: 'transparent', opacity: 0.5 }}
                        title="Remove Friend"
                      >
                        <Trash2 size={11} style={{ color: 'var(--color-functional-red)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
