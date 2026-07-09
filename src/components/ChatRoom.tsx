import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MatrixEvent, MsgType } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { useMessages } from '../hooks/useMessages';
import { useChatStore } from '../stores/useChatStore';
import { isRoomDirect } from '../utils/rooms';
import { ChatHeader } from './chat/ChatHeader';
import { MessageList } from './chat/MessageList';
import { MessageInput } from './chat/MessageInput';
import { InviteModal } from './chat/InviteModal';
import type { Message } from '../types';
import { Edit2, Trash2, Download, ArrowDown, Copy } from 'lucide-react';
import { downloadMxcMedia } from '../utils/media';
import { optimizeImage } from '../utils/imageOptimizer';
import { processVideoForUpload } from '../utils/videoOptimizer';
import { hasMarkdown, markdownToHtml } from '../utils/markdown';
import type { VirtuosoHandle } from 'react-virtuoso';

interface ChatRoomProps {
  roomId: string;
  onBack?: () => void;
  onSelectRoom?: (roomId: string) => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({ roomId, onBack }) => {
  const { client } = useMatrix();
  const { room, messages, refreshMessages } = useMessages(roomId);
  const { disappearingMode } = useChatStore();
  const isDisappearing = disappearingMode[roomId] || false;

  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [showNewMsgPill, setShowNewMsgPill] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<Message[]>([]);

  const updatePendingProgress = (id: string, progress: number, error?: boolean) => {
    setPendingUploads(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          info: {
            ...m.info,
            uploadProgress: progress,
            uploadError: error,
          }
        };
      }
      return m;
    }));
  };

  const removePendingUpload = (id: string) => {
    setPendingUploads(prev => prev.filter(m => m.id !== id));
  };

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, msgId: string, isImage: boolean, body: string, isMe: boolean } | null>(null);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const isDirect = client ? isRoomDirect(client, roomId) : false;

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'smooth') => {
    virtuosoRef.current?.scrollToIndex({
      index: 'LAST',
      behavior,
    });
    setShowNewMsgPill(false);
  }, []);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    document.addEventListener('touchstart', closeMenu);
    return () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('touchstart', closeMenu);
    };
  }, []);

  useEffect(() => {
    scrollToBottom('auto');
  }, [roomId, scrollToBottom]);

  useEffect(() => {
    if (!client || !room || !roomId || isDirect) return;
    try {
      const joinRule = room.currentState.getStateEvents('m.room.join_rules' as any, '')?.getContent()?.join_rule;
      if (!joinRule) {
        client.sendStateEvent(roomId, 'm.room.join_rules' as any, { join_rule: 'public' }, '').catch(() => {});
      }
      const historyVis = room.currentState.getStateEvents('m.room.history_visibility' as any, '')?.getContent()?.history_visibility;
      if (historyVis !== 'shared') {
        client.sendStateEvent(roomId, 'm.room.history_visibility' as any, { history_visibility: 'shared' }, '').catch(() => {});
      }
    } catch (_e) {
      // Ignore if lacking permissions
    }
  }, [client, room, roomId, isDirect]);

  useEffect(() => {
    if (!client || !roomId) return;

    const handleTimelineEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
        if (!isAtBottom) {
          setShowNewMsgPill(true);
        } else {
          setTimeout(() => scrollToBottom('smooth'), 50);
        }
      }
    };

    const handleTyping = (_event: MatrixEvent, member: any) => {
      if (!room) return;
      if (member.roomId === roomId) {
        const typingMembers = room.getMembers().filter(m => m.typing && m.userId !== client.getUserId());
        setTypingUsers(typingMembers.map(m => m.name || m.userId));
      }
    };

    client.on('Room.timeline' as any, handleTimelineEvent);
    client.on('RoomMember.typing' as any, handleTyping);

    return () => {
      client.removeListener('Room.timeline' as any, handleTimelineEvent);
      client.removeListener('RoomMember.typing' as any, handleTyping);
    };
  }, [client, roomId, room, refreshMessages, scrollToBottom, isAtBottom]);

  const handleSend = async (text: string, files?: File[]) => {
    if (!client) return;

    if (client.isRoomEncrypted(roomId)) {
      try {
        const crypto = client.getCrypto();
        const userIds = room?.getMembers().map(m => m.userId) || [];
        if (crypto && userIds.length > 0) {
          await crypto.getUserDeviceInfo(userIds, true);
        } else if ((client as any).downloadKeys && userIds.length > 0) {
          await (client as any).downloadKeys(userIds);
        }
      } catch (err) {
        console.warn('Failed to pre-download keys before sending:', err);
      }
    }

    const extraContent = isDisappearing ? {
      org_qpi_disappearing: true,
      expiry_ts: Date.now() + 60 * 60 * 1000,
    } : {};

    if (files && files.length > 0) {
      const uploadSingleFile = async (file: File, fileText: string) => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        if (isVideo) {
          const tempId = `pending_video_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const previewUrl = URL.createObjectURL(file);
          
          const pendingMsg: Message = {
            id: tempId,
            sender: client.getUserId() || 'Me',
            body: fileText.trim() || file.name || 'video.mp4',
            timestamp: Date.now(),
            isEncrypted: isDirect,
            msgtype: MsgType.Video,
            url: previewUrl,
            info: {
              mimetype: file.type || 'video/mp4',
              size: file.size,
              isPendingUpload: true,
              uploadProgress: 5,
            },
            isDisappearing: isDisappearing,
          };

          setPendingUploads(prev => [...prev, pendingMsg]);
          setTimeout(() => scrollToBottom('smooth'), 50);

          let currentProgress = 5;
          const progressTimer = setInterval(() => {
            if (currentProgress < 85) {
              currentProgress += Math.floor(Math.random() * 8) + 3;
              if (currentProgress > 85) currentProgress = 85;
              updatePendingProgress(tempId, currentProgress);
            }
          }, 300);

          try {
            const { videoFile, thumbnailFile, width, height, duration } = await processVideoForUpload(file);
            
            const thumbPreviewUrl = URL.createObjectURL(thumbnailFile);
            setPendingUploads(prev => prev.map(m => m.id === tempId ? {
              ...m,
              info: { ...m.info, w: width, h: height, duration, thumbnail_url: thumbPreviewUrl }
            } : m));

            const thumbRes = await client.uploadContent(thumbnailFile);
            const thumbMxcUrl = thumbRes.content_uri;

            updatePendingProgress(tempId, 45);
            currentProgress = 45;

            const videoRes = await client.uploadContent(videoFile, {
              progressHandler: (prog: any) => {
                if (prog && prog.total > 0) {
                  const pct = 45 + Math.round((prog.loaded / prog.total) * 50);
                  currentProgress = Math.max(currentProgress, pct);
                  updatePendingProgress(tempId, currentProgress);
                }
              }
            } as any);
            const videoMxcUrl = videoRes.content_uri;

            updatePendingProgress(tempId, 98);

            if (videoMxcUrl) {
              await client.sendMessage(roomId, {
                msgtype: MsgType.Video,
                body: fileText.trim() || videoFile.name || 'video.mp4',
                url: videoMxcUrl,
                info: {
                  mimetype: videoFile.type || 'video/mp4',
                  size: videoFile.size,
                  w: width,
                  h: height,
                  duration: duration,
                  thumbnail_url: thumbMxcUrl,
                  thumbnail_info: {
                    mimetype: 'image/jpeg',
                    size: thumbnailFile.size,
                    w: width,
                    h: height,
                  },
                },
                ...extraContent,
              } as any);
            }

            clearInterval(progressTimer);
            updatePendingProgress(tempId, 100);
            refreshMessages();

            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
              if (thumbPreviewUrl) URL.revokeObjectURL(thumbPreviewUrl);
            }, 1000);

          } catch (err: any) {
            clearInterval(progressTimer);
            console.error('Failed to upload video:', err);
            updatePendingProgress(tempId, 0, true);
            alert('동영상 업로드 실패: ' + (err.message || 'Unknown error'));
            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
            }, 4000);
          }
        } else if (isImage) {
          const tempId = `pending_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const previewUrl = URL.createObjectURL(file);
          
          const pendingMsg: Message = {
            id: tempId,
            sender: client.getUserId() || 'Me',
            body: fileText.trim() || file.name || 'image',
            timestamp: Date.now(),
            isEncrypted: isDirect,
            msgtype: MsgType.Image,
            url: previewUrl,
            info: {
              mimetype: file.type,
              size: file.size,
              isPendingUpload: true,
              uploadProgress: 10,
            },
            isDisappearing: isDisappearing,
          };

          setPendingUploads(prev => [...prev, pendingMsg]);
          setTimeout(() => scrollToBottom('smooth'), 50);

          let currentProgress = 10;
          const progressTimer = setInterval(() => {
            if (currentProgress < 85) {
              currentProgress += Math.floor(Math.random() * 12) + 5;
              if (currentProgress > 85) currentProgress = 85;
              updatePendingProgress(tempId, currentProgress);
            }
          }, 250);

          try {
            const optimizedFile = await optimizeImage(file, 1920, 0.85);
            updatePendingProgress(tempId, 40);
            currentProgress = 40;

            const uploadRes = await client.uploadContent(optimizedFile, {
              progressHandler: (prog: any) => {
                if (prog && prog.total > 0) {
                  const pct = 40 + Math.round((prog.loaded / prog.total) * 55);
                  currentProgress = Math.max(currentProgress, pct);
                  updatePendingProgress(tempId, currentProgress);
                }
              }
            } as any);
            const mxcUrl = uploadRes.content_uri;

            updatePendingProgress(tempId, 98);

            if (mxcUrl) {
              await client.sendMessage(roomId, {
                msgtype: MsgType.Image,
                body: fileText.trim() || optimizedFile.name || 'image',
                url: mxcUrl,
                info: {
                  mimetype: optimizedFile.type,
                  size: optimizedFile.size,
                },
                ...extraContent,
              } as any);
            }

            clearInterval(progressTimer);
            updatePendingProgress(tempId, 100);
            refreshMessages();

            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
            }, 1000);
          } catch (err: any) {
            clearInterval(progressTimer);
            console.error('Failed to upload image:', err);
            updatePendingProgress(tempId, 0, true);
            alert('이미지 업로드 실패: ' + (err.message || 'Unknown error'));
            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
            }, 4000);
          }
        } else {
          // General File (m.file)
          const tempId = `pending_file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const previewUrl = URL.createObjectURL(file);
          
          const pendingMsg: Message = {
            id: tempId,
            sender: client.getUserId() || 'Me',
            body: fileText.trim() || file.name || 'file',
            timestamp: Date.now(),
            isEncrypted: isDirect,
            msgtype: 'm.file',
            url: previewUrl,
            info: {
              mimetype: file.type || 'application/octet-stream',
              size: file.size,
              isPendingUpload: true,
              uploadProgress: 10,
            },
            isDisappearing: isDisappearing,
          };

          setPendingUploads(prev => [...prev, pendingMsg]);
          setTimeout(() => scrollToBottom('smooth'), 50);

          let currentProgress = 10;
          const progressTimer = setInterval(() => {
            if (currentProgress < 85) {
              currentProgress += Math.floor(Math.random() * 12) + 5;
              if (currentProgress > 85) currentProgress = 85;
              updatePendingProgress(tempId, currentProgress);
            }
          }, 250);

          try {
            const uploadRes = await client.uploadContent(file, {
              progressHandler: (prog: any) => {
                if (prog && prog.total > 0) {
                  const pct = 40 + Math.round((prog.loaded / prog.total) * 55);
                  currentProgress = Math.max(currentProgress, pct);
                  updatePendingProgress(tempId, currentProgress);
                }
              }
            } as any);
            const mxcUrl = uploadRes.content_uri;

            updatePendingProgress(tempId, 98);

            if (mxcUrl) {
              await client.sendMessage(roomId, {
                msgtype: 'm.file',
                body: fileText.trim() || file.name || 'file',
                url: mxcUrl,
                info: {
                  mimetype: file.type || 'application/octet-stream',
                  size: file.size,
                },
                ...extraContent,
              } as any);
            }

            clearInterval(progressTimer);
            updatePendingProgress(tempId, 100);
            refreshMessages();

            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
            }, 1000);
          } catch (err: any) {
            clearInterval(progressTimer);
            console.error('Failed to upload file:', err);
            updatePendingProgress(tempId, 0, true);
            alert('파일 업로드 실패: ' + (err.message || 'Unknown error'));
            setTimeout(() => {
              removePendingUpload(tempId);
              URL.revokeObjectURL(previewUrl);
            }, 4000);
          }
        }
      };

      if (files.length > 1) {
        // Multi-image collage upload!
        const tempId = `pending_collage_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        // Generate local preview URLs
        const localImages = files.map(file => ({
          url: URL.createObjectURL(file),
          name: file.name,
          size: file.size,
          mimetype: file.type
        }));

        const pendingMsg: Message = {
          id: tempId,
          sender: client.getUserId() || 'Me',
          body: text.trim() || '이미지 모음',
          timestamp: Date.now(),
          isEncrypted: isDirect,
          msgtype: MsgType.Image,
          url: localImages[0].url, // fallback url
          info: {
            mimetype: 'image/jpeg',
            size: files.reduce((acc, f) => acc + f.size, 0),
            isPendingUpload: true,
            uploadProgress: 10,
            images: localImages // local previews
          },
          isDisappearing: isDisappearing,
        };

        setPendingUploads(prev => [...prev, pendingMsg]);
        setTimeout(() => scrollToBottom('smooth'), 50);

        // Keep track of each file's progress
        const fileProgresses = new Array(files.length).fill(10);
        
        const updateCollageProgress = () => {
          const avgProgress = Math.round(fileProgresses.reduce((acc, p) => acc + p, 0) / files.length);
          updatePendingProgress(tempId, avgProgress);
        };

        // Standard fake timer to increment progress up to 40% before upload begins/finishes
        let isUploadDone = false;
        const progressTimer = setInterval(() => {
          if (!isUploadDone) {
            for (let i = 0; i < fileProgresses.length; i++) {
              if (fileProgresses[i] < 40) {
                fileProgresses[i] += Math.floor(Math.random() * 5) + 2;
                if (fileProgresses[i] > 40) fileProgresses[i] = 40;
              }
            }
            updateCollageProgress();
          }
        }, 200);

        try {
          // Upload all files in parallel
          const uploadPromises = files.map(async (file, idx) => {
            // Optimize image
            const optimizedFile = await optimizeImage(file, 1920, 0.85);
            fileProgresses[idx] = 40;
            updateCollageProgress();

            const uploadRes = await client.uploadContent(optimizedFile, {
              progressHandler: (prog: any) => {
                if (prog && prog.total > 0) {
                  const pct = 40 + Math.round((prog.loaded / prog.total) * 55);
                  fileProgresses[idx] = Math.max(fileProgresses[idx], pct);
                  updateCollageProgress();
                }
              }
            } as any);

            const mxcUrl = uploadRes.content_uri;
            if (!mxcUrl) throw new Error('Upload failed');

            fileProgresses[idx] = 98;
            updateCollageProgress();

            return {
              url: mxcUrl,
              name: optimizedFile.name || file.name || 'image',
              size: optimizedFile.size,
              mimetype: optimizedFile.type
            };
          });

          const uploadedImages = await Promise.all(uploadPromises);
          isUploadDone = true;
          clearInterval(progressTimer);
          updatePendingProgress(tempId, 98);

          // Send the message event containing all uploaded images
          await client.sendMessage(roomId, {
            msgtype: MsgType.Image,
            body: text.trim() || '이미지 모음',
            url: uploadedImages[0].url, // fallback url
            info: {
              mimetype: 'image/jpeg',
              size: uploadedImages.reduce((acc, f) => acc + f.size, 0),
              images: uploadedImages
            },
            ...extraContent,
          } as any);

          updatePendingProgress(tempId, 100);
          refreshMessages();

          setTimeout(() => {
            removePendingUpload(tempId);
            localImages.forEach(img => URL.revokeObjectURL(img.url));
          }, 1000);

        } catch (err: any) {
          isUploadDone = true;
          clearInterval(progressTimer);
          console.error('Failed to upload collage images:', err);
          updatePendingProgress(tempId, 0, true);
          alert('이미지 모아보내기 실패: ' + (err.message || 'Unknown error'));
          setTimeout(() => {
            removePendingUpload(tempId);
            localImages.forEach(img => URL.revokeObjectURL(img.url));
          }, 4000);
        }
      } else {
        await uploadSingleFile(files[0], text);
      }
    } else if (text.trim()) {
      try {
        const cleanText = text.trim();
        const hasHtml = /<[a-z][\s\S]*>/i.test(cleanText);
        const isMd = hasMarkdown(cleanText);
        const isRich = hasHtml || isMd;
        const formattedHtml = hasHtml ? cleanText : markdownToHtml(cleanText);

        await client.sendMessage(roomId, {
          msgtype: MsgType.Text,
          body: cleanText,
          format: isRich ? 'org.matrix.custom.html' : undefined,
          formatted_body: isRich ? formattedHtml : undefined,
          ...extraContent,
        } as any);
      } catch (err: any) {
        console.error('Failed to send text message:', err);
        alert('Failed to send message: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleDeleteMessage = async (eventId: string) => {
    if (!client) return;
    try {
      await client.redactEvent(roomId, eventId);
      refreshMessages();
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      alert(err.message || 'Failed to delete message');
    }
  };

  const handleStartEdit = (msgId: string, currentText: string) => {
    setEditingMessageId(msgId);
    setEditingText(currentText);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const handleSaveEdit = async (text: string) => {
    if (!text.trim() || !client || !editingMessageId) return;
    const eventId = editingMessageId;
    handleCancelEdit();

    try {
      const hasHtml = /<[a-z][\s\S]*>/i.test(text);
      const isMd = hasMarkdown(text);
      const isRich = hasHtml || isMd;
      const formattedHtml = hasHtml ? text : markdownToHtml(text);

      await client.sendMessage(roomId, {
        msgtype: MsgType.Text,
        body: `* ${text}`,
        format: isRich ? 'org.matrix.custom.html' : undefined,
        formatted_body: isRich ? `* ${formattedHtml}` : undefined,
        'm.new_content': {
          msgtype: MsgType.Text,
          body: text,
          format: isRich ? 'org.matrix.custom.html' : undefined,
          formatted_body: isRich ? formattedHtml : undefined,
        },
        'm.relates_to': {
          rel_type: 'm.replace' as any,
          event_id: eventId
        } as any
      });
      refreshMessages();
    } catch (err: any) {
      console.error('Failed to edit message:', err);
      alert('Failed to edit message');
    }
  };

  const handleContextMenu = (x: number, y: number, msg: Message) => {
    const isMe = msg.sender === client?.getUserId();
    
    // Adjust coordinates to prevent the menu from going off-screen
    const menuWidth = 140; // approximate width of the context menu
    const menuHeight = 120; // approximate height of the context menu
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuWidth > screenWidth) {
      adjustedX = screenWidth - menuWidth - 8;
    }
    if (y + menuHeight > screenHeight) {
      adjustedY = screenHeight - menuHeight - 8;
    }
    adjustedX = Math.max(8, adjustedX);
    adjustedY = Math.max(8, adjustedY);

    setContextMenu({
      x: adjustedX,
      y: adjustedY,
      msgId: msg.id,
      isImage: msg.msgtype === 'm.image',
      body: msg.body,
      isMe
    });
  };

  return (
    <div className="pdf-flex-col" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ChatHeader
        room={room}
        roomId={roomId}
        onBack={onBack}
        onOpenInviteModal={() => setIsInviteModalOpen(true)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        <MessageList
          messages={[...messages, ...pendingUploads]}
          room={room}
          isDirect={isDirect}
          onContextMenu={handleContextMenu}
          virtuosoRef={virtuosoRef}
          onAtBottomStateChange={(atBottom) => {
            setIsAtBottom(atBottom);
            if (atBottom) setShowNewMsgPill(false);
          }}
        />

        {showNewMsgPill && (
          <button
            onClick={() => scrollToBottom('smooth')}
            className="pdf-btn-primary pdf-radius-full"
            style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              padding: '8px 16px', fontSize: '13px', boxShadow: 'var(--shadow-hardware-elevated)',
              zIndex: 10, background: 'var(--color-functional-red)', color: '#fff',
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer'
            }}
          >
            <span>New messages</span>
            <ArrowDown size={14} />
          </button>
        )}
      </div>

      <MessageInput
        roomId={roomId}
        editingMessageId={editingMessageId}
        editingText={editingText}
        onCancelEdit={handleCancelEdit}
        onSend={handleSend}
        onSaveEdit={handleSaveEdit}
        typingUsers={typingUsers}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-hardware-elevated)',
            borderRadius: '6px',
            zIndex: 1000,
            padding: '4px 0',
            minWidth: '130px',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {!contextMenu.isImage && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.body);
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Copy size={14} /> Copy Text
            </button>
          )}
          {contextMenu.isMe && !contextMenu.isImage && (
            <button
              onClick={() => {
                handleStartEdit(contextMenu.msgId, contextMenu.body);
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Edit2 size={14} /> Edit
            </button>
          )}
          {contextMenu.isImage && (
            <button
              onClick={() => {
                const msg = messages.find(m => m.id === contextMenu.msgId);
                if (msg?.url) downloadMxcMedia(client, msg.url, contextMenu.body || 'image');
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}
            >
              <Download size={14} /> Download
            </button>
          )}
          {contextMenu.isMe && (
            <button
              onClick={() => {
                if (confirm('Delete this message?')) {
                  handleDeleteMessage(contextMenu.msgId);
                }
                setContextMenu(null);
              }}
              className="pdf-nav-item"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-functional-red)', cursor: 'pointer' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};
