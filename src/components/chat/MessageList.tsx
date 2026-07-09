import React, { useState, useRef } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../../matrix/MatrixProvider';
import { AuthImage } from '../AuthImage';
import { AuthVideo } from '../AuthVideo';
import { downloadMxcMedia } from '../../utils/media';
import type { Message } from '../../types';
import { Download, Timer, FileText } from 'lucide-react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { LinkPreview } from './LinkPreview';
import { URL_REGEX } from '../../utils/urlPreview';
import { renderSimpleMarkdown } from '../../utils/markdown';

export const isOnlyEmojis = (text: string): boolean => {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(trimmed)).map(s => s.segment.trim()).filter(Boolean);
      if (segments.length === 0 || segments.length > 4) return false;

      const emojiRegex = /^([\uFE0F\u200D]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3)+$/u;
      const lettersDigitsRegex = /^[a-zA-Z0-9\s.,!?"'(){}[\]<>@#$%^&*-=_+`~;:/\\|]+$/;
      
      return segments.every(seg => {
        if (lettersDigitsRegex.test(seg) && !seg.includes('\u20E3')) return false;
        return emojiRegex.test(seg.replace(/[\uFE0F\u200D\p{Emoji_Modifier}]/gu, ''));
      });
    } catch (_e) {}
  }

  const clean = trimmed.replace(/\s+/g, '');
  const asciiCheck = /[a-zA-Z0-9.,!?"'(){}[\]<>@#$%^&*-=_+`~;:/\\|]/;
  if (asciiCheck.test(clean.replace(/[0-9#*]\uFE0F?\u20E3/gu, ''))) return false;

  const emojiMatches = clean.match(/([\uFE0F\u200D]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)/gu);
  if (!emojiMatches) return false;
  
  const stripped = clean.replace(/([\uFE0F\u200D]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|[0-9#*]\u20E3)/gu, '');
  return stripped.length === 0 && emojiMatches.length >= 1 && emojiMatches.length <= 4;
};

const renderMessageBody = (body: string, isMe: boolean, isBigEmoji = false) => {
  if (!body) return null;

  if (isBigEmoji) {
    return (
      <span style={{
        fontSize: '48px',
        lineHeight: 1.25,
        letterSpacing: '2px',
        display: 'inline-block',
        padding: '2px 0'
      }}>
        {body}
      </span>
    );
  }

  return renderSimpleMarkdown(body, isMe);
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
            const isOnlyEmojiMsg = isOnlyEmojis(msg.body || '') && !msg.url && msg.msgtype !== 'm.image' && msg.msgtype !== 'm.video' && msg.msgtype !== 'm.file' && !msg.isDisappearing;

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
                      background: isOnlyEmojiMsg
                        ? 'transparent'
                        : (msg.isDisappearing 
                          ? (isMe ? 'var(--color-disappearing-bg-me)' : 'var(--color-disappearing-bg-other)')
                          : (isMe ? 'var(--color-functional-red)' : 'var(--color-bg-secondary)')),
                      color: msg.isDisappearing
                        ? (isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)')
                        : (isMe ? 'var(--color-bg-primary)' : 'var(--color-text-primary)'),
                      border: isOnlyEmojiMsg
                        ? 'none'
                        : (msg.isDisappearing 
                          ? (isMe ? '1px dashed var(--color-disappearing-border-me)' : '1px dashed var(--color-disappearing-border-other)')
                          : '1px solid ' + (isMe ? 'var(--color-functional-red)' : 'var(--color-border-default)')),
                      padding: isOnlyEmojiMsg
                        ? '2px 0'
                        : ((msg.msgtype === 'm.image' || msg.msgtype === 'm.video') ? 'var(--space-050)' : 'var(--space-100) var(--space-150)'),
                      borderRadius: isMe 
                        ? (isFirstInGroup ? '12px 12px 2px 12px' : '12px 2px 2px 12px') 
                        : (isFirstInGroup ? '12px 12px 12px 2px' : '2px 12px 12px 2px'),
                      boxShadow: (isMe || isOnlyEmojiMsg) ? 'none' : 'var(--shadow-hardware-bevel)',
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
                          color: msg.isDisappearing 
                            ? (isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)') 
                            : (isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'),
                          padding: '4px var(--space-050) var(--space-050) var(--space-050)' 
                        }}>
                          <span>{msg.body} {msg.info?.size ? `(${(msg.info.size / (1024 * 1024)).toFixed(1)}MB)` : ''}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)', fontSize: '10px', fontWeight: 'bold' }}>
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
                        {msg.info?.images && msg.info.images.length > 1 ? (
                          <div 
                            style={{ 
                              display: 'grid', 
                              gridTemplateColumns: msg.info.images.length === 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
                              gap: '4px',
                              width: '100%',
                              maxWidth: '320px',
                              borderRadius: '6px',
                              overflow: 'hidden'
                            }}
                          >
                            {msg.info.images.map((img: any, idx: number) => (
                              <div 
                                key={idx} 
                                style={{ 
                                  aspectRatio: '1', 
                                  position: 'relative', 
                                  overflow: 'hidden',
                                  width: '100%'
                                }} 
                                onClick={() => !msg.info?.isPendingUpload && setSelectedImageUrl(img.url)}
                              >
                                {msg.info?.isPendingUpload ? (
                                  <img 
                                    src={img.url} 
                                    alt={`collage ${idx}`} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                  />
                                ) : (
                                  <AuthImage 
                                    mxcUrl={img.url} 
                                    alt={`collage ${idx}`} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                                  />
                                )}
                                {!msg.info?.isPendingUpload && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadMxcMedia(client, img.url, img.name || 'image');
                                    }}
                                    style={{ 
                                      position: 'absolute', 
                                      top: 4, 
                                      right: 4, 
                                      background: 'rgba(0,0,0,0.5)', 
                                      color: '#fff', 
                                      border: 'none', 
                                      borderRadius: '4px', 
                                      padding: '4px', 
                                      cursor: 'pointer', 
                                      display: 'flex', 
                                      alignItems: 'center' 
                                    }}
                                    title="Download"
                                  >
                                    <Download size={12} />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
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
                          </>
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
                          color: msg.isDisappearing 
                            ? (isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)') 
                            : (isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'),
                          padding: '0 var(--space-050) var(--space-050) var(--space-050)' 
                        }}>
                          <span>{msg.body}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)', fontSize: '10px', fontWeight: 'bold' }}>
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
                    ) : msg.msgtype === 'm.file' && msg.url ? (
                      <div style={{ position: 'relative' }}>
                        <div 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            background: isMe ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.03)',
                            borderRadius: '8px',
                            border: '1px solid ' + (isMe ? 'rgba(255, 255, 255, 0.2)' : 'var(--color-border-default)'),
                          }}
                        >
                          <div 
                            style={{ 
                              width: '40px', 
                              height: '40px', 
                              borderRadius: '8px', 
                              background: isMe ? 'rgba(255,255,255,0.15)' : 'var(--color-bg-secondary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            <FileText size={20} color={isMe ? '#fff' : 'var(--color-text-primary)'} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                            <span 
                              style={{ 
                                fontSize: '13px', 
                                fontWeight: 600, 
                                color: isMe ? '#fff' : 'var(--color-text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '100%'
                              }}
                              title={msg.body}
                            >
                              {msg.body}
                            </span>
                            <span style={{ fontSize: '11px', color: isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)' }}>
                              {msg.info?.size ? `${(msg.info.size / (1024 * 1024)).toFixed(2)} MB` : 'Size unknown'}
                            </span>
                          </div>
                          {!msg.info?.isPendingUpload && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadMxcMedia(client, msg.url!, msg.body || 'file');
                              }}
                              style={{
                                background: 'transparent', 
                                border: 'none', 
                                color: isMe ? '#fff' : 'var(--color-text-primary)',
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px',
                                borderRadius: '50%',
                                transition: 'background 0.2s',
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = isMe ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                              title="파일 다운로드"
                            >
                              <Download size={18} />
                            </button>
                          )}
                        </div>
                        {msg.info?.isPendingUpload && (
                          <div style={{
                            width: '100%', background: 'rgba(0,0,0,0.75)', padding: '8px 12px',
                            borderRadius: '6px', marginTop: '6px', border: '1px solid rgba(255,255,255,0.15)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>
                              <span>{msg.info?.uploadError ? '❌ 업로드 실패' : '📂 파일 업로드 중...'}</span>
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
                        <div className="pdf-text-copy-13-mono pdf-mt-050 pdf-flex-row pdf-items-center pdf-justify-between" style={{ 
                          fontSize: '11px', 
                          color: msg.isDisappearing 
                            ? (isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)') 
                            : (isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'),
                          padding: '0 var(--space-050) var(--space-050) var(--space-050)' 
                        }}>
                          <div />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)', fontSize: '10px', fontWeight: 'bold' }}>
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
                        {renderMessageBody(msg.body || '', isMe, isOnlyEmojiMsg)}
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
                            alignSelf: isOnlyEmojiMsg ? (isMe ? 'flex-end' : 'flex-start') : 'flex-end',
                            marginTop: isOnlyEmojiMsg ? '0px' : '4px',
                            opacity: 0.8,
                            color: msg.isDisappearing 
                              ? (isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)') 
                              : (isMe ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary)'),
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}>
                            {msg.isDisappearing && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: isMe ? 'var(--color-disappearing-text-me)' : 'var(--color-disappearing-text-other)', fontSize: '10px', fontWeight: 'bold' }}>
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
