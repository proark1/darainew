// Classifies inbound Telegram group messages and writes to the right module.
// Called by telegram-poll for messages from a linked family group.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendDoriReply } from '../_shared/telegram-voice.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function tgSend(chatId: number, text: string) {
  try {
    await fetch(`${GATEWAY_URL}/sendMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'X-Connection-Api-Key': TELEGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch (e) {
    console.error('tgSend failed', e);
  }
}

// ─── Help / discoverability ──────────────────────────────────────────────
const HELP_TEXT = `<b>🤖 Dori — Family Assistant</b>

Just talk naturally — I'll save tasks, shopping, events to your shared space.

<b>📅 Schedule</b>
/today — today's agenda
/tomorrow — tomorrow's plan
/week — next 7 days
/agenda — same as /today

<b>➕ Quick add</b>
/add &lt;task&gt; — add a task
/buy &lt;item&gt; — add to shopping list
/event &lt;title&gt; @ &lt;time&gt; — create event
/note &lt;text&gt; — save a note
/remind &lt;text&gt; — set a reminder

<b>👨‍👩‍👧 Family &amp; people</b>
/birthdays — upcoming (30 days)
/contacts &lt;name&gt; — search contacts
/linkme — link your Telegram to Dori

<b>💶 Money &amp; assets</b>
/contracts — active contracts
/expiring — renewing in 60 days
/properties — your properties
/vehicles — your vehicles

<b>❤️ Health &amp; wellbeing</b>
/health — latest household metrics
/checkin — today's check-in status

<b>📧 Email</b>
/inbox — priority items
/actions — todos / payments / questions

<b>🕌 Islam</b>
/prayers — today's prayer times

<b>⚙️ Settings</b>
/quiet on|off — quiet hours
/voice on|off — voice replies

<i>Tip: just type "add milk to shopping", "what's Sarah doing tomorrow", or "draft an email to…"</i>

<b>🇩🇪 Tipp:</b> Schreib einfach normal — z.B. "Milch auf Einkaufsliste", "Termin morgen 14 Uhr Zahnarzt", "Was steht heute an?".`;

const HELP_TRIGGERS = [
  'dori help', 'dori commands', 'dori menu', 'dori was kannst du',
  'what can you do', 'help me', 'show commands', 'show menu',
  'hilfe', 'dori hilfe', 'was kannst du',
];

function isHelpRequest(lower: string): boolean {
  if (['/help', '/start', '/commands', '/menu'].includes(lower)) return true;
  if (lower.startsWith('/help') || lower.startsWith('/start')) return true;
  return HELP_TRIGGERS.some(t => lower.includes(t));
}

// ─── Household resolution ────────────────────────────────────────────────
async function getHouseholdMembers(supabase: any, ownerId: string, partnerId: string | null) {
  const ids = [ownerId, partnerId].filter(Boolean) as string[];
  const { data: profiles } = await supabase
    .from('profiles').select('user_id, display_name, email').in('user_id', ids);
  const map = new Map<string, string>();
  (profiles || []).forEach((p: any) => map.set(p.user_id, p.display_name || (p.email?.split('@')[0]) || 'Member'));
  return { ids, nameOf: (uid: string) => map.get(uid) || 'Member', multi: ids.length > 1 };
}

// ─── Slash command handlers ─────────────────────────────────────────────
async function handleAgenda(supabase: any, ids: string[], dayOffset = 0): Promise<string> {
  const start = new Date(); start.setDate(start.getDate() + dayOffset); start.setHours(0,0,0,0);
  const end = new Date(start); end.setHours(23,59,59,999);
  const label = dayOffset === 0 ? "Today" : dayOffset === 1 ? "Tomorrow" : start.toLocaleDateString('en-GB', { weekday: 'long' });

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events').select('title, start_time, location, user_id')
      .in('user_id', ids).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time'),
    supabase.from('tasks').select('title, due_date, user_id')
      .in('user_id', ids).eq('completed', false).eq('trashed', false)
      .gte('due_date', start.toISOString()).lte('due_date', end.toISOString())
      .order('due_date').limit(15),
  ]);

  const lines: string[] = [`<b>📅 ${label}'s agenda</b>`];
  if (events?.length) {
    lines.push('\n<b>Events</b>');
    events.forEach((e: any) => {
      const t = new Date(e.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      lines.push(`• ${t} — ${e.title}${e.location ? ` (${e.location})` : ''}`);
    });
  }
  if (tasks?.length) {
    lines.push('\n<b>Open tasks</b>');
    tasks.forEach((t: any) => lines.push(`• ${t.title}`));
  }
  if (!events?.length && !tasks?.length) lines.push('\nNothing scheduled — enjoy. ☕');
  return lines.join('\n');
}

async function handleWeek(supabase: any, ids: string[], household: any): Promise<string> {
  const start = new Date(); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(end.getDate() + 7); end.setHours(23,59,59,999);

  const [{ data: events }, { data: tasks }] = await Promise.all([
    supabase.from('events').select('title, start_time, user_id')
      .in('user_id', ids).gte('start_time', start.toISOString()).lte('start_time', end.toISOString())
      .order('start_time').limit(50),
    supabase.from('tasks').select('title, due_date, user_id')
      .in('user_id', ids).eq('completed', false).eq('trashed', false)
      .gte('due_date', start.toISOString()).lte('due_date', end.toISOString())
      .order('due_date').limit(30),
  ]);

  const byDay = new Map<string, string[]>();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

  (events || []).forEach((e: any) => {
    const d = new Date(e.start_time);
    const k = dayKey(d);
    const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const who = household.multi ? ` <i>(${household.nameOf(e.user_id)})</i>` : '';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(`• ${t} ${e.title}${who}`);
  });
  (tasks || []).forEach((t: any) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    const k = dayKey(d);
    const who = household.multi ? ` <i>(${household.nameOf(t.user_id)})</i>` : '';
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(`☑️ ${t.title}${who}`);
  });

  const out: string[] = ['<b>🗓 Next 7 days</b>'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const items = byDay.get(dayKey(d));
    if (items?.length) {
      out.push(`\n<b>${dayLabel(d)}</b>`);
      items.forEach(l => out.push(l));
    }
  }
  if (out.length === 1) out.push('\nNothing scheduled this week.');
  return out.join('\n');
}

async function handleShoppingList(supabase: any, ownerId: string): Promise<string> {
  const { data: lists } = await supabase.from('shopping_lists')
    .select('id, name').eq('user_id', ownerId).eq('is_completed', false)
    .order('created_at', { ascending: true });
  if (!lists?.length) return '🛒 No active shopping lists.';
  const out: string[] = [];
  for (const list of lists) {
    const { data: items } = await supabase.from('shopping_list_items')
      .select('name, quantity, is_checked').eq('list_id', list.id).eq('is_checked', false);
    out.push(`<b>🛒 ${list.name}</b>`);
    if (items?.length) items.forEach((i: any) => out.push(`• ${i.quantity > 1 ? `${i.quantity}× ` : ''}${i.name}`));
    else out.push('  (empty)');
  }
  return out.join('\n');
}

async function handleBirthdays(supabase: any, ids: string[], household: any): Promise<string> {
  const { data } = await supabase.from('contact_special_dates')
    .select('occurs_on, date_type, contact_id, user_id, user_contacts(name)')
    .in('user_id', ids).eq('date_type', 'birthday');
  if (!data?.length) return '🎂 No birthdays on file.';

  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = (data as any[])
    .map(d => {
      const orig = new Date(d.occurs_on);
      const next = new Date(today.getFullYear(), orig.getMonth(), orig.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const days = Math.round((next.getTime() - today.getTime()) / 86400000);
      return { ...d, next, days };
    })
    .filter(d => d.days <= 30)
    .sort((a, b) => a.days - b.days);

  if (!upcoming.length) return '🎂 No birthdays in the next 30 days.';
  const lines = ['<b>🎂 Upcoming birthdays</b>'];
  upcoming.forEach(b => {
    const name = b.user_contacts?.name || 'Unknown';
    const when = b.days === 0 ? 'today!' : b.days === 1 ? 'tomorrow' : `in ${b.days}d (${b.next.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`;
    const who = household.multi ? ` <i>— ${household.nameOf(b.user_id)}'s contact</i>` : '';
    lines.push(`• ${name}${who} — ${when}`);
  });
  return lines.join('\n');
}

async function handleContacts(supabase: any, ids: string[], query: string): Promise<string> {
  const q = query.trim();
  if (!q) return 'Usage: <code>/contacts &lt;name&gt;</code>';
  const { data } = await supabase.from('user_contacts')
    .select('name, phone, email, user_id').in('user_id', ids).ilike('name', `%${q}%`).limit(8);
  if (!data?.length) return `🔍 No contacts matching "${q}".`;
  const lines = [`<b>🔍 Contacts matching "${q}"</b>`];
  (data as any[]).forEach(c => {
    const bits = [c.name];
    if (c.phone) bits.push(c.phone);
    if (c.email) bits.push(c.email);
    lines.push(`• ${bits.join(' — ')}`);
  });
  return lines.join('\n');
}

async function handleContracts(supabase: any, ids: string[], expiringOnly: boolean): Promise<string> {
  let q = supabase.from('contracts').select('name, provider, cost_amount, cost_frequency, renewal_date, end_date, user_id')
    .in('user_id', ids).eq('is_active', true);
  if (expiringOnly) {
    const in60 = new Date(); in60.setDate(in60.getDate() + 60);
    q = q.or(`renewal_date.lte.${in60.toISOString().slice(0,10)},end_date.lte.${in60.toISOString().slice(0,10)}`);
  }
  const { data } = await q.order('renewal_date', { nullsFirst: false }).limit(20);
  if (!data?.length) return expiringOnly ? '✅ Nothing expiring in the next 60 days.' : '📄 No active contracts.';
  const title = expiringOnly ? '⏳ Expiring soon (60 days)' : '📄 Active contracts';
  const lines = [`<b>${title}</b>`];
  (data as any[]).forEach(c => {
    const cost = c.cost_amount ? ` — ${c.cost_amount}€${c.cost_frequency ? '/' + c.cost_frequency : ''}` : '';
    const due = c.renewal_date || c.end_date;
    const when = due ? ` (until ${new Date(due).toLocaleDateString('en-GB')})` : '';
    lines.push(`• ${c.name}${c.provider ? ` — ${c.provider}` : ''}${cost}${when}`);
  });
  return lines.join('\n');
}

async function handleProperties(supabase: any, ids: string[]): Promise<string> {
  const { data } = await supabase.from('properties')
    .select('name, property_type, city, country, current_value').in('user_id', ids).eq('is_active', true);
  if (!data?.length) return '🏠 No properties on file.';
  const lines = ['<b>🏠 Properties</b>'];
  (data as any[]).forEach(p => {
    const loc = [p.city, p.country].filter(Boolean).join(', ');
    const val = p.current_value ? ` — €${Number(p.current_value).toLocaleString()}` : '';
    lines.push(`• ${p.name} (${p.property_type})${loc ? ` — ${loc}` : ''}${val}`);
  });
  return lines.join('\n');
}

async function handleVehicles(supabase: any, ids: string[]): Promise<string> {
  const { data } = await supabase.from('vehicles')
    .select('name, make, model, year, license_plate, next_service_date, insurance_renewal').in('user_id', ids);
  if (!data?.length) return '🚗 No vehicles on file.';
  const lines = ['<b>🚗 Vehicles</b>'];
  (data as any[]).forEach(v => {
    const desc = [v.year, v.make, v.model].filter(Boolean).join(' ');
    const plate = v.license_plate ? ` [${v.license_plate}]` : '';
    const upcoming: string[] = [];
    if (v.next_service_date) upcoming.push(`service ${new Date(v.next_service_date).toLocaleDateString('en-GB')}`);
    if (v.insurance_renewal) upcoming.push(`insurance ${new Date(v.insurance_renewal).toLocaleDateString('en-GB')}`);
    lines.push(`• ${v.name}${desc ? ` — ${desc}` : ''}${plate}${upcoming.length ? `\n  ↳ ${upcoming.join(', ')}` : ''}`);
  });
  return lines.join('\n');
}

async function handleHealth(supabase: any, ids: string[], household: any): Promise<string> {
  const since = new Date(); since.setHours(0,0,0,0);
  const lines = ['<b>❤️ Today\'s health</b>'];
  let any = false;
  for (const uid of ids) {
    const { data } = await supabase.from('health_metrics')
      .select('metric_type, value, unit, recorded_at')
      .eq('user_id', uid).gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: false }).limit(20);
    if (!data?.length) continue;
    any = true;
    const latest = new Map<string, any>();
    (data as any[]).forEach(m => { if (!latest.has(m.metric_type)) latest.set(m.metric_type, m); });
    const prefix = household.multi ? `<b>${household.nameOf(uid)}</b> — ` : '';
    const bits = Array.from(latest.values()).map(m => `${m.metric_type}: ${m.value}${m.unit}`).join(', ');
    lines.push(`• ${prefix}${bits}`);
  }
  if (!any) lines.push('No metrics logged today yet.');
  return lines.join('\n');
}

