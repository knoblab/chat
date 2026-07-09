import React, { useState } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { useUIStore } from '../../stores/useUIStore';
import { useChatStore } from '../../stores/useChatStore';
import { RoomList } from '../RoomList';
import { FriendList } from '../FriendList';
import { E2EEInfoButton } from '../E2EEInfo';
import { CreateRoomModal } from '../chat/CreateRoomModal';
import { Settings, Sun, Moon, LogOut, MessageSquare, Users, Plus, Sparkles } from 'lucide-react';

interface SidebarProps {
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenProfile }) => {
  const { logout } = useMatrix();
  const { activeTab, setActiveTab, theme, toggleTheme } = useUIStore();
  const { selectedRoomId, selectRoom } = useChatStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <aside className="pdf-sidebar">
      {/* Header */}
      <div style={{ padding: 'var(--space-200)', borderBottom: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="pdf-text-heading-24 pdf-text-red" style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>QPI Chat</div>
        <div className="pdf-flex-row pdf-gap-100">
          <button 
            onClick={onOpenProfile}
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
          <>
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.03) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '10px',
              padding: '10px 12px',
              margin: '10px 12px 6px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'visible' }}>
                <div style={{ width: 28, height: 28, borderRadius: '6px', background: 'var(--color-functional-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  <Sparkles size={14} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'visible' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center' }}>
                    <span>100% E2EE 종단간 암호화</span>
                    <E2EEInfoButton />
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>• 대화 당사자만 열람 가능</span>
                </div>
              </div>
            </div>
            <RoomList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} />
          </>
        ) : (
          <FriendList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} onSwitchToChats={() => setActiveTab('chats')} />
        )}
      </div>

      {/* Action Button at bottom */}
      {activeTab === 'chats' && (
        <div style={{ padding: 'var(--space-150)', borderTop: '1px solid var(--color-border-default)' }}>
          <button onClick={() => setIsCreateModalOpen(true)} className="pdf-btn-primary pdf-btn-sm pdf-w-full">
            <Plus size={16} /> New Chat Room
          </button>
        </div>
      )}

      <CreateRoomModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </aside>
  );
};
