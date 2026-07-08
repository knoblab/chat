import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MatrixEvent, MsgType } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { useMessages } from '../hooks/useMessages';
import { isRoomDirect } from '../utils/rooms';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { InviteModal } from './chat/InviteModal';
import type { Message } from '../types';
import { Edit2, Trash2, Download, ArrowDown } from 'lucide-react';
import { downloadMxcMedia } from '../utils/media';
import { optimizeImage } from '../utils/imageOptimizer';
import type { VirtuosoHandle } from 'react-virtuoso';

interface ChatRoomProps {
  roomId: string;
  onBack?: () => void;
  onSelectRoom?: (roomId: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, onBack }) => {
  const { client } = useMatrix();
  const { room, messages, refreshMessages } = useMessages(roomId);

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string, isImage: boolean, body: string } | null>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isDirect = client ? isRoomDirect(client, roomId) : false;

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      behavior,
    });
    setShowNewMsgPill(false);
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [roomId, scrollToBottom]);

  useEffect(() => {
    if (!client || !roomId) return;

    const handleTimelineEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
        if (!isAtBottom) {
          setShowNewMsgPill(true);
        } else {
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
      }
    };

    const handleTyping = (_event: MatrixEvent, member: any) => {
      if (!room) return;
      if (member.roomId === roomId) {
        const typingMembers = room.getMembers().filter(m => m.typing && m.userId !== client.getUserId());
        setTypingUsers(typingMembers.map(m => m.name || m.userId));
      }
    };

    client.on('Room.timeline' as any, handleTimelineEvent);
    client.on('RoomMember.typing' as any, handleTyping);

    return () => {
      client.removeListener('Room.timeline' as any, handleTimelineEvent);
      client.removeListener('RoomMember.typing' as any, handleTyping);
    };
  }, [client, roomId, room, refreshMessages, scrollToBottom, isAtBottom]);

  const handleSend = async (text: string, file?: File) => {
    if (!client) return;

    if (client.isRoomEncrypted(roomId)) {
      try {
        const crypto = client.getCrypto();
        const userIds = room?.getMembers().map(m => m.userId) || [];
        if (crypto && userIds.length > 0) {
          await crypto.getUserDeviceInfo(userIds, true);
        } else if ((client as any).downloadKeys && userIds.length > 0) {
          await (client as any).downloadKeys(userIds);
        }
      } catch (err) {
        console.warn('Failed to pre-download keys before sending:', err);
      }
    }

    if (file) {
      try {
        const optimizedFile = await optimizeImage(file, 1920, 0.85);
        const uploadRes = await client.uploadContent(optimizedFile);
        const mxcUrl = uploadRes.content_uri;
        if (mxcUrl) {
          await client.sendMessage(roomId, {
            msgtype: MsgType.Image,
            body: optimizedFile.name || 'image',
            url: mxcUrl,
            info: {
              mimetype: optimizedFile.type,
              size: optimizedFile.size,
            },
          } as any);
        }
      } catch (err: any) {
        console.error('Failed to upload image:', err);
        alert('Failed to upload image: ' + (err.message || 'Unknown error'));
      }
    } else if (text.trim()) {
      try {
        await client.sendTextMessage(roomId, text.trim());
      } catch (err: any) {
        console.error('Failed to send text message:', err);
        alert('Failed to send message: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteMessage = async (eventId: string) => {
    if (!client) return;
    try {
      await client.redactEvent(roomId, eventId);
      refreshMessages();
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleStartEdit = (msgId: string, currentText: string) => {
    setEditingMessageId(msgId);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (text: string) => {
    if (!text.trim() || !client || !editingMessageId) return;
    const eventId = editingMessageId;
    handleCancelEdit();

    try {
      await client.sendMessage(roomId, {
        msgtype: MsgType.Text,
        body: `* ${text}`,
        'm.new_content': {
          msgtype: MsgType.Text,
          body: text
        },
        'm.relates_to': {
          rel_type: 'm.replace' as any,
          event_id: eventId
        } as any
      });
      refreshMessages();
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msg: Message) => {
    const isMe = msg.sender === client?.getUserId();
    if (!isMe) return;
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      msgId: msg.id,
      isImage: msg.msgtype === 'm.image',
      body: msg.body
    });
  };

  return (
    <div className="pdf-flex-col" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ChatHeader
        room={room}
        roomId={roomId}
        onBack={onBack}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <MessageList
          messages={messages}
          room={room}
          isDirect={isDirect}
          onContextMenu={handleContextMenu}
          virtuosoRef={virtuosoRef}
          onAtBottomStateChange={(atBottom) => {
            setIsAtBottom(atBottom);
            if (atBottom) setShowNewMsgPill(false);
          }}
        />

        {showNewMsgPill && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="pdf-btn-primary pdf-radius-full"
            style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              padding: '8px 16px', fontSize: '13px', boxShadow: 'var(--shadow-hardware-elevated)',
              zIndex: 10, background: 'var(--color-functional-red)', color: '#fff',
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer'
            }}
          >
            <span>New messages</span>
            <ArrowDown size={14} />
          </button>
        )}
      </div>

      <MessageInput
        roomId={roomId}
        editingMessageId={editingMessageId}
        editingText={editingText}
        onCancelEdit={handleCancelEdit}
        onSend={handleSend}
        onSaveEdit={handleSaveEdit}
        typingUsers={typingUsers}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-hardware-elevated)',
            borderRadius: '6px',
            zIndex: 100,
            padding: '4px 0',
            minWidth: '130px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!contextMenu.isImage && (
            <button
              onClick={() => {
                handleStartEdit(contextMenu.msgId, contextMenu.body);
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
          {contextMenu.isImage && (
            <button
              onClick={() => {
                const msg = messages.find(m => m.id === contextMenu.msgId);
                if (msg?.url) downloadMxcMedia(client, msg.url, contextMenu.body || 'image');
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Download size={14} /> Download
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Delete this message?')) {
                handleDeleteMessage(contextMenu.msgId);
              }
              setContextMenu(null);
            }}
            className="pdf-nav-item"
            style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-functional-red)', cursor: 'pointer' }}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
};
