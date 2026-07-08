import React, { useState, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { AuthImage } from '../AuthImage';
import { getUserCode } from '../../utils/rooms';
import { getAuth, deleteUser } from 'firebase/auth';
import { Upload, X, LogOut, Trash2 } from 'lucide-react';
import { optimizeImage } from '../../utils/imageOptimizer';

interface SettingsPanelProps {
  isModal?: boolean;
  onClose?: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isModal = false, onClose }) => {
  const { client, logout } = useMatrix();
  const [myDisplayName, setMyDisplayName] = useState('');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  useEffect(() => {
    if (!client) return;
    const loadProfile = async () => {
      try {
        const userId = client.getUserId();
        if (userId) {
          const profile = await client.getProfileInfo(userId);
          if (profile.displayname) setMyDisplayName(profile.displayname);
          else setMyDisplayName(userId.split(':')[0].substring(1));
          if (profile.avatar_url) setMyAvatarUrl(profile.avatar_url);
        }
      } catch (err) {
        console.warn('Failed to fetch profile:', err);
      }
    };
    loadProfile();
  }, [client]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const optimizedFile = await optimizeImage(file, 800, 0.82);
      const uploadRes = await client.uploadContent(optimizedFile);
      const mxcUrl = uploadRes.content_uri;
      if (mxcUrl) {
        await client.setAvatarUrl(mxcUrl);
        setMyAvatarUrl(mxcUrl);
        setProfileSuccess('Profile photo updated!');
      }
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setProfileError('Failed to upload photo: ' + (err.message || 'Unknown error'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !myDisplayName.trim()) return;

    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      await client.setDisplayName(myDisplayName.trim());
      setProfileSuccess('Nickname saved successfully!');
    } catch (err: any) {
      console.error('Failed to save display name:', err);
      setProfileError('Failed to save nickname: ' + (err.message || 'Unknown error'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!client) return;
    const confirmed = window.confirm(
      '정말로 계정을 탈퇴하시겠습니까? 탈퇴 시 모든 대화방에서 나가게 되며 계정이 영구 삭제됩니다.\n\nAre you sure you want to delete your account? This cannot be undone.'
    );
    if (!confirmed) return;

    setProfileLoading(true);
    setProfileError('');

    try {
      try {
        const rooms = client.getRooms();
        for (const room of rooms) {
          try {
            await client.leave(room.roomId);
          } catch (e) {
            console.warn('Failed to leave room during deletion:', room.roomId, e);
          }
        }
      } catch (e) {
        console.warn('Error while leaving rooms:', e);
      }

      const auth = getAuth();
      const user = auth.currentUser;
      if (user) {
        await deleteUser(user);
      }

      await logout();
    } catch (err: any) {
      console.error('Failed to delete account:', err);
      if (err.code === 'auth/requires-recent-login') {
        alert('보안을 위해 재로그인이 필요합니다. 로그아웃 후 다시 로그인하여 탈퇴를 진행해주세요.');
      } else {
        alert('계정 탈퇴 중 오류가 발생했습니다: ' + (err.message || 'Unknown error'));
      }
      setProfileLoading(false);
    }
  };

  const content = (
    <div className={`pdf-panel ${isModal ? 'pdf-shadow-glow pdf-animate-modal' : ''}`} style={{
      width: '100%',
      maxWidth: isModal ? '400px' : '500px',
      margin: isModal ? '0' : '0 auto',
      padding: 'var(--space-300)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--space-200)',
      position: 'relative',
      background: 'var(--color-bg-primary)',
      border: isModal ? '1px solid var(--color-border-default)' : 'none'
    }}>
      {/* Header */}
      <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: 'var(--space-100)' }}>
        <h3 className="pdf-text-heading-24 pdf-text-red" style={{ margin: 0, fontSize: '1.2rem' }}>Profile Settings</h3>
        {isModal && onClose && (
          <button 
            type="button"
            onClick={onClose}
            className="pdf-secondary-btn"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Avatar Section */}
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
            <AuthImage 
              mxcUrl={myAvatarUrl}
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
          <label className="pdf-text-label-16 pdf-text-muted pdf-mb-050" style={{ display: 'block', fontSize: '0.85rem' }}>My User Code (Click to Copy)</label>
          <div 
            className="pdf-panel pdf-selectable pdf-font-mono" 
            onClick={() => {
              if (client?.getUserId()) {
                const code = getUserCode(client.getUserId());
                navigator.clipboard.writeText(code);
                alert(`Copied Code (${code}) to clipboard!`);
              }
            }}
            style={{ 
              padding: 'var(--space-100)', 
              background: 'var(--color-bg-secondary)', 
              fontSize: '0.85rem',
              wordBreak: 'break-all',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-100)',
              cursor: 'pointer',
              borderRadius: '6px',
              border: '1px solid var(--color-border-default)'
            }}
          >
            <span style={{ flex: 1, userSelect: 'all', WebkitUserSelect: 'all', fontWeight: 'bold' }}>{getUserCode(client?.getUserId())}</span>
            <span style={{ fontSize: '11px', color: 'var(--color-functional-red)', fontWeight: 600, flexShrink: 0 }}>Copy Code</span>
          </div>
        </div>

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

      <div style={{ marginTop: 'var(--space-100)', paddingTop: 'var(--space-200)', borderTop: '1px solid var(--color-border-default)' }}>
        {!isModal && (
          <button 
            onClick={logout} 
            className="pdf-secondary-btn pdf-btn-sm pdf-w-full pdf-mb-100"
            style={{ justifyContent: 'center', gap: 'var(--space-100)', color: 'var(--color-functional-red)', borderColor: 'var(--color-functional-red)' }}
          >
            <LogOut size={14} /> Logout
          </button>
        )}
        <button 
          onClick={handleDeleteAccount} 
          className="pdf-btn-primary pdf-btn-sm pdf-w-full"
          style={{ justifyContent: 'center', gap: 'var(--space-100)', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
        >
          <Trash2 size={14} /> 계정 탈퇴 (Delete Account)
        </button>
      </div>
    </div>
  );

  if (isModal) {
    return (
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
        {content}
      </div>
    );
  }

  return <div style={{ padding: 'var(--space-200)', height: '100%', overflowY: 'auto' }}>{content}</div>;
};
