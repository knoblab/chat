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
import { Plus, Sun, Moon, X, Sparkles, UserPlus, ShieldCheck } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { client } = useMatrix();
  const navigate = useNavigate();
  const location = useLocation();
  const { mobileTab, setMobileTab, theme, toggleTheme } = useUIStore();
  const { selectedRoomId, selectRoom } = useChatStore();
  const { toastNotification, setToastNotification } = useNotifications(selectedRoomId);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomUser, setNewRoomUser] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

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

  const handleCreateRoom = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!client) return;

    try {
      setCreatingRoom(true);
      const name = newRoomName.trim() || `암호화 대화방 (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      const inviteList = newRoomUser.trim() ? [newRoomUser.trim()] : [];

      const res = await client.createRoom({
        name,
        preset: inviteList.length > 0 ? Preset.TrustedPrivateChat : Preset.PrivateChat,
        invite: inviteList,
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

      selectRoom(res.room_id);
      setNewRoomName('');
      setNewRoomUser('');
      setIsProfileOpen(false);
      setMobileTab('chats');
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('방 생성에 실패했습니다. 유효한 Matrix User ID(@user:domain)인지 확인해주세요.');
    } finally {
      setCreatingRoom(false);
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

    const getMobileHeaderTitle = () => {
      if (mobileTab === 'chats') return '채팅방';
      if (mobileTab === 'friends') return '친구 및 초대';
      return '설정 및 프로필';
    };

    return (
      <div className="pdf-mobile-container">
        <header className="pdf-mobile-header">
          <div className="pdf-flex-row pdf-items-center" style={{ gap: '8px' }}>
            <div className="pdf-text-heading-24 pdf-text-red" style={{ letterSpacing: '-0.02em', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              QPI
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{getMobileHeaderTitle()}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)' }} title="Matrix 종단간 암호화(E2EE) 보안 적용">
              <ShieldCheck size={13} style={{ color: 'var(--color-text-secondary)' }} />
              <span>E2EE</span>
            </div>
          </div>

          <div className="pdf-flex-row pdf-items-center" style={{ gap: '8px' }}>
            {mobileTab === 'chats' && (
              <button 
                onClick={() => handleCreateRoom()}
                disabled={creatingRoom}
                className="pdf-btn-primary pdf-btn-xs"
                style={{ height: '32px', padding: '0 10px', borderRadius: '16px', fontSize: '12px', gap: '4px', background: 'var(--color-functional-red)', opacity: creatingRoom ? 0.6 : 1 }}
                title="새 채팅방 생성"
              >
                <Plus size={14} /> {creatingRoom ? '생성 중...' : '새 채팅'}
              </button>
            )}
            {mobileTab === 'friends' && (
              <button 
                onClick={() => {
                  const input = document.querySelector('input[placeholder*="User Code"]') as HTMLInputElement;
                  if (input) input.focus();
                }}
                className="pdf-secondary-btn pdf-btn-xs"
                style={{ height: '32px', padding: '0 10px', borderRadius: '16px', fontSize: '12px', gap: '4px' }}
              >
                <UserPlus size={13} /> 추가
              </button>
            )}
            <button 
              onClick={toggleTheme} 
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center', borderRadius: '50%' }}
              title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </header>

        <div className="pdf-mobile-content-area">
          {mobileTab === 'chats' && (
            <div className="pdf-flex-col pdf-mobile-animate-in">
              <div className="pdf-mobile-hero pdf-flex-row pdf-items-center pdf-justify-between" style={{ gap: '10px' }}>
                <div className="pdf-flex-row pdf-items-center" style={{ gap: '8px', overflow: 'hidden' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--color-functional-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                    <Sparkles size={15} />
                  </div>
                  <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>100% E2EE 종단간 암호화</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>• 서버 열람 불가</span>
                  </div>
                </div>
                <button 
                  onClick={handleCreateRoom} 
                  className="pdf-btn-primary" 
                  style={{ height: '32px', padding: '0 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, gap: '4px', flexShrink: 0 }}
                >
                  <Plus size={14} /> 새 채팅방
                </button>
              </div>
              
              <div style={{ padding: '0 var(--space-100)' }}>
                <RoomList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} />
              </div>
            </div>
          )}
          {mobileTab === 'friends' && (
            <div className="pdf-mobile-animate-in">
              <FriendList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} onSwitchToChats={() => setMobileTab('chats')} />
            </div>
          )}
          {mobileTab === 'settings' && (
            <div className="pdf-mobile-animate-in">
              <SettingsPanel />
            </div>
          )}
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
