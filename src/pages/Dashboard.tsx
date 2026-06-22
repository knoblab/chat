import React, { useState } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';
import { Preset } from 'matrix-js-sdk';
import { RoomList } from '../components/RoomList';
import { FriendList } from '../components/FriendList';
import { ChatRoom } from '../components/ChatRoom';
import { LogOut, Plus, MessageSquare, Users } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { client, logout } = useMatrix();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'friends'>('chats');

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
    <div className="pdf-app">
      {/* Sidebar */}
      <aside className="pdf-sidebar">
        {/* Header */}
        <div style={{ padding: 'var(--space-200)', borderBottom: '1px solid var(--color-border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="pdf-text-heading-24 pdf-text-red" style={{ letterSpacing: '-0.02em', fontWeight: 800 }}>QPI Chat</div>
          <button 
            onClick={logout} 
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center' }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
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
            <ChatRoom roomId={selectedRoomId} />
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
    </div>
  );
};
