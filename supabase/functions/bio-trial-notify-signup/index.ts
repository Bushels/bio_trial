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

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_ADDR      = Deno.env.get("BIO_TRIAL_FROM")          ?? "Bio Trial <notifications@bushels.energy>";
// TO_VENDOR is intentionally NOT defaulted — leave BIO_TRIAL_VENDOR_EMAIL unset
// to suppress vendor notifications (e.g. while we're not yet looping SixRing in).
const TO_VENDOR_RAW  = Deno.env.get("BIO_TRIAL_VENDOR_EMAIL");
const TO_VENDOR      = TO_VENDOR_RAW && TO_VENDOR_RAW.trim() !== "" ? TO_VENDOR_RAW.trim() : null;
const TO_OWNER       = Deno.env.get("BIO_TRIAL_OWNER_EMAIL")   ?? "buperac@gmail.com";
const WEBHOOK_SECRET = Deno.env.get("BIO_TRIAL_WEBHOOK_SECRET");

const money = (cents: number | null) => cents == null
  ? "—"
  : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(cents / 100);

function buildEmail(r: SignupRow) {
  const trialCost = r.price_per_acre_cents && r.acres
    ? money(r.price_per_acre_cents * r.acres)
    : "—";
  const cropList = [...(r.crops ?? []), r.crops_other].filter(Boolean).join(", ");
  const address  = r.logistics_method === "ship"
    ? `${r.delivery_street ?? ""}, ${r.delivery_city ?? ""}, ${r.province_state ?? ""} ${r.delivery_postal ?? ""}`
    : "Pickup FOB Calgary";

  const subject = `New Bio Trial signup — ${r.name} · ${r.farm_name} · ${r.acres} ac`;

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1e2a4a;max-width:640px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 4px">New Bio Trial signup</h2>
<p style="color:#55554f;margin:0 0 20px">Submitted ${new Date(r.created_at).toLocaleString("en-CA", { timeZone: "America/Edmonton" })}</p>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:14px">
  <tr><td style="color:#55554f">Name</td><td><strong>${r.name}</strong></td></tr>
  <tr><td style="color:#55554f">Farm</td><td>${r.farm_name}</td></tr>
  <tr><td style="color:#55554f">Email</td><td><a href="mailto:${r.email}">${r.email}</a></td></tr>
  <tr><td style="color:#55554f">Phone</td><td>${r.phone ?? "—"}</td></tr>
  <tr><td style="color:#55554f">Region</td><td>${r.province_state} · ${r.rm_county ?? "—"}</td></tr>
  <tr><td style="color:#55554f">Crops</td><td>${cropList || "—"}</td></tr>
  <tr><td style="color:#55554f">Trial acres</td><td>${r.acres}</td></tr>
  <tr><td style="color:#55554f">Logistics</td><td>${r.logistics_method === "pickup_fob_calgary" ? "Pickup FOB Calgary" : r.logistics_method === "ship" ? "Ship to farmer" : "—"}</td></tr>
  <tr><td style="color:#55554f">Address</td><td>${address}</td></tr>
  <tr><td style="color:#55554f">Trial price</td><td><strong>${trialCost}</strong> <span style="color:#55554f">(${r.acres} ac × ${money(r.price_per_acre_cents)})</span></td></tr>
</table>
<p style="margin-top:24px;color:#55554f;font-size:13px">Mark payment / shipped / delivered in the vendor dashboard to progress the trial.</p>
<p style="color:#55554f;font-size:12px">Signup ID: ${r.id}</p>
</body></html>`;

  const text = `New Bio Trial signup\n\n${r.name} — ${r.farm_name}\n${r.email} · ${r.phone ?? "no phone"}\n${r.province_state} · ${r.rm_county ?? "—"}\nCrops: ${cropList || "—"}\nTrial acres: ${r.acres}\nLogistics: ${r.logistics_method ?? "—"}\nAddress: ${address}\nTrial price: ${trialCost} (${r.acres} × ${money(r.price_per_acre_cents)})\n\nSignup ID: ${r.id}`;

  return { subject, html, text };
}

async function sendEmail(subject: string, html: string, text: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email send.");
    return { sent: false, reason: "no_api_key" };
  }

  const recipients = [TO_VENDOR, TO_OWNER].filter((a): a is string => typeof a === "string" && a.length > 0);
  if (recipients.length === 0) {
    console.warn("No recipients configured — skipping email send.");
    return { sent: false, reason: "no_recipients" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: FROM_ADDR,
      to: recipients,
      subject,
      html,
      text
    })
  });
  const body = await res.text();
  return { sent: res.ok, status: res.status, body, recipients };
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

  const { subject, html, text } = buildEmail(body.record);
  const result = await sendEmail(subject, html, text);

  return new Response(JSON.stringify({ ok: true, email: result, signup_id: body.record.id }), {
    status: 200, headers: { "content-type": "application/json" }
  });
});
