import React, { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { Hash, LogOut, Lock } from 'lucide-react';

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
}

interface RoomInfo {
  room: Room;
  isDirect: boolean;
  displayName: string;
  avatarLetter: string;
  lastActivity: number;
}

export const RoomList: React.FC<RoomListProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { client } = useMatrix();
  const [roomInfos, setRoomInfos] = useState<RoomInfo[]>([]);

  const getOtherMember = (room: Room) => {
    if (!client) return null;
    const myId = client.getUserId();
    const members = room.getMembers();
    return members.find(m => m.userId !== myId && (m.membership === 'join' || m.membership === 'invite'));
  };

  const updateRooms = () => {
    if (!client) return;
    const allRooms = client.getVisibleRooms();

    const infos: RoomInfo[] = allRooms
      .filter(room => {
        // Only show rooms the user has joined
        return room.getMyMembership() === 'join';
      })
      .map(room => {
        const isDirect = room.currentState.getStateEvents('m.room.create', '')?.getContent().is_direct || false;

        // For DM rooms: check if the other member has actually joined
        // (if they haven't, it's a pending sent request — skip it)
        if (isDirect) {
          const other = getOtherMember(room);
          if (!other || other.membership !== 'join') {
            return null; // pending request, don't show in chat list
          }
        }

        // Determine display name and avatar
        let displayName = room.name || 'Unnamed Room';
        let avatarLetter = '#';

        if (isDirect) {
          const other = getOtherMember(room);
          if (other) {
            displayName = other.name || other.userId.split(':')[0].substring(1);
            avatarLetter = displayName.charAt(0).toUpperCase();
          }
        } else {
          avatarLetter = '#';
        }

        // Get last activity timestamp for sorting
        const timeline = room.getLiveTimeline()?.getEvents();
        const lastEvent = timeline && timeline.length > 0 ? timeline[timeline.length - 1] : null;
        const lastActivity = lastEvent ? lastEvent.getTs() : 0;

        return { room, isDirect, displayName, avatarLetter, lastActivity };
      })
      .filter(Boolean) as RoomInfo[];

    // Sort: most recent activity first
    infos.sort((a, b) => b.lastActivity - a.lastActivity);

    setRoomInfos(infos);
  };

  const handleLeaveRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!client) return;
    if (!confirm('Are you sure you want to leave and delete this room?')) return;

    try {
      await client.leave(roomId);
      await client.forget(roomId);
      if (selectedRoomId === roomId) {
        onSelectRoom('');
      }
      updateRooms();
    } catch (err: any) {
      console.error('Failed to leave room:', err);
      alert(err.message || 'Failed to leave room');
    }
  };

  useEffect(() => {
    if (!client) return;

    updateRooms();

    client.on('Room' as any, updateRooms);
    client.on('Room.name' as any, updateRooms);
    client.on('Room.myMembership' as any, updateRooms);
    client.on('Room.timeline' as any, updateRooms);
    client.on('RoomState.members' as any, updateRooms);

    return () => {
      client.removeListener('Room' as any, updateRooms);
      client.removeListener('Room.name' as any, updateRooms);
      client.removeListener('Room.myMembership' as any, updateRooms);
      client.removeListener('Room.timeline' as any, updateRooms);
      client.removeListener('RoomState.members' as any, updateRooms);
    };
  }, [client]);

  return (
    <div className="pdf-flex-col" style={{ height: '100%', padding: 'var(--space-100) 0' }}>
      {roomInfos.length === 0 ? (
        <p className="pdf-text-copy-14 pdf-text-center pdf-text-muted" style={{ padding: 'var(--space-200)' }}>
          No conversations yet. Add a friend to start chatting!
        </p>
      ) : (
        roomInfos.map(info => (
          <div
            key={info.room.roomId}
            onClick={() => onSelectRoom(info.room.roomId)}
            className={`pdf-nav-item ${selectedRoomId === info.room.roomId ? 'active' : ''}`}
            style={{ padding: 'var(--space-100) var(--space-200)' }}
          >
            <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-150)', overflow: 'hidden', width: '100%' }}>
              {/* Avatar / Icon */}
              <div style={{ 
                width: '36px', height: '36px', 
                borderRadius: info.isDirect ? '50%' : '8px',
                background: info.isDirect ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: info.isDirect ? '#fff' : 'var(--color-functional-red)',
                fontWeight: 'bold',
                fontSize: info.isDirect ? '0.9rem' : '0.8rem',
                flexShrink: 0,
                border: info.isDirect ? 'none' : '1px solid var(--color-border-default)'
              }}>
                {info.isDirect ? info.avatarLetter : <Hash size={14} />}
              </div>
              {/* Name & subtitle */}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: '0.9rem' }}>
                  {info.displayName}
                </div>
                <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ 
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
                  fontSize: '0.7rem', marginTop: '2px',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  {info.isDirect ? 'DM' : 'Group'}
                  {client?.isRoomEncrypted(info.room.roomId) && (
                    <><Lock size={9} /> E2EE</>
                  )}
                </div>
              </div>
              {/* Leave button */}
              <button 
                onClick={(e) => handleLeaveRoom(e, info.room.roomId)}
                className="pdf-secondary-btn pdf-btn-xs"
                style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', flexShrink: 0, opacity: 0.5, border: 'none', background: 'transparent' }}
                title="Leave & Delete"
              >
                <LogOut size={12} style={{ color: 'var(--color-functional-red)' }} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

