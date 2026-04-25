// Sends Islamic event reminders via Telegram (Eid, Ramadan, Day of Arafah, etc.)
// Scheduled: runs daily to check for upcoming events
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Islamic events with approximate Gregorian dates
const ISLAMIC_EVENTS = [
  {
    name: 'Isra and Mi\'raj',
    monthDay: '02-07', // Feb 7 (27 Rajab)
    hijriDate: '27 Rajab',
    description: 'The miraculous Night Journey from Makkah to Jerusalem and ascension to the heavens.',
    type: 'major',
  },
  {
    name: 'Shab-e-Barat (Mid-Sha\'ban)',
    monthDay: '02-24', // Feb 24 (15 Sha\'ban)
    hijriDate: '15 Sha\'ban',
    description: 'Night of Forgiveness - a blessed night to seek Allah\'s forgiveness.',
    type: 'remembrance',
  },
  {
    name: 'Ramadan Begins',
    monthDay: '03-10', // Mar 10 (1 Ramadan)
    hijriDate: '1 Ramadan',
    description: 'The blessed month of fasting, revelation of Quran, and spiritual renewal.',
    type: 'major',
  },
  {
    name: 'Laylat al-Qadr (27th Night)',
    monthDay: '04-06', // Apr 6 (27 Ramadan)
    hijriDate: '27 Ramadan',
    description: 'The Night of Power - better than 1000 months. Worship this night equals 83+ years of worship.',
    type: 'major',
  },
  {
    name: 'Eid al-Fitr',
    monthDay: '04-09', // Apr 9 (1 Shawwal)
    hijriDate: '1 Shawwal',
    description: 'Festival of Breaking the Fast - celebrating completion of Ramadan.',
    type: 'major',
  },
  {
    name: 'Day of Arafah',
    monthDay: '06-15', // Jun 15 (9 Dhu al-Hijjah)
    hijriDate: '9 Dhu al-Hijjah',
    description: 'The best day of the year. Fasting expiates sins of the previous and coming year.',
    type: 'fasting',
  },
  {
    name: 'Eid al-Adha',
    monthDay: '06-16', // Jun 16 (10 Dhu al-Hijjah)
    hijriDate: '10 Dhu al-Hijjah',
    description: 'Festival of Sacrifice commemorating Prophet Ibrahim\'s willingness to sacrifice his son.',
    type: 'major',
  },
  {
    name: 'Islamic New Year',
    monthDay: '07-07', // Jul 7 (1 Muharram)
    hijriDate: '1 Muharram',
    description: 'Beginning of the sacred month of Muharram and new Hijri year.',
    type: 'major',
  },
  {
    name: 'Day of Ashura',
    monthDay: '07-16', // Jul 16 (10 Muharram)
    hijriDate: '10 Muharram',
    description: 'Day Allah saved Musa (Moses) and the Israelites from Pharaoh.',
    type: 'fasting',
  },
  {
    name: 'Mawlid al-Nabi',
    monthDay: '09-15', // Sep 15 (12 Rabi\' al-Awwal)
    hijriDate: '12 Rabi\' al-Awwal',
    description: 'Birth of Prophet Muhammad ﷺ - time to send blessings upon him.',
    type: 'major',
  },
];

