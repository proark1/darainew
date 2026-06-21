// Nightly memory consolidation dispatcher.
//
// pg_cron isn't available on the self-hosted Railway Postgres, so the pure-SQL
// dori_run_memory_consolidation() (enforce ai_memory expiry, dedupe semantic
// rows, decay stale chat-turns) is invoked here on a schedule by the Railway
// cron service (see cron/scheduler.mjs).
//
// Auth: service-role bearer (same gate as the other *-cron functions).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!serviceKey || auth !== serviceKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const { data, error } = await admin.rpc("dori_run_memory_consolidation");
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, result: data });
  } catch (e) {
    console.error("[memory-consolidation-cron]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
