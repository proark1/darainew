// Generates a one-time link code and bot deep link for personal OR family group linking.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getBotUsername(tgKey: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${tgKey}/getMe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      console.error("[telegram-link] getMe failed", r.status, data);
      return null;
    }
    return data?.result?.username ?? null;
  } catch (e) {
    console.error("[telegram-link] getMe threw", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "generate";
    const scope = body.scope || "personal"; // 'personal' | 'group'

    // Reject unknown actions explicitly so we don't silently fall through to
    // the generate path (which upserts is_active:false and can disconnect a
    // linked user when a newer frontend calls an action the deployed backend
    // doesn't yet understand).
    const KNOWN_ACTIONS = new Set([
      "generate",
      "unlink",
      "diagnose",
      "family_members_list",
      "family_member_add",
      "family_member_remove",
      "workspace_links",
      "workspace_generate",
      "workspace_unlink",
    ]);
    if (!KNOWN_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "unlink") {
      if (scope === "group") {
        await admin.from("telegram_group_links").delete().eq("owner_user_id", user.id);
      } else {
        await admin.from("telegram_links").delete().eq("user_id", user.id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const getWorkspaceRole = async (workspaceId: string): Promise<string | null> => {
      const { data } = await admin
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", user.id)
        .maybeSingle();
      return (data?.role as string | undefined) ?? null;
    };

    const requireWorkspaceAdmin = async (
      workspaceId: string,
    ): Promise<{ ok: true; role: string } | { ok: false; response: Response }> => {
      const role = await getWorkspaceRole(workspaceId);
      if (role === "owner" || role === "admin") return { ok: true, role };
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "Only workspace owners and admins can manage Telegram." }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        ),
      };
    };

    if (action === "diagnose") {
      // Surface status for Settings → Telegram → Diagnose. Folded into this
      // function (rather than a separate one) because it is already deployed
      // and has the same env vars + admin client on hand.
      const runPoll = body.runPoll === true;

      // 1. getMe — validates bot token
      let botInfo: {
        ok: boolean;
        username?: string;
        first_name?: string;
        id?: number;
        error?: string;
      } = { ok: false };
      if (TELEGRAM_API_KEY) {
        try {
          const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/getMe`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: "{}",
          });
          const data = await r.json().catch(() => null);
          if (!r.ok) {
            botInfo = {
              ok: false,
              error: `telegram ${r.status}: ${JSON.stringify(data).slice(0, 200)}`,
            };
          } else if (data?.result) {
            botInfo = {
              ok: true,
              username: data.result.username,
              first_name: data.result.first_name,
              id: data.result.id,
            };
          } else {
            botInfo = { ok: false, error: "unexpected response shape" };
          }
        } catch (e) {
          botInfo = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      } else {
        botInfo = { ok: false, error: "missing TELEGRAM_API_KEY" };
      }

      // 2. bot_state — cron freshness
      const { data: botState } = await admin
        .from("telegram_bot_state")
        .select("update_offset, updated_at")
        .eq("id", 1)
        .maybeSingle();
      const lastTickSeconds = botState?.updated_at
        ? Math.round((Date.now() - new Date(botState.updated_at).getTime()) / 1000)
        : null;

      // 3. user's links
      const [{ data: link }, { data: group }] = await Promise.all([
        admin
          .from("telegram_links")
          .select("is_active, chat_id, telegram_username, telegram_first_name, linked_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("telegram_group_links")
          .select("is_active, chat_id, title, linked_at")
          .eq("owner_user_id", user.id)
          .maybeSingle(),
      ]);

      // 4. optional manual poll
      let pollResult: { ok: boolean; status?: number; body?: unknown; error?: string } | null =
        null;
      if (runPoll) {
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/telegram-poll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const text = await r.text();
          let parsed: unknown = text;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* keep as text */
          }
          pollResult = { ok: r.ok, status: r.status, body: parsed };
        } catch (e) {
          pollResult = { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      }

      return new Response(
        JSON.stringify({
          version: "diagnose-v2",
          envVars: {
            GEMINI_API_KEY: Boolean(Deno.env.get("GEMINI_API_KEY")),
            TELEGRAM_API_KEY: Boolean(TELEGRAM_API_KEY),
          },
          botInfo,
          botState: botState ? { ...botState, lastTickSeconds } : null,
          link,
          group,
          pollResult,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Family roster management (settings UI) ───────────────────────────
    // The caller must own a family group link. Members are pre-authorized by
    // @username; when they post in the group, telegram-router auto-accepts them.
    if (
      action === "family_members_list" ||
      action === "family_member_add" ||
      action === "family_member_remove"
    ) {
      const { data: groupLink } = await admin
        .from("telegram_group_links")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!groupLink) {
        return new Response(
          JSON.stringify({ error: "No family group yet. Create a family group link first." }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (action === "family_member_add") {
        const uname = String(body.username || "")
          .replace(/^@/, "")
          .trim()
          .toLowerCase();
        if (!uname || !/^[a-z0-9_]{3,}$/.test(uname)) {
          return new Response(
            JSON.stringify({
              error: "Enter a valid Telegram @username (letters, numbers, underscore).",
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const { error: upErr } = await admin.from("telegram_group_members").upsert(
          {
            group_link_id: groupLink.id,
            telegram_username: uname,
            display_name: body.display_name ? String(body.display_name).slice(0, 80) : null,
            role: "member",
            status: "invited",
          },
          { onConflict: "group_link_id,telegram_username" },
        );
        if (upErr) {
          return new Response(JSON.stringify({ error: upErr.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (action === "family_member_remove") {
        const id = String(body.id || "");
        if (id) {
          await admin
            .from("telegram_group_members")
            .delete()
            .eq("id", id)
            .eq("group_link_id", groupLink.id);
        }
      }

      const { data: members } = await admin
        .from("telegram_group_members")
        .select("id, telegram_username, display_name, status, role, joined_at")
        .eq("group_link_id", groupLink.id)
        .order("created_at", { ascending: true });
      return new Response(JSON.stringify({ ok: true, members: members || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "workspace_links") {
      const { data: memberships } = await admin
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id);
      const workspaceIds = ((memberships || []) as Array<{ workspace_id?: string | null }>)
        .map((row) => row.workspace_id)
        .filter(Boolean) as string[];

      const [{ data: workspaces }, { data: workspaceLinks }] = await Promise.all([
        workspaceIds.length
          ? admin
              .from("workspaces")
              .select("id, name, icon, archived")
              .in("id", workspaceIds)
              .eq("archived", false)
              .order("name", { ascending: true })
          : Promise.resolve({ data: [] }),
        workspaceIds.length
          ? admin
              .from("workspace_telegram_links")
              .select(
                "id, workspace_id, chat_id, title, is_active, linked_at, link_code_expires_at, created_at",
              )
              .in("workspace_id", workspaceIds)
              .order("created_at", { ascending: false })
              .limit(50)
          : Promise.resolve({ data: [] }),
      ]);

      return new Response(
        JSON.stringify({
          ok: true,
          workspaces: workspaces || [],
          memberships: memberships || [],
          workspaceLinks: workspaceLinks || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "workspace_generate") {
      const workspaceId = String(body.workspaceId || "");
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "Missing workspaceId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminCheck = await requireWorkspaceAdmin(workspaceId);
      if (!adminCheck.ok) return adminCheck.response;

      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const botUsername = await getBotUsername(TELEGRAM_API_KEY);

      await admin
        .from("workspace_telegram_links")
        .delete()
        .eq("workspace_id", workspaceId)
        .is("chat_id", null)
        .eq("is_active", false);

      const { data: pending, error: insertErr } = await admin
        .from("workspace_telegram_links")
        .insert({
          workspace_id: workspaceId,
          chat_id: null,
          title: null,
          link_code: code,
          link_code_expires_at: expires,
          is_active: false,
        })
        .select("id")
        .single();

      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const addToGroupUrl = botUsername ? `https://t.me/${botUsername}?startgroup=true` : null;
      return new Response(
        JSON.stringify({
          ok: true,
          id: pending?.id ?? null,
          code,
          expiresAt: expires,
          botUsername,
          addToGroupUrl,
          instructions: `1) Add @${botUsername || "the bot"} to your workspace Telegram group.\n2) In that group, send: /linkworkspace ${code}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "workspace_unlink") {
      const linkId = String(body.workspaceTelegramLinkId || body.linkId || "");
      if (!linkId) {
        return new Response(JSON.stringify({ error: "Missing workspaceTelegramLinkId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: linkRow } = await admin
        .from("workspace_telegram_links")
        .select("id, workspace_id")
        .eq("id", linkId)
        .maybeSingle();
      if (!linkRow?.workspace_id) {
        return new Response(JSON.stringify({ error: "Workspace Telegram link not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const adminCheck = await requireWorkspaceAdmin(linkRow.workspace_id as string);
      if (!adminCheck.ok) return adminCheck.response;

      await admin.from("workspace_telegram_links").delete().eq("id", linkId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate code
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const botUsername = await getBotUsername(TELEGRAM_API_KEY);

    if (scope === "group") {
      // Find an accepted partner (first one) for this owner
      const { data: partner } = await admin
        .from("space_members")
        .select("id, member_id")
        .eq("owner_id", user.id)
        .eq("status", "accepted")
        .limit(1)
        .maybeSingle();

      const { data: upserted } = await admin
        .from("telegram_group_links")
        .upsert(
          {
            owner_user_id: user.id,
            partner_user_id: partner?.member_id ?? null,
            space_member_id: partner?.id ?? null,
            link_code: code,
            link_code_expires_at: expires,
            is_active: false,
          },
          { onConflict: "owner_user_id" },
        )
        .select("id")
        .maybeSingle();

      // Ensure the owner has an active roster row so the household resolves and
      // members added by @username can be auto-accepted. Best-effort.
      if (upserted?.id) {
        try {
          const { data: existing } = await admin
            .from("telegram_group_members")
            .select("id")
            .eq("group_link_id", upserted.id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!existing) {
            await admin.from("telegram_group_members").insert({
              group_link_id: upserted.id,
              user_id: user.id,
              role: "owner",
              status: "active",
              joined_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error("owner roster seed failed", e);
        }
      }

      // Group bots cannot use ?start= deep link from a group; user must add bot then send /linkfamily <code>
      const addToGroupUrl = botUsername ? `https://t.me/${botUsername}?startgroup=true` : null;

      return new Response(
        JSON.stringify({
          code,
          expiresAt: expires,
          botUsername,
          addToGroupUrl,
          instructions: `1) Tap "Add to group" and choose your family group.\n2) In the group, send: /linkfamily ${code}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Personal
    await admin.from("telegram_links").upsert(
      {
        user_id: user.id,
        link_code: code,
        link_code_expires_at: expires,
        is_active: false,
      },
      { onConflict: "user_id" },
    );

    const deepLink = botUsername ? `https://t.me/${botUsername}?start=${code}` : null;

    return new Response(
      JSON.stringify({
        code,
        expiresAt: expires,
        botUsername,
        deepLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("telegram-link error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
