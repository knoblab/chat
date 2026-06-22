import React, { useState, useEffect } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';
import { Preset } from 'matrix-js-sdk';
import { RoomList } from '../components/RoomList';
import { FriendList } from '../components/FriendList';
import { ChatRoom } from '../components/ChatRoom';
import { LogOut, Plus, MessageSquare, Users, Sun, Moon, Settings, X, Upload } from 'lucide-react';

export const mxcToHttp = (mxcUrl: string, baseUrl: string): string => {
  if (!mxcUrl || !mxcUrl.startsWith('mxc://')) return '';
  const parts = mxcUrl.substring(6).split('/');
  if (parts.length < 2) return '';
  const serverName = parts[0];
  const mediaId = parts.slice(1).join('/');
  return `${baseUrl}/_matrix/media/v3/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`;
};

export const Dashboard: React.FC = () => {
  const { client, logout } = useMatrix();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');
  
  // Profile settings state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myAvatarUrl, setMyAvatarUrl] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  
  // Theme state persisted in localStorage
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark'; // default to dark
  });

  // Apply theme to documentElement
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load my profile details on load
  useEffect(() => {
    if (!client) return;
    const myId = client.getUserId();
    if (myId) {
      client.getProfileInfo(myId).then(info => {
        setMyDisplayName(info.displayname || '');
        setMyAvatarUrl(info.avatar_url || '');
      }).catch(err => {
        console.warn("Failed to load my profile info:", err);
      });
    }
  }, [client]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await client.setDisplayName(myDisplayName.trim());
      setProfileSuccess('Profile display name updated successfully!');
      setTimeout(() => setProfileSuccess(''), 2000);
    } catch (err: any) {
      console.error('Failed to update display name:', err);
      setProfileError(err.message || 'Failed to update profile name.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

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

      await client.setAvatarUrl(mxcUri);
      setMyAvatarUrl(mxcUri);
      setProfileSuccess('Avatar updated successfully!');
      setTimeout(() => setProfileSuccess(''), 2000);
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setProfileError(err.message || 'Failed to upload avatar picture.');
    } finally {
      setProfileLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Title flash and Audio alert for new messages
  useEffect(() => {
    if (!client) return;

    let titleInterval: any = null;
    const originalTitle = "QPI Chat";

    const playAlertSound = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);
          
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };

        playTone(523.25, 0, 0.12); // C5
        playTone(659.25, 0.08, 0.15); // E5
      } catch (err) {
        console.warn("Failed to play notification audio:", err);
      }
    };

    const handleNewMessage = (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return;
      if (event.getType() !== 'm.room.message') return;

      const senderId = event.getSender();
      if (senderId === client.getUserId()) return; // ignore our own messages

      const isWindowUnfocused = !document.hasFocus();
      const isDifferentRoom = selectedRoomId !== event.getRoomId();

      if (isWindowUnfocused || isDifferentRoom) {
        // 1. Play synth notification audio
        playAlertSound();

        // 2. Flash Document Title
        if (!titleInterval) {
          let flash = false;
          const roomName = room ? room.name : "New Message";
          titleInterval = setInterval(() => {
            document.title = flash ? `💬 New Msg: ${roomName}` : originalTitle;
            flash = !flash;
          }, 1000);
        }

        // 3. Web Push Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const content = event.getContent();
          const bodyText = content.msgtype === 'm.image' ? 'Sent an image' : (content.body || '');
          const senderName = room ? (room.getMember(senderId)?.name || senderId) : senderId;
          
          new Notification(senderName, {
            body: bodyText,
            tag: event.getRoomId(),
            renotify: true
          } as any);
        }
      }
    };

    client.on('Room.timeline' as any, handleNewMessage);

    const handleWindowFocus = () => {
      if (titleInterval) {
        clearInterval(titleInterval);
        titleInterval = null;
      }
      document.title = originalTitle;
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      client.removeListener('Room.timeline' as any, handleNewMessage);
      window.removeEventListener('focus', handleWindowFocus);
      if (titleInterval) {
        clearInterval(titleInterval);
      }
      document.title = originalTitle;
    };
  }, [client, selectedRoomId]);

  const handleCreateRoom = async () => {
    if (!client) return;
    try {
      const res = await client.createRoom({
        preset: Preset.PrivateChat,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2',
            },
          },
        ],
      });
      setSelectedRoomId(res.room_id);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Failed to create encrypted room');
    }
  };

  return (
    <div className={`pdf-app ${selectedRoomId ? 'room-selected' : ''}`}>
      {/* Sidebar */}
      <aside className="pdf-sidebar">
        {/* Header */}
        <div style={{ padding: 'var(--space-200)', borderBottom: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="pdf-text-heading-24 pdf-text-red" style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>QPI Chat</div>
          <div className="pdf-flex-row pdf-gap-100">
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
              title="Profile Settings"
            >
              <Settings size={14} />
            </button>
            <button 
              onClick={toggleTheme} 
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button 
              onClick={logout} 
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="pdf-flex-row pdf-border-bottom" style={{ background: 'rgba(0,0,0,0.05)' }}>
          <button
            onClick={() => setActiveTab('chats')}
            style={{
              flex: 1,
              height: '44px',
              border: 'none',
              borderBottom: activeTab === 'chats' ? '2px solid var(--color-functional-red)' : 'none',
              color: activeTab === 'chats' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: activeTab === 'chats' ? 'var(--color-bg-primary)' : 'transparent',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              fontWeight: activeTab === 'chats' ? 700 : 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-100)',
              cursor: 'pointer',
            }}
          >
            <MessageSquare size={14} />
            Chats
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            style={{
              flex: 1,
              height: '44px',
              border: 'none',
              borderBottom: activeTab === 'friends' ? '2px solid var(--color-functional-red)' : 'none',
              color: activeTab === 'friends' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              background: activeTab === 'friends' ? 'var(--color-bg-primary)' : 'transparent',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              fontWeight: activeTab === 'friends' ? 700 : 400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-100)',
              cursor: 'pointer',
            }}
          >
            <Users size={14} />
            Friends
          </button>
        </div>
        
        {/* Sidebar Content based on Tab */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'chats' ? (
            <RoomList onSelectRoom={setSelectedRoomId} selectedRoomId={selectedRoomId} />
          ) : (
            <FriendList onSelectRoom={setSelectedRoomId} selectedRoomId={selectedRoomId} />
          )}
        </div>

        {/* Action Button at bottom (only for normal group chats) */}
        {activeTab === 'chats' && (
          <div style={{ padding: 'var(--space-150)', borderTop: '1px solid var(--color-border-default)' }}>
            <button onClick={handleCreateRoom} className="pdf-btn-primary pdf-btn-sm pdf-w-full">
              <Plus size={16} /> New Encrypted Room
            </button>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="pdf-main-view">
        <div className="pdf-main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedRoomId ? (
            <ChatRoom roomId={selectedRoomId} onBack={() => setSelectedRoomId(null)} />
          ) : (
            <div className="pdf-flex-col pdf-justify-center pdf-items-center pdf-h-full pdf-selectable" style={{ color: 'var(--color-text-secondary)', minHeight: '80vh' }}>
              <div className="pdf-panel pdf-shadow-glow" style={{ padding: 'var(--space-400)', textAlign: 'center', maxWidth: '400px' }}>
                <h2 className="pdf-text-heading-24 pdf-text-red pdf-mb-150">Select a Chat</h2>
                <p className="pdf-text-copy-14">Choose an existing room from the sidebar or add a friend to start secure messaging.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Profile Settings Modal */}
      {isProfileOpen && (
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
          <div className="pdf-panel pdf-shadow-glow pdf-animate-modal" style={{
            width: '100%',
            maxWidth: '400px',
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
              <h3 className="pdf-text-heading-24 pdf-text-red" style={{ margin: 0, fontSize: '1.2rem' }}>Profile Settings</h3>
              <button 
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setProfileError('');
                  setProfileSuccess('');
                }}
                className="pdf-secondary-btn"
                style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Profile Avatar Section */}
            <div className="pdf-flex-col pdf-items-center" style={{ gap: 'var(--space-100)', padding: 'var(--space-100) 0' }}>
              <div style={{ 
                width: '72px', height: '72px', 
                borderRadius: '50%', background: 'var(--color-bg-secondary)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--color-functional-red)',
                fontWeight: 'bold',
                fontSize: '1.8rem',
                border: '2px solid var(--color-border-default)',
                overflow: 'hidden',
                position: 'relative'
              }}>
                {myAvatarUrl && client ? (
                  <img 
                    src={mxcToHttp(myAvatarUrl, client.baseUrl)} 
                    alt="Avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  myDisplayName ? myDisplayName.charAt(0).toUpperCase() : 'U'
                )}
              </div>
              <label 
                className="pdf-secondary-btn pdf-btn-xs" 
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-050)' }}
              >
                <Upload size={12} /> Upload Photo
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarUpload} 
                  style={{ display: 'none' }}
                  disabled={profileLoading}
                />
              </label>
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} className="pdf-flex-col pdf-gap-150">
              <div>
                <label className="pdf-text-label-16 pdf-text-muted pdf-mb-050" style={{ display: 'block', fontSize: '0.85rem' }}>Nickname</label>
                <input 
                  type="text" 
                  className="pdf-input pdf-input-sm pdf-font-mono"
                  value={myDisplayName} 
                  onChange={e => setMyDisplayName(e.target.value)} 
                  required 
                  placeholder="Your Nickname"
                  disabled={profileLoading}
                />
              </div>

              {profileSuccess && (
                <div className="pdf-text-copy-14 pdf-text-center" style={{ color: '#10b981', fontWeight: 600 }}>
                  {profileSuccess}
                </div>
              )}
              {profileError && (
                <div className="pdf-text-copy-14 pdf-text-center" style={{ color: 'var(--color-functional-red)' }}>
                  {profileError}
                </div>
              )}

              <button 
                type="submit" 
                disabled={profileLoading || !myDisplayName.trim()} 
                className="pdf-btn-primary pdf-btn-sm pdf-w-full"
              >
                Save Nickname
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
