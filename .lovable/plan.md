
The user wants to turn DarAI + Telegram into a true shared family assistant for him and his wife. Key needs:

1. Shared space with wife (already partially supported via space_members + space_share_settings + sharing settings).
2. A shared Telegram **group** where Dori talks to both of them — not just two separate 1:1 chats.
3. In that group: Dori reminds them of meetings, tasks, shopping, school events, etc.
4. Either of them can write into the group ("buy milk tomorrow", "dentist Friday 4pm") and Dori parses → stores in the right module (tasks, shopping list, calendar) for the shared space.
5. Meeting prep should look up history with the same contact (last meeting notes, last emails, open tasks).
6. Everything that exists in the platform should be reachable/usable via Telegram.

Current state I already know from history + memory:
- Telegram is connected via connector, `telegram-poll` works, `telegram_links` maps a single user_id ↔ chat_id, `chat` function handles the AI reply.
- `meeting-prep` and `meeting-followup` exist and can push to Telegram per user.
- `push-delivery` mirrors notifications to Telegram per user.
- Space sharing already exists (`space_members`, `space_share_settings`) with granular per-category toggles.
- Brain Dump + AI parsing already turn free text into tasks.

Gaps to close:
- `telegram_links` is per-user/personal chat only. We need a **family/group chat link** that:
  - links a Telegram group chat to a *shared space* (owner + accepted member),
  - so any message from either spouse in that group routes to Dori with shared context,
  - and Dori's outbound proactive messages for either spouse's items also go to the group.
- Inbound parsing in `telegram-poll` currently treats text as a chat prompt only. Needs an intent classifier: shopping item, task, event, note, question → write to DB in the shared space, then confirm in group.
- Meeting prep needs to also pull "last meeting / last interaction with this contact" (we have `contact_interactions` already used by CRM).
- Outbound proactive functions (`meeting-prep`, `meeting-followup`, `push-delivery`) need to additionally target the family group chat when the user has one linked, and label which spouse it's about.

# Plan: Shared Family Assistant on Telegram

## Goal
Make Dori a true shared family assistant for Asad + wife, fully usable from one shared Telegram group, with intelligent capture and proactive briefings drawing on the whole platform.

## What we'll build

### 1. Family group link
- New table `telegram_group_links`: `id, owner_user_id, partner_user_id (nullable), space_member_id (nullable), chat_id (group), title, created_at`.
- New flow in Settings → Telegram: "Connect Family Group"
  - Generates a one-time token like personal link, but for groups.
  - User adds the bot to the Telegram group, types `/linkfamily <token>`; poller detects group chat + command → links group to that user (and their accepted space partner).
- Group can be linked to a shared space so both spouses' shared data is in scope.

### 2. Inbound: smart capture from the group
Extend `telegram-poll` (or a new `telegram-router` function it calls) to:
- Detect chat type. For group chats with a `telegram_group_links` row, route differently than 1:1.
- Resolve sender (Telegram user id → which spouse) via a new `telegram_user_map` (telegram_user_id ↔ app user_id). Built automatically when each spouse runs `/linkme` in the group.
- Send the message + lightweight context to a small classifier (Lovable AI, Gemini Flash) returning one of:
  - `task` { title, due, category }
  - `shopping_item` { item, quantity, list }
  - `event` { title, start, end, location, attendees }
  - `note` { title, body, tags }
  - `question` (default → existing chat assistant)
- Write to the correct table under the **owner's user_id of the linked space**, mark `created_via='telegram_group'`, `created_by_partner=true|false`.
- Reply in group with a short confirmation + inline buttons (Undo / Edit / Open).

### 3. Outbound: group-aware proactive messages
- Add helper `sendToFamily(ownerUserId, text)` used by:
  - `meeting-prep` (briefings 15/5/1 min)
  - `meeting-followup`
  - `push-delivery` (task/contract/contact/shopping reminders)
  - `morning-briefing` and `daily-voice-briefing` (text mirror)
- Logic: if owner has a `telegram_group_links.chat_id`, send there (prefixed with "👤 Asad" or "👤 [wife]" so it's clear who it's about). Fall back to personal chat if no group.
- New per-user toggle in `proactive_settings`: `telegram_group_enabled` (default true if group exists).

### 4. Smarter meeting prep with relationship history
Extend `meeting-prep` to, for each event:
- Match attendees / event title against `user_contacts`.
- Pull from `contact_interactions` and notes:
  - last meeting date + summary,
  - last 3 emails subject lines (via existing email tables),
  - open shared tasks tagged with that contact,
  - any notes mentioning them.
- Feed all of that as compact context to the AI; output briefing now includes a "Recap with [Name]" section.

### 5. "Everything on Telegram" command surface
Add a small command set the poller understands inside the family group:
- `/today` → today's agenda for both spouses (shared events + tasks).
- `/shopping` → current shopping list.
- `/add ...` → force-add as task.
- `/buy ...` → force-add to default shopping list.
- `/meeting <name>` → on-demand prep card for next meeting with that person.
- Plain text without a slash still goes through the classifier (#2) so it stays natural.

### 6. Settings UI
- In `TelegramConnectPanel`: add "Family Group" section showing linked group, who's mapped (Asad ✓, wife ✗), instructions, unlink button.
- In `ProactiveSettingsPanel`: add toggles for "Send to family group" and "Label messages with whose item it is".

## Technical approach
- **Schema (migration)**:
  - `telegram_group_links` table (RLS: owner can manage; partner can read).
  - `telegram_user_map` table (telegram_user_id ↔ user_id), unique per telegram_user_id.
  - Add columns to relevant tables (`tasks`, `shopping_list_items`, `events`, `notes`): `created_via text`, `created_by_telegram_user_id bigint nullable`.
  - Add `telegram_group_enabled boolean default true` to `proactive_settings`.
- **Edge functions**:
  - Update `telegram-poll`: handle group chats, `/linkfamily`, `/linkme`, slash commands, dispatch to new `telegram-router`.
  - New `telegram-router`: classify intent + write to DB + send confirmation.
  - Update `meeting-prep`, `meeting-followup`, `push-delivery`: use `sendToFamily` helper.
  - Extend `meeting-prep` context with contact history.
- **Frontend**:
  - Update `TelegramConnectPanel` with group flow.
  - Update `ProactiveSettingsPanel` with new toggles.
- **Reuse**:
  - Existing `telegram` connector + gateway send helper.
  - Existing space sharing (no new sharing model).
  - Existing AI gateway (`google/gemini-3-flash-preview` for classifier — cheap + fast).

## What we won't do
- No new chat platform (WhatsApp/iMessage).
- No replacing the personal 1:1 Telegram link — both keep working in parallel.
- No multi-tenant family beyond owner + 1 partner in this round (extensible later).

## Verification
- Connect a Telegram group, both spouses run `/linkme`.
- From group: "buy milk and eggs tomorrow" → appears on shared shopping list, group reply confirms.
- From group: "dentist Friday 4pm" → event added to shared calendar, both see it.
- Create a calendar event with a known contact 15 min out → group gets briefing with "Recap with [Name]" section.
- After event ends → group gets follow-up prompt; tap "Create follow-up task" works.
- Toggle off "Send to family group" → only personal chat receives proactive pings.
