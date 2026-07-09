import React, { useState } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { useChatStore } from '../../stores/useChatStore';
import { Preset } from 'matrix-js-sdk';
import { X, ShieldCheck, ShieldAlert, Globe, Lock, Plus } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { client } = useMatrix();
  const { selectRoom } = useChatStore();

  const [roomName, setRoomName] = useState('');
  const [enableE2EE, setEnableE2EE] = useState(true); // 기본 켬
  const [joinRule, setJoinRule] = useState<'public' | 'invite'>('public'); // 기본: 링크 누구나 접속
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || creating) return;

    setCreating(true);
    setError('');

    try {
      const name = roomName.trim() || `새 대화방 (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;

      const initialState: any[] = [
        {
          type: 'm.room.join_rules',
          state_key: '',
          content: { join_rule: joinRule },
        },
        {
          type: 'm.room.history_visibility',
          state_key: '',
          content: { history_visibility: 'shared' },
        },
      ];

      // E2EE 종단간 암호화 설정이 켜져 있을 때만 암호화 이벤트 추가
      if (enableE2EE) {
        initialState.push({
          type: 'm.room.encryption',
          state_key: '',
          content: {
            algorithm: 'm.megolm.v1.aes-sha2',
          },
        });
      }

      const res = await client.createRoom({
        name,
        preset: joinRule === 'public' ? Preset.PublicChat : Preset.PrivateChat,
        visibility: 'private' as any,
        initial_state: initialState,
      });

      if (res.room_id) {
        selectRoom(res.room_id);
        onClose();
        // 리셋
        setRoomName('');
        setEnableE2EE(true);
        setJoinRule('public');
      }
    } catch (err: any) {
      console.error('Failed to create room:', err);
      setError(err.message || '채팅방 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-200)'
      }}
    >
      <div 
        className="pdf-panel pdf-animate-fade-in" 
        style={{ 
          width: '100%', maxWidth: '480px', maxHeight: '92vh', overflowY: 'auto',
          padding: '24px', background: 'var(--color-bg-primary)', 
          boxShadow: 'var(--shadow-hardware-elevated)', borderRadius: '16px',
          border: '1px solid var(--color-border-default)'
        }}
      >
        {/* Header */}
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={20} style={{ color: 'var(--color-functional-red)' }} />
            <h3 className="pdf-text-heading-20" style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>새 채팅방 만들기</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', borderRadius: '50%', border: 'none' }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Room Name Input */}
          <div>
            <label className="pdf-text-label-14-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              채팅방 이름 (Room Name)
            </label>
            <input
              type="text"
              className="pdf-input pdf-input-sm"
              placeholder="예: 프로젝트 팀 대화방, 보안 회의 등"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', fontSize: '14px' }}
              autoFocus
            />
          </div>

          {/* E2EE Toggle Card (기본 켬) */}
          <div>
            <label className="pdf-text-label-14-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              보안 및 암호화 설정 (E2EE Encryption)
            </label>

            <div
              onClick={() => setEnableE2EE(!enableE2EE)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px',
                borderRadius: '12px',
                border: enableE2EE ? '2px solid var(--color-functional-red)' : '1px solid var(--color-border-default)',
                background: enableE2EE ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ 
                width: 36, height: 36, borderRadius: '10px', 
                background: enableE2EE ? 'var(--color-functional-red)' : 'rgba(255,255,255,0.08)',
                color: enableE2EE ? '#fff' : 'var(--color-text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                {enableE2EE ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {enableE2EE ? '🛡️ 종단간 암호화(E2EE) 켜짐 (기본)' : '🔓 일반 비암호화 대화방 (꺼짐)'}
                  </span>
                  {/* Toggle Switch UI */}
                  <div style={{
                    width: '38px',
                    height: '22px',
                    borderRadius: '11px',
                    background: enableE2EE ? 'var(--color-functional-red)' : 'rgba(255,255,255,0.2)',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0
                  }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: '#fff',
                      position: 'absolute',
                      top: '3px',
                      left: enableE2EE ? '19px' : '3px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                    }} />
                  </div>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--color-text-secondary)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  {enableE2EE 
                    ? '대화 당사자의 기기에서만 복호화할 수 있으며, 서버 관리자 및 해커도 절대 내용을 볼 수 없습니다.'
                    : '암호화 과정이 없으므로 메시지 전송 및 검색 속도가 매우 빠른 일반 채팅 모드입니다.'}
                </p>
              </div>
            </div>
          </div>

          {/* Join Rule Selection */}
          <div>
            <label className="pdf-text-label-14-mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-secondary)', display: 'block', marginBottom: '8px' }}>
              방 접속 허용 범위 선택 (Join Permissions)
            </label>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div
                onClick={() => setJoinRule('public')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: joinRule === 'public' ? '2px solid var(--color-functional-red)' : '1px solid var(--color-border-default)',
                  background: joinRule === 'public' ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  <Globe size={15} style={{ color: joinRule === 'public' ? 'var(--color-functional-red)' : 'var(--color-text-secondary)' }} />
                  <span>링크 누구나 접속</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  초대 링크를 아는 모든 사용자 승인 없이 참여
                </span>
              </div>

              <div
                onClick={() => setJoinRule('invite')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  padding: '12px',
                  borderRadius: '10px',
                  border: joinRule === 'invite' ? '2px solid var(--color-functional-red)' : '1px solid var(--color-border-default)',
                  background: joinRule === 'invite' ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-bg-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  <Lock size={15} style={{ color: joinRule === 'invite' ? 'var(--color-functional-red)' : 'var(--color-text-secondary)' }} />
                  <span>초대된 사용자만</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--color-text-secondary)', lineHeight: 1.3 }}>
                  관리자의 초대 및 승인을 받은 사용자만 입장
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="pdf-text-copy-14 pdf-text-center" style={{ color: 'var(--color-functional-red)', fontSize: '12px' }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              className="pdf-secondary-btn"
              style={{ flex: 1, height: '42px', borderRadius: '10px', fontWeight: 600 }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={creating}
              className="pdf-btn-primary"
              style={{ flex: 1, height: '42px', borderRadius: '10px', fontWeight: 700 }}
            >
              {creating ? '생성 중...' : '채팅방 만들기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
