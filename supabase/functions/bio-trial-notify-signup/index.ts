import "jsr:@supabase/functions-js/edge-runtime.d.ts";

interface SignupRow {
  id: string;
  created_at: string;
  name: string;
  farm_name: string;
  email: string;
  phone: string | null;
  province_state: string;
  rm_county: string | null;
  crops: string[];
  crops_other: string | null;
  acres: number;
  logistics_method: string | null;
  delivery_street: string | null;
  delivery_city: string | null;
  delivery_postal: string | null;
  price_per_acre_cents: number | null;
}

interface WebhookPayload {
  type: string;
  table: string;
  schema: string;
  record: SignupRow;
  old_record: SignupRow | null;
}

const TG_BOT_TOKEN   = Deno.env.get("BIO_TRIAL_TG_BOT_TOKEN");
const TG_CHAT_ID     = Deno.env.get("BIO_TRIAL_TG_CHAT_ID");
const WEBHOOK_SECRET = Deno.env.get("BIO_TRIAL_WEBHOOK_SECRET");

const money = (cents: number | null) => cents == null
  ? "—"
  : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

// Telegram HTML parse_mode requires <, >, & escaping in text content.
const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildMessage(r: SignupRow): string {
  const trialCost = r.price_per_acre_cents && r.acres
    ? money(r.price_per_acre_cents * r.acres)
    : "—";
  const cropList = [...(r.crops ?? []), r.crops_other].filter(Boolean).join(", ");
  const logistics = r.logistics_method === "pickup_fob_calgary" ? "Pickup FOB Calgary"
                  : r.logistics_method === "ship"               ? "Ship to farmer"
                  : "—";
  const address = r.logistics_method === "ship"
    ? `${r.delivery_street ?? ""}, ${r.delivery_city ?? ""}, ${r.province_state ?? ""} ${r.delivery_postal ?? ""}`.replace(/\s+/g, " ").trim()
    : "Pickup FOB Calgary";
  const submitted = new Date(r.created_at).toLocaleString("en-CA", { timeZone: "America/Edmonton" });

  return [
    `<b>New Bio Trial signup</b>`,
    ``,
    `<b>${esc(r.name)}</b> — ${esc(r.farm_name)}`,
    `${esc(r.email)}${r.phone ? " · " + esc(r.phone) : ""}`,
    `${esc(r.province_state)}${r.rm_county ? " · " + esc(r.rm_county) : ""}`,
    ``,
    `Crops: ${esc(cropList || "—")}`,
    `Trial acres: <b>${r.acres}</b>`,
    `Logistics: ${logistics}`,
    `Address: ${esc(address)}`,
    `Price: <b>${trialCost}</b> (${r.acres} ac × ${money(r.price_per_acre_cents)})`,
    ``,
    `Submitted ${esc(submitted)}`,
    `ID: <code>${esc(r.id)}</code>`,
  ].join("\n");
}

async function sendTelegram(text: string) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
    console.warn("BIO_TRIAL_TG_BOT_TOKEN or BIO_TRIAL_TG_CHAT_ID not set — skipping Telegram send.");
    return { sent: false, reason: "no_config" };
  }

  const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TG_CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const body = await res.text();
  return { sent: res.ok, status: res.status, body };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  if (WEBHOOK_SECRET) {
    const hdr = req.headers.get("x-webhook-secret");
    if (hdr !== WEBHOOK_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  let body: WebhookPayload;
  try { body = await req.json(); }
  catch { return new Response("bad json", { status: 400 }); }

  if (body.type !== "INSERT" || body.table !== "signups" || body.schema !== "bio_trial") {
    return new Response(JSON.stringify({ ignored: true, reason: "unexpected_event" }), {
      status: 200, headers: { "content-type": "application/json" }
    });
  }

  const text = buildMessage(body.record);
  const result = await sendTelegram(text);

  return new Response(JSON.stringify({ ok: true, telegram: result, signup_id: body.record.id }), {
    status: 200, headers: { "content-type": "application/json" }
  });
});
