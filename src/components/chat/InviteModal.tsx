import React, { useState, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { Search, UserPlus, X, Globe, Lock, CheckCircle2, Copy, Check, ShieldCheck } from 'lucide-react';
import type { UserSearchResult } from '../../types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose, roomId }) => {
  const { client } = useMatrix();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Room access rule state ('public' = anyone with link, 'invite' = invited only)
  const [joinRule, setJoinRule] = useState<'public' | 'invite'>('public');
  const [updatingRule, setUpdatingRule] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!isOpen || !client || !roomId) return;
    try {
      const room = client.getRoom(roomId);
      const rule = room?.currentState.getStateEvents('m.room.join_rules' as any, '')?.getContent()?.join_rule;
      if (rule === 'invite' || rule === 'public') {
        setJoinRule(rule);
      } else {
        setJoinRule('public');
      }
    } catch (_e) {
      setJoinRule('public');
    }
    setError('');
    setSuccess('');
  }, [isOpen, client, roomId]);

  if (!isOpen) return null;

  const handleAccessRuleChange = async (newRule: 'public' | 'invite') => {
    if (!client || !roomId || newRule === joinRule || updatingRule) return;
    setUpdatingRule(true);
    setError('');
    setSuccess('');
    try {
      await client.sendStateEvent(roomId, 'm.room.join_rules' as any, { join_rule: newRule }, '');
      setJoinRule(newRule);
      if (newRule === 'public') {
        setSuccess('✔ 방 접속 설정 변경: 링크가 있는 모든 사용자가 참여할 수 있습니다.');
      } else {
        setSuccess('✔ 방 접속 설정 변경: 초대(권한 허용)된 사용자만 참여할 수 있습니다.');
      }
    } catch (err: any) {
      console.error('Failed to change join rules:', err);
      setError(err.message || '권한 설정 변경에 실패했습니다. (방 관리자 권한 여부를 확인해주세요)');
    } finally {
      setUpdatingRule(false);
    }
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/invite/${encodeURIComponent(roomId)}`;
    navigator.clipboard.writeText(inviteUrl)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      })
      .catch(() => alert('링크 복사 실패: ' + inviteUrl));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !client) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setResults([]);

    try {
      const q = query.trim();
      const myUserId = client.getUserId() || '';

      let targetUserId = q;
      if (!q.startsWith('@') && !q.includes(':')) {
        if (q.length >= 5) {
          const colonIndex = myUserId.indexOf(':');
          const suffix = colonIndex !== -1 ? myUserId.substring(colonIndex) : ':qpi.digital';
          targetUserId = `@${q.toLowerCase()}${suffix}`;
        } else {
          setError('Please enter a valid User ID code.');
          return;
        }
      }

      if (targetUserId === myUserId) {
        setError('You cannot invite yourself.');
        return;
      }

      try {
        const profile = await client.getProfileInfo(targetUserId);
        setResults([{
          userId: targetUserId,
          displayName: profile.displayname || undefined,
          avatarUrl: profile.avatar_url || undefined
        }]);
      } catch {
        setError('User ID not found. Ensure the spelling is exact.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (targetUserId: string) => {
    if (!client) return;
    setError('');
    setSuccess('');
    try {
      await client.invite(roomId, targetUserId);
      setSuccess(`✔ Successfully invited ${targetUserId}`);
      setResults([]);
      setQuery('');
    } catch (err: any) {
      console.error('Invite error:', err);
      setError(err.message || 'Failed to send invite.');
    }
  };

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-200)'
      }}
    >
      <div 
        className="pdf-panel pdf-animate-fade-in" 
        style={{ 
          width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
          padding: '24px', background: 'var(--color-bg-primary)', 
          boxShadow: 'var(--shadow-hardware-elevated)', borderRadius: '16px',
          border: '1px solid var(--color-border-default)'
        }}
      >
        {/* Header */}
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: 'var(--color-functional-red)' }} />
            <h3 className="pdf-text-heading-20" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Invite User to Room</h3>
          </div>
          <button 
            onClick={onClose}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', borderRadius: '50%', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Section 1: Room Access Permission Selection */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <label className="pdf-text-label-14-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              방 접속 허용 범위 선택 (Join Permissions)
            </label>
            {updatingRule && (
              <span style={{ fontSize: '11px', color: 'var(--color-functional-red)', fontWeight: 600 }}>
                설정 변경 중...
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Option 1: Anyone with link (public) */}
            <div
              onClick={() => handleAccessRuleChange('public')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                border: joinRule === 'public' ? '2px solid var(--color-functional-red)' : '1px solid var(--color-border-default)',
                background: joinRule === 'public' ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                cursor: updatingRule ? 'wait' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ 
                width: 32, height: 32, borderRadius: '8px', 
                background: joinRule === 'public' ? 'var(--color-functional-red)' : 'rgba(255,255,255,0.06)',
                color: joinRule === 'public' ? '#fff' : 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Globe size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    링크가 있는 모든 사용자 접속 가능
                  </span>
                  {joinRule === 'public' && <CheckCircle2 size={16} style={{ color: 'var(--color-functional-red)', flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  초대 링크나 방 ID를 아는 모든 사용자가 승인 없이 자유롭게 접속하고 대화에 참여할 수 있습니다.
                </p>
              </div>
            </div>

            {/* Option 2: Invited / permitted users only (invite) */}
            <div
              onClick={() => handleAccessRuleChange('invite')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                border: joinRule === 'invite' ? '2px solid var(--color-functional-red)' : '1px solid var(--color-border-default)',
                background: joinRule === 'invite' ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                cursor: updatingRule ? 'wait' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ 
                width: 32, height: 32, borderRadius: '8px', 
                background: joinRule === 'invite' ? 'var(--color-functional-red)' : 'rgba(255,255,255,0.06)',
                color: joinRule === 'invite' ? '#fff' : 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Lock size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    권한이 허용된(초대된) 사용자만 접속 가능
                  </span>
                  {joinRule === 'invite' && <CheckCircle2 size={16} style={{ color: 'var(--color-functional-red)', flexShrink: 0 }} />}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  초대를 받았거나 관리자로부터 명시적으로 권한이 부여된 사용자만 입장할 수 있습니다. (비공개 보안 채팅방)
                </p>
              </div>
            </div>
          </div>

          {/* Quick Copy Link Box */}
          <div style={{ 
            marginTop: '10px', padding: '10px 12px', borderRadius: '10px', 
            background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flexShrink: 0, fontWeight: 600 }}>초대 링크:</span>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {window.location.origin}/invite/{encodeURIComponent(roomId)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="pdf-secondary-btn pdf-btn-xs"
              style={{ flexShrink: 0, height: '26px', padding: '0 10px', fontSize: '11px', gap: '4px', borderRadius: '6px' }}
            >
              {copiedLink ? <><Check size={12} color="#10b981" /> 복사 완료</> : <><Copy size={12} /> 링크 복사</>}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--color-border-default)', margin: '20px 0' }} />

        {/* Section 2: Invite Specific User */}
        <div>
          <label className="pdf-text-label-14-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '10px' }}>
            특정 사용자 직접 초대 (Invite by User Code)
          </label>
          
          <form onSubmit={handleSearch} className="pdf-flex-row pdf-gap-100" style={{ marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
              <input
                type="text"
                className="pdf-input pdf-input-sm pdf-font-mono"
                placeholder="Enter User Code or @id:server..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ paddingLeft: '34px', height: '36px', borderRadius: '8px' }}
              />
            </div>
            <button type="submit" disabled={loading} className="pdf-btn-primary pdf-btn-sm" style={{ flexShrink: 0, height: '36px', padding: '0 16px', borderRadius: '8px' }}>
              {loading ? '검색 중...' : '검색'}
            </button>
          </form>

          {error && <div className="pdf-text-copy-14 pdf-text-center" style={{ color: 'var(--color-functional-red)', marginBottom: '12px', fontSize: '12px' }}>{error}</div>}
          {success && <div className="pdf-text-copy-14 pdf-text-center" style={{ color: '#10b981', marginBottom: '12px', fontSize: '12px', fontWeight: 600 }}>{success}</div>}

          {results.length > 0 && (
            <div className="pdf-flex-col pdf-gap-100">
              <div className="pdf-text-label-14-mono pdf-text-muted" style={{ fontSize: '11px' }}>검색된 사용자:</div>
              {results.map(result => (
                <div key={result.userId} className="pdf-panel pdf-flex-row pdf-items-center pdf-justify-between" style={{ padding: '12px', marginBottom: 0, borderRadius: '10px' }}>
                  <div style={{ overflow: 'hidden', marginRight: 'var(--space-100)' }}>
                    <div className="pdf-text-label-16" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '14px', fontWeight: 600 }}>
                      {result.displayName || result.userId.split(':')[0].substring(1)}
                    </div>
                    <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '12px', marginTop: '2px' }}>
                      {result.userId}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleInvite(result.userId)}
                    className="pdf-btn-primary pdf-btn-xs"
                    style={{ flexShrink: 0, height: '30px', padding: '0 12px', borderRadius: '6px' }}
                  >
                    <UserPlus size={13} /> 초대 발송
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
