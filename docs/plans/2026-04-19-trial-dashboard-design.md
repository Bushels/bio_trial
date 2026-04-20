# Trial Dashboard & Farmer Telegram Inbox — Design

**Date:** 2026-04-19
**Status:** Shipped 2026-04-19 (Telegram webhook registration pending Kyle's ops action — see T18 in the plan's progress log)
**Depends on:** `bio_trial` schema live on Bushel Board Supabase (`ibgsloyjxdopkvwqcqwh`), `@BuperacTrialBot` already wired for outbound notifications.

## Goal

Turn the Buperac bio trial into a live, public-facing marketing surface: farmers report trial data as the season unfolds, a public dashboard aggregates and redacts it, and every farmer has a private web dashboard for heavier data entry (field baselines, lab PDFs).

The trial has to produce defensible evidence for marketing claims ("Buperac + X fertilizer strategy yielded Y bu/ac on wheat vs. rotation-matched controls"). That requires structured data collection across the season — not just free-form observations.

## Three audiences

The design splits cleanly around audience, and each audience gets its own auth gate, its own entry points, and its own read scope over a shared event store.

| Surface | Audience | Auth | Purpose |
|---|---|---|---|
| **Public trial dashboard** — `/trial` | anyone | anon | Live redacted/aggregated stats — marketing asset |
| **Farmer dashboard** — `/farmer.html?token=…` | each farmer, own data only | signed JWT in URL | Enter field baselines, upload lab PDFs, view own timeline, bind Telegram |
| **Vendor console** — `/vendor.html` (unchanged) | SixRing | existing `vendor_users` / `is_vendor()` | Admin: signups list, paid / shipped / delivered, event review |

## Data model

Two new tables in the `bio_trial` schema. Existing `signups` gets one new column for Telegram binding.

### `bio_trial.trial_fields`

A farm can have several trial fields (e.g., Buperac on field A, control on field B). Baseline agronomy is per-field because seed/fert rates and tank mix choices vary.

```
id                  uuid PK
signup_id           uuid FK → signups
label               text                -- "NW quarter", "Field 3"
crop                text                -- wheat, canola, barley, …
prev_crop           text                -- rotation history
application_method  text                -- 'liquid_seeding' | 'foliar_spray'
seed_rate_payload   jsonb               -- {value, unit} — flexible unit
fert_rate_payload   jsonb               -- {value, unit, product}
tank_mix            jsonb               -- [{product, rate, unit}, …]
acres               numeric
created_at          timestamptz
```

### `bio_trial.trial_events`

One row per thing that happens — field added, Buperac applied, soil sample, photo, observation, yield, protein. `kind` is the tag, `payload` is kind-specific.

```
id                    uuid PK
signup_id             uuid FK → signups       -- always set
field_id              uuid FK → trial_fields  -- nullable for signup-level events
kind                  text                    -- see tag list below
payload               jsonb                   -- kind-specific structured fields
source                text                    -- 'telegram' | 'farmer_web' | 'vendor_admin'
telegram_message_id   bigint                  -- dedupe key when source='telegram'
file_urls             text[]                  -- Supabase Storage refs (photos, PDFs)
public_opt_in         boolean default false   -- farmer-granted, per-event
created_at            timestamptz
```

### `bio_trial.signups` additions

```
ALTER TABLE bio_trial.signups ADD COLUMN
  farmer_telegram_chat_id bigint UNIQUE,
  farmer_linked_at        timestamptz;
```

`UNIQUE` so a single Telegram chat can't bind to multiple signups.

### `kind` values in v1

`field_created`, `application`, `observation`, `stand_count`, `yield`, `protein`, `soil_test`, `moisture_test`, `photo`, `heat_event_timing`.

Adding more later is free — no migration, just a new bot/form handler and a new dashboard panel.

## Telegram flow (light data)

The bot stays as `@BuperacTrialBot` — same bot that notifies Kyle on signup. We add a webhook so it also receives messages.

### One-time binding (how we identify farmers)

