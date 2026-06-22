import React, { useEffect, useState, useRef } from 'react';
import { MatrixEvent, Room, MsgType, Preset } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { AuthImage, isRoomDirect } from './AuthImage';
import { HOMESERVER_URL } from '../matrix/client';
import { Send, Lock, Image as ImageIcon, Edit3, Check, X, UserPlus, Search, ArrowLeft, Trash2, Edit2, Download } from 'lucide-react';

interface ChatRoomProps {
  roomId: string;
  onBack?: () => void;
  onSelectRoom?: (roomId: string) => void;
}

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: number;
  isEncrypted: boolean;
  msgtype?: string;
  url?: string;
  isEdited?: boolean;
}

interface SearchResult {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

export const mxcToHttp = (mxcUrl: string, baseUrl: string, accessToken?: string): string => {
  if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return '';
  const parts = mxcUrl.substring(6).split('/');
  if (parts.length < 2) return '';
  const serverName = parts[0];
  const mediaId = parts.slice(1).join('/');
  let url = `${baseUrl}/_matrix/media/v3/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
  if (accessToken) {
    url += `?access_token=${encodeURIComponent(accessToken)}`;
  }
  return url;
};

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, onBack, onSelectRoom }) => {
  const { client } = useMatrix();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  
  // Scroll and Pill states
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowNewMsgPill(false);
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setShowNewMsgPill(false);
    }
  };
  
  // Message edit states
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // Room Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');

  // Image Upload State
  const [uploading, setUploading] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string, isImage: boolean, body: string } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Invite state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteResults, setInviteResults] = useState<SearchResult[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

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
        .filter(event => {
          if (event.getType() !== 'm.room.message') return false;
          if (event.isRedacted()) return false;
          // Filter out edit replacement events (m.replace)
          const content = event.getContent();
          const relatesTo = content['m.relates_to'];
          if (relatesTo && relatesTo.rel_type === 'm.replace') return false;
          return true;
        })
        .map(event => {
          // Check for edit replacement: look for a replacing event or m.new_content in the content
          const replacingEvent = event.replacingEvent?.();
          let body: string;
          let msgtype: string;
          let url: string;
          let isEdited = false;

          if (replacingEvent) {
            // SDK has linked the edit event
            const rc = replacingEvent.getContent();
            const newContent = rc['m.new_content'] || rc;
            body = newContent.body || '';
            msgtype = newContent.msgtype || 'm.text';
            url = newContent.url || '';
            isEdited = true;
          } else {
            // Use the event's own content (handles decrypted E2EE messages)
            const c = event.getContent();
            body = c.body || '';
            msgtype = c.msgtype || 'm.text';
            url = c.url || '';
          }

          return {
            id: event.getId() || Math.random().toString(),
            sender: event.getSender() || 'Unknown',
            body,
            msgtype,
            url,
            timestamp: event.getTs(),
            isEncrypted: event.isEncrypted(),
            isEdited
          };
        });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    };

    updateMessages();

    // Timeline events (new messages, edits)
    const handleTimelineEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        updateMessages();
        
        if (messagesContainerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
          // If we are significantly scrolled up, show pill instead of auto-scrolling
          if (scrollHeight - scrollTop - clientHeight > 100) {
            setShowNewMsgPill(true);
          } else {
            setTimeout(() => scrollToBottom('smooth'), 50);
          }
        } else {
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
        if (event.getType() === 'm.room.name' && r) {
          setNewRoomName(r.name || '');
        }
      }
    };

    // Redaction events (message deletion)
    const handleRedaction = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        updateMessages();
      }
    };

    // Decrypted events (E2EE messages decrypted after initial load)
    const handleDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        updateMessages();
      }
    };

    client.on('Room.timeline' as any, handleTimelineEvent);
    client.on('Room.redaction' as any, handleRedaction);
    client.on('Event.decrypted' as any, handleDecrypted);

    // Typing events
    const handleTyping = (_event: MatrixEvent, member: any) => {
      if (!r) return;
      if (member.roomId === roomId) {
        const typingMembers = r.getMembers().filter(m => m.typing && m.userId !== client.getUserId());
        setTypingUsers(typingMembers.map(m => m.name || m.userId));
      }
    };
    client.on('RoomMember.typing' as any, handleTyping);

    return () => {
      client.removeListener('Room.timeline' as any, handleTimelineEvent);
      client.removeListener('Room.redaction' as any, handleRedaction);
      client.removeListener('Event.decrypted' as any, handleDecrypted);
      client.removeListener('RoomMember.typing' as any, handleTyping);
    };
  }, [client, roomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !client) return;

    const text = inputText;
    setInputText('');
    client.sendTyping(roomId, false, 3000);

    try {
      await client.sendTextMessage(roomId, text);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text); // restore on fail
    }
  };

  const handleDeleteMessage = async (eventId: string) => {
    if (!client) return;
    try {
      await client.redactEvent(roomId, eventId);
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleProfileClick = async (targetUserId: string) => {
    if (!client || targetUserId === client.getUserId()) return;
    
    // Check if we already have a DM
    const myId = client.getUserId();
    const rooms = client.getVisibleRooms();
    const existing = rooms.find(r => 
      isRoomDirect(client, r.roomId) && 
      r.getMembers().some(m => m.userId === targetUserId && m.userId !== myId)
    );

    if (existing) {
      if (onSelectRoom) onSelectRoom(existing.roomId);
      return;
    }

    try {
      const res = await client.createRoom({
        is_direct: true,
        invite: [targetUserId],
        preset: Preset.TrustedPrivateChat,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ]
      });
      if (res.room_id && onSelectRoom) {
        onSelectRoom(res.room_id);
      }
    } catch (err: any) {
      console.error("Failed to add friend:", err);
      alert("Failed to add friend: " + err.message);
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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingText.trim() || !client || !editingMessageId) return;

    const text = editingText;
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
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message');
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

  const isDirect = client ? isRoomDirect(client, roomId) : false;
  const myId = client?.getUserId();
  const otherMembers = room?.getMembers().filter(m => m.userId !== myId);
  const isPending = isDirect && otherMembers && otherMembers.length > 0 && otherMembers.every(m => m.membership === 'invite');

  // Initial load auto-scroll
  useEffect(() => {
    setTimeout(() => scrollToBottom('auto'), 100);
  }, [roomId, room]);

  return (
    <div className="pdf-flex-col pdf-h-full" style={{ flex: 1 }}>
      {/* Header */}
      <div className="pdf-border-bottom pdf-bg-secondary pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-150) var(--space-300)', minHeight: '60px' }}>
        <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', flex: 1, overflow: 'hidden' }}>
          {onBack && (
            <button
              onClick={onBack}
              className="pdf-secondary-btn mobile-back-btn"
              style={{ 
                width: '32px', height: '32px', 
                padding: 0, justifyContent: 'center', 
                marginRight: 'var(--space-050)',
                flexShrink: 0
              }}
              title="Back to list"
            >
              <ArrowLeft size={16} />
            </button>
          )}
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
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="pdf-flex-col pdf-gap-150" 
        style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-300)', position: 'relative' }}
      >
        {messages.map((msg, idx) => {
          const isMe = msg.sender === client?.getUserId();
          const prevMsg = idx > 0 ? messages[idx - 1] : null;
          const showProfile = !isMe && (!prevMsg || prevMsg.sender !== msg.sender || msg.timestamp - prevMsg.timestamp > 300000); // 5 min gap
          const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={msg.id} className="animate-message" style={{
              alignSelf: isMe ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-050)',
              alignItems: isMe ? 'flex-end' : 'flex-start',
              marginTop: showProfile ? 'var(--space-100)' : 0
            }}>
              {showProfile && (
                <div 
                  className="pdf-flex-row pdf-items-center" 
                  style={{ gap: 'var(--space-100)', cursor: 'pointer' }}
                  onClick={() => handleProfileClick(msg.sender)}
                  title={`Click to add ${msg.sender} as friend`}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                    fontWeight: 'bold', color: 'var(--color-functional-red)', overflow: 'hidden'
                  }}>
                    {room.getMember(msg.sender)?.events?.member?.getContent()?.avatar_url ? (
                      <AuthImage 
                        mxcUrl={room.getMember(msg.sender)!.events!.member!.getContent().avatar_url as string} 
                        alt={msg.sender}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (room.getMember(msg.sender)?.name || msg.sender).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ fontWeight: 600 }}>
                    {room.getMember(msg.sender)?.name || msg.sender}
                  </div>
                </div>
              )}
              <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '100%' }}>
                <div 
                  className="pdf-panel pdf-selectable" 
                  onContextMenu={(e) => {
                    if (!isMe) return; // Only allow editing/deleting own messages
                    e.preventDefault();
                    setContextMenu({
                      x: e.pageX, y: e.pageY,
                      msgId: msg.id,
                      isImage: msg.msgtype === 'm.image',
                      body: msg.body
                    });
                  }}
                  style={{
                    background: isMe ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)',
                    color: isMe ? 'var(--color-bg-primary)' : 'var(--color-text-primary)',
                    borderColor: isMe ? 'var(--color-functional-red)' : 'var(--color-border-default)',
                    padding: msg.msgtype === 'm.image' ? 'var(--space-050)' : 'var(--space-100) var(--space-150)',
                    borderRadius: isMe 
                      ? (showProfile ? '12px 12px 2px 12px' : '12px 2px 2px 12px') 
                      : (showProfile ? '12px 12px 12px 2px' : '2px 12px 12px 2px'),
                    boxShadow: isMe ? 'none' : 'var(--shadow-hardware-bevel)',
                    marginBottom: 0,
                    maxWidth: '100%',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {msg.msgtype === 'm.image' && msg.url ? (
                    <div style={{ position: 'relative' }}>
                      <AuthImage 
                        mxcUrl={msg.url}
                        alt={msg.body} 
                        className="pdf-radius-sm"
                        style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', cursor: 'pointer' }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const url = mxcToHttp(msg.url!, HOMESERVER_URL, client?.getAccessToken() || undefined);
                          window.open(url, '_blank');
                        }}
                        style={{
                          position: 'absolute', top: 4, right: 4,
                          background: 'rgba(0,0,0,0.5)', color: '#fff',
                          border: 'none', borderRadius: '4px', padding: '4px',
                          cursor: 'pointer', display: 'flex', alignItems: 'center'
                        }}
                        title="Download Image"
                      >
                        <Download size={14} />
                      </button>
                      <div className="pdf-text-copy-13-mono pdf-mt-100 pdf-flex-row pdf-items-center pdf-justify-between" style={{ 
                        fontSize: '11px', 
                        color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
                        padding: '0 var(--space-050) var(--space-050) var(--space-050)' 
                      }}>
                        <span>{msg.body}</span>
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pdf-flex-col">
                      <span>{msg.body}</span>
                      <div style={{ 
                        fontSize: '10px', 
                        alignSelf: 'flex-end',
                        marginTop: '4px',
                        opacity: 0.6,
                        color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'
                      }}>
                        {formattedTime} {msg.isEdited && <i>(edited)</i>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* New Message Pill */}
      {showNewMsgPill && (
        <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <button 
            onClick={() => scrollToBottom('smooth')}
            className="pdf-shadow-glow"
            style={{ 
              background: 'var(--color-functional-red)', color: '#fff', 
              border: 'none', borderRadius: '16px', padding: 'var(--space-050) var(--space-150)',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(239,68,68,0.4)'
            }}
          >
            New message 👇
          </button>
        </div>
      )}

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-default)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          borderRadius: '8px',
          zIndex: 1000,
          padding: 'var(--space-050)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: '120px'
        }}>
          {!contextMenu.isImage && (
            <button
              onClick={() => handleStartEdit(contextMenu.msgId, contextMenu.body)}
              className="pdf-nav-item"
              style={{ justifyContent: 'flex-start', padding: 'var(--space-100)', borderRadius: '4px', border: 'none', background: 'transparent' }}
            >
              <Edit2 size={14} style={{ marginRight: '8px', color: 'var(--color-text-secondary)' }} /> Edit
            </button>
          )}
          <button
            onClick={() => handleDeleteMessage(contextMenu.msgId)}
            className="pdf-nav-item"
            style={{ justifyContent: 'flex-start', padding: 'var(--space-100)', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--color-functional-red)' }}
          >
            <Trash2 size={14} style={{ marginRight: '8px' }} /> Delete
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessageId && (
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: 'var(--space-100) var(--space-300)', background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border-default)', fontSize: '13px' }}>
          <span className="pdf-text-muted" style={{ fontStyle: 'italic' }}>
            Editing message...
          </span>
          <button 
            onClick={handleCancelEdit} 
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} style={{ color: 'var(--color-functional-red)' }} /> Cancel
          </button>
        </div>
      )}

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ padding: '0 var(--space-300) var(--space-100) var(--space-300)', fontStyle: 'italic', fontSize: '11px' }}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Input Form */}
      <div className="pdf-border-top" style={{ padding: 'var(--space-200) var(--space-300)', background: 'var(--color-bg-primary)' }}>
        <form onSubmit={editingMessageId ? handleSaveEdit : handleSend} className="pdf-flex-row pdf-gap-150">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            className="pdf-secondary-btn pdf-btn-md"
            style={{ width: '44px', height: '44px', padding: 0, justifyContent: 'center', flexShrink: 0 }}
            title="Upload Image"
            disabled={uploading || !!editingMessageId}
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
            className="pdf-input"
            value={editingMessageId ? editingText : inputText}
            onChange={(e) => {
              if (editingMessageId) {
                setEditingText(e.target.value);
              } else {
                setInputText(e.target.value);
                client?.sendTyping(roomId, true, 3000);
              }
            }}
            placeholder={isPending ? "Waiting for them to accept..." : (editingMessageId ? "Edit your message..." : "Type your message...")}
            style={{ flex: 1 }}
            disabled={isPending || uploading}
            autoFocus={!!editingMessageId}
          />
          <button 
            type="submit" 
            disabled={(editingMessageId ? !editingText.trim() : !inputText.trim()) || uploading || isPending} 
            className="pdf-btn-primary pdf-btn-md"
          >
            {editingMessageId ? 'Save' : <><Send size={16} /> Send</>}
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
