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
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const TG_BOT_TOKEN         = Deno.env.get("BIO_TRIAL_TG_BOT_TOKEN")      ?? "";
const TG_WEBHOOK_SECRET    = Deno.env.get("BIO_TRIAL_TG_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function supa(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function tgSendMessage(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!TG_BOT_TOKEN) {
    console.warn("BIO_TRIAL_TG_BOT_TOKEN unset — skipping tgSendMessage", { chatId, text });
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
  if (!res.ok) console.error("tgSendMessage failed", res.status, await res.text().catch(() => ""));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveSignup(sb: SupabaseClient, chatId: number): Promise<string | null> {
  const { data, error } = await sb
    .schema("bio_trial")
    .from("signups")
    .select("id")
    .eq("farmer_telegram_chat_id", chatId)
    .maybeSingle();
  if (error) {
    console.error("resolveSignup failed", error);
    return null;
  }
  return data?.id ?? null;
}

// `signups.telegram_message_id` has a UNIQUE partial index, so Telegram retries on timeout
// land as 23505 conflicts — treated as success (message already logged).
function isDuplicateKey(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === "23505" || /duplicate key|already exists/i.test(err.message ?? "");
}

async function handleObservation(
  sb: SupabaseClient,
  chatId: number,
  msg: { text?: string; message_id?: number },
): Promise<void> {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "You're not connected yet. Use your trial link from the delivery email.");
    return;
  }

  const { error } = await sb
    .schema("bio_trial")
    .from("trial_events")
    .insert({
      signup_id: signupId,
      kind: "observation",
      payload: { text: msg.text ?? "" },
      source: "telegram",
      telegram_message_id: msg.message_id ?? null,
    });

  if (error && !isDuplicateKey(error)) {
    console.error("observation insert failed", error);
    await tgSendMessage(chatId, "Couldn't save that — try again in a sec.");
    return;
  }

  await tgSendMessage(chatId, "Saved ✓");
}

async function handleStart(sb: SupabaseClient, chatId: number, args: string): Promise<void> {
  const signupId = args.trim();
  if (!UUID_RE.test(signupId)) {
    await tgSendMessage(chatId, "This doesn't look like a valid trial link. Tap the magic link from your delivery email.");
    return;
  }

  const { data: signup, error } = await sb
    .schema("bio_trial")
    .from("signups")
    .select("id, farmer_telegram_chat_id, name")
    .eq("id", signupId)
    .maybeSingle();

  if (error) {
    console.error("signup lookup failed", error);
    await tgSendMessage(chatId, "Something went wrong — try again in a minute.");
    return;
  }
  if (!signup) {
    await tgSendMessage(chatId, "Trial signup not found. Double-check your link.");
    return;
  }

  const bound = signup.farmer_telegram_chat_id;
  if (bound && Number(bound) !== chatId) {
    await tgSendMessage(chatId, "This trial is already connected to another phone. Ask your contact to rebind it.");
    return;
  }
  if (bound && Number(bound) === chatId) {
    await tgSendMessage(chatId, "You're already connected. Text me anytime, or try /apply or /yield.");
    return;
  }

  // Only binds if still null (atomic guard).
  const { error: upErr, count } = await sb
    .schema("bio_trial")
    .from("signups")
    .update(
      { farmer_telegram_chat_id: chatId, farmer_linked_at: new Date().toISOString() },
      { count: "exact" },
    )
    .eq("id", signupId)
    .is("farmer_telegram_chat_id", null);

  if (upErr) {
    console.error("bind failed", upErr);
    await tgSendMessage(chatId, "Something went wrong connecting you. Try again in a minute.");
    return;
  }
  if ((count ?? 0) === 0) {
    // Race: someone else bound it between SELECT and UPDATE.
    await tgSendMessage(chatId, "That trial just got claimed on another phone. Ask your contact if you think that's wrong.");
    return;
  }

  await tgSendMessage(
    chatId,
    `Connected, ${signup.name ?? "farmer"}. Text observations anytime, send photos, or try /apply and /yield when the time comes.`,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!TG_WEBHOOK_SECRET || secret !== TG_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: { message?: Record<string, unknown> };
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  try {
    const sb = supa();
    const msg = update.message as
      | { chat?: { id?: number }; text?: string; message_id?: number }
      | undefined;
    if (msg && msg.chat?.id) {
      const chatId = Number(msg.chat.id);
      const text   = typeof msg.text === "string" ? msg.text : "";

      if (text.startsWith("/start")) {
        await handleStart(sb, chatId, text.slice("/start".length).trim());
      } else if (text.startsWith("/")) {
        // /apply, /yield wired in T17.
        console.log("unhandled command", { chatId, textPreview: text.slice(0, 120) });
      } else if (text.length > 0) {
        await handleObservation(sb, chatId, msg);
      } else {
        console.log("unhandled non-text update", { chatId });
      }
    }
  } catch (err) {
    console.error("handler error", err);
  }

  // Always 200 to Telegram — it retries 5xx aggressively and we don't want a flood.
  return new Response("ok", { status: 200 });
});
