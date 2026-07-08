import React from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { useUIStore } from '../../stores/useUIStore';
import { useChatStore } from '../../stores/useChatStore';
import { RoomList } from '../RoomList';
import { FriendList } from '../FriendList';
import { Preset } from 'matrix-js-sdk';
import { Settings, Sun, Moon, LogOut, MessageSquare, Users, Plus } from 'lucide-react';

interface SidebarProps {
  onOpenProfile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenProfile }) => {
  const { client, logout } = useMatrix();
  const { activeTab, setActiveTab, theme, toggleTheme } = useUIStore();
  const { selectedRoomId, selectRoom } = useChatStore();

  const handleCreateRoom = async () => {
    if (!client) return;
    const name = prompt('Enter a name for the new room:');
    if (!name || !name.trim()) return;

    try {
      const res = await client.createRoom({
        name: name.trim(),
        preset: Preset.PublicChat,
        visibility: 'private' as any,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2',
            },
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

      if (res.room_id) {
        selectRoom(res.room_id);
      }
    } catch (err: any) {
      console.error('Failed to create room:', err);
      alert('Failed to create room: ' + (err.message || 'Unknown error'));
    }
  };

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
          <RoomList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} />
        ) : (
          <FriendList onSelectRoom={selectRoom} selectedRoomId={selectedRoomId} onSwitchToChats={() => setActiveTab('chats')} />
        )}
      </div>

      {/* Action Button at bottom */}
      {activeTab === 'chats' && (
        <div style={{ padding: 'var(--space-150)', borderTop: '1px solid var(--color-border-default)' }}>
          <button onClick={handleCreateRoom} className="pdf-btn-primary pdf-btn-sm pdf-w-full">
            <Plus size={16} /> New Encrypted Room
          </button>
        </div>
      )}
    </aside>
  );
};
