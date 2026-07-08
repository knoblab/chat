import { MatrixClient } from 'matrix-js-sdk';

/**
 * Check if a room is a Direct Message room by querying m.direct account data.
 * This is the correct way per the Matrix spec (not m.room.create content).
 */
export const isRoomDirect = (client: MatrixClient | null | any, roomId: string): boolean => {
  if (!client || !roomId) return false;
  const room = client.getRoom(roomId);
  if (!room) return false;

  // 1. Check strict m.direct account data
  const directEvent = client.getAccountData('m.direct');
  if (directEvent) {
    const content = directEvent.getContent();
    const found = Object.values(content).some((roomIds: any) =>
      Array.isArray(roomIds) && (roomIds as string[]).includes(roomId)
    );
    if (found) return true;
  }

  // 2. Fallback: If Synapse hasn't updated m.direct, check heuristics
  // If the room has 2 or fewer members and doesn't have an explicit room name set
  const members = room.getMembers();
  if (members.length <= 2) {
    const nameEvent = room.currentState.getStateEvents('m.room.name', '');
    if (!nameEvent) {
      return true;
    }
  }

  return false;
};

/**
 * Extract the user code (username part without @ and domain) from a Matrix user ID.
 */
export const getUserCode = (userId: string | null | undefined): string => {
  if (!userId) return '';
  const parts = userId.split(':');
  if (parts.length > 0 && parts[0].startsWith('@')) {
    return parts[0].substring(1);
  }
  return userId;
};
