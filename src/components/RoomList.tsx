import React, { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { Hash, LogOut } from 'lucide-react';

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
}

export const RoomList: React.FC<RoomListProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { client } = useMatrix();
  const [rooms, setRooms] = useState<Room[]>([]);

  const updateRooms = () => {
    if (!client) return;
    const allRooms = client.getVisibleRooms();
    // Filter out DM rooms (where is_direct is true)
    const groupRooms = allRooms.filter(room => {
      const isDirect = room.currentState.getStateEvents('m.room.create', '')?.getContent().is_direct || false;
      return !isDirect;
    });
    setRooms(groupRooms);
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

    return () => {
      client.removeListener('Room' as any, updateRooms);
      client.removeListener('Room.name' as any, updateRooms);
      client.removeListener('Room.myMembership' as any, updateRooms);
    };
  }, [client]);

  return (
    <div className="pdf-flex-col" style={{ height: '100%', padding: 'var(--space-100) 0' }}>
      {rooms.length === 0 ? (
        <p className="pdf-text-copy-14 pdf-text-center pdf-text-muted" style={{ padding: 'var(--space-200)' }}>
          No rooms joined yet.
        </p>
      ) : (
        rooms.map(room => (
          <div
            key={room.roomId}
            onClick={() => onSelectRoom(room.roomId)}
            className={`pdf-nav-item ${selectedRoomId === room.roomId ? 'active' : ''}`}
            style={{ padding: 'var(--space-100) var(--space-200)' }}
          >
            <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-150)', overflow: 'hidden', width: '100%' }}>
              <div style={{ 
                width: '32px', height: '32px', 
                borderRadius: '50%', background: 'var(--color-bg-secondary)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-functional-red)',
                flexShrink: 0,
                border: '1px solid var(--color-border-default)'
              }}>
                <Hash size={14} />
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: '0.9rem' }}>
                  {room.name || 'Unnamed Room'}
                </div>
              </div>
              <button 
                onClick={(e) => handleLeaveRoom(e, room.roomId)}
                className="pdf-secondary-btn pdf-btn-xs"
                style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', flexShrink: 0, opacity: 0.7, border: 'none', background: 'transparent' }}
                title="Leave & Delete Room"
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
