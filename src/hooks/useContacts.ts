import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Contact {
  id: string;
  userId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export function useContacts(userId: string | undefined) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContacts = useCallback(async () => {
    if (!userId) {
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    // Get all profiles for potential assignees
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, email, display_name, avatar_url');

    if (profiles) {
      setContacts(profiles.map(p => ({
        id: p.user_id,
        userId: p.user_id,
        email: p.email || '',
        displayName: p.display_name || undefined,
        avatarUrl: p.avatar_url || undefined,
      })));
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    loading,
    refetch: fetchContacts,
  };
}
