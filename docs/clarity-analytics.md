# Clarity analytics — bio_trial

Microsoft Clarity is wired into every public HTML page on `trial.buperac.com` so we can replay sessions, inspect heatmaps, and read the analytics dashboard via the Clarity MCP server.

## Project

- **Project ID (public tag)**: `wfiijmew82`
- **Embedded in `<head>`** of: `index.html`, `funding.html`, `trial.html`, `farmer.html`, `vendor.html`
- **Dashboard**: https://clarity.microsoft.com/projects/view/wfiijmew82/dashboard

## Data Export API token

The Data.Export-scoped JWT is **not** committed to this repo. It lives in the central tokens file on Kyle's machine:

```
C:\Users\kyle\.clarity\clarity_tokens.txt   # entry: BIOTRIAL_CLARITY
```

`.env.local` (gitignored) records the lookup key (`CLARITY_API_TOKEN_REF=BIOTRIAL_CLARITY`) so any local script that needs the token can resolve it without hard-coding the JWT.

## Querying via the Clarity MCP

When the `mcp__Microsoft_Clarity__*` tools are connected, ask for analytics with the project ID above:

- `query-analytics-dashboard` — top pages, traffic, scroll depth, rage clicks, dead clicks
- `list-session-recordings` — replay sessions, useful for diagnosing form abandonment on the signup or funding pages
- `query-documentation-resources` — Clarity API reference

## Privacy

The trial site never collects raw farmer PII in any form Clarity could ingest:
- Public pages (`/`, `/trial`, `/funding`) render aggregated, anonymized data only.
- Authenticated pages (`/farmer`, `/vendor`) include `<meta name="robots" content="noindex, nofollow">` and Clarity sessions there are kept for self-service diagnostics, not marketing analysis.
