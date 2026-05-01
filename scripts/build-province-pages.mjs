#!/usr/bin/env node
/**
 * build-province-pages.mjs
 *
 * Generates 10 province-specific grant landing pages at the repo root,
 * one per Canadian province in CANADA_PROVINCES (excluding "All Provinces"
 * and the territories, which have no grants today).
 *
 * Each page:
 *   - Has unique <title>, <meta description>, canonical, OG/Twitter, GovernmentService JSON-LD
 *   - Lists grants where regions includes this province + federal "All Provinces" grants
 *   - Includes Clarity + AdSense + the shared site footer
 *   - Reuses funding.css for visual consistency
 *
 * Run: node scripts/build-province-pages.mjs
 *
 * Re-run whenever funding-data.js changes.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const repoRoot   = path.resolve(__dirname, '..');

// ---- Load funding-data.js by sandbox-evaluating it (it attaches to window) ----
const dataPath = path.join(repoRoot, 'funding-data.js');
const dataSrc  = fs.readFileSync(dataPath, 'utf8');
const sandbox  = { window: {} };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox);
const { GRANTS, CANADA_PROVINCES } = sandbox.window.FUNDING_DATA;

// Provinces with at least one grant (excludes territories + "All Provinces")
const targets = CANADA_PROVINCES.filter(p => {
  if (p === 'All Provinces') return false;
  return GRANTS.some(g => g.regions.includes(p));
});

const slug = s => s
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapeAttr = s => escapeHtml(s).replace(/'/g, '&#39;');

function renderGrantCard(g) {
  const isFederal = g.isFederal ? '<span class="badge badge-fed">Federal</span>' : '';
  return `
        <article class="grant-card">
          <header class="grant-head">
            <h3 class="grant-name">${escapeHtml(g.name)}</h3>
            ${isFederal}
          </header>
          <p class="grant-org"><strong>${escapeHtml(g.organization)}</strong> · ${escapeHtml(g.amount || 'Varies')} · ${escapeHtml(g.deadline || 'Check program page')}</p>
          <p class="grant-desc">${escapeHtml(g.description)}</p>
          <p class="grant-benefits">${(g.benefits || []).map(b => `<span class="chip">${escapeHtml(b)}</span>`).join(' ')}</p>
          <p class="grant-cta"><a href="${escapeAttr(g.link)}" target="_blank" rel="nofollow noopener">Open program page →</a></p>
        </article>`;
}

function renderPage(province) {
  const slugged = slug(province);
  const provincial = GRANTS.filter(g => g.regions.includes(province));
  const federal    = GRANTS.filter(g => g.regions.includes('All Provinces') && g.country === 'Canada');
  const total = provincial.length + federal.length;

  const title = `${province} Biostimulant Grants — ${total} Programs for 2026 On-Farm Trials`;
  const description = `${total} federal and provincial grant programs that ${province} farmers can use to fund a biostimulant trial, reduce synthetic nitrogen, or improve soil health. Updated 2026-05-01.`;
  const canonical = `https://trial.buperac.com/funding-${slugged}`;

  const govSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${province} biostimulant grants`,
    description,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'Buperac Bio Trial', url: 'https://trial.buperac.com/' },
    about: [...provincial, ...federal].map(g => ({
      '@type': 'GovernmentService',
      name: g.name,
      provider: { '@type': 'GovernmentOrganization', name: g.organization },
      areaServed: g.country === 'Canada'
        ? (g.regions.includes('All Provinces') ? 'Canada' : province)
        : g.regions[0],
      url: g.link,
      description: g.description,
    })),
  }, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <meta name="theme-color" content="#3d7a2f" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <meta name="keywords" content="${escapeAttr(`${province} biostimulant grant, ${province} farm grant, OFCAF ${province}, ${province} soil health funding, ${province} nitrogen reduction, on-farm trial grant ${province}`)}" />
  <meta name="author" content="Buperac" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Buperac Bio Trial" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:image" content="https://trial.buperac.com/favicon.svg" />
  <meta property="og:locale" content="en_CA" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="https://trial.buperac.com/favicon.svg" />

  <!-- JSON-LD: GovernmentService collection -->
  <script type="application/ld+json">
${govSchema}
  </script>

  <!-- Microsoft Clarity -->
  <script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "wfiijmew82");
  </script>

  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7958728286012509"
       crossorigin="anonymous"></script>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Permanent+Marker&family=Special+Elite&family=Cutive+Mono&family=Inter:wght@400;500;600;700&family=IM+Fell+English+SC&family=Kalam:wght@400;700&display=swap" />
  <link rel="stylesheet" href="funding.css" />

  <style>
    .pp-wrap { max-width: 1100px; margin: 0 auto; padding: clamp(20px, 5vw, 60px) clamp(16px, 5vw, 60px); }
    .pp-crumb { font-family: "Cutive Mono", monospace; font-size: 13px; margin-bottom: 24px; }
    .pp-crumb a { color: #1e2a4a; text-decoration: none; border-bottom: 1px dashed rgba(30,42,74,0.5); margin-right: 12px; }
    .pp-h1 { font-family: "Permanent Marker", cursive; font-size: clamp(28px, 6vw, 48px); color: #1e2a4a; margin: 0 0 6px; line-height: 1.1; }
    .pp-lede { font-family: "Caveat", cursive; font-size: clamp(20px, 4vw, 28px); color: #3d7a2f; margin: 0 0 28px; }
    .pp-section-title { font-family: "Permanent Marker", cursive; color: #1e2a4a; font-size: 22px; margin: 32px 0 14px; }
    .grant-grid { display: grid; gap: 16px; grid-template-columns: 1fr; }
    @media (min-width: 720px) { .grant-grid { grid-template-columns: 1fr 1fr; } }
    .grant-card {
      background: #f5ecd6; border: 1px solid #bfa87a; border-radius: 4px;
      padding: 16px 18px; box-shadow: 0 4px 10px -4px rgba(40,20,10,0.45);
      font-family: "Inter", system-ui, sans-serif; color: #3a3a38;
    }
    .grant-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
    .grant-name { font-family: "Special Elite", monospace; font-size: 16px; color: #1e2a4a; margin: 0; line-height: 1.3; }
    .badge-fed { background: #3d7a2f; color: #f5ecd6; font-size: 11px; padding: 2px 8px; border-radius: 3px; font-family: "Cutive Mono", monospace; white-space: nowrap; }
    .grant-org { font-size: 13px; color: #55554f; margin: 4px 0 8px; }
    .grant-desc { font-size: 14px; line-height: 1.5; margin: 8px 0; }
    .grant-benefits { margin: 8px 0 4px; }
    .chip { display: inline-block; background: #efe0bd; border: 1px solid #bfa87a; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin: 2px 4px 2px 0; color: #3a3a38; }
    .grant-cta a { color: #1e2a4a; font-weight: 600; text-decoration: none; border-bottom: 1px solid rgba(30,42,74,0.5); }

    /* Footer (shared with /, /trial, /funding) */
    .site-foot { background: #efe0bd; border-top: 3px solid #6b4a2b; padding: clamp(20px, 4vw, 40px) clamp(16px, 5vw, 60px); color: #3a3a38; font-family: "Inter", ui-sans-serif, system-ui, sans-serif; font-size: 14px; line-height: 1.55; }
    .site-foot .foot-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 24px 40px; }
    @media (min-width: 720px) { .site-foot .foot-grid { grid-template-columns: 1.4fr 1fr 1fr 1fr; } }
    .site-foot h3 { font-family: "Permanent Marker", cursive; font-size: 17px; margin: 0 0 10px; color: #1e2a4a; letter-spacing: 0.5px; }
    .site-foot ul { list-style: none; margin: 0; padding: 0; }
    .site-foot li { margin: 6px 0; }
    .site-foot a { color: #1e2a4a; text-decoration: none; border-bottom: 1px dashed rgba(30, 42, 74, 0.45); padding-bottom: 1px; }
    .site-foot a:hover { border-bottom-style: solid; }
    .site-foot .brand strong { font-family: "Caveat", cursive; font-size: 22px; color: #3d7a2f; font-weight: 600; }
    .site-foot .colophon { max-width: 1100px; margin: 24px auto 0; padding-top: 16px; border-top: 1px dashed rgba(107, 74, 43, 0.45); font-size: 12px; color: #55554f; text-align: center; }
  </style>
</head>
<body class="funding">
  <main class="desk">
    <div class="pp-wrap">
      <nav class="pp-crumb" aria-label="site">
        <a href="/">← enrolment page</a>
        <a href="/funding">all grants</a>
        <a href="/trial">live trial results</a>
      </nav>

      <h1 class="pp-h1">${escapeHtml(province)} biostimulant grants</h1>
      <p class="pp-lede">${total} programs you can stack with the 2026 Buperac × SixRing trial.</p>

      <p>If you farm in ${escapeHtml(province)} and you're considering a foliar biostimulant trial, the right grant can cover most or all of the input cost. Frame your application around <strong>nutrient management</strong>, <strong>nitrogen reduction</strong>, <strong>soil health</strong>, or <strong>on-farm research</strong> — those are the plain-language hooks every program below recognizes. The Buperac trial is built to slot into a Beneficial Management Practice (BMP) plan, with documented application rate (0.5 L/ac) and per-field yield reporting that satisfies most cost-share documentation requirements.</p>

      <h2 class="pp-section-title">${escapeHtml(province)}-specific programs (${provincial.length})</h2>
      <div class="grant-grid">
${provincial.map(renderGrantCard).join('\n')}
      </div>

      <h2 class="pp-section-title">Federal programs available to ${escapeHtml(province)} farmers (${federal.length})</h2>
      <div class="grant-grid">
${federal.map(renderGrantCard).join('\n')}
      </div>

      <p style="margin-top: 32px; font-family: 'Cutive Mono', monospace; font-size: 13px; color: #55554f;">
        Directory compiled from public federal and provincial program pages. Amounts and deadlines change — verify with the issuing body before applying. Last updated 2026-05-01.
      </p>
    </div>
  </main>

  <footer class="site-foot" aria-label="site footer">
    <div class="foot-grid">
      <div class="brand">
        <h3>Buperac Bio Trial</h3>
        <p><strong>0.5 L per acre.</strong></p>
        <p>A grower-led on-farm trial of a lignin-derived foliar biostimulant. Find a grant, run a strip trial, and watch the live ledger.</p>
      </div>
      <div>
        <h3>Trial</h3>
        <ul>
          <li><a href="/">Enrol your fields</a></li>
          <li><a href="/trial">Live trial ledger</a></li>
          <li><a href="/learn-lignin-biostimulants">How it works</a></li>
        </ul>
      </div>
      <div>
        <h3>Funding by region</h3>
        <ul>
          <li><a href="/funding">All grants</a></li>
${targets.filter(p => p !== province).slice(0, 5).map(p => `          <li><a href="/funding-${slug(p)}">${escapeHtml(p)}</a></li>`).join('\n')}
        </ul>
      </div>
      <div>
        <h3>About</h3>
        <ul>
          <li>Pricing: $2.80 / acre</li>
          <li>Privacy floor: ≥3 farms</li>
          <li><a href="/vendor">SixRing login</a></li>
        </ul>
      </div>
    </div>
    <div class="colophon">
      Buperac × SixRing 2026 · trial.buperac.com · Built for the Canadian Prairies and US Northern Plains.
    </div>
  </footer>
</body>
</html>
`;
}

console.log(`Generating ${targets.length} province pages…`);
let written = 0;
for (const province of targets) {
  const slugged = slug(province);
  const outPath = path.join(repoRoot, `funding-${slugged}.html`);
  const html = renderPage(province);
  fs.writeFileSync(outPath, html, 'utf8');
  const provincial = GRANTS.filter(g => g.regions.includes(province));
  const federal    = GRANTS.filter(g => g.regions.includes('All Provinces') && g.country === 'Canada');
  console.log(`  ✓ ${path.relative(repoRoot, outPath)}  (${provincial.length} provincial + ${federal.length} federal)`);
  written++;
}
console.log(`\nDone. ${written} files written.`);
console.log('Don\'t forget to add these URLs to sitemap.xml.');
