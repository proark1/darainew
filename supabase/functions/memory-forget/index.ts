// Forget memory items.
//
// One endpoint, three usage shapes:
//   - { target_kind, target_id, reason? }                  → forget one row
//   - { bulk: [{ target_kind, target_id }], reason? }      → forget many
//   - { entity_id, deep: true, reason? }                   → forget an entity
//                                                            AND every memory
//                                                            row that mentions
//                                                            it.
//
// Uses the SECURITY DEFINER `forget_memory_target` RPC for the per-row
// case so that the cascade (mention deletion + audit log insert) is
// transactional. Deep entity-forget is implemented client-side (in
// this function) because it needs to walk kg_mentions to discover
// downstream targets.
//
// Always logs to memory_redactions — even the deep cascade — so the
// user has a complete audit trail.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ForgetTargetKind =
  | 'semantic'
  | 'episodic'
  | 'ai_memory'
  | 'kg_entity';

const ALLOWED_KINDS: ForgetTargetKind[] = [
  'semantic', 'episodic', 'ai_memory', 'kg_entity',
];

interface ForgetTarget {
  target_kind: ForgetTargetKind;
  target_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null;

    // ---- Deep entity forget: drop the entity + every memory row it touches ----
    if (body.entity_id && body.deep === true) {
      const entityId = String(body.entity_id);

      // Walk mentions, group by source_kind, and forget each underlying row.
      const { data: mentions } = await admin
        .from('kg_mentions')
        .select('source_kind, source_id')
        .eq('user_id', user.id)
        .eq('entity_id', entityId)
        .limit(2000);

      let cascaded = 0;
      const seen = new Set<string>();
      for (const m of mentions ?? []) {
        const kind = m.source_kind as string;
        const id = String(m.source_id);
        const key = `${kind}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // Only the kinds the per-row RPC understands are cascaded.
        if (!['semantic', 'episodic', 'ai_memory'].includes(kind)) continue;
        const { data, error } = await admin.rpc('forget_memory_target', {
          p_user_id: user.id,
          p_target_kind: kind,
          p_target_id: id,
          p_reason: reason ?? `cascade from kg_entity ${entityId}`,
        });
        if (!error) cascaded += Number(data) || 0;
      }

      // Now soft-delete the entity itself.
      const { data: entityRows } = await admin.rpc('forget_memory_target', {
        p_user_id: user.id,
        p_target_kind: 'kg_entity',
        p_target_id: entityId,
        p_reason: reason,
      });

      // Roll up audit row for the deep action so the user sees one entry
      // with the full impact, not just the per-row entries the RPC made.
      await admin.from('memory_redactions').insert({
        user_id: user.id,
        target_kind: 'all_for_entity',
        target_id: entityId,
        scope: { mentions_walked: mentions?.length ?? 0 },
        reason,
        cascaded_count: cascaded + (Number(entityRows) || 0),
        applied_by: 'user',
      });

      return json({
        forgotten: cascaded + (Number(entityRows) || 0),
        cascaded_rows: cascaded,
        entity_redacted: (Number(entityRows) || 0) > 0,
      });
    }

    // ---- Bulk: array of targets ----
    if (Array.isArray(body.bulk)) {
      const targets: ForgetTarget[] = body.bulk
        .filter((t: any) => t && ALLOWED_KINDS.includes(t.target_kind) && t.target_id)
        .slice(0, 200);
      let total = 0;
      for (const t of targets) {
        const { data, error } = await admin.rpc('forget_memory_target', {
          p_user_id: user.id,
          p_target_kind: t.target_kind,
          p_target_id: String(t.target_id),
          p_reason: reason,
        });
        if (!error) total += Number(data) || 0;
      }
      return json({ forgotten: total, targets: targets.length });
    }

    // ---- Single target ----
    if (body.target_kind && body.target_id) {
      const kind = body.target_kind as ForgetTargetKind;
      if (!ALLOWED_KINDS.includes(kind)) return json({ error: 'invalid target_kind' }, 400);
      const { data, error } = await admin.rpc('forget_memory_target', {
        p_user_id: user.id,
        p_target_kind: kind,
        p_target_id: String(body.target_id),
        p_reason: reason,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ forgotten: Number(data) || 0 });
    }

    return json({ error: 'unrecognised request shape' }, 400);
  } catch (err) {
    console.error('[memory-forget] failed', (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
