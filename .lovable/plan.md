
The user wants to make Dori (the AI assistant) more intelligent and proactive — specifically, things like alerting them about upcoming meetings, briefing them ahead of time, and helping "sort things out." The platform already has a lot of building blocks (proactive-assistant function, daily voice briefing, smart nudges, event notifications, calendar). The gap is tying them together into a tighter, more anticipatory Dori experience.

Let me focus on what would actually move the needle — high-impact, ADHD-friendly proactive intelligence layered on what already exists, not net-new modules.

# Plan: Make Dori Truly Proactive

## Goal
Turn Dori from a reactive chat assistant into an anticipatory partner that warns about upcoming meetings, briefs you with context before they start, surfaces what matters next, and learns from your patterns.

## What we'll add

### 1. Pre-Meeting Briefing (the headline feature)
Dori proactively pings 15 / 5 / 1 minutes before each calendar event with:
- Event title, time, location/link
- Who you're meeting (pulled from contacts: last interaction, notes, related emails)
- Related tasks, notes, or contracts tied to that contact/topic
- A 1-line AI-generated "what to remember" summary
- Quick actions: Join call · Snooze · Mark prepared · Open notes

Delivered through:
- In-app toast + Dori notification icon
- Optional voice announcement ("Asad, your meeting with X starts in 5 minutes…")
- Optional Telegram message (since bot is now linked)

### 2. "Next Up" Live Strip in Dori Panel
A persistent top strip in the Dori panel showing the next 1–2 events/tasks with countdown. Always visible when Dori is open, so context is one glance away.

### 3. Smart Pre-Meeting Prep (10 min before)
Edge function `meeting-prep` runs ~10 min before any meeting and generates a short prep card:
- Last 3 emails / messages with that contact
- Open shared tasks
- Notes tagged with their name
- Suggested talking points (AI)
Stored in `user_notifications` so it appears in the dashboard + Dori panel.

### 4. Proactive Conflict & Overload Detection
- Back-to-back meetings → suggest 5-min buffer
- No lunch block → suggest one
- Overloaded day (>threshold from settings) → morning warning
- Travel time between locations → leave-by alert

### 5. End-of-Meeting Follow-Up
After event ends, Dori asks (in-app + Telegram):
- "How did the meeting with X go?"
- One-tap: log outcome, create follow-up task, schedule next touchpoint, add note

### 6. Cross-Module Stitching
Make Dori actually use what's already there:
- Pull contact tier + last interaction into briefings
- Pull related contracts (e.g. meeting with vendor → show contract status)
- Pull mood/energy → adjust tone ("low energy day — keep it light")

### 7. Telegram parity
Mirror critical proactive alerts (meeting in 5 min, daily briefing, end-of-day review) to Telegram so Dori reaches you outside the app.

## Technical approach

- **New edge function** `meeting-prep`: runs on cron every 5 min, scans upcoming events in next 15 min, generates prep card via Lovable AI (`google/gemini-3-flash-preview`), inserts into `user_notifications`, optionally pushes via Telegram + push.
- **Extend `proactive-assistant`**: add conflict/overload/travel-buffer rules.
- **New component** `MeetingBriefingCard.tsx`: rich notification card with quick actions.
- **Extend `DoriPanel`**: add "Next Up" live strip at top.
- **New cron job** (pg_cron + pg_net) every 5 minutes hitting `meeting-prep`.
- **End-of-meeting trigger**: small edge function `meeting-followup` cron'd to detect just-ended events and send follow-up prompt.
- **Telegram delivery**: reuse existing Telegram connector via gateway to push proactive messages to linked users.
- **Settings**: extend `proactive_settings` with `meeting_briefing_minutes` (default `[15, 5, 1]`), `meeting_followup_enabled`, `telegram_proactive_enabled`.

## What we won't do (yet)
- No new top-level navigation
- No new database tables beyond settings columns + reuse of `user_notifications`
- No replacing existing daily briefing — this layers on top

## Out-of-scope for this round
- Full calendar AI rescheduling (separate feature)
- Voice two-way conversational meeting prep (later, on top of this)

## Verification
- Create a test event 15 min out → confirm briefing fires at 15/5/1 min
- Confirm Telegram echo arrives
- Confirm "Next Up" strip updates in Dori panel
- Confirm follow-up prompt appears after event end
- Confirm settings toggles disable each channel