async function handleCheckin(supabase: any, ids: string[], household: any): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('daily_checkins')
    .select('user_id, mood, energy_level, sleep_hours, day_rating, checkin_type')
    .in('user_id', ids).eq('checkin_date', today);
  if (!data?.length) return '📝 No check-ins logged today yet.';
  const lines = ['<b>📝 Today\'s check-ins</b>'];
  (data as any[]).forEach(c => {
    const prefix = household.multi ? `<b>${household.nameOf(c.user_id)}</b> ` : '';
    const bits: string[] = [];
    if (c.mood) bits.push(`mood ${c.mood}`);
    if (c.energy_level) bits.push(`energy ${c.energy_level}`);
    if (c.sleep_hours) bits.push(`sleep ${c.sleep_hours}h`);
    if (c.day_rating) bits.push(`rating ${c.day_rating}/10`);
    lines.push(`• ${prefix}(${c.checkin_type}) ${bits.join(', ') || '—'}`);
  });
  return lines.join('\n');
}

async function handleEmailActions(supabase: any, ids: string[], household: any, priorityOnly: boolean): Promise<string> {
  let q = supabase.from('email_classifications')
    .select('category, suggested_action, suggested_payload, user_id, created_at')
    .in('user_id', ids).eq('status', 'pending');
  if (priorityOnly) q = q.in('category', ['important', 'urgent', 'action_required']);
  const { data } = await q.order('created_at', { ascending: false }).limit(15);
  if (!data?.length) return priorityOnly ? '📭 Inbox clear.' : '✅ No pending email actions.';
  const lines = [`<b>${priorityOnly ? '📥 Priority inbox' : '📧 Email actions'}</b>`];
  (data as any[]).forEach(e => {
    const prefix = household.multi ? `<b>${household.nameOf(e.user_id)}</b> — ` : '';
    const subj = (e.suggested_payload as any)?.subject || (e.suggested_payload as any)?.from || e.suggested_action || e.category;
    lines.push(`• ${prefix}[${e.category}] ${subj}`);
  });
  return lines.join('\n');
}

