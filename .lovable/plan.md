
Goal: fix Telegram replies so messages sent to the linked bot actually reach Dori instead of returning “Sorry, I'm having trouble reaching Dori right now.”

What I found
- The failure is not in the Telegram link flow. Linking succeeds and `telegram-poll` is receiving messages.
- Current logs show the real backend error:
  - `telegram-poll` logs: `Dori call failed ... 401 {"code":"UNAUTHORIZED_INVALID_JWT_FORMAT","message":"Invalid JWT"}`
- In code, `telegram-poll` calls `/functions/v1/chat` with:
  - `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  - `x-telegram-user-id: <linked user id>`
- In `supabase/functions/chat/index.ts`, there is already a trusted server-to-server branch that accepts this pattern.
- But `supabase/config.toml` still has:
  - `[functions.chat] verify_jwt = true`
- That means platform-level JWT verification rejects the service-role token before the function code can run. So the trusted branch never gets a chance.

Plan
1. Align the `chat` function config with the intended Telegram auth flow
- Change `supabase/config.toml` so `functions.chat` does not require platform JWT verification.
- Keep authentication enforcement inside `supabase/functions/chat/index.ts`:
  - allow only:
    - valid user JWTs via `getClaims()`, or
    - trusted Telegram server calls with exact `service role token + x-telegram-user-id`
- This preserves security while allowing Telegram polling to work.

2. Harden the `chat` function auth block
- Confirm the trusted path is strict:
  - require `x-telegram-user-id`
  - require bearer token to exactly match `SUPABASE_SERVICE_ROLE_KEY`
  - reject all other malformed or missing auth
- Add clearer logging for which auth branch was used, without leaking secrets.

3. Re-deploy affected edge functions
- Deploy at least:
  - `chat`
  - `telegram-poll`
- This ensures config and runtime code are both live together.

4. Validate end-to-end
- Test the `chat` function directly in both modes:
  - regular app-authenticated request
  - Telegram-style trusted request
- Check edge logs after deployment to confirm:
  - no more `UNAUTHORIZED_INVALID_JWT_FORMAT`
  - Telegram messages produce successful assistant responses
- Then send a real Telegram message like “hi” and verify Dori answers.

5. Secondary cleanup if needed
- If a separate `ai-assistant` 401 still appears in logs, review it independently. It does not look like the blocker for Telegram replies right now because the Telegram worker is explicitly calling `chat`, not `ai-assistant`.

Technical details
- Root cause:
  - config says `verify_jwt = true` for `chat`
  - Telegram worker sends a non-user JWT pattern (`service role`) intentionally
  - edge platform rejects it before the function code executes
- Files to update:
  - `supabase/config.toml`
  - possibly small hardening/logging touch in `supabase/functions/chat/index.ts`
- Files already consistent with the intended design:
  - `supabase/functions/telegram-poll/index.ts`
- Expected outcome:
  - Telegram remains linked
  - incoming messages route through the trusted server-to-server path
  - Dori responds in Telegram normally

Verification checklist
- Telegram link still shows connected in Settings
- `telegram-poll` logs stop showing `Invalid JWT`
- `chat` logs show successful requests from Telegram path
- A real Telegram message receives a real assistant reply
- Normal in-app chat still works for logged-in users
