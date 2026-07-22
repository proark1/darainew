## Architecture & deploy

Read this before reasoning about hosting or how to ship — it is easy to assume a
stock Supabase-Cloud setup and be wrong.

- **Frontend**: Vite + React SPA. **Package manager is bun** (`.bun-version`,
  `bun.lock`) — not npm/yarn. `bun install`, `bun run <script>`.
- **Edge functions are self-hosted on Railway**, not on Supabase Cloud. They run
  on Supabase's open-source `edge-runtime` Docker image (build context = repo
  root, Dockerfile = `edge-runtime/Dockerfile`, which `COPY`s
  `supabase/functions`). See [`edge-runtime/README.md`](edge-runtime/README.md).
  A Caddy `gateway` service fronts them. **There is no `supabase functions
deploy`** and the Supabase CLI is not part of the deploy path.
- **Edge functions are Deno** (`.ts` imports with extensions, `Deno.env`). CI
  gates them with `deno check`; they are not covered by the frontend `tsc`.
- **Deploy = push to `main`.** Railway watches the repo and auto-rebuilds the
  frontend, gateway, and edge-runtime services on push. CI
  (`.github/workflows/ci.yml`) only lints / type-checks / tests / builds — it
  does **not** deploy. `bun audit` there can start failing when a new advisory
  lands on a transitive dep; pin the fix through the `overrides` block in
  `package.json`.
- **Timezone**: users are in Germany. Stored timestamps are instants (UTC); when
  a profile has no timezone, display in **`Europe/Berlin`**, never with a bare
  `toLocaleString()` (that renders in the Deno server's UTC and reads 1–2h off).
  In `supabase/functions/chat/index.ts` format event/reminder times with
  `fmtEventWhen(iso, tz)`, which defaults to Berlin.
- **Telegram calendar intent** is first handled by a deterministic regex parser
  (`supabase/functions/_shared/telegram-calendar-shortcut.ts`) that pre-forms the
  `schedule_event` tool and **bypasses the LLM**; the message only reaches the
  model if that parser declines (returns `null`).

## Shipping workflow

When a requested development task is complete, automatically ship it unless the user explicitly says not to.

Default flow:

1. Run the relevant checks.
2. Stage only task-related files.
3. Commit with a concise message.
4. Push the working branch.
5. Switch to `main`.
6. Pull `main` with `--ff-only`.
7. Merge the working branch into `main`.
8. Push `main`.

Do not auto-ship if checks fail, merge conflicts occur, unrelated local changes are present, secrets are detected, or the user asks for review/report/planning only.
