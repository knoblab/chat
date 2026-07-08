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
    const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => alert('Invite link copied to clipboard!\n\n' + inviteUrl))
      .catch(() => alert('Failed to copy link: ' + inviteUrl));
  };

  return (
    <div className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-150) var(--space-200)', marginBottom: 0, borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
      <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-150)', overflow: 'hidden' }}>
        {onBack && (
          <button
            onClick={onBack}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
            title="Back to Rooms"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        
        {isEditingName ? (
          <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-050)' }}>
            <input
              type="text"
              className="pdf-input pdf-input-sm"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              style={{ height: '32px' }}
              autoFocus
            />
            <button 
              onClick={handleSaveName}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, background: '#10b981' }}
            >
              <Check size={14} />
            </button>
            <button 
              onClick={() => { setIsEditingName(false); setNewRoomName(room?.name || ''); }}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, background: '#ef4444' }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', overflow: 'hidden' }}>
            <h2 className="pdf-text-heading-24" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1.25rem' }}>
              {room?.name || 'Unnamed Room'}
            </h2>
            <button
              onClick={() => { setIsEditingName(true); setNewRoomName(room?.name || ''); }}
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
              title="Edit Room Name"
            >
              <Edit3 size={12} />
            </button>
          </div>
        )}
      </div>
      
      <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)' }}>
        {!isDirect && (
          <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-050)' }}>
            <button
              onClick={handleShareLink}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '28px', padding: '0 var(--space-100)', border: '1px solid var(--color-border-default)' }}
              title="Share Link"
            >
              <Link size={12} /> Share Link
            </button>
            <button
              onClick={onOpenInviteModal}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ background: 'var(--color-functional-red)', color: 'var(--color-bg-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '28px', padding: '0 var(--space-100)' }}
            >
              <UserPlus size={12} /> Invite
            </button>
          </div>
        )}
        {client?.isRoomEncrypted(roomId) && (
          <div className="pdf-badge pdf-text-label-14-mono" style={{ borderColor: '#10b981', color: '#10b981', padding: 'var(--space-050) var(--space-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '28px' }}>
            <Lock size={12} /> E2EE SECURE
          </div>
        )}
      </div>
    </div>
  );
};
