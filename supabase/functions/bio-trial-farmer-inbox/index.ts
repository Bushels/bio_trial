// Telegram webhook receiver for the Buperac bio-trial farmer inbox.
//
// Roles in scope (built up across Phase 5 of the trial-dashboard plan):
//   T13 — scaffold + X-Telegram-Bot-Api-Secret-Token verification
//   T14 — /start <signup_id> binding (writes signups.farmer_telegram_chat_id)
//   T15 — free-form text      -> trial_events(kind='observation')
//   T16 — photos               -> storage + trial_events(kind='photo')
//   T17 — /apply and /yield    -> inline-keyboard field pickers, callback_query handled
//
// Telegram identifies itself via the `x-telegram-bot-api-secret-token` header
// we registered in setWebhook. Any POST without it is 403'd.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TG_BOT_TOKEN      = Deno.env.get("BIO_TRIAL_TG_BOT_TOKEN")      ?? "";
const TG_WEBHOOK_SECRET = Deno.env.get("BIO_TRIAL_TG_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!TG_WEBHOOK_SECRET || secret !== TG_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // Stub — real routing added in T14-T17.
  console.log("update received (scaffold)", JSON.stringify(update).slice(0, 500));

  // Suppress unused-var warnings for env vars wired up in T14+.
  void TG_BOT_TOKEN;

  return new Response("ok", { status: 200 });
});
