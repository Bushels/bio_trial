// Telegram webhook receiver for the Buperac bio-trial farmer inbox.
//
// Roles in scope (Phase 5 of the trial-dashboard plan):
//   T13 — scaffold + X-Telegram-Bot-Api-Secret-Token verification
//   T14 — /start <signup_id> binding (writes signups.farmer_telegram_chat_id)
//   T15 — free-form text  -> trial_events(kind='observation')
//   T16 — photos          -> storage + trial_events(kind='photo')
//   T17 — /apply + /yield -> inline-keyboard field pickers + callback_query handler
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

// Farmers opt a photo into the public dashboard by including #public anywhere
// in the caption (case-insensitive, word-boundary so `#publicly` won't match).
// Stateless by design — no preference column; every photo is an explicit choice,
// and absence of the tag means "private" (safe default).
const PUBLIC_TAG_RE = /(^|\s)#public(\b|$)/i;

function captionOptsIn(caption: string | null | undefined): boolean {
  return typeof caption === "string" && PUBLIC_TAG_RE.test(caption);
}

function stripPublicTag(caption: string | null | undefined): string | null {
  if (typeof caption !== "string") return null;
  const cleaned = caption.replace(PUBLIC_TAG_RE, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

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

type TgField = { id: string; label: string | null; crop: string | null };
type TgCallbackQuery = {
  id: string;
  data?: string;
  message?: { chat?: { id?: number } };
};

async function listFields(sb: SupabaseClient, signupId: string): Promise<TgField[]> {
  const { data, error } = await sb
    .schema("bio_trial")
    .from("trial_fields")
    .select("id, label, crop")
    .eq("signup_id", signupId)
    .order("created_at");
  if (error) {
    console.error("listFields failed", error);
    return [];
  }
  return (data ?? []) as TgField[];
}

async function tgAnswerCallback(callbackQueryId: string): Promise<void> {
  if (!TG_BOT_TOKEN) return;
  const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  }).catch((e) => { console.error("answerCallbackQuery failed", e); return null; });
  if (res && !res.ok) console.error("answerCallbackQuery non-ok", res.status);
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

type TgPhotoSize = { file_id: string; width: number; height: number };

async function handlePhoto(
  sb: SupabaseClient,
  chatId: number,
  msg: { photo?: TgPhotoSize[]; caption?: string; message_id?: number },
): Promise<void> {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }

  const photos = msg.photo ?? [];
  if (photos.length === 0) return;
  const best = photos.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];

  if (!TG_BOT_TOKEN) {
    console.error("BIO_TRIAL_TG_BOT_TOKEN unset — cannot fetch photo bytes");
    return;
  }

  // getFile -> tg-hosted path
  const fileRes  = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(best.file_id)}`);
  const fileJson = await fileRes.json().catch(() => null) as { ok?: boolean; result?: { file_path?: string } } | null;
  if (!fileJson?.ok || !fileJson.result?.file_path) {
    console.error("getFile failed", fileJson);
    await tgSendMessage(chatId, "Couldn't fetch that photo — try again.");
    return;
  }
  const tgPath = fileJson.result.file_path;

  // Fetch bytes
  const binRes = await fetch(`https://api.telegram.org/file/bot${TG_BOT_TOKEN}/${tgPath}`);
  if (!binRes.ok) {
    console.error("telegram file download failed", binRes.status);
    await tgSendMessage(chatId, "Photo download failed — try again later.");
    return;
  }
  const bytes = new Uint8Array(await binRes.arrayBuffer());
  const ext   = (tgPath.split(".").pop() ?? "jpg").toLowerCase();
  const storagePath = `${signupId}/${crypto.randomUUID()}.${ext}`;
  const contentType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;

  // Upload to private bucket
  const { error: upErr } = await sb.storage
    .from("trial-uploads")
    .upload(storagePath, bytes, { contentType, upsert: false });
  if (upErr) {
    console.error("storage upload failed", upErr);
    await tgSendMessage(chatId, "Photo upload failed — try again later.");
    return;
  }

  const publicOk = captionOptsIn(msg.caption);
  const caption  = stripPublicTag(msg.caption);

  // Record event
  const { error: evtErr } = await sb
    .schema("bio_trial")
    .from("trial_events")
    .insert({
      signup_id: signupId,
      kind: "photo",
      payload: { caption },
      source: "telegram",
      telegram_message_id: msg.message_id ?? null,
      file_urls: [storagePath],
      public_opt_in: publicOk,
    });

  if (evtErr && !isDuplicateKey(evtErr)) {
    console.error("photo event insert failed", evtErr);
    return;
  }

  await tgSendMessage(
    chatId,
    publicOk
      ? "Photo saved 📷 — tagged for the public dashboard (no farm name shown)."
      : "Photo saved 📷 (kept private — add #public to the caption to feature it on the public dashboard).",
  );
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

