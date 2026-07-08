import React, { useState, useRef, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { useChatStore } from '../../stores/useChatStore';
import { Send, Image as ImageIcon, Film, Edit2, X, Timer } from 'lucide-react';

interface MessageInputProps {
  roomId: string;
  editingMessageId: string | null;
  editingText: string;
  onCancelEdit: () => void;
  onSend: (text: string, file?: File) => Promise<void>;
  onSaveEdit: (text: string) => Promise<void>;
  typingUsers?: string[];
}

export const MessageInput: React.FC<MessageInputProps> = ({
  roomId,
  editingMessageId,
  editingText: initialEditingText,
  onCancelEdit,
  onSend,
  onSaveEdit,
  typingUsers = [],
}) => {
  const { client } = useMatrix();
  const { disappearingMode, toggleDisappearingMode } = useChatStore();
  const isDisappearing = disappearingMode[roomId] || false;

  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingMessageId) {
      setInputText(initialEditingText);
    } else {
      setInputText('');
    }
    textInputRef.current?.focus();
  }, [editingMessageId, initialEditingText, roomId]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      
      const ignoreKeys = [
        'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
        'PageUp', 'PageDown', 'Home', 'End', 'Shift', 'Control', 'Alt', 
        'Meta', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'Insert'
      ];
      if (ignoreKeys.includes(e.key) || e.key.startsWith('F')) return;

      if (textInputRef.current) {
        textInputRef.current.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    };
  }, [attachmentPreviewUrl]);

  const handleRemoveAttachment = () => {
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
    setSelectedAttachment(null);
    setAttachmentPreviewUrl(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 45 * 1024 * 1024 : 25 * 1024 * 1024;
    const sizeLabel = isVideo ? '45MB' : '25MB';

    // Size Check
    if (file.size > maxSize) {
      alert(`단일 ${isVideo ? '동영상' : '파일'} 업로드는 최대 ${sizeLabel}까지만 가능합니다.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedAttachment(file);
    const url = URL.createObjectURL(file);
    setAttachmentPreviewUrl(url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!client || editingMessageId) return;

    try {
      client.sendTyping(roomId, true, 3000);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        client.sendTyping(roomId, false, 0);
      }, 3000);
    } catch (err) {
      console.warn('Failed to send typing indicator:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedAttachment) return;

    const text = inputText;
    const fileToSend = selectedAttachment;

    setInputText('');
    handleRemoveAttachment();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (client) {
      try { client.sendTyping(roomId, false, 0); } catch {}
    }

    if (editingMessageId) {
      await onSaveEdit(text);
    } else {
      setUploading(true);
      try {
        await onSend(text, fileToSend || undefined);
      } finally {
        setUploading(false);
        textInputRef.current?.focus();
      }
    }
  };

  const isMobile = window.innerWidth < 1024;

  return (
    <div className="pdf-flex-col pdf-mobile-input-bar" style={{ 
      background: 'var(--color-bg-primary)', 
      borderTop: '1px solid var(--color-border-default)',
      paddingBottom: isMobile ? 'calc(8px + env(safe-area-inset-bottom, 0px))' : '0px',
      position: 'sticky', bottom: 0, zIndex: 40
    }}>
      {typingUsers.length > 0 && !editingMessageId && (
        <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ padding: '4px var(--space-200)', fontSize: '11px', fontStyle: 'italic', background: 'var(--color-bg-secondary)' }}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? '님이 입력 중...' : '님이 입력 중...'}
        </div>
      )}

      {isDisappearing && !editingMessageId && (
        <div className="pdf-flex-row pdf-items-center" style={{ background: 'rgba(245, 158, 11, 0.15)', borderBottom: '1px solid #f59e0b', padding: '6px 14px', gap: '6px', color: '#f59e0b', fontSize: '11px', fontWeight: 600 }}>
          <Timer size={14} />
          <span>⏱️ 1시간 자동 삭제 모드 ON (전송된 메시지는 1시간 후 사라집니다)</span>
        </div>
      )}

      {selectedAttachment && attachmentPreviewUrl && (
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderBottom: '1px solid var(--color-border-default)', gap: '12px' }}>
          <div className="pdf-flex-row pdf-items-center" style={{ gap: '10px', overflow: 'hidden' }}>
            {selectedAttachment.type.startsWith('video/') ? (
              <video src={attachmentPreviewUrl} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border-default)', background: '#000' }} muted playsInline />
            ) : (
              <img src={attachmentPreviewUrl} alt="Preview" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border-default)' }} />
            )}
            <div className="pdf-flex-col" style={{ overflow: 'hidden' }}>
              <span className="pdf-text-copy-13-mono" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{selectedAttachment.name}</span>
              <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{(selectedAttachment.size / (1024 * 1024)).toFixed(2)} MB ({selectedAttachment.type.startsWith('video/') ? '동영상 썸네일 자동추출 대기' : '전송 대기 중'})</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemoveAttachment}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '28px', height: '28px', padding: 0, justifyContent: 'center', borderRadius: '14px' }}
            title="첨부 취소"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {editingMessageId && (
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ background: 'var(--color-bg-secondary)', padding: '8px 14px', borderBottom: '1px solid var(--color-border-default)' }}>
          <div className="pdf-flex-row pdf-items-center" style={{ gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-functional-red)' }}>
            <Edit2 size={13} />
            <span>메시지 수정 중</span>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '24px', height: '24px', padding: 0, justifyContent: 'center', borderRadius: '12px' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pdf-flex-row pdf-items-center" style={{ padding: isMobile ? '8px 12px' : '12px 16px', gap: '8px' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
        {!editingMessageId && (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="pdf-secondary-btn"
              style={{ width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', padding: 0, justifyContent: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '2px', borderRadius: '20px', background: 'var(--color-bg-secondary)', border: 'none' }}
              title="이미지/동영상 업로드"
            >
              <ImageIcon size={17} />
              <Film size={15} />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => toggleDisappearingMode(roomId)}
              className="pdf-secondary-btn"
              style={{ 
                width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', padding: 0, justifyContent: 'center', flexShrink: 0, borderRadius: '20px',
                background: isDisappearing ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-bg-secondary)',
                border: isDisappearing ? '1px solid #f59e0b' : 'none',
                color: isDisappearing ? '#f59e0b' : 'var(--color-text-primary)'
              }}
              title="1시간 자동 삭제 토글"
            >
              <Timer size={18} />
            </button>
          </>
        )}
        <input
          type="text"
          ref={textInputRef}
          className="pdf-input"
          placeholder={editingMessageId ? '수정할 메시지를 입력하세요...' : (uploading ? '전송 중...' : (selectedAttachment ? '설명(캡션) 입력 후 전송...' : '메시지 입력...'))}
          value={inputText}
          onChange={handleInputChange}
          disabled={uploading}
          style={{ 
            flex: 1, 
            height: isMobile ? '40px' : '42px', 
            borderRadius: '20px', 
            paddingLeft: '16px', 
            paddingRight: '16px', 
            fontSize: isMobile ? '14px' : '15px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)'
          }}
        />
        <button
          type="submit"
          disabled={(!inputText.trim() && !selectedAttachment && !uploading) || uploading}
          className="pdf-btn-primary"
          style={{ 
            width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', 
            padding: 0, justifyContent: 'center', flexShrink: 0, borderRadius: '20px',
            boxShadow: (!inputText.trim() && !selectedAttachment) ? 'none' : '0 3px 10px rgba(239, 68, 68, 0.4)'
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
