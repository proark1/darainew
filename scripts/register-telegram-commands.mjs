// Push Dori's slash-command menu to Telegram (setMyCommands).
//
// The "/" autocomplete list users see lives on Telegram's side, not in our
// code, so it has to be pushed whenever supabase/functions/_shared/telegram-commands.ts
// changes. The cron service does this automatically on every deploy (see
// BOOT_TASKS in cron/scheduler.mjs) — this script is the manual escape hatch
// for local runs, one-off fixes, and CI.
//
// Usage:
//   bun run telegram:commands
//   node scripts/register-telegram-commands.mjs https://<gateway>/functions/v1
//
// Env:
//   SUPABASE_SERVICE_ROLE_KEY  required — telegram-register-commands gates on it
//   EDGE_FUNCTIONS_URL         base URL of the edge runtime
//   SUPABASE_URL / VITE_SUPABASE_URL   gateway URL; "/functions/v1" is appended

const DEFAULT_BASE = "http://edge-runtime.railway.internal:9000";

function resolveBase() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (arg) return arg.replace(/\/+$/, "");
  if (process.env.EDGE_FUNCTIONS_URL) {
    return process.env.EDGE_FUNCTIONS_URL.replace(/\/+$/, "");
  }
  // A gateway URL points at the site root; the functions live under a prefix.
  const gateway = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (gateway) {
    const trimmed = gateway.replace(/\/+$/, "");
    return trimmed.endsWith("/functions/v1") ? trimmed : `${trimmed}/functions/v1`;
  }
  return DEFAULT_BASE;
}

const base = resolveBase();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. The telegram-register-commands function\n" +
      "rejects anything else, so there is nothing useful to send.",
  );
  process.exit(1);
}

const url = `${base}/telegram-register-commands`;
console.log(`Registering Telegram commands via ${url}`);

let res;
try {
  res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: "{}",
    signal: AbortSignal.timeout(60_000),
  });
} catch (e) {
  console.error(`Request failed: ${e?.message || e}`);
  console.error(
    "If you are running this from a laptop, point it at the public gateway:\n" +
      "  node scripts/register-telegram-commands.mjs https://<gateway>/functions/v1",
  );
  process.exit(1);
}

const body = await res.json().catch(() => null);

if (!res.ok || !body?.ok) {
  console.error(`Failed [${res.status}]:`, JSON.stringify(body, null, 2));
  process.exit(1);
}

for (const entry of body.results ?? []) {
  console.log(`  ${entry.ok ? "✓" : "✗"} ${entry.label} — ${entry.registered} commands`);
}
console.log("Telegram command menu updated.");