async function sendTelegramMessage(chatId: number, text: string, lovableKey: string, telegramKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://connector-gateway.lovable.dev/telegram/sendMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
    return response.ok;
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
    return false;
  }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
    const telegramKey = Deno.env.get('TELEGRAM_API_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const [year, month, day] = todayStr.split('-');
    const monthDay = `${month}-${day}`;
    const todayDate = new Date(todayStr);

    // Helper to check if event is within user's notification window
    const isEventInReminderWindow = (eventDateStr: string, hoursBefore: number): boolean => {
      const eventDate = new Date(eventDateStr);
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntilEvent > 0 && hoursUntilEvent <= hoursBefore;
    };

    // Find events within reminder windows (respecting user's hours_before preference)
    // For now, we check all events that occur within the next 48 hours
    // TODO: Use a Hijri calendar library to dynamically calculate Islamic dates
    // Current implementation uses static Gregorian approximations which shift ~11 days/year
    const upcomingEvents: typeof ISLAMIC_EVENTS = [];
    for (const event of ISLAMIC_EVENTS) {
      // Parse event date (MM-DD format)
      const [eventMonth, eventDay] = event.monthDay.split('-');
      const eventDate = new Date(new Date().getFullYear(), parseInt(eventMonth) - 1, parseInt(eventDay));

      // Check if event is within the next 48 hours (to cover various reminder windows)
      const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntilEvent > 0 && hoursUntilEvent <= 48) {
        upcomingEvents.push(event);
      }
    }

    if (upcomingEvents.length === 0) {
      return new Response(JSON.stringify({ message: 'No events within reminder window' }), { status: 200 });
    }

    // Get all users with event reminders enabled
    const { data: users, error: usersErr } = await admin
      .from('islamic_notification_settings')
      .select('user_id, events_enabled, events_hours_before, notification_language')
      .eq('events_enabled', true);

    if (usersErr) {
      console.error('Failed to fetch users:', usersErr);
      return new Response(JSON.stringify({ error: usersErr.message }), { status: 500 });
    }

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: 'No users with event reminders enabled' }), { status: 200 });
    }

    let sentCount = 0;
    let failedCount = 0;

    // Process users in parallel with concurrency limit
    const CONCURRENCY_LIMIT = 5;
    for (let i = 0; i < users.length; i += CONCURRENCY_LIMIT) {
      const batch = users.slice(i, i + CONCURRENCY_LIMIT);

      await Promise.all(batch.map(async (userSettings) => {
        try {
          for (const upcomingEvent of upcomingEvents) {
            // Parse event date
            const [eventMonth, eventDay] = upcomingEvent.monthDay.split('-');
            const eventDate = new Date(new Date().getFullYear(), parseInt(eventMonth) - 1, parseInt(eventDay));

            // Check if event is in user's reminder window
            if (!isEventInReminderWindow(eventDate.toISOString().split('T')[0], userSettings.events_hours_before)) {
              continue;
            }

            // Check if notification was already sent for this event and user
            const { data: alreadySent } = await admin
              .from('islamic_event_notifications_sent')
              .select('id')
              .eq('user_id', userSettings.user_id)
              .eq('event_name', upcomingEvent.name)
              .eq('event_date', eventDate.toISOString().split('T')[0])
              .limit(1);

            if (alreadySent && alreadySent.length > 0) {
              continue; // Already sent
            }

            // Get user's Telegram link
            const { data: telegramLink } = await admin
              .from('telegram_links')
              .select('chat_id, is_active')
              .eq('user_id', userSettings.user_id)
              .eq('is_active', true)
              .maybeSingle();

            if (!telegramLink || !telegramLink.chat_id) {
              continue; // No active Telegram link
            }

            // Format message with emoji based on type
            const emoji = upcomingEvent.type === 'major' ? '⭐' : upcomingEvent.type === 'fasting' ? '🌙' : '✨';

            const message = `
${emoji} <b>${upcomingEvent.name}</b>

<b>${upcomingEvent.hijriDate}</b>

${upcomingEvent.description}

Prepare your heart and increase your worship on this blessed day.
`.trim();

            // Send message
            const sent = await sendTelegramMessage(
              telegramLink.chat_id as number,
              message,
              lovableKey,
              telegramKey
            );

            if (sent) {
              // Record that notification was sent
              await admin.from('islamic_event_notifications_sent').insert({
                user_id: userSettings.user_id,
                event_name: upcomingEvent.name,
                event_date: eventDate.toISOString().split('T')[0],
              });
              sentCount++;
            } else {
              failedCount++;
            }
          }
        } catch (e) {
          console.error(`Error processing user ${userSettings.user_id}:`, e);
          failedCount++;
        }
      }));
    }

    console.log(`Event reminders processed: ${sentCount} sent, ${failedCount} failed for ${upcomingEvents.length} events`);
    return new Response(
      JSON.stringify({ success: true, events: upcomingEvents.length, sent: sentCount, failed: failedCount }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in islamic-event-reminders:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
