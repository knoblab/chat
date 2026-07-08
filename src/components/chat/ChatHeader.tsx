import React, { useState } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../../matrix/MatrixProvider';
import { isRoomDirect } from '../../utils/rooms';
import { ArrowLeft, Edit3, Check, X, Link, UserPlus, Lock } from 'lucide-react';

interface ChatHeaderProps {
  room: Room | null;
  roomId: string;
  onBack?: () => void;
  onOpenInviteModal: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  room,
  roomId,
  onBack,
  onOpenInviteModal,
}) => {
  const { client } = useMatrix();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState(room?.name || '');

  const isDirect = client ? isRoomDirect(client, roomId) : false;

  const handleSaveName = async () => {
    if (!client || !room || !newRoomName.trim()) return;
    try {
      await client.setRoomName(roomId, newRoomName.trim());
      setIsEditingName(false);
    } catch (err: any) {
      console.error('Failed to set room name:', err);
      alert('Failed to rename room: ' + (err.message || 'Unknown error'));
    }
  };

  const handleShareLink = () => {
    if (client && roomId && !isDirect) {
      client.sendStateEvent(roomId, 'm.room.join_rules' as any, { join_rule: 'public' }, '').catch(() => {});
      client.sendStateEvent(roomId, 'm.room.history_visibility' as any, { history_visibility: 'shared' }, '').catch(() => {});
    }
    const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => alert('Invite link copied to clipboard!\n\n' + inviteUrl))
      .catch(() => alert('Failed to copy link: ' + inviteUrl));
  };

  const isMobile = window.innerWidth < 1024 || !!onBack;

  return (
    <div className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ 
      padding: isMobile ? '8px 12px' : 'var(--space-150) var(--space-200)', 
      height: isMobile ? 'calc(56px + env(safe-area-inset-top, 0px))' : 'auto',
      paddingTop: isMobile ? 'calc(8px + env(safe-area-inset-top, 0px))' : 'var(--space-150)',
      marginBottom: 0, borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0,
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(28px) saturate(190%)',
      WebkitBackdropFilter: 'blur(28px) saturate(190%)',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
      position: 'sticky', top: 0, zIndex: 50
    }}>
      <div className="pdf-flex-row pdf-items-center" style={{ gap: isMobile ? '10px' : 'var(--space-150)', overflow: 'hidden', flex: 1 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="pdf-secondary-btn"
            style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center', borderRadius: '19px', flexShrink: 0, background: 'var(--color-bg-secondary)', border: 'none' }}
            title="목록으로 뒤로 가기"
          >
            <ArrowLeft size={18} />
          </button>
        )}

        {/* Room Avatar on Mobile & Desktop */}
        <div className="pdf-radius-circle" style={{
          width: isMobile ? '38px' : '40px',
          height: isMobile ? '38px' : '40px',
          background: isDirect ? 'linear-gradient(135deg, var(--color-functional-red), #991b1b)' : 'var(--color-bg-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isDirect ? '#fff' : 'var(--color-functional-red)',
          fontWeight: 700,
          fontSize: '15px',
          flexShrink: 0,
          position: 'relative',
          border: isDirect ? 'none' : '1px solid var(--color-border-default)'
        }}>
          {room?.name ? room.name.charAt(0).toUpperCase() : (isDirect ? 'U' : '#')}
        </div>
        
        {isEditingName ? (
          <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', flex: 1 }}>
            <input
              type="text"
              className="pdf-input pdf-input-sm"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              style={{ height: '34px', borderRadius: '17px', paddingLeft: '12px', fontSize: '14px', flex: 1 }}
              autoFocus
            />
            <button 
              type="button"
              onClick={handleSaveName}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ width: '34px', height: '34px', padding: 0, background: '#10b981', borderRadius: '17px', flexShrink: 0 }}
            >
              <Check size={15} />
            </button>
            <button 
              type="button"
              onClick={() => { setIsEditingName(false); setNewRoomName(room?.name || ''); }}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ width: '34px', height: '34px', padding: 0, background: '#ef4444', borderRadius: '17px', flexShrink: 0 }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="pdf-flex-col" style={{ overflow: 'hidden', flex: 1 }}>
            <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', overflow: 'hidden' }}>
              <h2 className="pdf-text-heading-24" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: isMobile ? '15px' : '1.15rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{room?.name || 'Unnamed Room'}</span>
                {client?.isRoomEncrypted(roomId) && (
                  <span title="종단간 암호화(E2EE) 적용된 방" style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-secondary)', flexShrink: 0 }}>
                    <Lock size={14} />
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => { setIsEditingName(true); setNewRoomName(room?.name || ''); }}
                className="pdf-secondary-btn pdf-btn-xs"
                style={{ width: '24px', height: '24px', padding: 0, justifyContent: 'center', border: 'none', background: 'transparent', flexShrink: 0 }}
                title="방 이름 수정"
              >
                <Edit3 size={13} style={{ color: 'var(--color-text-secondary)' }} />
              </button>
            </div>
            {isMobile && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, marginTop: '1px' }}>
                <Lock size={10} /> 종단간 암호화(E2EE) • {isDirect ? '1:1 보안 대화' : '그룹 채팅방'}
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="pdf-flex-row pdf-items-center" style={{ gap: isMobile ? '6px' : 'var(--space-100)', flexShrink: 0 }}>
        {!isDirect && (
          <div className="pdf-flex-row pdf-items-center" style={{ gap: isMobile ? '6px' : 'var(--space-050)' }}>
            {isMobile ? (
              <>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="pdf-secondary-btn"
                  style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', borderRadius: '18px', background: 'var(--color-bg-secondary)', border: 'none' }}
                  title="초대 링크 복사"
                >
                  <Link size={16} />
                </button>
                <button
                  type="button"
                  onClick={onOpenInviteModal}
                  className="pdf-btn-primary"
                  style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', borderRadius: '18px', background: 'var(--color-functional-red)', border: 'none' }}
                  title="친구 초대하기"
                >
                  <UserPlus size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleShareLink}
                  className="pdf-btn-primary pdf-btn-xs"
                  style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '30px', padding: '0 var(--space-100)', borderRadius: '15px', border: '1px solid var(--color-border-default)', fontWeight: 600 }}
                  title="Share Link"
                >
                  <Link size={13} /> 링크 복사
                </button>
                <button
                  type="button"
                  onClick={onOpenInviteModal}
                  className="pdf-btn-primary pdf-btn-xs"
                  style={{ background: 'var(--color-functional-red)', color: '#fff', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '30px', padding: '0 var(--space-100)', borderRadius: '15px', fontWeight: 600 }}
                >
                  <UserPlus size={13} /> 초대하기
                </button>
              </>
            )}
          </div>
        )}
        {!isMobile && client?.isRoomEncrypted(roomId) && (
          <div className="pdf-badge pdf-text-label-14-mono" style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', padding: '0 10px', display: 'flex', alignItems: 'center', gap: '6px', height: '30px', borderRadius: '15px', fontWeight: 700, fontSize: '11px' }}>
            <Lock size={12} /> E2EE SECURE
          </div>
        )}
      </div>
    </div>
  );
};
