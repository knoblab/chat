import React from 'react';
import { useRooms } from '../hooks/useRooms';
import { useMatrix } from '../matrix/MatrixProvider';
import { Hash, LogOut, Lock } from 'lucide-react';

interface RoomListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
}

export const RoomList: React.FC<RoomListProps> = ({ onSelectRoom, selectedRoomId }) => {
  const { client } = useMatrix();
  const { roomInfos, handleLeaveRoom } = useRooms();

  const onLeaveClick = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    const success = await handleLeaveRoom(roomId);
    if (success && selectedRoomId === roomId) {
      onSelectRoom('');
    }
  };

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
              {/* Leave button (hidden for General Chat) */}
              {info.displayName !== 'General Chat' && (
                <button 
                  onClick={(e) => onLeaveClick(e, info.room.roomId)}
                  className="pdf-secondary-btn pdf-btn-xs"
                  style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', flexShrink: 0, opacity: 0.5, border: 'none', background: 'transparent' }}
                  title="Leave & Delete"
                >
                  <LogOut size={12} style={{ color: 'var(--color-functional-red)' }} />
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

