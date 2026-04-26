import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type MemorySourceKind = 'semantic' | 'episodic' | 'ai_memory';

export interface MemoryAuditItem {
  sourceKind: MemorySourceKind;
  sourceId: string;
  subKind: string | null;
  title: string | null;
  content: string | null;
  metadata: Record<string, unknown>;
  importance: number | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRedaction {
  id: string;
  targetKind: string;
  targetId: string | null;
  reason: string | null;
  cascadedCount: number;
  appliedBy: 'user' | 'system';
  createdAt: string;
}

interface UseMemoryAuditOptions {
  kinds?: MemorySourceKind[];
  limit?: number;
}

// Reads the unified `memory_audit_feed` view + drives forget actions on
// individual rows. The feed is ordered by created_at DESC so pagination
// is just (limit, offset). Server-side filtering by source_kind keeps
// payload small.
export function useMemoryAudit(opts: UseMemoryAuditOptions = {}) {
  const { user } = useAuth();
  const [items, setItems] = useState<MemoryAuditItem[]>([]);
  const [redactions, setRedactions] = useState<MemoryRedaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const limit = opts.limit ?? 80;
  const kindsKey = JSON.stringify(opts.kinds ?? null);

  const fetchItems = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      let q = (supabase as any)
        .from('memory_audit_feed')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (opts.kinds && opts.kinds.length > 0) {
        q = q.in('source_kind', opts.kinds);
      }
      const { data, error: dbErr } = await q;
      if (dbErr) throw dbErr;
      const rows: MemoryAuditItem[] = (data ?? []).map((r: any) => ({
        sourceKind: r.source_kind,
        sourceId: r.source_id,
        subKind: r.sub_kind ?? null,
        title: r.title ?? null,
        content: r.content ?? null,
        metadata: r.metadata ?? {},
        importance: r.importance != null ? Number(r.importance) : null,
        confidence: r.confidence != null ? Number(r.confidence) : null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
      setItems(rows);
    } catch (e) {
      console.warn('[useMemoryAudit] fetch failed', (e as Error).message);
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, kindsKey, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRedactions = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error: dbErr } = await (supabase as any)
        .from('memory_redactions')
        .select('id, target_kind, target_id, reason, cascaded_count, applied_by, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40);
      if (dbErr) throw dbErr;
      setRedactions((data ?? []).map((r: any) => ({
        id: r.id,
        targetKind: r.target_kind,
        targetId: r.target_id ?? null,
        reason: r.reason ?? null,
        cascadedCount: Number(r.cascaded_count ?? 0),
        appliedBy: r.applied_by,
        createdAt: r.created_at,
      })));
    } catch (e) {
      console.warn('[useMemoryAudit] redactions failed', (e as Error).message);
    }
  }, [user?.id]);

  const forgetItem = useCallback(async (item: MemoryAuditItem, reason?: string) => {
    if (!user?.id) return false;
    try {
      const { error: invErr } = await supabase.functions.invoke('memory-forget', {
        body: { target_kind: item.sourceKind, target_id: item.sourceId, reason },
      });
      if (invErr) throw invErr;
      // Optimistic remove + refresh redactions feed.
      setItems((prev) => prev.filter((i) =>
        !(i.sourceKind === item.sourceKind && i.sourceId === item.sourceId),
      ));
      fetchRedactions();
      return true;
    } catch (e) {
      console.warn('[useMemoryAudit] forget failed', (e as Error).message);
      return false;
    }
  }, [user?.id, fetchRedactions]);

  useEffect(() => {
    fetchItems();
    fetchRedactions();
  }, [fetchItems, fetchRedactions]);

  return {
    items,
    redactions,
    loading,
    error,
    refresh: fetchItems,
    forgetItem,
    refreshRedactions: fetchRedactions,
  };
}
