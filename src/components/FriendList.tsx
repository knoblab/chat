import React from 'react';
import { useFriends } from '../hooks/useFriends';
import { UserPlus, Check, X, Search, Clock, User, MessageSquare, Trash2 } from 'lucide-react';

interface FriendListProps {
  onSelectRoom: (roomId: string) => void;
  selectedRoomId: string | null;
  onSwitchToChats?: () => void;
}

export const FriendList: React.FC<FriendListProps> = ({ onSelectRoom, onSwitchToChats }) => {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    inviteError,
    friends,
    incomingRequests,
    handleSearch,
    handleAddFriend,
    handleAcceptInvite,
    handleRejectInvite,
    handleRemoveFriend,
    getOtherMemberInfo,
  } = useFriends(onSelectRoom, onSwitchToChats);

  const handleOpenChat = (roomId: string) => {
    onSelectRoom(roomId);
    if (onSwitchToChats) {
      onSwitchToChats();
    }
  };

  return (
    <div className="pdf-flex-col" style={{ height: '100%', padding: '12px 14px' }}>
      
      {/* Search/Add Friend Form */}
      <form onSubmit={handleSearch} className="pdf-flex-row" style={{ gap: '8px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input
            type="text"
            className="pdf-input pdf-input-sm pdf-font-mono"
            placeholder="사용자 코드 입력 (@user:matrix.org)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px', borderRadius: '20px', height: '40px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)', fontSize: '13px' }}
          />
        </div>
        <button type="submit" disabled={isSearching} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0, borderRadius: '20px', height: '40px', padding: '0 16px', fontWeight: 600 }}>
          {isSearching ? '검색중...' : '친구 검색'}
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="pdf-panel pdf-mobile-animate-in" style={{ padding: '12px', marginBottom: '16px', maxHeight: '220px', overflowY: 'auto', borderRadius: '16px', border: '1px solid var(--color-functional-red)', background: 'var(--color-bg-secondary)' }}>
          <div className="pdf-text-label-14-mono pdf-text-red" style={{ paddingBottom: '8px', borderBottom: '1px solid var(--color-border-default)', fontWeight: 700, fontSize: '12px' }}>검색 결과</div>
          {searchResults.map(result => (
            <div key={result.userId} className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: '10px 4px', borderBottom: '1px solid var(--color-border-default)' }}>
              <div className="pdf-flex-row pdf-items-center" style={{ gap: '12px', overflow: 'hidden' }}>
                <div style={{ width: 38, height: 38, borderRadius: '19px', background: 'var(--color-functional-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
                  {(result.displayName || result.userId.split(':')[0].substring(1)).charAt(0).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', fontWeight: 600 }}>{result.displayName || result.userId.split(':')[0].substring(1)}</div>
                  <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px', marginTop: '2px' }}>{result.userId}</div>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => handleAddFriend(result.userId)}
                className="pdf-btn-primary pdf-btn-xs"
                style={{ flexShrink: 0, borderRadius: '16px', height: '30px', padding: '0 12px' }}
              >
                <UserPlus size={13} /> 추가
              </button>
            </div>
          ))}
        </div>
      )}

      {inviteError && (
        <div className="pdf-text-copy-14 pdf-text-center pdf-mb-150" style={{ color: 'var(--color-functional-red)', fontWeight: 600, padding: '8px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
          {inviteError}
        </div>
      )}

      {/* Main Lists container */}
      <div className="pdf-flex-col" style={{ gap: '20px', flex: 1, overflowY: 'auto' }}>
        
        {/* Incoming Friend Requests */}
        {incomingRequests.length > 0 && (
          <div className="pdf-mobile-animate-in">
            <div className="pdf-text-label-16 pdf-mb-100" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 700, fontSize: '13px' }}>
              <Clock size={15} /> 받은 초대 및 친구 요청 ({incomingRequests.length})
            </div>
            <div className="pdf-flex-col" style={{ gap: '10px' }}>
              {incomingRequests.map(room => {
                const info = getOtherMemberInfo(room);
                return (
                  <div key={room.roomId} className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: '14px', marginBottom: 0, borderRadius: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <div className="pdf-flex-row pdf-items-center" style={{ gap: '12px', overflow: 'hidden', marginRight: '8px' }}>
                      <div style={{ width: 44, height: 44, borderRadius: '22px', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px', flexShrink: 0 }}>
                        {info.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{info.name}</div>
                        <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', marginTop: '2px' }}>{info.userId}</div>
                      </div>
                    </div>
                    <div className="pdf-flex-row" style={{ gap: '8px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => handleAcceptInvite(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ background: '#10b981', height: '34px', padding: '0 12px', borderRadius: '17px', gap: '4px', fontWeight: 600 }}
                        title="수락"
                      >
                        <Check size={14} /> 수락
                      </button>
                      <button 
                        type="button"
                        onClick={() => handleRejectInvite(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ background: '#ef4444', height: '34px', padding: '0 10px', borderRadius: '17px', gap: '4px' }}
                        title="거절"
                      >
                        <X size={14} /> 거절
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Friends List (Merged DMs) */}
        <div>
          <div className="pdf-text-label-16 pdf-text-muted pdf-mb-100" style={{ fontSize: '13px', fontWeight: 700 }}>
            친구 목록 ({friends.length})
          </div>
          {friends.length === 0 ? (
            <div className="pdf-flex-col pdf-justify-center pdf-items-center" style={{ padding: '36px 20px', border: '1px dashed var(--color-border-default)', borderRadius: '16px', background: 'var(--color-bg-secondary)', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: '24px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-functional-red)', marginBottom: '12px' }}>
                <User size={24} />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>아직 등록된 친구가 없습니다</div>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px', maxWidth: '240px', lineHeight: 1.4 }}>
                상단 검색창에 친구의 사용자 코드를 입력하고 초대장을 보내보세요.
              </p>
            </div>
          ) : (
            <div className="pdf-flex-col" style={{ gap: '4px' }}>
              {friends.map(room => {
                const info = getOtherMemberInfo(room);
                return (
                  <div
                    key={room.roomId}
                    className="pdf-panel pdf-flex-row pdf-items-center pdf-mobile-row"
                    style={{ padding: '12px 14px', marginBottom: 0, gap: '14px', borderRadius: '14px', border: 'none', background: 'transparent' }}
                  >
                    {/* Avatar */}
                    <div style={{ 
                      width: '44px', height: '44px', 
                      borderRadius: '22px', background: 'linear-gradient(135deg, var(--color-functional-red), #b91c1c)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '16px',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
                    }}>
                      {info.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, fontSize: '15px', color: 'var(--color-text-primary)' }}>
                        {info.name}
                      </div>
                      <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', marginTop: '2px' }}>
                        {info.userId}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="pdf-flex-row pdf-items-center" style={{ gap: '8px', flexShrink: 0 }}>
                      <button 
                        type="button"
                        onClick={() => handleOpenChat(room.roomId)}
                        className="pdf-btn-primary pdf-btn-xs"
                        style={{ height: '34px', padding: '0 14px', fontSize: '13px', gap: '6px', borderRadius: '17px', fontWeight: 600, boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)' }}
                        title="대화하기"
                      >
                        <MessageSquare size={14} /> 대화하기
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleRemoveFriend(e, room.roomId)}
                        className="pdf-secondary-btn pdf-btn-xs"
                        style={{ width: '32px', height: '32px', padding: 0, justifyContent: 'center', border: 'none', background: 'transparent', opacity: 0.5 }}
                        title="친구 삭제"
                      >
                        <Trash2 size={15} style={{ color: 'var(--color-functional-red)' }} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
