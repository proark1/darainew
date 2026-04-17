
The user ran `/linkfamily <code>` in a Telegram **group**, but the bot replied with the personal-chat "not linked" message. Root cause: in `telegram-poll`, the `/linkfamily` command branch is almost certainly gated by the personal-chat lookup (it checks `telegram_links` for the sender first and bails out with that 🔒 message before handling the group command). So the group linking command never gets a chance to run.

I need to inspect `telegram-poll/index.ts` to confirm exactly where the early-return happens, then fix the order so:
1. If the chat is a `group`/`supergroup` AND the text starts with `/linkfamily`, handle it before any personal-link check.
2. The handler should: parse the code, look up `telegram_group_links` by `link_code`, verify not expired, set `chat_id`, `title`, `is_active=true`, `linked_at=now()`, and reply with a success message + instructions for `/linkme`.
3. Same for `/linkme <code>` — must work in groups regardless of whether sender already has a personal link.

Plan to present:

# Fix: `/linkfamily` in group says "not linked"

## Problem
When you run `/linkfamily <code>` in your family group, the bot replies with the personal-chat "🔒 not linked" message instead of linking the group. The personal 1:1 chat connection in Settings is unrelated and works fine.

## Cause
In `telegram-poll`, group messages are passed through the same code path as personal chats. The personal-chat "is this user linked?" check runs **before** the `/linkfamily` group-command handler, so the command never executes — the bot bails out early with the lock message.

## Fix
Reorder the message handler in `supabase/functions/telegram-poll/index.ts` so that group-chat commands are handled first:

1. Detect chat type (`group` / `supergroup`) at the top of message processing.
2. If it's a group:
   - If text starts with `/linkfamily <code>` → look up `telegram_group_links` by `link_code`, ensure not expired, then update the row with `chat_id`, `title` (from `message.chat.title`), `is_active = true`, `linked_at = now()`. Reply: "✅ Family group linked! Now each of you should send `/linkme <your-personal-code>` here."
   - If text starts with `/linkme <code>` → look up `telegram_links` by `link_code`, ensure not expired, set `chat_id` (personal), `is_active`, `linked_at`, AND insert into `telegram_user_map` (telegram_user_id ↔ user_id). Reply: "✅ Linked you, {first_name}!"
   - Other group text → only route to `telegram-router` if the group is already active.
3. Only fall through to the personal-chat "not linked" message for **private** chats.

Also: re-send the success reply via the connector gateway so the user sees confirmation in the group.

## Files
- `supabase/functions/telegram-poll/index.ts` (reorder + add group command handling)

## Verification
- In the family group, send `/linkfamily <fresh-code-from-Settings>` → bot replies "✅ Family group linked!"
- Each spouse sends `/linkme <their-personal-code>` → bot confirms each.
- Send "buy milk tomorrow" in the group → appears in shared shopping list, bot confirms.
- Personal 1:1 chat with Dori still works unchanged.
