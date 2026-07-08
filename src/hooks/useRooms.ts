import { useEffect, useState, useRef, useCallback } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { isRoomDirect } from '../utils/rooms';

export interface RoomInfo {
  room: Room;
  isDirect: boolean;
  displayName: string;
  avatarLetter: string;
  lastActivity: number;
}

export const useRooms = () => {
  const { client } = useMatrix();
  const [roomInfos, setRoomInfos] = useState<RoomInfo[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOtherMember = useCallback((room: Room) => {
    if (!client) return null;
    const myId = client.getUserId();
    const members = room.getMembers();
    return members.find(m => m.userId !== myId && (m.membership === 'join' || m.membership === 'invite'));
  }, [client]);

  const updateRooms = useCallback(() => {
    if (!client) return;
    const allRooms = client.getVisibleRooms();

    const infos: RoomInfo[] = allRooms
      .filter(room => room.getMyMembership() === 'join')
      .map(room => {
        const isDirect = isRoomDirect(client, room.roomId);

        if (isDirect) {
          const other = getOtherMember(room);
          if (!other || other.membership !== 'join') {
            return null;
          }
        }

        let displayName = room.name || 'Unnamed Room';
        let avatarLetter = '#';

        if (isDirect) {
          const other = getOtherMember(room);
          if (other) {
            displayName = other.name || other.userId.split(':')[0].substring(1);
            avatarLetter = displayName.charAt(0).toUpperCase();
          }
        } else {
          avatarLetter = '#';
        }

        const timeline = room.getLiveTimeline()?.getEvents();
        const lastEvent = timeline && timeline.length > 0 ? timeline[timeline.length - 1] : null;
        
        let lastActivity = 0;
        if (lastEvent) {
          lastActivity = lastEvent.getTs();
        } else {
          try {
            const createEvent = room.currentState.getStateEvents('m.room.create', '');
            if (createEvent) lastActivity = createEvent.getTs();
          } catch {}
        }

        return { room, isDirect, displayName, avatarLetter, lastActivity };
      })
      .filter(Boolean) as RoomInfo[];

    infos.sort((a, b) => b.lastActivity - a.lastActivity);
    setRoomInfos(infos);
  }, [client, getOtherMember]);

  const debouncedUpdateRooms = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      updateRooms();
    }, 100);
  }, [updateRooms]);

  const handleLeaveRoom = async (roomId: string): Promise<boolean> => {
    if (!client) return false;
    if (!confirm('Are you sure you want to leave and delete this room?')) return false;

    try {
      await client.leave(roomId);
      await client.forget(roomId);
      updateRooms();
      return true;
    } catch (err: any) {
      console.error('Failed to leave room:', err);
      alert(err.message || 'Failed to leave room');
      return false;
    }
  };

  useEffect(() => {
    if (!client) return;

    updateRooms();

    client.on('Room' as any, debouncedUpdateRooms);
    client.on('Room.name' as any, debouncedUpdateRooms);
    client.on('Room.myMembership' as any, debouncedUpdateRooms);
    client.on('Room.timeline' as any, debouncedUpdateRooms);
    client.on('RoomState.members' as any, debouncedUpdateRooms);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      client.removeListener('Room' as any, debouncedUpdateRooms);
      client.removeListener('Room.name' as any, debouncedUpdateRooms);
      client.removeListener('Room.myMembership' as any, debouncedUpdateRooms);
      client.removeListener('Room.timeline' as any, debouncedUpdateRooms);
      client.removeListener('RoomState.members' as any, debouncedUpdateRooms);
    };
  }, [client, updateRooms, debouncedUpdateRooms]);

  return { roomInfos, handleLeaveRoom, refreshRooms: updateRooms };
};