async function handleApply(sb: SupabaseClient, chatId: number): Promise<void> {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }
  const fields = await listFields(sb, signupId);
  if (fields.length === 0) {
    await tgSendMessage(chatId, "No fields yet — add one on your farmer dashboard first.");
    return;
  }
  const keyboard = {
    inline_keyboard: fields.map((f) => [{
      text: `${f.label ?? "(unnamed)"} (${f.crop ?? "?"})`,
      callback_data: `apply:${f.id}`,
    }]),
  };
  await tgSendMessage(chatId, "Which field did you spray Buperac on?", { reply_markup: keyboard });
}

async function handleYield(sb: SupabaseClient, chatId: number, args: string): Promise<void> {
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    return;
  }
  const n = parseFloat(args);
  if (!isFinite(n) || n <= 0) {
    await tgSendMessage(chatId, "Usage: /yield 52  (bu/ac for the field you'll pick next)");
    return;
  }
  const fields = await listFields(sb, signupId);
  if (fields.length === 0) {
    await tgSendMessage(chatId, "No fields yet — add one on your farmer dashboard first.");
    return;
  }
  const keyboard = {
    inline_keyboard: fields.map((f) => [{
      text: `${f.label ?? "(unnamed)"} (${f.crop ?? "?"})`,
      callback_data: `yield:${f.id}:${n}`,
    }]),
  };
  await tgSendMessage(chatId, `Which field yielded ${n} bu/ac?`, { reply_markup: keyboard });
}

async function handleCallback(sb: SupabaseClient, cb: TgCallbackQuery): Promise<void> {
  const chatIdRaw = cb.message?.chat?.id;
  if (!chatIdRaw) {
    await tgAnswerCallback(cb.id);
    return;
  }
  const chatId = Number(chatIdRaw);
  const signupId = await resolveSignup(sb, chatId);
  if (!signupId) {
    await tgSendMessage(chatId, "Connect first using your trial link.");
    await tgAnswerCallback(cb.id);
    return;
  }

  const [kind, fieldId, extra] = (cb.data ?? "").split(":");

  if (kind === "apply" && fieldId) {
    const { error } = await sb.schema("bio_trial").from("trial_events").insert({
      signup_id: signupId,
      field_id: fieldId,
      kind: "application",
      payload: { applied_at: new Date().toISOString() },
      source: "telegram",
    });
    if (error && !isDuplicateKey(error)) {
      console.error("application insert failed", error);
      await tgSendMessage(chatId, "Couldn't save that — try again.");
    } else {
      await tgSendMessage(chatId, "Application logged ✓");
    }
  } else if (kind === "yield" && fieldId && extra) {
    const bu = parseFloat(extra);
    if (!isFinite(bu) || bu <= 0) {
      await tgSendMessage(chatId, "Bad yield value — try /yield <number> again.");
    } else {
      const { error } = await sb.schema("bio_trial").from("trial_events").insert({
        signup_id: signupId,
        field_id: fieldId,
        kind: "yield",
        payload: { bu_per_ac: bu },
        source: "telegram",
      });
      if (error && !isDuplicateKey(error)) {
        console.error("yield insert failed", error);
        await tgSendMessage(chatId, "Couldn't save that — try again.");
      } else {
        await tgSendMessage(chatId, `Yield saved: ${bu} bu/ac ✓`);
      }
    }
  } else {
    console.log("unknown callback payload", { data: cb.data });
  }

  await tgAnswerCallback(cb.id);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!TG_WEBHOOK_SECRET || secret !== TG_WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }

  let update: {
    message?: Record<string, unknown>;
    callback_query?: Record<string, unknown>;
  };
  try {
    update = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  try {
    const sb = supa();

    if (update.callback_query) {
      await handleCallback(sb, update.callback_query as TgCallbackQuery);
      return new Response("ok", { status: 200 });
    }

    const msg = update.message as
      | {
          chat?: { id?: number };
          text?: string;
          message_id?: number;
          photo?: TgPhotoSize[];
          caption?: string;
        }
      | undefined;
    if (msg && msg.chat?.id) {
      const chatId = Number(msg.chat.id);
      const text   = typeof msg.text === "string" ? msg.text : "";

      if (msg.photo && msg.photo.length > 0) {
        await handlePhoto(sb, chatId, msg);
      } else if (text.startsWith("/start")) {
        await handleStart(sb, chatId, text.slice("/start".length).trim());
      } else if (text.startsWith("/apply")) {
        await handleApply(sb, chatId);
      } else if (text.startsWith("/yield")) {
        await handleYield(sb, chatId, text.slice("/yield".length).trim());
      } else if (text.startsWith("/public")) {
        await tgSendMessage(
          chatId,
          "To feature a photo on the public bio-trial dashboard, add <b>#public</b> anywhere in its caption when you send it.\n\n" +
          "The public view shows only the image, caption (with #public removed), province, and crop — never your name or farm. " +
          "Photos without #public stay private and are visible only to you and the trial team.",
        );
      } else if (text.startsWith("/")) {
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