1. Vendor console shows a **"Copy farmer magic link"** button on any row with `delivered=true`.
2. Kyle clicks, gets `https://trial.buperac.com/farmer.html?token=<signed_jwt>` on his clipboard, pastes it into his own email/text to the farmer.
3. Farmer lands on farmer dashboard. The big CTA on first visit is **"Connect Telegram"** — a deep link: `https://t.me/BuperacTrialBot?start=<signup_id>`.
4. Farmer taps, Telegram opens, taps Start. Telegram sends `/start <signup_id>` as the first bot message.
5. The `bio-trial-farmer-inbox` edge function receives the update, extracts `chat_id` from `message.from.id`, validates `signup_id`, and writes:
   ```sql
   UPDATE bio_trial.signups
   SET farmer_telegram_chat_id = $chat_id, farmer_linked_at = now()
   WHERE id = $signup_id AND farmer_telegram_chat_id IS NULL;
   ```
6. Bot replies: "You're connected — text me observations anytime, send photos, or try `/apply` / `/yield` when the time comes."

From then on, **every message from that `chat_id` carries identity** via `SELECT signup_id FROM signups WHERE farmer_telegram_chat_id = $incoming_chat_id`. Photos, texts, commands — all tagged to the right signup automatically.

### Ongoing messages

- **Plain text** → `kind='observation'`, `payload={text}`, `source='telegram'`
- **Photo** → bot calls Telegram `getFile`, streams the bytes into Supabase Storage bucket `trial-uploads/<signup_id>/<uuid>.jpg`, inserts `kind='photo'`, `payload={caption}`, `file_urls=[storage_url]`
- **`/apply`** → bot replies with inline keyboard of farmer's fields, records `kind='application'`, `payload={field_id, applied_at:now}` on reply
- **`/yield 52`** → bot asks which field, records `kind='yield'`, `payload={bu_per_ac:52, field_id}`
- **Unknown `chat_id`** → bot replies "use your trial link to connect first" and writes nothing
- **Duplicate `telegram_message_id`** → skipped silently (idempotency for retries)

### Security notes

- `signup_id` in the deep link is a uuid — not guessable, but is shareable. First-tap wins: the `/start` handler refuses binding if `farmer_telegram_chat_id` is already set. If the wrong phone connects, Kyle rebinds from vendor console (nulls the column, hands out a fresh link).
- Webhook endpoint uses a secret token set via Telegram `setWebhook` — we verify the token header on every inbound request.

## Farmer dashboard (heavy data)

New page `farmer.html`. Auth is a signed JWT in the URL; no Supabase Auth user created per farmer.

### Why signed-token instead of Supabase Auth

- Farmers aren't recurring users of Bushel Board — they're trial participants for one season.
- Supabase Magic Link OTP requires transactional email we don't have configured (Resend is deferred because of $20/mo paywall).
- A JWT signed with a server-side secret, carrying `{signup_id, exp}`, is simple, stateless, and costs nothing.
- Lost link = Kyle mints a new one from vendor console. Acceptable friction for low volume.

### JWT shape

```
{
  "sub": "<signup_id>",
  "iat": <unix>,
  "exp": <unix + 180 days>,
  "aud": "bio_trial.farmer"
}
```

Signed HS256 with `BIO_TRIAL_FARMER_JWT_SECRET` stored in Supabase edge function secrets. Every farmer RPC takes the JWT as an argument, verifies signature + expiry + audience server-side inside the RPC.

### Sections on farmer.html

- **Your fields** — list cards, "Add a field" button. Each card opens an inline form: label, crop, prev crop, application method, seed rate (value + unit), fert rate (value + unit + product), tank mix (repeatable rows).
- **Upload lab result** — choose kind (soil test, moisture test, protein), attach PDF or photo, fill structured fields (pH, OM%, NPK for soil; moisture % for moisture; protein % for protein), pick which field it applies to. File goes to Supabase Storage via signed URL, then a single RPC call registers the `trial_events` row with the returned URL.
- **Your timeline** — read-only feed of all events on this signup (Telegram + web, sorted newest first).
- **Connect Telegram** — deep link button when `farmer_telegram_chat_id IS NULL`, "Connected ✓" state otherwise.

### RPCs

All gated by `bio_trial.is_farmer_of(p_signup_id)` called from within each `SECURITY DEFINER` RPC, which first verifies the JWT and then matches its `sub` against `p_signup_id`.

- `public.farmer_bootstrap(p_token)` → `{signup: {...}, fields: [...], events: [...], telegram_bound: bool}`
- `public.farmer_upsert_field(p_token, p_field_patch jsonb)` → returns updated field row
- `public.farmer_register_event(p_token, p_kind, p_field_id, p_payload, p_file_urls)` → inserts event, returns row
- `public.farmer_signed_upload_url(p_token, p_filename)` → returns a signed Supabase Storage PUT URL the browser can POST the file to directly

