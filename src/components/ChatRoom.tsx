import React, { useEffect, useState, useRef } from 'react';
import { MatrixEvent, Room, MsgType } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { Send, Lock, Image as ImageIcon, Edit3, Check, X, UserPlus, Search } from 'lucide-react';

interface ChatRoomProps {
  roomId: string;
}

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  isEncrypted: boolean;
  msgtype?: string;
  url?: string;
}

interface SearchResult {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId }) => {
  const { client } = useMatrix();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Room Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // Image Upload State
  const [uploading, setUploading] = useState(false);

  // Invite state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<SearchResult[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!client) return;
    const r = client.getRoom(roomId);
    setRoom(r);
    if (r) {
      setNewRoomName(r.name || '');
    }

    const updateMessages = () => {
      if (!r) return;
      const timeline = r.getLiveTimeline().getEvents();
      const msgs = timeline
        .filter(event => event.getType() === 'm.room.message')
        .map(event => {
          const content = event.getContent();
          return {
            id: event.getId() || Math.random().toString(),
            sender: event.getSender() || 'Unknown',
            body: content.body || '',
            msgtype: content.msgtype || 'm.text',
            url: content.url || '',
            timestamp: event.getTs(),
            isEncrypted: event.isEncrypted()
          };
        });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    updateMessages();

    const handleEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        if (event.getType() === 'm.room.message' || event.getType() === 'm.room.name') {
          updateMessages();
          if (event.getType() === 'm.room.name' && r) {
            setNewRoomName(r.name || '');
          }
        }
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

  const handleSaveName = async () => {
    if (!newRoomName.trim() || !client || !room) return;
    try {
      await client.setRoomName(roomId, newRoomName.trim());
      setIsEditingName(false);
    } catch (err: any) {
      console.error('Failed to change room name:', err);
      alert(err.message || 'Failed to change room name');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setUploading(true);
    try {
      const token = client.getAccessToken();
      if (!token) throw new Error("No access token found");

      const uploadUrl = `${client.baseUrl}/_matrix/media/v3/upload?filename=${encodeURIComponent(file.name)}`;
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': file.type,
        },
        body: file
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const res = await response.json();
      const mxcUri = res.content_uri;

      // 2. Send E2EE-capable m.image message
      await client.sendMessage(roomId, {
        msgtype: MsgType.Image,
        url: mxcUri,
        body: file.name,
        info: {
          mimetype: file.type,
          size: file.size
        }
      });
    } catch (err: any) {
      console.error('Failed to upload image:', err);
      alert(err.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInviteSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteQuery.trim() || !client) return;

    setInviteLoading(true);
    setInviteError('');
    setInviteResults([]);
    setInviteSuccess('');

    try {
      const query = inviteQuery.trim();
      const myUserId = client.getUserId();

      if (query.startsWith('@') && query.includes(':')) {
        if (query === myUserId) {
          setInviteError('You cannot invite yourself.');
        } else {
          setInviteResults([{ userId: query }]);
        }
      } else {
        const res = await client.searchUserDirectory({ term: query, limit: 10 });
        let results = res.results.map(r => ({
          userId: r.user_id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url
        }));

        if (results.length === 0 && myUserId) {
          const domain = myUserId.split(':')[1];
          const localUserId = `@${query.toLowerCase()}:${domain}`;
          
          if (localUserId !== myUserId) {
            try {
              const profile = await client.getProfileInfo(localUserId);
              results = [{
                userId: localUserId,
                displayName: profile.displayname || query,
                avatarUrl: profile.avatar_url
              }];
            } catch (profileErr) {
              console.log('Local profile lookup failed for invite:', profileErr);
            }
          }
        }

        if (myUserId) {
          results = results.filter(r => r.userId !== myUserId);
        }

        setInviteResults(results);
        if (results.length === 0) {
          setInviteError('No users found.');
        }
      }
    } catch (err: any) {
      console.error('Invite search error:', err);
      setInviteError(err.message || 'Search failed. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteUser = async (targetUserId: string) => {
    if (!client) return;
    setInviteError('');
    setInviteSuccess('');
    try {
      await client.invite(roomId, targetUserId);
      setInviteSuccess(`Successfully invited ${targetUserId}!`);
      setTimeout(() => {
        setIsInviteModalOpen(false);
        setInviteQuery('');
        setInviteResults([]);
        setInviteSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Invite user error:', err);
      setInviteError(err.message || 'Failed to invite user');
    }
  };

  if (!room) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading room...</div>;
  }

  const isDirect = room.currentState.getStateEvents('m.room.create', '')?.getContent().is_direct || false;

  return (
    <div className="pdf-flex-col pdf-h-full" style={{ flex: 1 }}>
      {/* Header */}
      <div className="pdf-border-bottom pdf-bg-secondary pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-150) var(--space-300)', minHeight: '60px' }}>
        <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', flex: 1, overflow: 'hidden' }}>
          {isEditingName ? (
            <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-050)', width: '100%', maxWidth: '300px' }}>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                className="pdf-input pdf-input-xs pdf-font-mono"
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
                onClick={() => { setIsEditingName(false); setNewRoomName(room.name || ''); }}
                className="pdf-btn-primary pdf-btn-xs"
                style={{ width: '32px', height: '32px', padding: 0, background: '#ef4444' }}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', overflow: 'hidden' }}>
              <h2 className="pdf-text-heading-24" style={{ margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '1.25rem' }}>
                {room.name || 'Unnamed Room'}
              </h2>
              <button
                onClick={() => setIsEditingName(true)}
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
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="pdf-btn-primary pdf-btn-xs"
              style={{ background: 'var(--color-functional-red)', color: 'var(--color-bg-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '28px', padding: '0 var(--space-100)' }}
            >
              <UserPlus size={12} /> Invite
            </button>
          )}
          {client?.isRoomEncrypted(roomId) && (
            <div className="pdf-badge pdf-text-label-14-mono" style={{ borderColor: '#10b981', color: '#10b981', padding: 'var(--space-050) var(--space-100)', display: 'flex', alignItems: 'center', gap: 'var(--space-050)', height: '28px' }}>
              <Lock size={12} /> E2EE SECURE
            </div>
          )}
        </div>
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
                  padding: msg.msgtype === 'm.image' ? 'var(--space-050)' : 'var(--space-100) var(--space-150)',
                  borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  boxShadow: isMe ? 'none' : 'var(--shadow-hardware-bevel)',
                  marginBottom: 0,
                  maxWidth: '100%'
                }}
              >
                {msg.msgtype === 'm.image' && msg.url ? (
                  <div>
                    <img 
                      src={client?.mxcUrlToHttp(msg.url) || ''} 
                      alt={msg.body} 
                      className="pdf-radius-sm"
                      style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', cursor: 'pointer' }}
                      onClick={() => {
                        const httpUrl = client?.mxcUrlToHttp(msg.url || '') || '';
                        if (httpUrl) window.open(httpUrl, '_blank');
                      }}
                    />
                    <div className="pdf-text-copy-13-mono pdf-mt-100" style={{ 
                      fontSize: '11px', 
                      color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
                      padding: '0 var(--space-050) var(--space-050) var(--space-050)' 
                    }}>
                      {msg.body}
                    </div>
                  </div>
                ) : (
                  msg.body
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="pdf-border-top" style={{ padding: 'var(--space-200) var(--space-300)', background: 'var(--color-bg-primary)' }}>
        <form onSubmit={handleSend} className="pdf-flex-row pdf-gap-150">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="pdf-secondary-btn pdf-btn-md"
            style={{ width: '44px', height: '44px', padding: 0, justifyContent: 'center', flexShrink: 0 }}
            title="Upload Image"
            disabled={uploading}
          >
            {uploading ? '...' : <ImageIcon size={18} />}
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={uploading ? "Uploading image..." : "Type an encrypted message..."}
            className="pdf-input pdf-input-md pdf-font-mono"
            style={{ maxWidth: 'none' }}
            disabled={uploading}
          />
          <button type="submit" disabled={!inputText.trim() || uploading} className="pdf-btn-primary pdf-btn-md">
            <Send size={16} /> Send
          </button>
        </form>
      </div>

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 'var(--space-200)'
        }}>
          <div className="pdf-panel pdf-shadow-glow" style={{
            width: '100%',
            maxWidth: '450px',
            padding: 'var(--space-300)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-200)',
            position: 'relative',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)'
          }}>
            {/* Modal Header */}
            <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: 'var(--space-100)' }}>
              <h3 className="pdf-text-heading-24 pdf-text-red" style={{ margin: 0, fontSize: '1.2rem' }}>Invite User</h3>
              <button 
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteQuery('');
                  setInviteResults([]);
                  setInviteError('');
                  setInviteSuccess('');
                }}
                className="pdf-secondary-btn"
                style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Invite Form */}
            <form onSubmit={handleInviteSearch} className="pdf-flex-row pdf-gap-100">
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
                <input
                  type="text"
                  className="pdf-input pdf-input-sm pdf-font-mono"
                  placeholder="Nickname or Matrix ID..."
                  value={inviteQuery}
                  onChange={e => setInviteQuery(e.target.value)}
                  style={{ paddingLeft: '32px' }}
                />
              </div>
              <button type="submit" disabled={inviteLoading} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0 }}>
                {inviteLoading ? '...' : 'Search'}
              </button>
            </form>

            {/* Success & Error message */}
            {inviteSuccess && (
              <div className="pdf-text-copy-14 pdf-text-center" style={{ color: '#10b981', fontWeight: 600 }}>
                {inviteSuccess}
              </div>
            )}
            {inviteError && (
              <div className="pdf-text-copy-14 pdf-text-center" style={{ color: 'var(--color-functional-red)' }}>
                {inviteError}
              </div>
            )}

            {/* Search Results */}
            {inviteResults.length > 0 && (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--color-border-default)', borderRadius: '6px' }}>
                {inviteResults.map(result => (
                  <div key={result.userId} className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100)', borderBottom: '1px solid var(--color-border-default)' }}>
                    <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)', flex: 1 }}>
                      <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.85rem' }}>{result.displayName || result.userId.split(':')[0].substring(1)}</div>
                      <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.75rem', marginTop: '2px' }}>{result.userId}</div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleInviteUser(result.userId)}
                      className="pdf-btn-primary pdf-btn-xs"
                      style={{ flexShrink: 0 }}
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
