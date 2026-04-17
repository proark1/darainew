
The user wants Dori (assistant) — across the web app AND Telegram — to be a true operator, not just a Q&A bot. Read access + write access (create / edit / delete) across all major modules: tasks, events, contacts, contracts, properties, startups/businesses, emails (with draft creation), family, etc.

Let me scope quickly what already exists so the plan is accurate.

Key existing pieces I know from memory + files:
- `ai-assistant` edge function — main Dori brain (text). Already does some tool-calling (memory, web search, voice actions for tasks).
- `gemini-live` edge function — voice path.
- `telegram-router` edge function — handles Telegram messages from personal + family group, routes to AI.
- `email-draft-reply`, `gmail-send-reply`, `gmail-fetch-email` — email tools exist.
- Tables: tasks, events, user_contacts, contracts, properties (likely), businesses (likely), family_members, etc.

I'll inspect what's actually implemented.