## Public trial dashboard

New page `trial.html` at `trial.buperac.com/trial` (or a section on homepage). All data via one anon RPC: `public.get_trial_dashboard()` returning a single jsonb document.

### What it shows

- **Headline:** acres enrolled, # farms reporting, # provinces represented, # applications logged
- **Progress:** # yield reports, # soil tests submitted, # observations logged
- **Aggregates** (with privacy floor — hidden until ≥3 farms contributing to the slice): average yield by crop, average protein by crop, rotation-context breakdown (prev crop → crop yield bands)
- **Activity feed:** 20 most recent events, redacted to province + crop + kind: *"A farmer in SK logged a soil test on wheat · 2h ago"*
- **Opt-in photo strip:** photos where `public_opt_in=true`. Farmer ticks a box per photo in the farmer dashboard — default off.

### Privacy rules

The `get_trial_dashboard` RPC enforces these in SQL, not in the frontend:

1. Never expose `name`, `farm_name`, `email`, `phone`, `rm_county`, `delivery_*`, `field.label`, or any raw farmer identifier.
2. Province is fine (coarse). RM/county is not (too precise to identify a farm).
3. Aggregates hidden when the contributing farm count falls below 3 — prevents single-farm inference.
4. Photos only surface when `public_opt_in=true`.

## Vendor console changes

Minimal diff to `vendor.html`:

- Add **"Copy farmer magic link"** button on each row with `delivered=true`. Calls a new vendor-gated RPC `public.vendor_mint_farmer_token(p_signup_id)` that returns the signed JWT. Button copies the full `https://trial.buperac.com/farmer.html?token=…` URL to clipboard.
- Add **"Rebind Telegram"** action (menu item) that nulls `farmer_telegram_chat_id` for when the wrong phone connected.
- Add **"Events"** tab showing all `trial_events` for a given signup — useful for support calls.

No other changes. SixRing workflow unchanged.

## Edge functions

One new function (plus the existing `bio-trial-notify-signup`):

- **`bio-trial-farmer-inbox`** — Telegram webhook receiver. Parses update, routes by message type (text / photo / command), inserts rows into `trial_events`. Verifies the Telegram `X-Telegram-Bot-Api-Secret-Token` header. Copies photos to Supabase Storage.

Webhook registered once via `setWebhook` API call (one-time setup step).

## What's in v1

- `trial_fields` and `trial_events` tables + RLS + RPCs
- Farmer JWT + `farmer.html` with fields / labs / timeline / Telegram binding sections
- `bio-trial-farmer-inbox` edge function with text + photo + `/start` + `/apply` + `/yield` handlers
- Public `/trial` page with anon dashboard RPC
- Vendor console: copy-link button, rebind action, events tab
- Supabase Storage `trial-uploads` bucket with RLS

## What's deferred to v2

- Automated transactional delivery email (v1 uses manual copy-link button in vendor console).
- Outbound heat-wave / frost alerts tied to Environment Canada feeds.
- Structured `/seed`, `/fert`, `/herbicide` bot commands (v1: farmers enter baseline through web form; bot stays light/observational).
- Side-by-side Buperac vs. control comparison UI on the public dashboard (schema supports it, UI waits).
- Farmer-to-farmer visibility on the farmer dashboard (v1: farmers see own data only).

## Key risks

- **Telegram photo → Storage plumbing** is the biggest unknown. The Telegram `getFile` URL expires in ~1 hour and serves bytes over HTTPS; we need to stream those bytes into Supabase Storage without buffering the whole file in memory. Prototype first, then integrate.
- **JWT secret rotation** — if `BIO_TRIAL_FARMER_JWT_SECRET` rotates, every outstanding farmer link breaks. Document this clearly and put a process note in the README before first farmer link is minted.
- **Privacy floor (≥3 farms)** means the public dashboard looks empty for the first weeks of the trial. That's correct behavior, but expect the "is it broken?" question — add a UI note: "Aggregated stats unlock once 3 farms are reporting on a given crop."

## Cost impact

Zero new paid services. Supabase Storage is ~1 GB free on Pro (we're on Pro). Telegram is free. Vercel is free. The $10/mo we avoided by keeping the schema on Bushel Board is still avoided.
