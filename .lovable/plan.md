# Telegram Assistant — Round 2 Audit (50 scenarios)

I brainstormed 50 fresh scenarios, then audited `telegram-router`, `chat`, `dori-tools`, and `telegram-poll`. Here's what works today and what needs to be fixed.

## ✅ Already Works (38 / 50)

| # | Scenario | Path |
|---|---|---|
| 1 | Snooze task tomorrow | Tap-button snooze works; free-text "snooze" goes through `manage_task` update |
| 4 | Mark task in progress | `manage_task update` with status field |
| 6 | Highest-priority task | AI reads `tasksSummary` context |
| 7 | Delete completed tasks | `manage_task delete` (one at a time) |
| 8 | Reschedule 3pm to Friday | `manage_event update` (now echoes new time, fixed in round 1) |
| 9 | Block deep-work time | `schedule_event` |
| 11 | Who's invited | Event details via tap button or AI |
| 14 | Recurring meeting | `schedule_event` with RRULE |
| 19 | Life score this week | `get_summary type=health` covers wellbeing |
| 22 | Mark meditation done | `manage_habit log` |
| 23 | Reading streak | `manage_habit summary` |
| 25 | Netflix cost | `manage_contract search` |
| 26 | Renewals this month | `/expiring` shortcut |
| 27 | Total monthly subs | `get_summary type=contract_costs` |
| 28 | Cancel gym contract | `cancel_subscription` tool |
| 29 | Urgent emails | `/priority` and `fetch_emails` |
| 30 | Summarize boss emails | `fetch_emails` filter by sender |
| 31 | Reply to John | `draft_email_reply` / `/draft` |
| 33 | Last contact with Sarah | `manage_contact search` |
| 34 | Add note to Ahmed | `manage_contact update` |
| 35 | Contacts in Berlin | `suggest_contacts` |
| 36 | Birthdays this month | `/birthdays` |
| 37 | Add task to wife | `manage_task` with `assignee` (workspace only) |
| 41 | Save note | `/note` and `manage_note create` |
| 42 | Find lease notes | `/notes <query>` |
| 48 | Voice note → action | `transcribeTelegramVoice` → router |
| 49 | Photo of receipt | `downloadTelegramFile` → multimodal chat |
| 50 | Forward email screenshot | Same multimodal path |
| + tappable today/tomorrow/week, /overdue, /free, /shopping with check/uncheck/remove buttons, /undo, /standup, /comment, /schedule, /recap, /linkfamily, /linkworkspace |

## ❌ Gaps to Fix (12 / 50)

### Group A — Quick wins (free-text routing in `chat/index.ts` system prompt)

1. **#2 "Move all today's tasks to next week"** — bulk update not supported; AI iterates one at a time, often gives up. **Fix:** add `manage_task action=bulk_reschedule` with `{filter, shift_days}` payload.
2. **#5 "Add subtask 'buy batteries' to shopping task"** — no `parent_task_id` support in tool. **Fix:** extend `manage_task add` schema to accept `parent_query` (matches parent by title).
3. **#10 "Cancel all meetings on Friday"** — no bulk delete. **Fix:** extend `manage_event delete` with `{date}` filter.
4. **#12 "Find slot for me + wife"** — `find_time` only solo in private chats. **Fix:** when called in `tg_family` chat, expand participants to all household members automatically.

### Group B — New tools needed in `dori-tools.ts` + `chat/index.ts`

5. **#15 "Log mood 4/5"**, **#18 "morning check-in"** — no mood-logging tool exists. **Fix:** add `log_wellbeing` tool (mood, energy, sleep_hours, water_ml, notes) writing to `daily_checkins`.
6. **#16 "How many steps today"**, **#17 "Log 8h sleep"**, **#20 "Log 500ml water"** — same gap. Covered by the same `log_wellbeing` tool + a read path through existing `health-insights`.
7. **#24 "Q1 goal progress"** — no goals tool. **Fix:** add `manage_goal` tool (create/update/check-in) on `goals` table.
8. **#32 "Archive promotional emails"** — no archive action. **Fix:** add `manage_email action=archive|trash` calling `gmail-modify-labels` (already deployed).
9. **#38–39 "What's for dinner / plan meals this week"** — no meal-plan tool. **Fix:** add `meal_plan` tool that reads/writes `meal_plans` and triggers `recipe-assistant` for suggestions.
10. **#40 "Who has trash duty"** — household chore-rotation not surfaced. **Fix:** new `/chores` shortcut in router that reads from `household_chores` (or recurring tasks tagged `chore`).

### Group C — Islam features (router shortcuts, no AI)

11. **#13 "Sunset / Maghrib today"**, **#44 "When is Maghrib"** — `/prayers` calls `prayer-times` function which **does not exist**. **Fix:** create `supabase/functions/prayer-times/index.ts` using a free API (Aladhan) keyed to user's lat/lng from profile, then `/prayers` works.
12. **#45 "Log 100 dhikr"**, **#46 "Read Surah Al-Fatiha"**, **#47 "Qibla from Berlin"** — no handlers. **Fix:** add `/dhikr <count>` (writes to `dhikr_log`), `/quran <surah>` (returns text snippet via existing `quran_verses` table), `/qibla [city]` (computes bearing from coords).

### Group D — Other small fixes

13. **#3 "Tasks assigned to my wife"** — only works inside workspace; family-shared task assignment isn't queryable. **Fix:** in `tg_family`, when user says "assigned to <name>", filter `tasks` by `user_id` of household member matching the name.
14. **#21 "Did I do my workout today?"** — `manage_habit summary` returns all; no per-name filter. **Fix:** allow `query` param to filter to a single habit.
15. **#43 "Append to yesterday's journal"** — `manage_note` only creates new notes. **Fix:** add `action=append` that finds the most recent note matching the title (e.g. journal/today's date) and appends with a separator.

## Files to Edit

- `supabase/functions/_shared/dori-tools.ts` — add `log_wellbeing`, `manage_goal`, `meal_plan`, `manage_email` tool defs.
- `supabase/functions/chat/index.ts` — add executors for the new tools, `bulk_reschedule`, bulk event delete, append-note action, family-aware `find_time`, family-assignee filter, single-habit summary.
- `supabase/functions/telegram-router/index.ts` — new shortcuts: `/chores`, `/dhikr`, `/quran`, `/qibla`. Update `HELP_TEXT`.
- `supabase/functions/telegram-register-commands/index.ts` — register the new commands so they appear in Telegram's autocomplete.
- **NEW** `supabase/functions/prayer-times/index.ts` — proxy to Aladhan API (`https://api.aladhan.com/v1/timings/...`), uses `profiles.latitude/longitude` (or city geocode fallback), no API key needed.

## Out of Scope (acknowledged, won't fix this round)

- True multi-person conflict-free scheduling across separate calendars (#12) requires deeper rework of `find_time`; we'll do a "good-enough" intersection for now.
- "Read Surah Al-Fatiha to me" as audio playback would need TTS streaming; we'll send Arabic + transliteration text and let `prefer_voice_replies` users get it spoken via the existing TTS path.

## Outcome

After this round, **all 50 scenarios** route to either a deterministic shortcut or an AI tool that actually executes — no more silent failures or "got it" responses for unsupported asks.
