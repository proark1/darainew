import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CallRecording {
  id: string;
  userId: string;
  sessionId: string | null;
  callerId: string;
  calleeId: string;
  filePath: string;
  fileUrl: string;
  durationSeconds: number;
  fileSizeBytes: number | null;
  createdAt: Date;
  callerName?: string;
  calleeName?: string;
}

export function useCallRecordings(userId: string | undefined) {
  const { toast } = useToast();
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('call_recordings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for caller/callee names
      const userIds = [...new Set(data?.flatMap(r => [r.caller_id, r.callee_id]) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name || p.email || 'Unknown']));

      const mapped: CallRecording[] = (data || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        sessionId: r.session_id,
        callerId: r.caller_id,
        calleeId: r.callee_id,
        filePath: r.file_path,
        fileUrl: r.file_url,
        durationSeconds: r.duration_seconds,
        fileSizeBytes: r.file_size_bytes,
        createdAt: new Date(r.created_at),
        callerName: profileMap.get(r.caller_id) || 'Unknown',
        calleeName: profileMap.get(r.callee_id) || 'Unknown',
      }));

      setRecordings(mapped);
    } catch (error) {
      console.error('[recordings] Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const deleteRecording = useCallback(async (recordingId: string) => {
    try {
      const recording = recordings.find(r => r.id === recordingId);
      if (!recording) return;

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('chat-attachments')
        .remove([recording.filePath]);

      if (storageError) {
        console.warn('[recordings] Storage delete warning:', storageError);
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('call_recordings')
        .delete()
        .eq('id', recordingId);

      if (dbError) throw dbError;

      setRecordings(prev => prev.filter(r => r.id !== recordingId));

      toast({
        title: 'Recording Deleted',
        description: 'The call recording has been removed.',
      });
    } catch (error) {
      console.error('[recordings] Delete error:', error);
      toast({
        title: 'Delete Error',
        description: 'Could not delete the recording.',
        variant: 'destructive',
      });
    }
  }, [recordings, toast]);

  useEffect(() => {
    fetchRecordings();
  }, [fetchRecordings]);

  return {
    recordings,
    loading,
    refetch: fetchRecordings,
    deleteRecording,
  };
}
