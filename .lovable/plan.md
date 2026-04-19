
User wants a discoverability improvement in the Telegram bot: typing "Dori help" (or similar) should reveal all available slash commands and natural-language capabilities. Currently `/help` exists but is minimal and only triggers on exact slash match.

## Current state (verified from `telegram-router/index.ts`)
Existing slash commands: `/today`, `/agenda`, `/shopping`, `/list`, `/help`, `/start`, `/add <task>`, `/buy <item>`, `/linkme` (mentioned in help but not implemented in router).

`/help` text is short and doesn't show the full picture. Natural-language messages get routed to the Dori brain (chat function) with full tool access — but users don't know what to ask.

## Plan — Richer help & more discovery commands

### 1. Trigger expansion
Match help on any of: `/help`, `/start`, `/commands`, `/menu`, plus natural phrases — `dori help`, `dori commands`, `what can you do`, `help me`, `hilfe` (German). Case-insensitive substring check at top of router.

### 2. New rich help message
Replace current help with a categorized HTML message:
- **Quick info**: `/today`, `/agenda`, `/shopping`, `/week`, `/tomorrow`
- **Quick add**: `/add <task>`, `/buy <item>`, `/event <title @ time>`, `/note <text>`, `/remind <text>`
- **Family & people**: `/birthdays` (next 30 days), `/contacts <name>` (search), `/linkme`
- **Money & contracts**: `/contracts` (active list), `/expiring` (next 60 days), `/properties`, `/vehicles`
- **Health & wellbeing**: `/health` (today's metrics for household), `/mood`, `/checkin`
- **Email**: `/inbox` (priority unread), `/actions` (todos/payments/questions from email)
- **Islam**: `/prayers` (today's times), `/qibla`
- **Settings**: `/quiet on|off`, `/voice on|off` (toggle voice replies)
- **Natural language tip**: "Or just talk normally — 'add milk to shopping', 'what's Sarah doing tomorrow', 'draft an email to…'"

### 3. New slash commands to implement (read-only, fast)
Most of these just query existing tables and format a Telegram reply (mirrors how `/today` and `/shopping` already work). Add handlers for:
- `/week` — events + tasks for next 7 days, grouped by day, person-attributed for shared groups
- `/tomorrow` — same as `/today` but for tomorrow
- `/birthdays` — next 30 days from `user_contacts.birthday` across household
- `/contracts` + `/expiring` — pull from `contracts` table
- `/properties`, `/vehicles` — from respective tables
- `/health` — latest sleep/steps from household members (named)
- `/prayers` — today's prayer times (uses existing prayer-times function/data)
- `/inbox` + `/actions` — priority emails / pending email action items
- `/quiet on|off` + `/voice on|off` — toggle `proactive_settings` columns
- `/event <title> @ <time>` and `/remind <text>` — force routes (like existing `/add`/`/buy`)

Anything not recognized as a slash falls through to the Dori brain as today.

### 4. BotFather command list
Best-practice: also register the top commands with BotFather so Telegram shows an autocomplete menu when users type `/`. This is done via `setMyCommands` API call — add a tiny one-shot edge function `telegram-register-commands` that posts the command list to the gateway. Run once after deploy.

### 5. Localization
Help message bilingual (English + German short version) since user prefers German.

## Files to change
- `supabase/functions/telegram-router/index.ts` — expand help trigger detection, replace help text, add ~12 new slash handlers (each ~10–20 lines: query + format + send).
- `supabase/functions/telegram-register-commands/index.ts` (new) — one-time registration of BotFather command menu.
- No DB migration, no frontend changes.

## Out of scope
- Inline keyboards / buttons (Telegram supports them but adds complexity — can be follow-up).
- Per-user command customization.
- Voice-command parity for slash shortcuts.
