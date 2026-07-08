import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { MessageSquare, Users, Settings } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { mobileTab, setMobileTab } = useUIStore();

  return (
    <nav className="pdf-mobile-nav">
      <button 
        onClick={() => setMobileTab('chats')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'chats' ? 'active' : ''}`}
      >
        <MessageSquare size={20} />
        <span>Chats</span>
      </button>
      <button 
        onClick={() => setMobileTab('friends')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'friends' ? 'active' : ''}`}
      >
        <Users size={20} />
        <span>Friends</span>
      </button>
      <button 
        onClick={() => setMobileTab('settings')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'settings' ? 'active' : ''}`}
      >
        <Settings size={20} />
        <span>Settings</span>
      </button>
    </nav>
  );
};
