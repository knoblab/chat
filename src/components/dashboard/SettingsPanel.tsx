import React, { useState, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { AuthImage } from '../AuthImage';
import { getUserCode } from '../../utils/rooms';
import { deleteUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase';
import { Upload, X, LogOut, Trash2, Download as DownloadIcon, Upload as UploadIcon, ShieldCheck } from 'lucide-react';
import { optimizeImage } from '../../utils/imageOptimizer';
import { ImageCropperModal } from './ImageCropperModal';
import { useChatStore } from '../../stores/useChatStore';

const GoogleDriveLogo = ({ size = 18 }: { size?: number }) => (
  <img 
    src="https://www.gstatic.com/images/branding/productlogos/drive_2026/v2/web-64dp/logo_drive_2026_color_2x_web_64dp.png" 
    alt="Google Drive" 
    width={size} 
    height={size} 
    style={{ flexShrink: 0, display: 'block', objectFit: 'contain' }} 
  />
);

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

  // Cropper state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);

  // Delete account confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmCode, setDeleteConfirmCode] = useState('');
  const userCode = client?.getUserId() ? getUserCode(client.getUserId()) : '';

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

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    // 25MB check
    if (file.size > 25 * 1024 * 1024) {
      alert('단일 파일 업로드는 최대 25MB까지만 가능합니다.');
      e.target.value = '';
      return;
    }

    setCropFile(file);
    setIsCropperOpen(true);
    e.target.value = '';
  };

  const handleCroppedAvatarUpload = async (file: File) => {
    if (!client) return;
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
        setProfileSuccess('프로필 사진이 성공적으로 업데이트되었습니다!');
      }
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      setProfileError('사진 업로드 실패: ' + (err.message || 'Unknown error'));
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
      setProfileSuccess('닉네임이 성공적으로 저장되었습니다!');
    } catch (err: any) {
      console.error('Failed to save display name:', err);
      setProfileError('닉네임 저장 실패: ' + (err.message || 'Unknown error'));
    } finally {
      setProfileLoading(false);
    }
  };

  // Google Drive Backup
  const handleGoogleDriveBackup = async () => {
    if (!client) return;
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error('구글 드라이브 접근 권한(Access Token)을 획득하지 못했습니다.');
      }

      const chatState = useChatStore.getState();
      let exportedKeys = null;
      try {
        if ((client as any).exportRoomKeys) {
          exportedKeys = await (client as any).exportRoomKeys();
        } else if (client.getCrypto() && (client.getCrypto() as any).exportRoomKeys) {
          exportedKeys = await (client.getCrypto() as any).exportRoomKeys();
        }
      } catch (err) {
        console.warn('Key export not available or failed:', err);
      }

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        userId: client.getUserId(),
        profile: {
          displayName: myDisplayName,
          avatarUrl: myAvatarUrl,
        },
        rooms: client.getRooms().map(r => ({
          roomId: r.roomId,
          name: r.name,
          isEncrypted: client.isRoomEncrypted(r.roomId),
        })),
        messages: chatState.messages,
        encryptionKeys: exportedKeys,
      };

      const fileContent = JSON.stringify(backupData, null, 2);
      const fileName = 'qpi_chat_backup_v1.json';

      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchJson = await searchRes.json();
      const existingFile = searchJson.files?.[0];

      if (existingFile) {
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: fileContent,
          }
        );
      } else {
        const metadata = { name: fileName, mimeType: 'application/json' };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([fileContent], { type: 'application/json' }));

        await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
          }
        );
      }

      setProfileSuccess('✅ 구글 드라이브에 데이터 및 암호화 키 백업이 완료되었습니다!');
    } catch (err: any) {
      console.error('Google Drive backup failed:', err);
      setProfileError('구글 드라이브 백업 실패: ' + (err.message || '오류 발생'));
    } finally {
      setProfileLoading(false);
    }
  };

  // Google Drive Restore
  const handleGoogleDriveRestore = async () => {
    if (!client) return;
    setProfileLoading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (!accessToken) {
        throw new Error('구글 드라이브 접근 권한을 획득하지 못했습니다.');
      }

      const fileName = 'qpi_chat_backup_v1.json';
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${fileName}' and trashed=false&spaces=drive`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const searchJson = await searchRes.json();
      const existingFile = searchJson.files?.[0];

      if (!existingFile) {
        throw new Error('구글 드라이브에서 백업 파일(qpi_chat_backup_v1.json)을 찾을 수 없습니다.');
      }

      const downloadRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const backupData = await downloadRes.json();

      if (backupData.messages) {
        Object.entries(backupData.messages).forEach(([rId, msgs]) => {
          useChatStore.getState().setMessages(rId, msgs as any);
        });
      }

      if (backupData.encryptionKeys) {
        try {
          if ((client as any).importRoomKeys) {
            await (client as any).importRoomKeys(backupData.encryptionKeys);
          } else if (client.getCrypto() && (client.getCrypto() as any).importRoomKeys) {
            await (client.getCrypto() as any).importRoomKeys(backupData.encryptionKeys);
          }
        } catch (keyErr) {
          console.warn('Failed to import room keys:', keyErr);
        }
      }

      setProfileSuccess('✅ 구글 드라이브에서 데이터 및 암호화 키 복원이 완료되었습니다!');
    } catch (err: any) {
      console.error('Google Drive restore failed:', err);
      setProfileError('구글 드라이브 복원 실패: ' + (err.message || '오류 발생'));
    } finally {
      setProfileLoading(false);
    }
  };

  // Local PC Backup
  const handleLocalBackup = async () => {
    if (!client) return;
    try {
      const chatState = useChatStore.getState();
      let exportedKeys = null;
      try {
        if ((client as any).exportRoomKeys) {
          exportedKeys = await (client as any).exportRoomKeys();
        } else if (client.getCrypto() && (client.getCrypto() as any).exportRoomKeys) {
          exportedKeys = await (client.getCrypto() as any).exportRoomKeys();
        }
      } catch (_err) {}

      const backupData = {
        version: '1.0.0',
        timestamp: Date.now(),
        userId: client.getUserId(),
        profile: { displayName: myDisplayName, avatarUrl: myAvatarUrl },
        messages: chatState.messages,
        encryptionKeys: exportedKeys,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qpi_chat_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setProfileSuccess('✅ 로컬 PC로 백업 파일이 다운로드되었습니다.');
    } catch (err: any) {
      setProfileError('로컬 백업 실패: ' + err.message);
    }
  };

  // Local PC Restore
  const handleLocalRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        if (backupData.messages) {
          Object.entries(backupData.messages).forEach(([rId, msgs]) => {
            useChatStore.getState().setMessages(rId, msgs as any);
          });
        }
        if (backupData.encryptionKeys) {
          try {
            if ((client as any).importRoomKeys) {
              await (client as any).importRoomKeys(backupData.encryptionKeys);
            } else if (client.getCrypto() && (client.getCrypto() as any).importRoomKeys) {
              await (client.getCrypto() as any).importRoomKeys(backupData.encryptionKeys);
            }
          } catch {}
        }
        setProfileSuccess('✅ 백업 파일로부터 데이터 및 키 복원이 완료되었습니다!');
      } catch (_err: any) {
        setProfileError('복원 실패: 파일 형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeleteAccount = async () => {
    if (!client) return;
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
      maxWidth: isModal ? '440px' : '540px',
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
        <h3 className="pdf-text-heading-24 pdf-text-red" style={{ margin: 0, fontSize: '1.2rem' }}>Profile & Backup Settings</h3>
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
          width: '76px', height: '76px', 
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
          <Upload size={12} /> 프로필 사진 변경 (자르기 적용)
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleAvatarUpload} 
            style={{ display: 'none' }}
            disabled={profileLoading}
          />
        </label>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>* 단일 파일 최대 25MB 제한</span>
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

        <button 
          type="submit" 
          disabled={profileLoading || !myDisplayName.trim()} 
          className="pdf-btn-primary pdf-btn-sm pdf-w-full"
        >
          닉네임 저장 (Save Nickname)
        </button>
      </form>

      {/* Backup & Restore Section */}
      <div style={{ marginTop: 'var(--space-100)', paddingTop: 'var(--space-150)', borderTop: '1px solid var(--color-border-default)' }}>
        <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', marginBottom: 'var(--space-100)' }}>
          <ShieldCheck size={16} style={{ color: 'var(--color-functional-red)' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>데이터 & 암호화 키 백업 관리</h4>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-150)', lineHeight: '1.4' }}>
          대화 내역 및 종단간 암호화(E2EE) 세션 키를 안전하게 백업하고 복원합니다. 기기 변경 시 대화 내용을 복구할 수 있습니다.
        </p>

        <div className="pdf-flex-col" style={{ gap: 'var(--space-100)' }}>
          {/* Google Drive Buttons (Google Official Branding Guidelines) */}
          <div className="pdf-flex-row" style={{ gap: 'var(--space-100)' }}>
            <button
              type="button"
              onClick={handleGoogleDriveBackup}
              disabled={profileLoading}
              className="pdf-secondary-btn"
              style={{
                flex: 1,
                height: '40px',
                padding: '0 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              title="Backup to Google Drive"
            >
              <GoogleDriveLogo size={16} />
              <span>Google 드라이브 백업</span>
            </button>
            <button
              type="button"
              onClick={handleGoogleDriveRestore}
              disabled={profileLoading}
              className="pdf-secondary-btn"
              style={{
                flex: 1,
                height: '40px',
                padding: '0 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              title="Restore from Google Drive"
            >
              <GoogleDriveLogo size={16} />
              <span>Google 드라이브 복원</span>
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '0 0 var(--space-050) 0', lineHeight: '1.3', fontStyle: 'italic', textAlign: 'center' }}>
            Google Drive는 Google Inc.의 상표입니다. 이 상표의 사용에는 Google 권한이 적용됩니다.
          </p>

          {/* Local PC Buttons */}
          <div className="pdf-flex-row" style={{ gap: 'var(--space-100)' }}>
            <button
              type="button"
              onClick={handleLocalBackup}
              disabled={profileLoading}
              className="pdf-secondary-btn pdf-btn-sm"
              style={{ flex: 1, justifyContent: 'center', gap: '6px', fontSize: '12px' }}
            >
              <DownloadIcon size={13} /> PC 파일 백업
            </button>
            <label 
              className="pdf-secondary-btn pdf-btn-sm"
              style={{ flex: 1, justifyContent: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}
            >
              <UploadIcon size={13} /> PC 파일 복원
              <input type="file" accept=".json,application/json" onChange={handleLocalRestore} style={{ display: 'none' }} disabled={profileLoading} />
            </label>
          </div>
        </div>
      </div>

      {/* Messages */}
      {profileSuccess && (
        <div className="pdf-text-copy-14 pdf-text-center" style={{ color: '#10b981', fontWeight: 600, padding: 'var(--space-050)', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px' }}>
          {profileSuccess}
        </div>
      )}
      {profileError && (
        <div className="pdf-text-copy-14 pdf-text-center" style={{ color: 'var(--color-functional-red)', padding: 'var(--space-050)', background: 'rgba(173, 29, 29, 0.1)', borderRadius: '6px' }}>
          {profileError}
        </div>
      )}

      {/* Account actions */}
      <div style={{ marginTop: 'var(--space-050)', paddingTop: 'var(--space-150)', borderTop: '1px solid var(--color-border-default)' }}>
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
          onClick={() => { setShowDeleteModal(true); setDeleteConfirmText(''); setDeleteConfirmCode(''); }} 
          className="pdf-btn-primary pdf-btn-sm pdf-w-full"
          style={{ justifyContent: 'center', gap: 'var(--space-100)', background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}
        >
          <Trash2 size={14} /> 계정 탈퇴 (Delete Account)
        </button>
      </div>

      {/* Image Cropper Modal */}
      <ImageCropperModal
        isOpen={isCropperOpen}
        file={cropFile}
        onClose={() => setIsCropperOpen(false)}
        onCropComplete={handleCroppedAvatarUpload}
      />

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          padding: 'var(--space-200)'
        }}>
          <div className="pdf-panel pdf-shadow-glow pdf-animate-modal" style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--color-bg-primary)',
            padding: 'var(--space-300)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-200)',
            borderRadius: '16px',
            border: '2px solid var(--color-functional-red)'
          }}>
            <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ borderBottom: '1px solid var(--color-border-default)', paddingBottom: 'var(--space-100)' }}>
              <h3 className="pdf-text-heading-24" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-functional-red)' }}>
                ⚠️ 영구 계정 탈퇴 (Delete Account)
              </h3>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="pdf-secondary-btn"
                style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ background: 'rgba(173, 29, 29, 0.1)', padding: 'var(--space-150)', borderRadius: '8px', borderLeft: '4px solid var(--color-functional-red)' }}>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-primary)', lineHeight: '1.5' }}>
                계정을 탈퇴하면 모든 대화방에서 나가게 되며 대화 내역 및 회원 정보가 <strong>영구적으로 삭제</strong>되며 복구할 수 없습니다.
              </p>
            </div>

            <div className="pdf-flex-col" style={{ gap: 'var(--space-150)' }}>
              <div>
                <label className="pdf-text-label-16 pdf-text-muted" style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>
                  1. 확인을 위해 아래 입력란에 <strong style={{ color: 'var(--color-functional-red)' }}>이해했습니다</strong>를 입력하세요.
                </label>
                <input
                  type="text"
                  className="pdf-input"
                  placeholder="이해했습니다"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="pdf-text-label-16 pdf-text-muted" style={{ display: 'block', fontSize: '12px', marginBottom: '6px' }}>
                  2. 본인의 계정 코드 <strong style={{ color: '#fff', background: 'var(--color-functional-red)', padding: '2px 6px', borderRadius: '4px' }}>{userCode}</strong> 를 정확히 입력하세요.
                </label>
                <input
                  type="text"
                  className="pdf-input pdf-font-mono"
                  placeholder={userCode}
                  value={deleteConfirmCode}
                  onChange={(e) => setDeleteConfirmCode(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="pdf-flex-row" style={{ gap: 'var(--space-100)', marginTop: 'var(--space-100)' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="pdf-secondary-btn pdf-btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                취소 (Cancel)
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={profileLoading || deleteConfirmText !== '이해했습니다' || deleteConfirmCode !== userCode}
                className="pdf-btn-primary pdf-btn-sm"
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  background: (deleteConfirmText === '이해했습니다' && deleteConfirmCode === userCode) ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)',
                  color: (deleteConfirmText === '이해했습니다' && deleteConfirmCode === userCode) ? '#fff' : 'var(--color-text-secondary)',
                  cursor: (deleteConfirmText === '이해했습니다' && deleteConfirmCode === userCode) ? 'pointer' : 'not-allowed',
                  border: '1px solid var(--color-border-default)'
                }}
              >
                최종 탈퇴 (Delete Forever)
              </button>
            </div>
          </div>
        </div>
      )}
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
