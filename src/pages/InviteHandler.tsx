import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatrix } from '../matrix/MatrixProvider';

export const InviteHandler: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { client, isReady } = useMatrix();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    // Wait until the Matrix Provider is fully initialized before deciding
    if (!isReady) return;

    if (!roomId) {
      setError('Invalid invite link.');
      return;
    }

    if (!client) {
      // User is not logged in. Save the intended room to sessionStorage and redirect to login.
      sessionStorage.setItem('pendingInvite', roomId);
      navigate('/login', { replace: true });
      return;
    }

    const joinRoom = async () => {
      setJoining(true);
      setError('');
      try {
        console.log(`Attempting to join room: ${roomId}`);
        // If the room is already joined or we can join it (public join_rule)
        await client.joinRoom(roomId);
        console.log(`Successfully joined room: ${roomId}`);
        
        // Remove from pending if it was there
        sessionStorage.removeItem('pendingInvite');

        // Navigate to dashboard and optionally select the room if your app state supports passing it
        // We'll pass the roomId in the router state so Dashboard can pick it up.
        navigate('/', { state: { openRoomId: roomId }, replace: true });
      } catch (err: any) {
        console.error('Failed to join room via invite link:', err);
        setError(err.message || 'Failed to join the chat room. It may be private or invalid.');
      } finally {
        setJoining(false);
      }
    };

    joinRoom();
  }, [client, isReady, roomId, navigate]);

  return (
    <div className="pdf-app pdf-justify-center pdf-items-center" style={{ minHeight: '100vh', padding: 'var(--space-300)' }}>
      <div className="pdf-panel pdf-animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <h2 className="pdf-text-heading-24 pdf-mb-200">초대 확인 중...</h2>
        {joining && (
          <p className="pdf-text-copy-14 pdf-text-muted">
            채팅방에 접속하고 있습니다. 잠시만 기다려주세요.
          </p>
        )}
        {error && (
          <>
            <p className="pdf-text-copy-14 pdf-mb-200" style={{ color: 'var(--color-functional-red)' }}>
              {error}
            </p>
            <button onClick={() => navigate('/')} className="pdf-btn-primary pdf-btn-md">
              대시보드로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
};
