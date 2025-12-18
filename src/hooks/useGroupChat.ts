import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatAttachment } from './useDirectMessages';

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  members?: GroupMember[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface GroupMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile?: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  attachments: ChatAttachment[];
  reactions: MessageReaction[];
  created_at: string;
  sender_profile?: {
    display_name: string | null;
    email: string | null;
  };
  read_by?: string[];
}

export interface MessageReaction {
  emoji: string;
  user_ids: string[];
}

export function useGroupChat(userId: string | null) {
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all groups
  const fetchGroups = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: groupsData, error } = await supabase
        .from('chat_groups')
        .select(`
          *,
          chat_group_members (
            id,
            user_id,
            role,
            joined_at
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Fetch member profiles and last messages
      const enrichedGroups = await Promise.all(
        (groupsData || []).map(async (group) => {
          const memberIds = group.chat_group_members?.map((m: any) => m.user_id) || [];
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, email, avatar_url')
            .in('user_id', memberIds);
          
          const { data: lastMsg } = await supabase
            .from('group_messages')
            .select('content, created_at')
            .eq('group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          const members = group.chat_group_members?.map((m: any) => ({
            ...m,
            profile: profiles?.find(p => p.user_id === m.user_id),
          }));

          return {
            ...group,
            members,
            lastMessage: lastMsg?.content || '',
            lastMessageAt: lastMsg?.created_at || group.created_at,
          };
        })
      );

      setGroups(enrichedGroups);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Create a new group
  const createGroup = useCallback(async (name: string, memberIds: string[], description?: string) => {
    if (!userId) return null;

    try {
      // Create the group
      const { data: group, error: groupError } = await supabase
        .from('chat_groups')
        .insert({
          name,
          description,
          created_by: userId,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as admin
      const { error: adminError } = await supabase
        .from('chat_group_members')
        .insert({
          group_id: group.id,
          user_id: userId,
          role: 'admin',
        });

      if (adminError) throw adminError;

      // Add other members
      if (memberIds.length > 0) {
        const memberInserts = memberIds.map(id => ({
          group_id: group.id,
          user_id: id,
          role: 'member',
        }));

        await supabase
          .from('chat_group_members')
          .insert(memberInserts);
      }

      await fetchGroups();
      return group;
    } catch (error) {
      console.error('Error creating group:', error);
      return null;
    }
  }, [userId, fetchGroups]);

  // Fetch messages for a group
  const fetchMessages = useCallback(async (groupId: string) => {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = [...new Set(data?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', senderIds);

      // Fetch read statuses
      const messageIds = data?.map(m => m.id) || [];
      const { data: reads } = await supabase
        .from('group_message_reads')
        .select('message_id, user_id')
        .in('message_id', messageIds);

      const readMap = new Map<string, string[]>();
      reads?.forEach(r => {
        if (!readMap.has(r.message_id)) {
          readMap.set(r.message_id, []);
        }
        readMap.get(r.message_id)!.push(r.user_id);
      });

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      const messagesWithProfiles: GroupMessage[] = (data || []).map(msg => ({
        ...msg,
        attachments: (Array.isArray(msg.attachments) ? msg.attachments : []) as unknown as ChatAttachment[],
        reactions: (Array.isArray(msg.reactions) ? msg.reactions : []) as unknown as MessageReaction[],
        sender_profile: profileMap.get(msg.sender_id) || undefined,
        read_by: readMap.get(msg.id) || [],
      }));

      setMessages(messagesWithProfiles);
      return messagesWithProfiles;
    } catch (error) {
      console.error('Error fetching group messages:', error);
      return [];
    }
  }, [userId]);

  // Send a message
  const sendMessage = useCallback(async (
    groupId: string,
    content: string,
    attachments: ChatAttachment[] = []
  ) => {
    if (!userId || (!content.trim() && attachments.length === 0)) return null;

    try {
      const { data, error } = await supabase
        .from('group_messages')
        .insert({
          group_id: groupId,
          sender_id: userId,
          content: content.trim(),
          attachments: attachments as unknown as null,
        })
        .select()
        .single();

      if (error) throw error;

      // Update group's updated_at
      await supabase
        .from('chat_groups')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', groupId);

      return data;
    } catch (error) {
      console.error('Error sending group message:', error);
      return null;
    }
  }, [userId]);

  // Mark messages as read
  const markAsRead = useCallback(async (groupId: string) => {
    if (!userId) return;

    try {
      // Get unread messages in this group
      const { data: unreadMessages } = await supabase
        .from('group_messages')
        .select('id')
        .eq('group_id', groupId)
        .neq('sender_id', userId);

      if (!unreadMessages || unreadMessages.length === 0) return;

      // Insert read receipts
      const reads = unreadMessages.map(m => ({
        message_id: m.id,
        user_id: userId,
      }));

      await supabase
        .from('group_message_reads')
        .upsert(reads, { onConflict: 'message_id,user_id' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [userId]);

  // Add reaction to message
  const addReaction = useCallback(async (messageId: string, emoji: string, isGroup: boolean) => {
    if (!userId) return;

    try {
      const table = isGroup ? 'group_messages' : 'direct_messages';
      
      const { data: message } = await supabase
        .from(table)
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (!message) return;

      const reactions = (Array.isArray(message.reactions) ? message.reactions : []) as unknown as MessageReaction[];
      const existingReaction = reactions.find(r => r.emoji === emoji);

      if (existingReaction) {
        if (existingReaction.user_ids.includes(userId)) {
          // Remove user from reaction
          existingReaction.user_ids = existingReaction.user_ids.filter(id => id !== userId);
          if (existingReaction.user_ids.length === 0) {
            const index = reactions.indexOf(existingReaction);
            reactions.splice(index, 1);
          }
        } else {
          existingReaction.user_ids.push(userId);
        }
      } else {
        reactions.push({ emoji, user_ids: [userId] });
      }

      await supabase
        .from(table)
        .update({ reactions: reactions as unknown as null })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  }, [userId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return;

    fetchGroups();

    const channel = supabase
      .channel('group-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchGroups]);

  return {
    groups,
    messages,
    loading,
    createGroup,
    fetchMessages,
    sendMessage,
    markAsRead,
    addReaction,
    refetch: fetchGroups,
  };
}
