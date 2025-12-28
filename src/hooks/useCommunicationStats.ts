import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CommunicationStat {
  id: string;
  contactId: string;
  contactName?: string;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  totalCalls: number;
  totalCallDurationSeconds: number;
  avgResponseTimeSeconds?: number;
  lastInteractionAt?: Date;
}

export interface CommunicationDashboard {
  totalContacts: number;
  totalMessages: number;
  totalCalls: number;
  totalCallMinutes: number;
  avgResponseTime: number;
  mostActiveContacts: CommunicationStat[];
  neglectedContacts: CommunicationStat[];
  recentActivity: { date: string; messages: number; calls: number }[];
}

export function useCommunicationStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<CommunicationStat[]>([]);
  const [dashboard, setDashboard] = useState<CommunicationDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch all communication stats
  const fetchStats = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('communication_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('last_interaction_at', { ascending: false });

      if (!error && data) {
        // Get contact names
        const contactIds = data.map(s => s.contact_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', contactIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

        const mappedStats = data.map(s => ({
          id: s.id,
          contactId: s.contact_id,
          contactName: profileMap.get(s.contact_id) || 'Unknown',
          totalMessagesSent: s.total_messages_sent,
          totalMessagesReceived: s.total_messages_received,
          totalCalls: s.total_calls,
          totalCallDurationSeconds: s.total_call_duration_seconds,
          avgResponseTimeSeconds: s.avg_response_time_seconds,
          lastInteractionAt: s.last_interaction_at ? new Date(s.last_interaction_at) : undefined,
        }));

        setStats(mappedStats);
        calculateDashboard(mappedStats);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate dashboard metrics
  const calculateDashboard = useCallback((statsData: CommunicationStat[]) => {
    const totalMessages = statsData.reduce((sum, s) => sum + s.totalMessagesSent + s.totalMessagesReceived, 0);
    const totalCalls = statsData.reduce((sum, s) => sum + s.totalCalls, 0);
    const totalCallMinutes = statsData.reduce((sum, s) => sum + s.totalCallDurationSeconds, 0) / 60;
    
    const avgTimes = statsData.filter(s => s.avgResponseTimeSeconds).map(s => s.avgResponseTimeSeconds!);
    const avgResponseTime = avgTimes.length > 0 ? avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length : 0;

    // Most active contacts (by total interactions)
    const mostActiveContacts = [...statsData]
      .sort((a, b) => (b.totalMessagesSent + b.totalMessagesReceived + b.totalCalls) - 
                       (a.totalMessagesSent + a.totalMessagesReceived + a.totalCalls))
      .slice(0, 5);

    // Neglected contacts (no interaction in 30+ days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const neglectedContacts = statsData
      .filter(s => !s.lastInteractionAt || s.lastInteractionAt < thirtyDaysAgo)
      .slice(0, 5);

    // Generate recent activity (mock data based on totals - in real app, would query time-series data)
    const recentActivity = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
      return {
        date: date.toISOString().split('T')[0],
        messages: Math.floor(Math.random() * (totalMessages / 7) * 2),
        calls: Math.floor(Math.random() * (totalCalls / 7) * 2),
      };
    });

    setDashboard({
      totalContacts: statsData.length,
      totalMessages,
      totalCalls,
      totalCallMinutes: Math.round(totalCallMinutes),
      avgResponseTime: Math.round(avgResponseTime / 60), // Convert to minutes
      mostActiveContacts,
      neglectedContacts,
      recentActivity,
    });
  }, []);

  // Update stats for a contact
  const updateStats = useCallback(async (
    contactId: string,
    update: {
      messagesSent?: number;
      messagesReceived?: number;
      calls?: number;
      callDurationSeconds?: number;
    }
  ) => {
    if (!user) return;

    // First, get current stats
    const { data: existing } = await supabase
      .from('communication_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('contact_id', contactId)
      .single();

    const newStats = {
      user_id: user.id,
      contact_id: contactId,
      total_messages_sent: (existing?.total_messages_sent || 0) + (update.messagesSent || 0),
      total_messages_received: (existing?.total_messages_received || 0) + (update.messagesReceived || 0),
      total_calls: (existing?.total_calls || 0) + (update.calls || 0),
      total_call_duration_seconds: (existing?.total_call_duration_seconds || 0) + (update.callDurationSeconds || 0),
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('communication_stats')
      .upsert(newStats, { onConflict: 'user_id,contact_id' });

    fetchStats();
  }, [user, fetchStats]);

  // Get stats for a specific contact
  const getContactStats = useCallback((contactId: string) => {
    return stats.find(s => s.contactId === contactId);
  }, [stats]);

  // Get response time breakdown
  const getResponseTimeBreakdown = useCallback(() => {
    const fast = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds < 300).length;
    const medium = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds >= 300 && s.avgResponseTimeSeconds < 3600).length;
    const slow = stats.filter(s => s.avgResponseTimeSeconds && s.avgResponseTimeSeconds >= 3600).length;
    
    return { fast, medium, slow };
  }, [stats]);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user, fetchStats]);

  return {
    stats,
    dashboard,
    loading,
    fetchStats,
    updateStats,
    getContactStats,
    getResponseTimeBreakdown,
  };
}
