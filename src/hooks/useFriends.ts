import { useState, useCallback, useEffect, useRef } from 'react';
import { Room } from 'matrix-js-sdk';
import { useMatrix } from '../matrix/MatrixProvider';
import { isRoomDirect } from '../utils/rooms';
import type { UserSearchResult } from '../types';

export const useFriends = (onSelectRoom?: (roomId: string) => void, onSwitchToChats?: () => void) => {
  const { client } = useMatrix();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [friends, setFriends] = useState<Room[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<Room[]>([]);

  const updateLists = useCallback(() => {
    if (!client) return;
    const allRooms = client.getVisibleRooms();
    const myId = client.getUserId();

    const incoming: Room[] = [];
    const sent: Room[] = [];
    const active: Room[] = [];

    allRooms.forEach(room => {
      const members = room.getMembers().filter(m => m.membership === 'join' || m.membership === 'invite');
      const isDirect = isRoomDirect(client, room.roomId);
      const isDmInvite = !!room.getDMInviter();

      if (isDirect || isDmInvite) {
        const myMembership = room.getMyMembership();

        if (myMembership === 'invite') {
          incoming.push(room);
        } else if (myMembership === 'join') {
          const otherInvite = members.find(m => m.userId !== myId && m.membership === 'invite');
          const otherJoin = members.find(m => m.userId !== myId && m.membership === 'join');

          if (otherInvite) {
            sent.push(room);
          } else if (otherJoin) {
            active.push(room);
          }
        }
      }
    });

    setIncomingRequests(incoming);
    setFriends([...active, ...sent]);
  }, [client]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedUpdateLists = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updateLists();
    }, 100);
  }, [updateLists]);

  useEffect(() => {
    if (!client) return;
    updateLists();

    client.on('Room' as any, debouncedUpdateLists);
    client.on('Room.myMembership' as any, debouncedUpdateLists);
    client.on('Room.currentState' as any, debouncedUpdateLists);
    client.on('RoomState.members' as any, debouncedUpdateLists);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      client.removeListener('Room' as any, debouncedUpdateLists);
      client.removeListener('Room.myMembership' as any, debouncedUpdateLists);
      client.removeListener('Room.currentState' as any, debouncedUpdateLists);
      client.removeListener('RoomState.members' as any, debouncedUpdateLists);
    };
  }, [client, updateLists, debouncedUpdateLists]);

  const handleSearch = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!client || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setInviteError(null);
    setSearchResults([]);

    try {
      const query = searchQuery.trim();
      const myUserId = client.getUserId() || '';

      let targetUserId = query;
      if (!query.startsWith('@') && !query.includes(':')) {
        if (query.length >= 5) {
          const colonIndex = myUserId.indexOf(':');
          const suffix = colonIndex !== -1 ? myUserId.substring(colonIndex) : ':qpi.digital';
          targetUserId = `@${query.toLowerCase()}${suffix}`;
        } else {
          setInviteError('Please enter a valid User ID code.');
          return;
        }
      }

      if (targetUserId === myUserId) {
        setInviteError('You cannot add yourself as a friend.');
        return;
      }

      try {
        const profile = await client.getProfileInfo(targetUserId);
        setSearchResults([{
          userId: targetUserId,
          displayName: profile.displayname || undefined,
          avatarUrl: profile.avatar_url || undefined
        }]);
      } catch (err: any) {
        console.log('Profile lookup failed for exact User ID:', err);
        setInviteError('User ID not found. Ensure the spelling is exact.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setInviteError(err.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [client, searchQuery]);

  const checkExistingDM = useCallback((userId: string): Room | null => {
    if (!client) return null;
    const rooms = client.getVisibleRooms();
    for (const room of rooms) {
      if (isRoomDirect(client, room.roomId)) {
        const members = room.getMembers();
        if (members.some(m => m.userId === userId)) {
          return room;
        }
      }
    }
    return null;
  }, [client]);

  const handleAddFriend = useCallback(async (targetUserId: string) => {
    if (!client) return;
    setInviteError(null);
    setActionInProgress(targetUserId);

    try {
      const myId = client.getUserId();
      const existing = friends.find(room => 
        room.getMembers().some(m => m.userId === targetUserId && m.userId !== myId)
      ) || incomingRequests.find(room => 
        room.getMembers().some(m => m.userId === targetUserId && m.userId !== myId)
      );

      if (existing) {
        setSearchQuery('');
        setSearchResults([]);
        if (onSelectRoom) onSelectRoom(existing.roomId);
        if (onSwitchToChats) onSwitchToChats();
        return;
      }

      const res = await client.createRoom({
        preset: 'trusted_private_chat' as any,
        invite: [targetUserId],
        is_direct: true,
        initial_state: [
          {
            type: 'm.room.encryption',
            state_key: '',
            content: {
              algorithm: 'm.megolm.v1.aes-sha2',
            },
          },
        ],
      });

      setSearchQuery('');
      setSearchResults([]);
      updateLists();

      if (res.room_id) {
        if (onSelectRoom) onSelectRoom(res.room_id);
        if (onSwitchToChats) onSwitchToChats();
      }
    } catch (err: any) {
      console.error('Failed to add friend:', err);
      alert(err.message || 'Failed to send friend request');
    } finally {
      setActionInProgress(null);
    }
  }, [client, friends, incomingRequests, onSelectRoom, onSwitchToChats, updateLists]);

  const handleAcceptInvite = useCallback(async (roomId: string) => {
    if (!client) return;
    setActionInProgress(roomId);
    try {
      const joinedRoom = await client.joinRoom(roomId);
      const myId = client.getUserId();
      const members = joinedRoom.getMembers().filter(m => m.userId !== myId);
      if (members.length > 0) {
        const targetUserId = members[0].userId;
        try {
          const crypto = client.getCrypto();
          if (crypto) {
            await crypto.getUserDeviceInfo([targetUserId], true);
          } else if ((client as any).downloadKeys) {
            await (client as any).downloadKeys([targetUserId]);
          }
        } catch (keyErr) {
          console.warn("Failed to pre-download keys on join:", keyErr);
        }
      }

      try {
        await client.sendTextMessage(roomId, "👋 Connected! We can now chat securely.");
      } catch (msgErr) {
        console.warn("Failed to send welcome E2EE sync message:", msgErr);
      }

      updateLists();
      if (onSelectRoom) onSelectRoom(roomId);
      if (onSwitchToChats) onSwitchToChats();
    } catch (err: any) {
      console.error('Failed to join room:', err);
      alert('Failed to accept request');
    } finally {
      setActionInProgress(null);
    }
  }, [client, onSelectRoom, onSwitchToChats, updateLists]);

  const handleRejectInvite = useCallback(async (roomId: string) => {
    if (!client) return;
    setActionInProgress(roomId);
    try {
      await client.leave(roomId);
      updateLists();
    } catch (err: any) {
      console.error('Failed to reject invite:', err);
      alert('Failed to decline request');
    } finally {
      setActionInProgress(null);
    }
  }, [client, updateLists]);

  const handleRemoveFriend = useCallback(async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!client) return;
    if (!confirm('Are you sure you want to remove this friend?')) return;

    try {
      await client.leave(roomId);
      await client.forget(roomId);
      updateLists();
    } catch (err: any) {
      console.error('Failed to remove friend:', err);
      alert(err.message || 'Failed to remove friend');
    }
  }, [client, updateLists]);

  const getOtherMemberInfo = useCallback((room: Room) => {
    if (!client) return { name: 'Unknown', userId: '' };
    const myId = client.getUserId();
    const members = room.getMembers();
    const other = members.find(m => m.userId !== myId);
    return {
      name: other?.name || other?.userId || 'Unknown',
      userId: other?.userId || ''
    };
  }, [client]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    inviteError,
    friends,
    incomingRequests,
    handleSearch,
    handleAddFriend,
    handleAcceptInvite,
    handleRejectInvite,
    handleRemoveFriend,
    getOtherMemberInfo,
    actionInProgress,
    checkExistingDM,
  };
};
