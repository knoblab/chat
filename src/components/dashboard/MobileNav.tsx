import React from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { useFriends } from '../../hooks/useFriends';
import { MessageSquare, Users, Settings } from 'lucide-react';

export const MobileNav: React.FC = () => {
  const { mobileTab, setMobileTab } = useUIStore();
  const { incomingRequests } = useFriends();

  return (
    <nav className="pdf-mobile-bottom-nav pdf-mobile-nav">
      <button 
        type="button"
        onClick={() => setMobileTab('chats')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'chats' ? 'active' : ''}`}
      >
        <div className="pdf-mobile-tab-pill">
          <MessageSquare size={20} />
        </div>
        <span>채팅</span>
      </button>

      <button 
        type="button"
        onClick={() => setMobileTab('friends')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'friends' ? 'active' : ''}`}
      >
        <div className="pdf-mobile-tab-pill">
          <Users size={20} />
          {incomingRequests && incomingRequests.length > 0 && (
            <span className="pdf-mobile-badge">{incomingRequests.length}</span>
          )}
        </div>
        <span>친구</span>
      </button>

      <button 
        type="button"
        onClick={() => setMobileTab('settings')} 
        className={`pdf-mobile-tab-btn ${mobileTab === 'settings' ? 'active' : ''}`}
      >
        <div className="pdf-mobile-tab-pill">
          <Settings size={20} />
        </div>
        <span>설정</span>
      </button>
    </nav>
  );
};

