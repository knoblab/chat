import React, { useState, useRef, useEffect } from 'react';
import { useMatrix } from '../../matrix/MatrixProvider';
import { Send, Image as ImageIcon, Edit2, X } from 'lucide-react';

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
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editingMessageId) {
      setInputText(initialEditingText);
    } else {
      setInputText('');
    }
  }, [editingMessageId, initialEditingText]);

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
    if (!inputText.trim() && !fileInputRef.current?.files?.length) return;

    const text = inputText;
    setInputText('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (client) {
      try { client.sendTyping(roomId, false, 0); } catch {}
    }

    if (editingMessageId) {
      await onSaveEdit(text);
    } else {
      const file = fileInputRef.current?.files?.[0];
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(true);
      try {
        await onSend(text, file);
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="pdf-flex-col" style={{ background: 'var(--color-bg-primary)', borderTop: '1px solid var(--color-border-default)' }}>
      {typingUsers.length > 0 && !editingMessageId && (
        <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ padding: '4px var(--space-200)', fontSize: '11px', fontStyle: 'italic', background: 'var(--color-bg-secondary)' }}>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {editingMessageId && (
        <div className="pdf-flex-row pdf-items-center pdf-justify-between" style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-050) var(--space-200)', borderBottom: '1px solid var(--color-border-default)' }}>
          <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-050)', fontSize: '12px' }}>
            <Edit2 size={12} style={{ color: 'var(--color-functional-red)' }} />
            <span>Editing message</span>
          </div>
          <button
            onClick={onCancelEdit}
            className="pdf-secondary-btn pdf-btn-xs"
            style={{ width: '20px', height: '20px', padding: 0, justifyContent: 'center', border: 'none', background: 'transparent' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="pdf-flex-row pdf-gap-100" style={{ padding: 'var(--space-150) var(--space-200)' }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={() => {
            if (fileInputRef.current?.files?.length) {
              handleSubmit({ preventDefault: () => {} } as any);
            }
          }}
        />
        {!editingMessageId && (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="pdf-secondary-btn"
            style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center', flexShrink: 0 }}
            title="Upload Image"
          >
            <ImageIcon size={18} />
          </button>
        )}
        <input
          type="text"
          className="pdf-input"
          placeholder={editingMessageId ? 'Edit message...' : (uploading ? 'Uploading image...' : 'Type a message...')}
          value={inputText}
          onChange={handleInputChange}
          disabled={uploading}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={(!inputText.trim() && !uploading) || uploading}
          className="pdf-btn-primary"
          style={{ width: '38px', height: '38px', padding: 0, justifyContent: 'center', flexShrink: 0 }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};
