import React, { useState, useRef, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { useChatStore } from '../../stores/useChatStore';
import { Send, Edit2, X, Timer, Paperclip, FileText } from 'lucide-react';

interface MessageInputProps {
  roomId: string;
  editingMessageId: string | null;
  editingText: string;
  onCancelEdit: () => void;
  onSend: (text: string, files?: File[]) => Promise<void>;
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
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<string[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
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
      attachmentPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachmentPreviewUrls]);

  const handleRemoveAttachment = (index: number) => {
    URL.revokeObjectURL(attachmentPreviewUrls[index]);
    setSelectedAttachments(prev => prev.filter((_, i) => i !== index));
    setAttachmentPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAttachments = () => {
    attachmentPreviewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedAttachments([]);
    setAttachmentPreviewUrls([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length > 1) {
      // Multiple files - must be images, max 4, max 10MB each
      const allImages = files.every(f => f.type.startsWith('image/'));
      if (!allImages) {
        alert('모아보내기는 이미지만 가능하며, 동영상이나 일반 파일은 한 번에 하나씩만 전송할 수 있습니다.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (files.length > 4) {
        alert('이미지는 한 번에 최대 4장까지만 전송할 수 있습니다.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      const overSized = files.some(f => f.size > 10 * 1024 * 1024);
      if (overSized) {
        alert('모아보내기 시 각 이미지의 크기는 최대 10MB까지만 가능합니다.');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    } else {
      // Single file validation
      const file = files[0];
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 45 * 1024 * 1024 : 25 * 1024 * 1024;
      const sizeLabel = isVideo ? '45MB' : '25MB';

      if (file.size > maxSize) {
        alert(`단일 ${isVideo ? '동영상' : '파일'} 업로드는 최대 ${sizeLabel}까지만 가능합니다.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    // Clear previous attachment previews
    attachmentPreviewUrls.forEach(url => URL.revokeObjectURL(url));

    setSelectedAttachments(files);
    const urls = files.map(file => URL.createObjectURL(file));
    setAttachmentPreviewUrls(urls);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Trigger submission
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  // Auto-adjust textarea height
  useEffect(() => {
    const textarea = textInputRef.current;
    if (!textarea) return;
    
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;

    if (newHeight > 45) {
      textarea.style.borderRadius = '12px';
    } else {
      textarea.style.borderRadius = '20px';
    }
  }, [inputText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && selectedAttachments.length === 0) return;

    const text = inputText;
    const filesToSend = selectedAttachments;

    setInputText('');
    handleClearAttachments();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (client) {
      try { client.sendTyping(roomId, false, 0); } catch {}
    }

    if (editingMessageId) {
      await onSaveEdit(text);
    } else {
      setUploading(true);
      try {
        await onSend(text, filesToSend.length > 0 ? filesToSend : undefined);
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
        <div className="pdf-flex-row pdf-items-center" style={{ background: 'var(--color-disappearing-banner-bg)', borderBottom: '1px solid var(--color-disappearing-banner-border)', padding: '6px 14px', gap: '6px', color: 'var(--color-disappearing-banner-text)', fontSize: '11px', fontWeight: 600 }}>
          <Timer size={14} />
          <span>⏱️ 1시간 자동 삭제 모드 ON (전송된 메시지는 1시간 후 사라집니다)</span>
        </div>
      )}

      {selectedAttachments.length > 0 && (
        <div className="pdf-flex-row pdf-items-center" style={{ background: 'var(--color-bg-secondary)', padding: '10px 14px', borderBottom: '1px solid var(--color-border-default)', gap: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {selectedAttachments.map((file, idx) => {
            const previewUrl = attachmentPreviewUrls[idx];
            const isVideo = file.type.startsWith('video/');
            const isImage = file.type.startsWith('image/');
            
            return (
              <div 
                key={idx} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'var(--color-bg-primary)', 
                  border: '1px solid var(--color-border-default)', 
                  borderRadius: '8px', 
                  padding: '6px 8px', 
                  position: 'relative',
                  flexShrink: 0,
                  maxWidth: '220px'
                }}
              >
                {isImage && previewUrl ? (
                  <img src={previewUrl} alt="Preview" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                ) : isVideo && previewUrl ? (
                  <video src={previewUrl} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', background: '#000' }} muted playsInline />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} />
                  </div>
                )}
                
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', width: '120px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.name}>
                    {file.name}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--color-text-secondary)' }}>
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(idx)}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-text-primary)',
                    flexShrink: 0
                  }}
                  title="삭제"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
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
          multiple
          onChange={handleFileSelect}
        />
        {!editingMessageId && (
          <>
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="pdf-secondary-btn"
              style={{ width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', padding: 0, justifyContent: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', borderRadius: '20px', background: 'var(--color-bg-secondary)', border: 'none' }}
              title="파일/이미지 첨부"
            >
              <Paperclip size={18} />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={() => toggleDisappearingMode(roomId)}
              className="pdf-secondary-btn"
              style={{ 
                width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', padding: 0, justifyContent: 'center', flexShrink: 0, borderRadius: '20px',
                background: isDisappearing ? 'var(--color-disappearing-btn-bg)' : 'var(--color-bg-secondary)',
                border: isDisappearing ? '1px solid var(--color-disappearing-btn-border)' : 'none',
                color: isDisappearing ? 'var(--color-disappearing-btn-text)' : 'var(--color-text-primary)'
              }}
              title="1시간 자동 삭제 토글"
            >
              <Timer size={18} />
            </button>
          </>
        )}
        <textarea
          ref={textInputRef}
          className="pdf-input"
          placeholder={editingMessageId ? '수정할 메시지를 입력하세요...' : (uploading ? '전송 중...' : (selectedAttachments.length > 0 ? '설명(캡션) 입력 후 전송...' : '메시지 입력...'))}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          rows={1}
          style={{ 
            flex: 1, 
            height: isMobile ? '40px' : '42px', 
            borderRadius: '20px', 
            padding: '10px 16px', 
            fontSize: isMobile ? '14px' : '15px',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)',
            resize: 'none',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            overflowY: 'auto'
          }}
        />
        <button
          type="submit"
          disabled={(!inputText.trim() && selectedAttachments.length === 0 && !uploading) || uploading}
          className="pdf-btn-primary"
          style={{ 
            width: isMobile ? '40px' : '42px', height: isMobile ? '40px' : '42px', 
            padding: 0, justifyContent: 'center', flexShrink: 0, borderRadius: '20px',
            boxShadow: (!inputText.trim() && selectedAttachments.length === 0) ? 'none' : '0 3px 10px rgba(239, 68, 68, 0.4)'
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
