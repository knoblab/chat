import { useState, useEffect } from 'react';
import { useMatrix } from '../matrix/MatrixProvider';

export interface ToastNotification {
  sender: string;
  body: string;
  roomId: string;
}

export const useNotifications = (selectedRoomId: string | null) => {
  const { client } = useMatrix();
  const [toastNotification, setToastNotification] = useState<ToastNotification | null>(null);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!client) return;

    let titleInterval: ReturnType<typeof setInterval> | null = null;
    const originalTitle = 'Knoblab Chat';

    const playAlertSound = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const playTone = (freq: number, start: number, duration: number) => {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime + start);
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + start + duration);
          
          osc.start(audioCtx.currentTime + start);
          osc.stop(audioCtx.currentTime + start + duration);
        };

        playTone(523.25, 0, 0.12); // C5
        playTone(659.25, 0.08, 0.15); // E5
      } catch (err) {
        console.warn('Failed to play notification audio:', err);
      }
    };

    const handleNewMessage = (event: any, room: any, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return;
      if (event.getType() !== 'm.room.message') return;

      const senderId = event.getSender();
      if (senderId === client.getUserId()) return; // ignore our own messages

      const isWindowUnfocused = !document.hasFocus();
      const isDifferentRoom = selectedRoomId !== event.getRoomId();

      if (isDifferentRoom || isWindowUnfocused) {
        playAlertSound();

        let senderName = senderId;
        try {
          const m = room.getMember(senderId);
          if (m && m.name) senderName = m.name;
        } catch {}
        
        setToastNotification({
          sender: senderName,
          body: event.getContent().body || 'Sent an image or file',
          roomId: event.getRoomId()
        });

        setTimeout(() => setToastNotification(null), 5000);

        if (!titleInterval) {
          let flash = false;
          const roomName = room ? room.name : 'New Message';
          titleInterval = setInterval(() => {
            document.title = flash ? `💬 New Msg: ${roomName}` : originalTitle;
            flash = !flash;
          }, 1000);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
          const content = event.getContent();
          const bodyText = content.msgtype === 'm.image' ? 'Sent an image' : (content.body || '');
          const senderName = room ? (room.getMember(senderId)?.name || senderId) : senderId;
          
          new Notification(senderName, {
            body: bodyText,
            tag: event.getRoomId(),
            renotify: true
          } as any);
        }
      }
    };

    client.on('Room.timeline' as any, handleNewMessage);

    const handleWindowFocus = () => {
      if (titleInterval) {
        clearInterval(titleInterval);
        titleInterval = null;
      }
      document.title = originalTitle;
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      client.removeListener('Room.timeline' as any, handleNewMessage);
      window.removeEventListener('focus', handleWindowFocus);
      if (titleInterval) {
        clearInterval(titleInterval);
      }
      document.title = originalTitle;
    };
  }, [client, selectedRoomId]);

  return { toastNotification, setToastNotification };
};
