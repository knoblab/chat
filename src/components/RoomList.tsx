import React from 'react';
import { useRooms } from '../hooks/useRooms';
import { useMatrix } from '../matrix/MatrixProvider';
import { Hash, LogOut, Lock, ChevronRight, MessageSquare } from 'lucide-react';

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
    <div className="pdf-flex-col" style={{ height: '100%', padding: '4px 0' }}>
      {roomInfos.length === 0 ? (
        <div className="pdf-flex-col pdf-items-center pdf-justify-center" style={{ padding: '36px 20px', textAlign: 'center', border: '1px dashed var(--color-border-default)', borderRadius: '16px', margin: '12px 0', background: 'var(--color-bg-secondary)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '24px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-functional-red)', marginBottom: '12px' }}>
            <MessageSquare size={24} />
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>아직 대화 목록이 없습니다</div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', maxWidth: '240px', lineHeight: 1.4 }}>
            상단 버튼으로 새 암호화 채팅방을 만들거나 친구 목록에서 대화를 시작해보세요.
          </p>
        </div>
      ) : (
        roomInfos.map(info => {
          const isEncrypted = client?.isRoomEncrypted(info.room.roomId);
          return (
            <div
              key={info.room.roomId}
              onClick={() => onSelectRoom(info.room.roomId)}
              className={`pdf-nav-item pdf-mobile-row ${selectedRoomId === info.room.roomId ? 'active' : ''}`}
              style={{ padding: '12px 14px', borderRadius: '12px', marginBottom: '2px', border: 'none' }}
            >
              <div className="pdf-flex-row pdf-items-center" style={{ gap: '14px', overflow: 'hidden', width: '100%' }}>
                {/* Avatar */}
                <div style={{ 
                  width: '44px', height: '44px', 
                  borderRadius: info.isDirect ? '22px' : '14px',
                  background: info.isDirect ? 'linear-gradient(135deg, var(--color-functional-red), #b91c1c)' : 'var(--color-bg-tertiary)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: info.isDirect ? '#fff' : 'var(--color-functional-red)',
                  fontWeight: 700,
                  fontSize: info.isDirect ? '16px' : '15px',
                  flexShrink: 0,
                  boxShadow: info.isDirect ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none',
                  border: info.isDirect ? 'none' : '1px solid var(--color-border-default)',
                  position: 'relative'
                }}>
                  {info.isDirect ? info.avatarLetter : <Hash size={18} />}
                </div>

                {/* Name & subtitle */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="pdf-flex-row pdf-items-center pdf-justify-between">
                    <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, fontSize: '15px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{info.displayName}</span>
                      {isEncrypted && (
                        <span title="종단간 암호화(E2EE) 적용된 방" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                          <Lock size={13} />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ 
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
                    fontSize: '12px', marginTop: '3px',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    <span style={{ fontWeight: 500, color: info.isDirect ? '#a1a1aa' : '#71717a' }}>{info.isDirect ? '개인 메시지(DM)' : '그룹 채팅방'}</span>
                    {isEncrypted && (
                      <span style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                        • E2EE 암호화
                      </span>
                    )}
                  </div>
                </div>

                {/* Right side actions */}
                <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', flexShrink: 0 }}>
                  {info.displayName !== 'General Chat' && (
                    <button 
                      type="button"
                      onClick={(e) => onLeaveClick(e, info.room.roomId)}
                      className="pdf-secondary-btn pdf-btn-xs"
                      style={{ width: '30px', height: '30px', padding: 0, justifyContent: 'center', borderRadius: '15px', border: 'none', background: 'transparent' }}
                      title="나가기 및 삭제"
                    >
                      <LogOut size={15} style={{ color: 'var(--color-functional-red)' }} />
                    </button>
                  )}
                  <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};


