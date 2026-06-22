import React, { useEffect, useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { Hash } from 'lucide-react';

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
}

export const RoomList: React.FC<RoomListProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { client } = useMatrix();
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    if (!client) return;

    const updateRooms = () => {
      const allRooms = client.getVisibleRooms();
      // Filter out DM rooms (where is_direct is true or active members <= 2)
      const groupRooms = allRooms.filter(room => {
        const isDirect = room.currentState.getStateEvents('m.room.create', '')?.getContent().is_direct || false;
        const activeMembers = room.getMembers().filter(m => m.membership === 'join' || m.membership === 'invite');
        const isTwoMember = activeMembers.length <= 2;
        return !isDirect && !isTwoMember;
      });
      setRooms(groupRooms);
    };

    updateRooms();

    client.on('Room' as any, updateRooms);
    client.on('Room.name' as any, updateRooms);

    return () => {
      client.removeListener('Room' as any, updateRooms);
      client.removeListener('Room.name' as any, updateRooms);
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
            </div>
          </div>
        ))
      )}
    </div>
  );
};
