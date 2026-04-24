// Polls Telegram getUpdates and routes incoming messages.
// 1:1 chats → Dori chat; group chats linked via /linkfamily → telegram-router.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDoriReply } from '../_shared/telegram-voice.ts';
import {
  approveAndExecutePending,
  buildConfirmKeyboard,
  classifyConfirmationText,
  fetchLatestPendingForChat,
  rejectPending,
  tgAnswerCallback,
  tgEditMessageText,
  tgSendWithKeyboard,
} from '../_shared/telegram-confirm.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function tg(method: string, body: Record<string, unknown>, lovableKey: string, tgKey: string) {
  const r = await fetch(`${GATEWAY_URL}/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': tgKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function sendMessage(chatId: number, text: string, lovableKey: string, tgKey: string) {
  try {
    await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' }, lovableKey, tgKey);
  } catch (e) {
    console.error('sendMessage failed:', e);
  }
}

// Download a Telegram file (voice/audio) and transcribe via Gemini.
// Returns the transcript text, or null on failure.
async function transcribeTelegramVoice(
  fileId: string,
  mime: string,
  lovableKey: string,
  tgKey: string,
): Promise<string | null> {
  try {
    // 1) Resolve file_path
    const fileRes = await tg('getFile', { file_id: fileId }, lovableKey, tgKey);
    const filePath = fileRes?.result?.file_path;
    if (!filePath) return null;

    // 2) Download file bytes via gateway
    const dl = await fetch(`${GATEWAY_URL}/file/${filePath}`, {
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'X-Connection-Api-Key': tgKey },
    });
    if (!dl.ok) {
      console.error('voice download failed', dl.status);
      return null;
    }
    const bytes = new Uint8Array(await dl.arrayBuffer());

    // 3) Base64 encode (chunked to avoid stack overflow on large files)
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
    }
    const base64Audio = btoa(binary);

    // 4) Transcribe via Lovable AI Gateway (Gemini supports audio inline as data URL)
    const audioMime = mime || 'audio/ogg';
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a precise transcriber. Transcribe the audio verbatim in the original language. Output ONLY the transcript, no quotes, no commentary.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcribe this voice message.' },
              { type: 'image_url', image_url: { url: `data:${audioMime};base64,${base64Audio}` } },
            ],
          },
        ],
      }),
    });
    if (!aiRes.ok) {
      console.error('transcription failed', aiRes.status, await aiRes.text());
      return null;
    }
    const aiData = await aiRes.json();
    const transcript = aiData?.choices?.[0]?.message?.content?.trim();
    return transcript || null;
  } catch (e) {
    console.error('transcribeTelegramVoice error', e);
    return null;
  }
}

interface ToolResult {
  ok: boolean;
  message: string;
  tool?: string;
  queued?: boolean;
  actionId?: string;
  summary?: string;
}

interface DoriCallResult {
  reply: string;
  toolResults: ToolResult[];
}

// Calls the chat function in agent-mode so tools actually run for 1:1 Telegram
// messages (previously the private chat path streamed text without executing
// tools, so add/edit/delete silently failed). Returns the reply PLUS any
// tool results, including queued confirmation prompts the bot must surface.
async function callDori(
  userId: string,
  message: string,
  chatId: number,
  supabaseUrl: string,
  serviceKey: string,
): Promise<DoriCallResult> {
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userId,
        'x-dori-channel': 'tg_private',
        'x-dori-channel-ref': String(chatId),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        personality: 'balanced',
        executeServerSide: true,
        actionSource: 'tg_private',
        actionSourceRef: String(chatId),
      }),
    });
    if (!r.ok) {
      console.error(`Dori call failed for user ${userId}:`, r.status, await r.text());
      return {
        reply: "Sorry, I'm having trouble reaching Dori right now. Try again in a moment.",
        toolResults: [],
      };
    }
    const data = await r.json();
    return {
      reply: (data?.reply || '').trim(),
      toolResults: (data?.toolResults || []) as ToolResult[],
    };
  } catch (e) {
    console.error('callDori error:', e);
    return { reply: 'Something went wrong. Please try again.', toolResults: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Public (cron-only by convention, matching email-autopilot). No in-function
  // auth gate: verify_jwt = false in config.toml and any auth check requires
  // operator setup (Vault + env var) to stay in sync with the cron, which
  // previously broke the integration whenever they drifted. Supabase's
  // built-in function rate limits + timeouts bound worst-case abuse, and
  // expensive paths (voice transcription) only fire on real Telegram inputs.
  const startTime = Date.now();
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: state } = await supabase
    .from('telegram_bot_state')
    .select('update_offset')
    .eq('id', 1)
    .single();

  let currentOffset = state?.update_offset ?? 0;
  let processed = 0;
  console.log(`[telegram-poll] tick: offset=${currentOffset}`);

  while (Date.now() - startTime < MAX_RUNTIME_MS - MIN_REMAINING_MS) {
    const remainingMs = MAX_RUNTIME_MS - (Date.now() - startTime);
    const timeout = Math.min(50, Math.floor(remainingMs / 1000) - 5);
    if (timeout < 1) break;

    let data: any;
    try {
      data = await tg(
        'getUpdates',
        { offset: currentOffset, timeout, allowed_updates: ['message', 'callback_query'] },
        LOVABLE_API_KEY,
        TELEGRAM_API_KEY,
      );
      // (voice/audio arrive inside 'message' updates — no extra allowed_updates needed)
    } catch (e) {
      console.error('getUpdates failed:', e);
      break;
    }

    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      // ── Callback query (inline-keyboard tap on a confirmation prompt) ───────
      if (u.callback_query) {
        const cb = u.callback_query;
        const raw = String(cb.data || '');
        const match = raw.match(/^dori_(confirm|reject):(.+)$/);
        const cbChatId = cb.message?.chat?.id;
        const cbMessageId = cb.message?.message_id;
        const cbFromId = cb.from?.id;

        if (match && cbChatId && cbFromId) {
          const decision = match[1] as 'confirm' | 'reject';
          const actionId = match[2];

          // Resolve the tapping user to an app user so we enforce ownership.
          const { data: mapped } = await supabase.from('telegram_user_map')
            .select('user_id').eq('telegram_user_id', cbFromId).maybeSingle();
          const tappingUserId = mapped?.user_id as string | undefined;

          const { data: action } = await supabase.from('auto_actions_log')
            .select('*').eq('id', actionId).maybeSingle();

          if (!action) {
            await tgAnswerCallback(cb.id, 'That action is no longer available.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (action.status !== 'pending') {
            await tgAnswerCallback(cb.id, `Already ${action.status}.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else if (tappingUserId && tappingUserId !== action.user_id) {
            await tgAnswerCallback(cb.id, 'Only the person who asked Dori can confirm this.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else {
            const outcome = decision === 'confirm'
              ? await approveAndExecutePending(supabase, action, supabaseUrl, serviceKey)
              : await rejectPending(supabase, action.id, action.reason);

            await tgAnswerCallback(
              cb.id,
              decision === 'confirm' ? '✅ Done' : '❌ Cancelled',
              LOVABLE_API_KEY,
              TELEGRAM_API_KEY,
            );
            if (cbMessageId) {
              await tgEditMessageText(
                cbChatId,
                cbMessageId,
                outcome,
                LOVABLE_API_KEY,
                TELEGRAM_API_KEY,
              );
            } else {
              await sendMessage(cbChatId, outcome, LOVABLE_API_KEY, TELEGRAM_API_KEY);
            }
            try {
              await supabase.from('telegram_assistant_replies').insert({ chat_id: cbChatId, reply: outcome });
            } catch { /* ignore */ }
          }
        } else {
          await tgAnswerCallback(cb.id, '', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }

        await supabase
          .from('telegram_bot_state')
          .update({ update_offset: u.update_id + 1, updated_at: new Date().toISOString() })
          .eq('id', 1);
        currentOffset = u.update_id + 1;
        continue;
      }

      const msg = u.message;
      if (!msg) continue;

      // Per-update try/finally: once we've pulled an update from Telegram we
      // MUST advance the stored offset before this iteration ends, otherwise
      // an AI/router crash mid-batch replays the same message on the next
      // poll and the bot double-acts (extra tasks created, duplicate replies).
      try {

      const chatId = msg.chat.id;
      const chatType = msg.chat.type as string;

      // ---------- VOICE / AUDIO → transcribe via Gemini, then treat as text ----------
      let textFromVoice: string | null = null;
      if (!msg.text && (msg.voice || msg.audio)) {
        const v = msg.voice || msg.audio;
        const mime = v.mime_type || 'audio/ogg';
        try {
          await tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        } catch { /* ignore */ }
        textFromVoice = await transcribeTelegramVoice(v.file_id, mime, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        if (!textFromVoice) {
          await sendMessage(chatId, "🎙️ I couldn't understand that voice message. Try again or type it.", LOVABLE_API_KEY, TELEGRAM_API_KEY);
          await supabase.from('telegram_bot_state').update({ update_offset: u.update_id + 1, updated_at: new Date().toISOString() }).eq('id', 1);
          currentOffset = u.update_id + 1;
          continue;
        }
        // Inject transcript so the rest of the pipeline treats it as a text message
        msg.text = textFromVoice;
      }

      if (!msg.text) continue;

      // Track if original message was voice — used later to decide voice vs text reply
      const wasVoiceMessage = !!textFromVoice;


      const rawText: string = String(msg.text ?? '').trim();
      if (!rawText) continue;

      // Normalize: strip @botname suffix from commands so "/linkfamily@darai_bot CODE" works
      const text: string = rawText.replace(/^(\/[a-zA-Z_]+)@\w+/, '$1');
      const fromId = msg.from?.id;
      const fromUsername = msg.from?.username ?? null;
      const fromFirstName = msg.from?.first_name ?? null;
      const isGroup = chatType === 'group' || chatType === 'supergroup';

      console.log(`[telegram-poll] chat=${chatId} type=${chatType} from=${fromId} text="${text.slice(0, 80)}"`);

      // ---------- /start (private only — group link uses /linkfamily) ----------
      if (text.startsWith('/start') && !isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (code) {
          const { data: link } = await supabase.from('telegram_links').select('*').eq('link_code', code).maybeSingle();
          if (link && (!link.link_code_expires_at || new Date(link.link_code_expires_at) > new Date())) {
            await supabase.from('telegram_links').update({
              chat_id: chatId,
              telegram_username: fromUsername,
              telegram_first_name: fromFirstName,
              is_active: true,
              linked_at: new Date().toISOString(),
              link_code: null,
              link_code_expires_at: null,
            }).eq('id', link.id);
            // Also map this telegram user to the app user
            if (fromId) {
              await supabase.from('telegram_user_map').upsert({
                telegram_user_id: fromId,
                user_id: link.user_id,
                telegram_username: fromUsername,
                telegram_first_name: fromFirstName,
              }, { onConflict: 'telegram_user_id' });
            }
            await sendMessage(chatId, `✅ <b>Linked successfully!</b>\n\nHi ${fromFirstName ?? 'there'}, I'm Dori — your personal assistant.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
          } else {
            await sendMessage(chatId, '❌ This link code is invalid or expired.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
        } else {
          await sendMessage(chatId, '👋 Welcome! Open the Dori app → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }
        continue;
      }

      // ---------- /linkfamily <code> (group only) ----------
      if (text.startsWith('/linkfamily') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (!code) {
          await sendMessage(chatId, '⚠️ Usage: /linkfamily <code> — generate a code in Settings → Telegram → Family Group.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: glink } = await supabase.from('telegram_group_links').select('*').eq('link_code', code).maybeSingle();
        if (!glink || (glink.link_code_expires_at && new Date(glink.link_code_expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired family link code.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        await supabase.from('telegram_group_links').update({
          chat_id: chatId,
          title: msg.chat.title ?? 'Family Group',
          is_active: true,
          linked_at: new Date().toISOString(),
          link_code: null,
          link_code_expires_at: null,
        }).eq('id', glink.id);
        // Map the user who ran /linkfamily as the owner-side telegram identity
        if (fromId) {
          await supabase.from('telegram_user_map').upsert({
            telegram_user_id: fromId,
            user_id: glink.owner_user_id,
            telegram_username: fromUsername,
            telegram_first_name: fromFirstName,
          }, { onConflict: 'telegram_user_id' });
        }
        await sendMessage(chatId, `✅ <b>Family group linked!</b>\n\nWrite naturally — I'll save tasks, shopping items, and events for your shared space.\n\nYour partner should send <code>/linkme &lt;their-code&gt;</code> here so I know who's who.\nType /help for more commands.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // ---------- /linkme <personal-code> (group only — partner self-identifies) ----------
      if (text.startsWith('/linkme') && isGroup) {
        const parts = text.split(/\s+/);
        const code = parts[1];
        if (!code) {
          await sendMessage(chatId, '⚠️ Generate a personal link code in Settings → Telegram, then send: /linkme <code>', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        const { data: link } = await supabase.from('telegram_links').select('user_id, link_code_expires_at').eq('link_code', code).maybeSingle();
        if (!link || (link.link_code_expires_at && new Date(link.link_code_expires_at) < new Date())) {
          await sendMessage(chatId, '❌ Invalid or expired code.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          continue;
        }
        if (fromId) {
          await supabase.from('telegram_user_map').upsert({
            telegram_user_id: fromId,
            user_id: link.user_id,
            telegram_username: fromUsername,
            telegram_first_name: fromFirstName,
          }, { onConflict: 'telegram_user_id' });
        }
        await sendMessage(chatId, `✅ ${fromFirstName ?? 'You'} are now linked. Items you add will be tagged to you.`, LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // ---------- GROUP MESSAGES → router ----------
      if (isGroup) {
        const { data: glink } = await supabase
          .from('telegram_group_links')
          .select('owner_user_id')
          .eq('chat_id', chatId)
          .eq('is_active', true)
          .maybeSingle();
        // Wake-word matchers — broad to handle voice transcription variants
        // (Dori / Dory / Dorie / Doree / Dora / Dorai / Darai / DarAI / Tory / Lori etc.)
        const BOT_MENTION = /@\w*(darai|dori|dory|dora|tory|lori)\w*_?bot\b/i;
        const ADDRESSES_DORI = /^(hey\s+|hi\s+|hello\s+|ok\s+|okay\s+|yo\s+)?(dori|dory|dorie|doree|dora|dorai|darai|dar[\s-]?ai|tory|lori)\b[\s,.:;!?]?/i;
        const STRIP_MENTION = /@\w*(darai|dori|dory|dora|tory|lori)\w*_?bot\b/gi;
        const STRIP_ADDRESS = /^(hey\s+|hi\s+|hello\s+|ok\s+|okay\s+|yo\s+)?(dori|dory|dorie|doree|dora|dorai|darai|dar[\s-]?ai|tory|lori)\b[\s,.:;!?]*/i;

        if (!glink) {
          const hasMention = BOT_MENTION.test(rawText);
          const addressesDori = ADDRESSES_DORI.test(rawText.trim());
          if (rawText.startsWith('/') || hasMention || addressesDori) {
            await sendMessage(chatId, '🔒 This group is not linked yet. Generate a Family Group code in Settings → Telegram, then send /linkfamily <code> here.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
          }
          continue;
        }

        // Decide if Dori should respond. Stay silent on family chit-chat.
        const repliedToIsBot = msg.reply_to_message?.from?.is_bot === true;
        const hasMention = BOT_MENTION.test(rawText);
        const addressesDori = ADDRESSES_DORI.test(rawText.trim());
        const actionKeywords = /\b(buy|need|get|pick up|grab|remind|reminder|task|todo|to-do|schedule|meeting|appointment|event|tomorrow|today|tonight|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday|kaufen|brauchen|besorgen|erinner|termin|morgen|heute)\b/i;
        const looksActionable = actionKeywords.test(rawText);
        const isCommand = rawText.startsWith('/');
        // Voice/audio messages → always respond (user clearly meant to interact)
        const isVoice = !!(msg.voice || msg.audio);

        const shouldRespond = hasMention || addressesDori || repliedToIsBot || looksActionable || isCommand || isVoice;

        if (!shouldRespond) {
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }

        // Strip mention/address prefix before sending to router
        const cleanText = rawText
          .replace(STRIP_MENTION, '')
          .replace(STRIP_ADDRESS, '')
          .trim() || text;

        tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});

        try {
          await fetch(`${supabaseUrl}/functions/v1/telegram-router`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: cleanText,
              telegram_user_id: fromId,
              telegram_username: fromUsername,
              telegram_first_name: fromFirstName,
            }),
          });
        } catch (e) {
          console.error('router invoke failed', e);
          await sendMessage(chatId, '⚠️ Router unavailable, try again shortly.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        }

        await supabase.from('telegram_messages').upsert({
          update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
        }, { onConflict: 'update_id' });
        processed++;
        continue;
      }

      // ---------- 1:1 PRIVATE CHAT ----------
      const { data: link } = await supabase
        .from('telegram_links')
        .select('user_id, is_active')
        .eq('chat_id', chatId)
        .maybeSingle();

      if (!link || !link.is_active) {
        await sendMessage(chatId, '🔒 This chat isn\'t linked yet. Open Dori → Settings → Telegram to connect.', LOVABLE_API_KEY, TELEGRAM_API_KEY);
        continue;
      }

      // If the user has a pending confirmation and just replied "yes"/"no",
      // resolve it without another AI round.
      const confirm = classifyConfirmationText(text);
      if (confirm) {
        const pending = await fetchLatestPendingForChat(supabase, link.user_id, 'tg_private', String(chatId));
        if (pending) {
          const outcome = confirm === 'yes'
            ? await approveAndExecutePending(supabase, pending, supabaseUrl, serviceKey)
            : await rejectPending(supabase, pending.id, pending.reason);
          await sendDoriReply({
            chatId, text: outcome, preferVoice: wasVoiceMessage,
            lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
          });
          await supabase.from('telegram_messages').upsert({
            update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
          }, { onConflict: 'update_id' });
          processed++;
          continue;
        }
      }

      tg('sendChatAction', { chat_id: chatId, action: 'typing' }, LOVABLE_API_KEY, TELEGRAM_API_KEY).catch(() => {});
      const dori = await callDori(link.user_id, text, chatId, supabaseUrl, serviceKey);

      // Voice reply if user prefers OR if they sent a voice message
      let preferVoice = wasVoiceMessage;
      try {
        const supabaseForPref = createClient(supabaseUrl, serviceKey);
        const { data: ps } = await supabaseForPref.from('proactive_settings')
          .select('prefer_voice_replies').eq('user_id', link.user_id).maybeSingle();
        if (ps?.prefer_voice_replies) preferVoice = true;
      } catch (_) { /* ignore */ }

      const queued = dori.toolResults.filter((t) => t.queued && t.actionId);
      const executed = dori.toolResults.filter((t) => !t.queued);

      const bodyParts: string[] = [];
      if (dori.reply) bodyParts.push(dori.reply);
      if (executed.length > 0) bodyParts.push(executed.map((t) => t.message).join('\n'));
      const replyText = bodyParts.join('\n\n').trim();

      if (replyText) {
        await sendDoriReply({
          chatId, text: replyText, preferVoice,
          lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
        });
      }

      for (const q of queued) {
        const prompt = `🤔 <b>Please confirm</b>\n${q.summary || q.message}\n\nReply <b>yes</b> or tap a button below.`;
        await tgSendWithKeyboard(
          chatId,
          prompt,
          buildConfirmKeyboard(q.actionId!),
          LOVABLE_API_KEY,
          TELEGRAM_API_KEY,
        );
      }

      if (!replyText && queued.length === 0) {
        await sendDoriReply({
          chatId, text: "I processed that but didn't have anything to add.", preferVoice,
          lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
        });
      }

      await supabase.from('telegram_messages').upsert({
        update_id: u.update_id, chat_id: chatId, text, raw_update: u, processed: true,
      }, { onConflict: 'update_id' });
      processed++;
      } finally {
        // Even if the try-block above threw, advance the offset past this
        // update so we don't re-deliver it. We tolerate dropping a reply
        // far more than we tolerate duplicating actions.
        const nextOffset = u.update_id + 1;
        if (nextOffset > currentOffset) {
          currentOffset = nextOffset;
          try {
            await supabase
              .from('telegram_bot_state')
              .update({ update_offset: nextOffset, updated_at: new Date().toISOString() })
              .eq('id', 1);
          } catch (e) { console.error('offset persist failed', e); }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, processed, finalOffset: currentOffset }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
