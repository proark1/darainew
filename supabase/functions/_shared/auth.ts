// Shared auth helper.
//
// Two paths into our edge functions:
//   1. End-user JWT in Authorization (the normal path)
//   2. Service-role bearer + x-telegram-user-id header — used when
//      another edge function (chat, telegram-router, dori-execute-action)
//      delegates on behalf of a known user.
//
// Both paths return a user_id; callers no longer have to hand-roll the
// six lines of auth boilerplate per function.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface ResolvedAuth {
  userId: string;
  // True when the call came in via a service-role token (so the caller
  // is implicitly trusted). Useful for selectively relaxing checks
  // (e.g. allowing requests on behalf of a Telegram user).
  isInternal: boolean;
}

export async function resolveUserId(req: Request): Promise<ResolvedAuth | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl) return null;

  // Path 2 first — cheap, no network call.
  const tgUserId = req.headers.get('x-telegram-user-id');
  if (serviceKey && token === serviceKey && tgUserId) {
    return { userId: tgUserId, isInternal: true };
  }

  // Path 1 — verify with Supabase.
  try {
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await userClient.auth.getUser();
    if (error || !data?.user) return null;
    return { userId: data.user.id, isInternal: false };
  } catch {
    return null;
  }
}

// Convenience: pull the admin (service-role) client. Every edge fn that
// reads/writes on behalf of the resolved user will need this.
export function adminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(supabaseUrl, serviceKey);
}