async function handlePrayers(supabase: any, userId: string): Promise<string> {
  // Try invoking the prayer-times function; fall back gracefully.
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/prayer-times`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, date: new Date().toISOString().slice(0, 10) }),
    });
    if (r.ok) {
      const j = await r.json();
      const times = j.times || j;
      if (times && typeof times === 'object') {
        const lines = ['<b>🕌 Today\'s prayer times</b>'];
        ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(k => {
          const v = times[k] || times[k.charAt(0).toUpperCase() + k.slice(1)];
          if (v) lines.push(`• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
        });
        if (lines.length > 1) return lines.join('\n');
      }
    }
  } catch (e) { console.error('prayers fetch failed', e); }
  return '🕌 Prayer times unavailable right now. Check the Islam tab in the app.';
}

async function handleToggleSetting(
  supabase: any, userId: string, column: string, value: boolean, label: string
): Promise<string> {
  const { error } = await supabase.from('proactive_settings')
    .upsert({ user_id: userId, [column]: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return `⚠️ Could not update ${label}: ${error.message}`;
  return `✅ ${label} ${value ? 'enabled' : 'disabled'}.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = req.headers.get('Authorization') || '';
  if (auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { chat_id, text, telegram_user_id, telegram_first_name, telegram_username } = await req.json();

  // Resolve group → owner + partner
  const { data: group } = await supabase
    .from('telegram_group_links')
    .select('owner_user_id, partner_user_id')
    .eq('chat_id', chat_id).eq('is_active', true).maybeSingle();

  if (!group) {
    await tgSend(chat_id, '🔒 This group is not linked to a Dori family space yet.');
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  const household = await getHouseholdMembers(supabase, group.owner_user_id, group.partner_user_id);
  const memberIds = household.ids;

  // Resolve sender → app user
  let senderUserId: string | null = null;
  if (telegram_user_id) {
    const { data: mapped } = await supabase.from('telegram_user_map')
      .select('user_id').eq('telegram_user_id', telegram_user_id).maybeSingle();
    if (mapped) senderUserId = mapped.user_id;
  }
  const userForChat = senderUserId || group.owner_user_id;

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // ─── Help / discoverability ──────────────────────────────
  if (isHelpRequest(lower)) {
    await tgSend(chat_id, HELP_TEXT);
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Schedule ────────────────────────────────────────────
  if (lower === '/today' || lower === '/agenda') {
    await tgSend(chat_id, await handleAgenda(supabase, memberIds, 0));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/tomorrow') {
    await tgSend(chat_id, await handleAgenda(supabase, memberIds, 1));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/week') {
    await tgSend(chat_id, await handleWeek(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/shopping' || lower === '/list') {
    await tgSend(chat_id, await handleShoppingList(supabase, group.owner_user_id));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Family & people ─────────────────────────────────────
  if (lower === '/birthdays') {
    await tgSend(chat_id, await handleBirthdays(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower.startsWith('/contacts')) {
    await tgSend(chat_id, await handleContacts(supabase, memberIds, trimmed.slice(9).trim()));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/linkme') {
    if (!telegram_user_id) {
      await tgSend(chat_id, 'Could not read your Telegram ID — try again.');
    } else {
      await supabase.from('telegram_user_map').upsert({
        telegram_user_id, user_id: group.owner_user_id,
        telegram_username: telegram_username || null,
        telegram_first_name: telegram_first_name || null,
      }, { onConflict: 'telegram_user_id' });
      await tgSend(chat_id, `✅ Linked Telegram ID <code>${telegram_user_id}</code> to this family space.`);
    }
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Money & assets ──────────────────────────────────────
  if (lower === '/contracts') {
    await tgSend(chat_id, await handleContracts(supabase, memberIds, false));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/expiring') {
    await tgSend(chat_id, await handleContracts(supabase, memberIds, true));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/properties') {
    await tgSend(chat_id, await handleProperties(supabase, memberIds));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/vehicles') {
    await tgSend(chat_id, await handleVehicles(supabase, memberIds));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Health & wellbeing ──────────────────────────────────
  if (lower === '/health') {
    await tgSend(chat_id, await handleHealth(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/checkin' || lower === '/mood') {
    await tgSend(chat_id, await handleCheckin(supabase, memberIds, household));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Email ───────────────────────────────────────────────
  if (lower === '/inbox') {
    await tgSend(chat_id, await handleEmailActions(supabase, memberIds, household, true));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  if (lower === '/actions') {
    await tgSend(chat_id, await handleEmailActions(supabase, memberIds, household, false));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Islam ───────────────────────────────────────────────
  if (lower === '/prayers') {
    await tgSend(chat_id, await handlePrayers(supabase, userForChat));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Settings toggles ────────────────────────────────────
  const quietMatch = lower.match(/^\/quiet\s+(on|off)$/);
  if (quietMatch) {
    await tgSend(chat_id, await handleToggleSetting(
      supabase, userForChat, 'quiet_hours_enabled', quietMatch[1] === 'on', 'Quiet hours'));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }
  const voiceMatch = lower.match(/^\/voice\s+(on|off)$/);
  if (voiceMatch) {
    await tgSend(chat_id, await handleToggleSetting(
      supabase, userForChat, 'prefer_voice_replies', voiceMatch[1] === 'on', 'Voice replies'));
    return new Response('{"ok":true}', { headers: corsHeaders });
  }

  // ─── Force-route shortcuts ───────────────────────────────
  let forcedPrefix: string | null = null;
  let payloadText = trimmed;
  if (lower.startsWith('/add ')) { forcedPrefix = 'Add task: '; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/buy ')) { forcedPrefix = 'Add to shopping: '; payloadText = trimmed.slice(5); }
  else if (lower.startsWith('/event ')) { forcedPrefix = 'Create event: '; payloadText = trimmed.slice(7); }
  else if (lower.startsWith('/note ')) { forcedPrefix = 'Save note: '; payloadText = trimmed.slice(6); }
  else if (lower.startsWith('/remind ')) { forcedPrefix = 'Set reminder: '; payloadText = trimmed.slice(8); }

  // Build short conversation history
  const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const [{ data: priorUserMsgs }, { data: priorReplies }] = await Promise.all([
    supabase.from('telegram_messages').select('text, created_at')
      .eq('chat_id', chat_id).gte('created_at', sinceIso).not('text', 'is', null)
      .order('created_at', { ascending: true }).limit(20),
    supabase.from('telegram_assistant_replies').select('reply, created_at')
      .eq('chat_id', chat_id).gte('created_at', sinceIso)
      .order('created_at', { ascending: true }).limit(20),
  ]);

  type Turn = { role: 'user' | 'assistant'; content: string; ts: number };
  const turns: Turn[] = [];
  (priorUserMsgs || []).forEach((m: any) => {
    if (m.text && m.text.trim() && m.text.trim() !== trimmed) {
      turns.push({ role: 'user', content: m.text, ts: new Date(m.created_at).getTime() });
    }
  });
  (priorReplies || []).forEach((r: any) => {
    if (r.reply) turns.push({ role: 'assistant', content: r.reply, ts: new Date(r.created_at).getTime() });
  });
  turns.sort((a, b) => a.ts - b.ts);
  const recent = turns.slice(-12);

  const finalUserContent = forcedPrefix ? `${forcedPrefix}${payloadText}` : trimmed;
  const conversationMessages = [
    ...recent.map(t => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: finalUserContent },
  ];

  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'x-telegram-user-id': userForChat,
        'x-dori-channel': 'tg_family',
        'x-dori-channel-ref': String(chat_id),
      },
      body: JSON.stringify({
        messages: conversationMessages, personality: 'balanced', executeServerSide: true,
      }),
    });

    if (!r.ok) {
      await tgSend(chat_id, "Sorry, I couldn't reach Dori right now.");
      return new Response('{"ok":true}', { headers: corsHeaders });
    }

    const json = await r.json();
    const reply = (json.reply || '').trim();
    const toolResults = (json.toolResults || []) as { ok: boolean; message: string }[];

    const parts: string[] = [];
    if (reply) parts.push(reply);
    if (toolResults.length > 0) parts.push(toolResults.map(t => t.message).join('\n'));
    const finalMsg = parts.join('\n\n').trim() || 'Got it.';

    try {
      await supabase.from('telegram_assistant_replies').insert({ chat_id, reply: finalMsg });
    } catch (e) { console.error('Failed to persist assistant reply', e); }

    let preferVoice = false;
    try {
      const prefUser = senderUserId || group.owner_user_id;
      const { data: ps } = await supabase.from('proactive_settings')
        .select('prefer_voice_replies').eq('user_id', prefUser).maybeSingle();
      preferVoice = !!ps?.prefer_voice_replies;
    } catch (_) { /* ignore */ }

    await sendDoriReply({
      chatId: chat_id, text: finalMsg.slice(0, 4000), preferVoice,
      lovableKey: LOVABLE_API_KEY, telegramKey: TELEGRAM_API_KEY,
    });
    return new Response('{"ok":true}', { headers: corsHeaders });
  } catch (e) {
    console.error('router error', e);
    await tgSend(chat_id, '⚠️ Something went wrong.');
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { headers: corsHeaders });
  }
});
