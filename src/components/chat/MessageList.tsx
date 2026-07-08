import React, { useState, useRef } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../../matrix/MatrixProvider';
import { AuthImage } from '../AuthImage';
import { AuthVideo } from '../AuthVideo';
import { downloadMxcMedia } from '../../utils/media';
import type { Message } from '../../types';
import { Download, Timer } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { LinkPreview } from './LinkPreview';
import { URL_REGEX } from '../../utils/urlPreview';

const renderMessageBody = (body: string, isMe: boolean) => {
  if (!body) return null;

  const matches = [...body.matchAll(URL_REGEX)];
  if (matches.length === 0) {
    return <span>{body}</span>;
  }

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, idx) => {
    const url = match[0];
    const matchIndex = match.index!;

    if (matchIndex > lastIndex) {
      elements.push(body.substring(lastIndex, matchIndex));
    }

    elements.push(
      <a
        key={`link-${idx}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: isMe ? '#ffffff' : 'var(--color-functional-red)',
          textDecoration: 'underline',
          wordBreak: 'break-all',
          fontWeight: 600
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = matchIndex + url.length;
  });

  if (lastIndex < body.length) {
    elements.push(body.substring(lastIndex));
  }

  return <span>{elements}</span>;
};


interface MessageListProps {
  messages: Message[];
  room: Room | null;
  isDirect: boolean;
  onContextMenu: (x: number, y: number, msg: Message) => void;
  virtuosoRef: React.RefObject<VirtuosoHandle | null>;
  onAtBottomStateChange?: (atBottom: boolean) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  room,
  isDirect,
  onContextMenu,
  virtuosoRef,
  onAtBottomStateChange,
}) => {
  const { client } = useMatrix();
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const touchTimerRef = useRef<any>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  return (
    <>
      <div style={{ flex: 1, height: '100%', position: 'relative', overflow: 'hidden' }}>
        <Virtuoso
          ref={virtuosoRef}
          data={messages}
          initialTopMostItemIndex={messages.length > 0 ? messages.length - 1 : 0}
          followOutput="auto"
          alignToBottom
          atBottomStateChange={onAtBottomStateChange}
          style={{ height: '100%', width: '100%', overflowX: 'hidden' }}
          itemContent={(idx, msg) => {
            const isMe = msg.sender === client?.getUserId();
            const prevMsg = idx > 0 ? messages[idx - 1] : null;
            const nextMsg = idx < messages.length - 1 ? messages[idx + 1] : null;

            const prevDate = prevMsg ? new Date(prevMsg.timestamp) : null;
            const currDate = new Date(msg.timestamp);
            const nextDate = nextMsg ? new Date(nextMsg.timestamp) : null;

            const isSameSenderAsPrev = prevMsg && prevMsg.sender === msg.sender;
            const isSameMinuteAsPrev = prevDate && prevDate.getHours() === currDate.getHours() && prevDate.getMinutes() === currDate.getMinutes() && currDate.getDate() === prevDate.getDate();
            
            const isSameSenderAsNext = nextMsg && nextMsg.sender === msg.sender;
            const isSameMinuteAsNext = nextDate && nextDate.getHours() === currDate.getHours() && nextDate.getMinutes() === currDate.getMinutes() && currDate.getDate() === nextDate.getDate();

            const isFirstInGroup = !isSameSenderAsPrev || !isSameMinuteAsPrev;
            const showProfile = !isMe && isFirstInGroup;
            const showTime = !isSameSenderAsNext || !isSameMinuteAsNext;
            const formattedTime = currDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const marginTop = idx === 0 ? 0 : (isFirstInGroup ? 'var(--space-150)' : 'var(--space-025)');

            return (
              <div key={msg.id} className="animate-message" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isMe ? 'flex-end' : 'flex-start',
                width: '100%',
                padding: '0 var(--space-300)',
                paddingTop: idx === 0 ? 'var(--space-300)' : 0,
                paddingBottom: idx === messages.length - 1 ? 'var(--space-300)' : 0,
                marginTop: marginTop
              }}>
                {showProfile && (
                  <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', marginBottom: 'var(--space-050)' }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-default)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                      fontWeight: 'bold', color: 'var(--color-functional-red)', overflow: 'hidden'
                    }}>
                      {room?.getMember(msg.sender)?.events?.member?.getContent()?.avatar_url ? (
                        <AuthImage 
                          mxcUrl={room.getMember(msg.sender)!.events!.member!.getContent().avatar_url as string} 
                          alt={msg.sender}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        (room?.getMember(msg.sender)?.name || msg.sender).charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="pdf-text-copy-13-mono pdf-text-muted" style={{ fontWeight: 600 }}>
                      {room?.getMember(msg.sender)?.name || msg.sender}
                    </div>
                  </div>
                )}
                <div className="pdf-flex-row pdf-items-center" style={{ gap: 'var(--space-100)', flexDirection: isMe ? 'row-reverse' : 'row', maxWidth: '70%' }}>
                  <div 
                    className="pdf-panel pdf-selectable" 
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (longPressTriggeredRef.current) {
                        return;
                      }
                      if (touchTimerRef.current) {
                        clearTimeout(touchTimerRef.current);
                        touchTimerRef.current = null;
                      }
                      onContextMenu(e.clientX, e.clientY, msg);
                    }}
                    onTouchStart={(e) => {
                      longPressTriggeredRef.current = false;
                      const touch = e.touches[0];
                      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

                      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
                      touchTimerRef.current = setTimeout(() => {
                        longPressTriggeredRef.current = true;
                        onContextMenu(touch.clientX, touch.clientY, msg);
                        if (navigator.vibrate) {
                          try {
                            navigator.vibrate(40);
                          } catch (err) {}
                        }
                      }, 500);
                    }}
                    onTouchMove={(e) => {
                      if (!touchTimerRef.current || !touchStartPosRef.current) return;
                      const touch = e.touches[0];
                      const dx = touch.clientX - touchStartPosRef.current.x;
                      const dy = touch.clientY - touchStartPosRef.current.y;
                      if (Math.sqrt(dx * dx + dy * dy) > 10) {
                        clearTimeout(touchTimerRef.current);
                        touchTimerRef.current = null;
                      }
                    }}
                    onTouchEnd={() => {
                      if (touchTimerRef.current) {
                        clearTimeout(touchTimerRef.current);
                        touchTimerRef.current = null;
                      }
                    }}
                    onTouchCancel={() => {
                      if (touchTimerRef.current) {
                        clearTimeout(touchTimerRef.current);
                        touchTimerRef.current = null;
                      }
                    }}
                    style={{
                      background: msg.isDisappearing 
                        ? (isMe ? 'rgba(245, 158, 11, 0.25)' : 'rgba(245, 158, 11, 0.15)')
                        : (isMe ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)'),
                      color: msg.isDisappearing
                        ? (isMe ? '#fff' : '#f59e0b')
                        : (isMe ? 'var(--color-bg-primary)' : 'var(--color-text-primary)'),
                      border: msg.isDisappearing ? '1px dashed #f59e0b' : '1px solid ' + (isMe ? 'var(--color-functional-red)' : 'var(--color-border-default)'),
                      padding: (msg.msgtype === 'm.image' || msg.msgtype === 'm.video') ? 'var(--space-050)' : 'var(--space-100) var(--space-150)',
                      borderRadius: isMe 
                        ? (isFirstInGroup ? '12px 12px 2px 12px' : '12px 2px 2px 12px') 
                        : (isFirstInGroup ? '12px 12px 12px 2px' : '2px 12px 12px 2px'),
                      boxShadow: isMe ? 'none' : 'var(--shadow-hardware-bevel)',
                      marginBottom: 0,
                      maxWidth: '100%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {msg.msgtype === 'm.video' && msg.url ? (
                      <div style={{ position: 'relative' }}>
                        <AuthVideo 
                          mxcUrl={msg.url}
                          posterMxcUrl={msg.info?.thumbnail_url}
                          alt={msg.body} 
                          className="pdf-radius-sm"
                          style={{ maxWidth: '100%', maxHeight: '360px', display: 'block' }}
                        />
                        {!msg.info?.isPendingUpload && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMxcMedia(client, msg.url!, msg.body || 'video.mp4');
                            }}
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              background: 'rgba(0,0,0,0.6)', color: '#fff',
                              border: 'none', borderRadius: '4px', padding: '6px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              zIndex: 10
                            }}
                            title="Download Video"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        {msg.info?.isPendingUpload && (
                          <div style={{
                            width: '100%', background: 'rgba(0,0,0,0.75)', padding: '8px 12px',
                            borderRadius: '6px', marginTop: '6px', border: '1px solid rgba(255,255,255,0.15)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>
                              <span>{msg.info?.uploadError ? '❌ 업로드 실패' : '🎬 동영상 업로드 중...'}</span>
                              <span>{msg.info?.uploadProgress || 0}%</span>
                            </div>
                            {!msg.info?.uploadError && (
                              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${msg.info?.uploadProgress || 0}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="pdf-text-copy-13-mono pdf-mt-100 pdf-flex-row pdf-items-center pdf-justify-between" style={{ 
                          fontSize: '11px', 
                          color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
                          padding: '4px var(--space-050) var(--space-050) var(--space-050)' 
                        }}>
                          <span>{msg.body} {msg.info?.size ? `(${(msg.info.size / (1024 * 1024)).toFixed(1)}MB)` : ''}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }}>
                                <Timer size={11} /> 1h
                              </span>
                            )}
                            {isMe && isDirect && !msg.isReadByOther && !msg.info?.isPendingUpload && (
                              <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '10px' }}>1</span>
                            )}
                            {showTime && <span>{formattedTime}</span>}
                          </div>
                        </div>
                      </div>
                    ) : msg.msgtype === 'm.image' && msg.url ? (
                      <div style={{ position: 'relative' }}>
                        <div onClick={() => !msg.info?.isPendingUpload && setSelectedImageUrl(msg.url!)}>
                          <AuthImage 
                            mxcUrl={msg.url}
                            alt={msg.body} 
                            className="pdf-radius-sm"
                            style={{ maxWidth: '100%', maxHeight: '300px', display: 'block', cursor: msg.info?.isPendingUpload ? 'default' : 'pointer' }}
                          />
                        </div>
                        {!msg.info?.isPendingUpload && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadMxcMedia(client, msg.url!, msg.body || 'download');
                            }}
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              background: 'rgba(0,0,0,0.5)', color: '#fff',
                              border: 'none', borderRadius: '4px', padding: '4px',
                              cursor: 'pointer', display: 'flex', alignItems: 'center'
                            }}
                            title="Download Image"
                          >
                            <Download size={14} />
                          </button>
                        )}
                        {msg.info?.isPendingUpload && (
                          <div style={{
                            width: '100%', background: 'rgba(0,0,0,0.75)', padding: '8px 12px',
                            borderRadius: '6px', marginTop: '6px', border: '1px solid rgba(255,255,255,0.15)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>
                              <span>{msg.info?.uploadError ? '❌ 업로드 실패' : '🖼️ 이미지 업로드 중...'}</span>
                              <span>{msg.info?.uploadProgress || 0}%</span>
                            </div>
                            {!msg.info?.uploadError && (
                              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{
                                  width: `${msg.info?.uploadProgress || 0}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                            )}
                          </div>
                        )}
                        <div className="pdf-text-copy-13-mono pdf-mt-100 pdf-flex-row pdf-items-center pdf-justify-between" style={{ 
                          fontSize: '11px', 
                          color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)',
                          padding: '0 var(--space-050) var(--space-050) var(--space-050)' 
                        }}>
                          <span>{msg.body}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }}>
                                <Timer size={11} /> 1h
                              </span>
                            )}
                            {isMe && isDirect && !msg.isReadByOther && !msg.info?.isPendingUpload && (
                              <span style={{ color: '#ffc107', fontWeight: 'bold', fontSize: '10px' }}>1</span>
                            )}
                            {showTime && <span>{formattedTime}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pdf-flex-col" style={{ gap: '4px' }}>
                        {renderMessageBody(msg.body || '', isMe)}
                        {(() => {
                          const urls = msg.body ? [...msg.body.matchAll(URL_REGEX)].map(m => m[0]) : [];
                          if (urls.length > 0) {
                            return <LinkPreview url={urls[0]} isMe={isMe} />;
                          }
                          return null;
                        })()}
                        {(showTime || msg.isEdited || (isMe && isDirect) || msg.isDisappearing) && (
                          <div style={{ 
                            fontSize: '10px', 
                            alignSelf: 'flex-end',
                            marginTop: '4px',
                            opacity: 0.8,
                            color: msg.isDisappearing ? '#f59e0b' : (isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'),
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#f59e0b', fontSize: '10px', fontWeight: 'bold' }}>
                                <Timer size={11} /> 1h
                              </span>
                            )}
                            {msg.isEdited && <span>(edited)</span>}
                            {isMe && isDirect && !msg.isReadByOther && (
                              <span style={{ color: '#ffc107', fontWeight: 'bold' }}>1</span>
                            )}
                            {showTime && <span>{formattedTime}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
        />
      </div>

      {/* Image Modal */}
      {selectedImageUrl && (
        <div 
          onClick={() => setSelectedImageUrl(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 'var(--space-300)', cursor: 'zoom-out'
          }}
        >
          <div style={{ maxHeight: '90vh', maxWidth: '90vw' }}>
            <AuthImage 
              mxcUrl={selectedImageUrl} 
              alt="Full Size" 
              style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </>
  );
};
