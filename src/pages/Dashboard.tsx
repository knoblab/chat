import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMatrix } from '../matrix/MatrixProvider';
import { useUIStore } from '../stores/useUIStore';
import { useChatStore } from '../stores/useChatStore';
import { useNotifications } from '../hooks/useNotifications';
import { RoomList } from '../components/RoomList';
import { FriendList } from '../components/FriendList';
import { ChatRoom } from '../components/ChatRoom';
import { Sidebar } from '../components/dashboard/Sidebar';
import { MobileNav } from '../components/dashboard/MobileNav';
import { SettingsPanel } from '../components/dashboard/SettingsPanel';
import { Preset } from 'matrix-js-sdk';
import { Plus, Sun, Moon, X } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { client } = useMatrix();
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileTab, setMobileTab, theme, toggleTheme } = useUIStore();
  const { selectedRoomId, selectRoom } = useChatStore();
  const { toastNotification, setToastNotification } = useNotifications(selectedRoomId);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const pendingInvite = sessionStorage.getItem('pendingInvite');
    if (pendingInvite) {
      sessionStorage.removeItem('pendingInvite');
      navigate(`/invite/${pendingInvite}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (location.state && location.state.openRoomId) {
      selectRoom(location.state.openRoomId);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, selectRoom]);

  const handleCreateRoom = async () => {
    if (!client) return;
    const roomName = window.prompt('새로운 채팅방 이름을 입력하세요:');
    if (roomName === null || !roomName.trim()) return;

    try {
      const res = await client.createRoom({
        name: roomName.trim(),
        preset: Preset.PublicChat,
        visibility: 'private' as any,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
          {
            type: 'm.room.join_rules',
            state_key: '',
            content: { join_rule: 'public' },
          },
          {
            type: 'm.room.history_visibility',
            state_key: '',
            content: { history_visibility: 'shared' },
          },
        ],
      });
      selectRoom(res.room_id);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Failed to create encrypted room');
    }
  };

  if (isMobile) {
    if (selectedRoomId) {
      return (
        <div className="pdf-mobile-container">
          <ChatRoom roomId={selectedRoomId} onBack={() => selectRoom(null)} />
        </div>
      );
    }

    return (
      <div className="pdf-mobile-container">
        <header className="pdf-mobile-header">
          <div className="pdf-text-heading-24 pdf-text-red" style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>QPI Chat</div>
          <div className="pdf-flex-row pdf-gap-100">
            <button 
              onClick={toggleTheme} 
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        <div className="pdf-mobile-content-area">
          {mobileTab === 'chats' && (
            <div className="pdf-flex-col" style={{ padding: 'var(--space-200) 0' }}>
              <div style={{ padding: '0 var(--space-200) var(--space-200) var(--space-200)' }}>
                <button onClick={handleCreateRoom} className="pdf-btn-primary pdf-btn-sm pdf-w-full">
                  <Plus size={16} /> New Encrypted Room
                </button>
              </div>
              <RoomList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} />
            </div>
          )}
          {mobileTab === 'friends' && (
            <div style={{ padding: 'var(--space-200) 0' }}>
              <FriendList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} onSwitchToChats={() => setMobileTab('chats')} />
            </div>
          )}
          {mobileTab === 'settings' && <SettingsPanel />}
        </div>

        <MobileNav />
      </div>
    );
  }

  return (
    <div className={`pdf-app ${selectedRoomId ? 'room-selected' : ''}`}>
      <Sidebar onOpenProfile={() => setIsProfileOpen(true)} />

      <main className="pdf-main-view">
        <div className="pdf-main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {selectedRoomId ? (
            <ChatRoom roomId={selectedRoomId} onBack={() => selectRoom(null)} />
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

      {isProfileOpen && (
        <SettingsPanel isModal={true} onClose={() => setIsProfileOpen(false)} />
      )}

      {toastNotification && (
        <div 
          className="pdf-animate-fade-in pdf-panel pdf-shadow-glow"
          style={{
            position: 'fixed', top: 'var(--space-200)', right: 'var(--space-200)', zIndex: 9999,
            width: '300px', cursor: 'pointer', background: 'var(--color-bg-primary)',
            borderLeft: '4px solid var(--color-functional-red)'
          }}
          onClick={() => {
            selectRoom(toastNotification.roomId);
            setToastNotification(null);
          }}
        >
          <div className="pdf-flex-row pdf-items-center pdf-justify-between pdf-mb-050">
            <span className="pdf-text-label-16" style={{ fontSize: '13px', fontWeight: 600 }}>{toastNotification.sender}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setToastNotification(null); }}
              style={{ padding: 0, color: 'var(--color-text-secondary)', background: 'transparent' }}
            >
              <X size={14} />
            </button>
          </div>
          <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px' }}>
            {toastNotification.body}
          </div>
        </div>
      )}
    </div>
  );
};
