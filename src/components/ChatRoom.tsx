import React, { useEffect, useState, useRef } from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { Send, Lock } from 'lucide-react';

interface ChatRoomProps {
  roomId: string;
}

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  isEncrypted: boolean;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId }) => {
  const { client } = useMatrix();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!client) return;
    const r = client.getRoom(roomId);
    setRoom(r);

    const updateMessages = () => {
      if (!r) return;
      const timeline = r.getLiveTimeline().getEvents();
      const msgs = timeline
        .filter(event => event.getType() === 'm.room.message')
        .map(event => ({
          id: event.getId() || Math.random().toString(),
          sender: event.getSender() || 'Unknown',
          body: event.getContent().body || '',
          timestamp: event.getTs(),
          isEncrypted: event.isEncrypted()
        }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    updateMessages();

    const handleEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId && event.getType() === 'm.room.message') {
        updateMessages();
      }
    };

    client.on('Room.timeline' as any, handleEvent);

    return () => {
      client.removeListener('Room.timeline' as any, handleEvent);
    };
  }, [client, roomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !client) return;

    const text = inputText;
    setInputText('');

    try {
      await client.sendTextMessage(roomId, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text); // restore on fail
    }
  };

  if (!room) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading room...</div>;
  }

  return (
    <div className="pdf-flex-col pdf-h-full" style={{ flex: 1 }}>
      {/* Header */}
      <div className="pdf-border-bottom pdf-bg-secondary pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-200) var(--space-300)' }}>
        <h2 className="pdf-text-heading-24" style={{ margin: 0 }}>{room.name || 'Unnamed Room'}</h2>
        {client?.isRoomEncrypted(roomId) && (
          <div className="pdf-badge pdf-text-label-14-mono" style={{ borderColor: '#10b981', color: '#10b981', padding: 'var(--space-050) var(--space-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)' }}>
            <Lock size={12} /> E2EE SECURE
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="pdf-flex-col pdf-gap-150" style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-300)' }}>
        {messages.map(msg => {
          const isMe = msg.sender === client?.getUserId();
          return (
            <div key={msg.id} style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-050)',
              alignItems: isMe ? 'flex-end' : 'flex-start'
            }}>
              <div className="pdf-text-copy-13-mono pdf-text-muted">{msg.sender}</div>
              <div 
                className="pdf-panel pdf-selectable" 
                style={{
                  background: isMe ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)',
                  color: isMe ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                  borderColor: isMe ? 'var(--color-functional-red)' : 'var(--color-border-default)',
                  padding: 'var(--space-100) var(--space-150)',
                  borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  boxShadow: isMe ? 'none' : 'var(--shadow-hardware-bevel)',
                  marginBottom: 0
                }}
              >
                {msg.body}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="pdf-border-top" style={{ padding: 'var(--space-200) var(--space-300)', background: 'var(--color-bg-primary)' }}>
        <form onSubmit={handleSend} className="pdf-flex-row pdf-gap-150">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="Type an encrypted message..."
            className="pdf-input pdf-input-md pdf-font-mono"
            style={{ maxWidth: 'none' }}
          />
          <button type="submit" disabled={!inputText.trim()} className="pdf-btn-primary pdf-btn-md">
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
};
