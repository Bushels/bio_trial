import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 120) || "file";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST")     return jsonResponse({ error: "method_not_allowed" }, 405);

  let payload: { token?: string; filename?: string };
  try { payload = await req.json(); }
  catch { return jsonResponse({ error: "bad_json" }, 400); }

  const token    = (payload.token    ?? "").trim();
  const filename = (payload.filename ?? "").trim();
  if (!token || !filename) return jsonResponse({ error: "missing_token_or_filename" }, 400);

  // public.farmer_verify_token wraps bio_trial.verify_farmer_jwt — returns uuid (signup_id) or null.
  const { data: signupId, error: verifyError } = await admin
    .rpc("farmer_verify_token", { p_token: token });
  if (verifyError) {
    console.error("verify_farmer_jwt error", verifyError);
    return jsonResponse({ error: "verify_failed", detail: verifyError.message }, 500);
  }
  if (!signupId || typeof signupId !== "string") {
    return jsonResponse({ error: "invalid_token" }, 401);
  }

  const safe  = sanitizeFilename(filename);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand  = crypto.randomUUID().slice(0, 8);
  const path  = `${signupId}/${stamp}-${rand}-${safe}`;

  const { data: signed, error: signError } = await admin
    .storage.from("trial-uploads")
    .createSignedUploadUrl(path);
  if (signError || !signed) {
    console.error("createSignedUploadUrl error", signError);
    return jsonResponse({ error: "sign_failed", detail: signError?.message ?? "unknown" }, 500);
  }

  return jsonResponse({
    path,
    token: signed.token,
    signedUrl: signed.signedUrl,
    bucket: "trial-uploads",
    signup_id: signupId,
  });
});
