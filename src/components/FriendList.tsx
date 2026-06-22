import React, { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { UserPlus, Check, X, Search, Clock, User } from 'lucide-react';

interface FriendListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
}

interface SearchResult {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export const FriendList: React.FC<FriendListProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { client } = useMatrix();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Lists
  const [friends, setFriends] = useState<Room[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Room[]>([]);
  const [sentRequests, setSentRequests] = useState<Room[]>([]);

  // Update lists from rooms
  const updateLists = () => {
    if (!client) return;
    const allRooms = client.getVisibleRooms();
    const myId = client.getUserId();

    const incoming: Room[] = [];
    const sent: Room[] = [];
    const active: Room[] = [];

    allRooms.forEach(room => {
      // Get active members (joined or invited)
      const members = room.getMembers().filter(m => m.membership === 'join' || m.membership === 'invite');
      
      // Heuristic: DMs are private rooms with exactly 2 active members (ourselves and the target user)
      const isTwoMember = members.length <= 2;
      const isDirect = room.currentState.getStateEvents('m.room.create', '')?.getContent().is_direct || false;
      
      // Only treat it as DM if it's marked direct or is a private 1-to-1
      if (isDirect || isTwoMember) {
        const myMembership = room.getMyMembership();

        if (myMembership === 'invite') {
          // Incoming invite (Friend request)
          incoming.push(room);
        } else if (myMembership === 'join') {
          // Check if there's someone else invited (Sent request pending)
          const otherInvite = members.find(m => m.userId !== myId && m.membership === 'invite');
          // Check if there's someone else joined (Active friendship)
          const otherJoin = members.find(m => m.userId !== myId && m.membership === 'join');

          if (otherInvite) {
            sent.push(room);
          } else if (otherJoin) {
            active.push(room);
          }
        }
      }
    });

    setIncomingRequests(incoming);
    setSentRequests(sent);
    setFriends(active);
  };

  useEffect(() => {
    if (!client) return;

    updateLists();

    // Event listeners
    const handleRoomEvent = () => {
      updateLists();
    };

    client.on('Room' as any, handleRoomEvent);
    client.on('Room.myMembership' as any, handleRoomEvent);
    client.on('Room.currentState' as any, handleRoomEvent);
    client.on('RoomState.members' as any, handleRoomEvent);

    return () => {
      client.removeListener('Room' as any, handleRoomEvent);
      client.removeListener('Room.myMembership' as any, handleRoomEvent);
      client.removeListener('Room.currentState' as any, handleRoomEvent);
      client.removeListener('RoomState.members' as any, handleRoomEvent);
    };
  }, [client]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !client) return;

    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const query = searchQuery.trim();
      const myUserId = client.getUserId();

      // Enforce exact Matrix User ID format
      if (!query.startsWith('@') || !query.includes(':')) {
        setSearchError('Please enter a complete Matrix User ID (e.g. @username:server).');
        return;
      }

      if (query === myUserId) {
        setSearchError('You cannot add yourself as a friend.');
        return;
      }

      // Lookup the profile of the exact Matrix ID to confirm existence
      try {
        const profile = await client.getProfileInfo(query);
        setSearchResults([{
          userId: query,
          displayName: profile.displayname || undefined,
          avatarUrl: profile.avatar_url || undefined
        }]);
      } catch (err: any) {
        console.log('Profile lookup failed for exact User ID:', err);
        setSearchError('User ID not found. Ensure the spelling is exact.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setSearchError(err.message || 'Search failed. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddFriend = async (targetUserId: string) => {
    if (!client) return;

    try {
      // 1. Check if we already have a DM with this user
      const existing = friends.find(room => 
        room.getMembers().some(m => m.userId === targetUserId)
      ) || sentRequests.find(room => 
        room.getMembers().some(m => m.userId === targetUserId)
      ) || incomingRequests.find(room => 
        room.getMembers().some(m => m.userId === targetUserId)
      );

      if (existing) {
        alert('A connection (or pending request) with this user already exists.');
        onSelectRoom(existing.roomId);
        return;
      }

      // 2. Create direct encrypted room
      await client.createRoom({
        preset: 'trusted_private_chat' as any,
        invite: [targetUserId],
        is_direct: true,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2',
            },
          },
        ],
      });

      alert('Friend request sent!');
      setSearchQuery('');
      setSearchResults([]);
      updateLists();
    } catch (err: any) {
      console.error('Add friend error:', err);
      alert(err.message || 'Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (roomId: string) => {
    if (!client) return;
    try {
      await client.joinRoom(roomId);
      updateLists();
      onSelectRoom(roomId);
    } catch (err: any) {
      console.error('Accept invite error:', err);
      alert('Failed to accept request');
    }
  };

  const handleDeclineRequest = async (roomId: string) => {
    if (!client) return;
    try {
      await client.leave(roomId);
      updateLists();
    } catch (err: any) {
      console.error('Decline invite error:', err);
      alert('Failed to decline request');
    }
  };

  const getOtherMemberInfo = (room: Room) => {
    if (!client) return { name: 'Unknown', userId: '' };
    const myId = client.getUserId();
    const members = room.getMembers();
    const other = members.find(m => m.userId !== myId);
    return {
      name: other?.name || other?.userId || 'Unknown',
      userId: other?.userId || ''
    };
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
            placeholder="Exact Matrix ID (@user:server)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px' }}
          />
        </div>
        <button type="submit" disabled={searchLoading} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0 }}>
          {searchLoading ? '...' : 'Search'}
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

      {searchError && (
        <div className="pdf-text-copy-14 pdf-text-center pdf-mb-150" style={{ color: 'var(--color-functional-red)' }}>
          {searchError}
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
                        onClick={() => handleAcceptRequest(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ background: '#10b981', width: '28px', height: '28px', padding: 0 }}
                        title="Accept"
                      >
                        <Check size={12} />
                      </button>
                      <button 
                        onClick={() => handleDeclineRequest(room.roomId)}
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

        {/* Sent Requests (Pending) */}
        {sentRequests.length > 0 && (
          <div>
            <div className="pdf-text-label-16 pdf-text-muted pdf-mb-100">
              Sent Requests ({sentRequests.length})
            </div>
            <div className="pdf-flex-col pdf-gap-100">
              {sentRequests.map(room => {
                const info = getOtherMemberInfo(room);
                return (
                  <div key={room.roomId} className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100)', marginBottom: 0, opacity: 0.8 }}>
                    <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)' }}>
                      <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{info.name}</div>
                      <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>{info.userId}</div>
                    </div>
                    <div className="pdf-text-copy-13-mono pdf-text-muted pdf-flex-row pdf-items-center pdf-gap-050" style={{ flexShrink: 0, fontSize: '0.75rem' }}>
                      <Clock size={12} /> Pending
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div>
          <div className="pdf-text-label-16 pdf-text-muted pdf-mb-100">
            Friends ({friends.length})
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
                const isSelected = selectedRoomId === room.roomId;
                return (
                  <div
                    key={room.roomId}
                    onClick={() => onSelectRoom(room.roomId)}
                    className={`pdf-nav-item ${isSelected ? 'active' : ''}`}
                    style={{ padding: 'var(--space-100) var(--space-150)', borderRadius: '4px' }}
                  >
                    <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-150)', overflow: 'hidden', width: '100%' }}>
                      <div style={{ 
                        width: '32px', height: '32px', 
                        borderRadius: '50%', background: 'var(--color-bg-secondary)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--color-functional-red)',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        flexShrink: 0,
                        border: '1px solid var(--color-border-default)'
                      }}>
                        {info.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: '0.9rem' }}>
                          {info.name}
                        </div>
                        <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>
                          {info.userId}
                        </div>
                      </div>
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
