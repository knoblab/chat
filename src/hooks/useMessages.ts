import { useEffect, useState, useCallback, useRef } from 'react';
import { MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { useChatStore } from '../stores/useChatStore';
import type { Message } from '../types';

export const useMessages = (roomId: string) => {
  const { client } = useMatrix();
  const [room, setRoom] = useState<Room | null>(null);
  const { messages: storeMessages, setMessages } = useChatStore();
  
  const messages = storeMessages[roomId] || [];

  const sendReadReceiptForLastMessage = useCallback((currentRoom: Room) => {
    if (!client || !currentRoom) return;
    const timeline = currentRoom.getLiveTimeline().getEvents();
    const lastMsg = [...timeline].reverse().find(event => {
      const type = event.getType();
      return (type === 'm.room.message' || type === 'm.room.encrypted') && !event.isRedacted();
    });
    if (lastMsg && lastMsg.getSender() !== client.getUserId()) {
      client.sendReadReceipt(lastMsg).catch(err => {
        console.warn('Failed to send read receipt:', err);
      });
    }
  }, [client]);

  const updateMessages = useCallback(() => {
    if (!client || !roomId) return;
    const currentRoom = client.getRoom(roomId);
    if (!currentRoom) return;

    const timeline = currentRoom.getLiveTimeline().getEvents();
    const otherMember = currentRoom.getMembers().find(m => m.userId !== client?.getUserId());

    const msgs: Message[] = timeline
      .filter(event => {
        const type = event.getType();
        if (type !== 'm.room.message' && type !== 'm.room.encrypted') return false;
        if (event.isRedacted()) return false;
        const content = event.getContent();
        const relatesTo = content['m.relates_to'];
        if (relatesTo && relatesTo.rel_type === 'm.replace') return false;

        const expiryTs = content.expiry_ts;
        if (expiryTs && Date.now() > expiryTs) {
          return false;
        }
        return true;
      })
      .map(event => {
        const replacingEvent = event.replacingEvent?.();
        let body: string;
        let msgtype: string;
        let url: string;
        let info: any;
        let isEdited = false;
        let isDisappearing = false;
        let expiryTs: number | undefined = undefined;

        const c = event.getContent();
        if (c.org_qpi_disappearing || c.expiry_ts) {
          isDisappearing = true;
          expiryTs = c.expiry_ts;
        }

        if (event.getType() === 'm.room.encrypted') {
          body = '🔒 Unable to decrypt message';
          msgtype = 'm.text';
          url = '';
        } else if (replacingEvent) {
          const rc = replacingEvent.getContent();
          const newContent = rc['m.new_content'] || rc;
          body = newContent.body || '';
          msgtype = newContent.msgtype || 'm.text';
          url = newContent.url || '';
          info = newContent.info;
          isEdited = true;
          if (newContent.org_qpi_disappearing || newContent.expiry_ts) {
            isDisappearing = true;
            expiryTs = newContent.expiry_ts;
          }
        } else {
          body = c.body || '';
          msgtype = c.msgtype || 'm.text';
          url = c.url || '';
          info = c.info;
        }

        const isReadByOther = (otherMember && typeof currentRoom.hasUserReadEvent === 'function')
          ? currentRoom.hasUserReadEvent(otherMember.userId, event.getId() || '')
          : false;

        return {
          id: event.getId() || Math.random().toString(),
          sender: event.getSender() || 'Unknown',
          body,
          msgtype,
          url,
          info,
          timestamp: event.getTs(),
          isEncrypted: event.isEncrypted(),
          isEdited,
          isReadByOther,
          isDisappearing,
          expiryTs,
        };
      });

    setMessages(roomId, msgs);
  }, [client, roomId, setMessages]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedUpdateMessages = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateMessages();
    }, 50);
  }, [updateMessages]);

  useEffect(() => {
    if (!client || !roomId) return;
    const currentRoom = client.getRoom(roomId);
    setRoom(currentRoom);

    if (currentRoom) {
      updateMessages();
      sendReadReceiptForLastMessage(currentRoom);
    }

    const expiryInterval = setInterval(() => {
      updateMessages();
    }, 15000);

    const handleTimelineEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        debouncedUpdateMessages();
        if (event.getSender() !== client.getUserId() && (event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted')) {
          client.sendReadReceipt(event).catch(err => {
            console.warn('Failed to send read receipt for timeline event:', err);
          });
        }
      }
    };

    const handleReceiptEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        debouncedUpdateMessages();
      }
    };

    const handleRedactionEvent = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        debouncedUpdateMessages();
      }
    };

    client.on('Room.timeline' as any, handleTimelineEvent);
    client.on('Room.receipt' as any, handleReceiptEvent);
    client.on('Room.redaction' as any, handleRedactionEvent);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearInterval(expiryInterval);
      client.removeListener('Room.timeline' as any, handleTimelineEvent);
      client.removeListener('Room.receipt' as any, handleReceiptEvent);
      client.removeListener('Room.redaction' as any, handleRedactionEvent);
    };
  }, [client, roomId, updateMessages, debouncedUpdateMessages, sendReadReceiptForLastMessage]);

  return { room, messages, refreshMessages: updateMessages };
};
