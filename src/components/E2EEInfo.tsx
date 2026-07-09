import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const E2EEInfoButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 280;
    const popoverHeight = 150;
    
    // Calculate horizontal position centered on button, clamped to screen width
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));
    
    // Calculate vertical position below button, or above if near bottom
    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - 20 && rect.top > popoverHeight + 12) {
      top = rect.top - popoverHeight - 8;
    }
    
    setPos({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleResizeOrScroll = () => {
      updatePosition();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResizeOrScroll, true);
    window.addEventListener('scroll', handleResizeOrScroll, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResizeOrScroll, true);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPinned && isOpen) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      updatePosition();
      setIsPinned(true);
      setIsOpen(true);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="e2ee-info-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: isOpen || isPinned ? 'var(--color-functional-red)' : 'var(--color-bg-tertiary)',
          border: '1px solid',
          borderColor: isOpen || isPinned ? 'var(--color-functional-red)' : 'var(--color-border-default)',
          color: isOpen || isPinned ? '#fff' : 'var(--color-text-secondary)',
          cursor: 'pointer',
          padding: 0,
          transition: 'all 0.15s ease',
          flexShrink: 0,
          marginLeft: '4px'
        }}
        title="종단간 암호화(E2EE)란?"
      >
        <Info size={11} strokeWidth={2.5} />
      </button>

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => {
            if (!isPinned) setIsOpen(false);
          }}
          style={{
            position: 'fixed',
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            width: '280px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(239, 68, 68, 0.25)',
            zIndex: 999999,
            color: 'var(--color-text-primary)',
            animation: 'e2ee-info-fade-in 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--color-functional-red)', fontWeight: 700, fontSize: '13px' }}>
            <ShieldCheck size={16} />
            <span>종단간 암호화(E2EE)란?</span>
          </div>
          
          <p style={{ fontSize: '12px', lineHeight: '1.45', color: 'var(--color-text-secondary)', margin: '0 0 10px 0', wordBreak: 'keep-all' }}>
            발신자부터 수신자까지 <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>모든 메시지가 강력하게 암호화</strong>되어 전송되는 최고 수준의 보안 기술입니다.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--color-border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.35' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-functional-red)', flexShrink: 0, marginTop: '1px' }} />
              <span>오직 대화 당사자들의 기기에서만 복호화하여 열람 가능</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.35' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-functional-red)', flexShrink: 0, marginTop: '1px' }} />
              <span>해커, 중간 서버, 관리자 및 제3자 열람 절대 불가</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: '1.35' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--color-functional-red)', flexShrink: 0, marginTop: '1px' }} />
              <span>사진, 동영상 및 모든 파일 첨부 완벽 보호</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
