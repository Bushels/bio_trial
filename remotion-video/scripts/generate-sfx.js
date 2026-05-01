// Synthesize placeholder SFX for the farmer-explainer video.
//
// These are synthetic WAV files generated from first principles (sine waves,
// filtered noise, envelopes). They demonstrate cue timing and give an audio
// draft to audition against the video — but they are NOT broadcast-quality
// Foley. Replace with real recordings before final delivery.
//
// Run:  node scripts/generate-sfx.js
// Out:  public/sfx/*.wav  (24 files, ~5-8 MB total)

const fs = require("fs");
const path = require("path");

const SR = 44100; // sample rate (Hz)

// ───────────── WAV writer (PCM 16-bit mono) ─────────────

function writeWav(filename, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, buf);
}

// ───────────── primitives ─────────────

const len = (sec) => Math.round(sec * SR);

function noise(dur) {
  const out = new Float64Array(len(dur));
  for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

function sine(freq, dur, phase = 0) {
  const out = new Float64Array(len(dur));
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.sin(2 * Math.PI * freq * (i / SR) + phase);
  }
  return out;
}

// ADSR envelope over dur seconds
function adsr(dur, a = 0.005, d = 0.05, sustain = 0.3, r = 0.1) {
  const n = len(dur);
  const out = new Float64Array(n);
  const aS = Math.max(1, Math.round(a * SR));
  const dS = Math.max(1, Math.round(d * SR));
  const rS = Math.max(1, Math.round(r * SR));
  const sS = Math.max(0, n - aS - dS - rS);
  for (let i = 0; i < n; i++) {
    if (i < aS) out[i] = i / aS;
    else if (i < aS + dS) out[i] = 1 - (1 - sustain) * ((i - aS) / dS);
    else if (i < aS + dS + sS) out[i] = sustain;
    else out[i] = Math.max(0, sustain * (1 - (i - aS - dS - sS) / rS));
  }
  return out;
}

// exponential decay envelope — nice for percussive hits
function exp_env(dur, tau = 0.1, attack = 0.005) {
  const n = len(dur);
  const out = new Float64Array(n);
  const aS = Math.round(attack * SR);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const atk = i < aS ? i / aS : 1;
    out[i] = atk * Math.exp(-t / tau);
  }
  return out;
}

function lowpass(samples, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const a = dt / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0] * a;
  for (let i = 1; i < samples.length; i++) {
    out[i] = out[i - 1] + a * (samples[i] - out[i - 1]);
  }
  return out;
}

function highpass(samples, cutoff) {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / SR;
  const a = rc / (rc + dt);
  const out = new Float64Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = a * (out[i - 1] + samples[i] - samples[i - 1]);
  }
  return out;
}

function mul(a, b) {
  const n = Math.min(a.length, b.length);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] * b[i];
  return out;
}

function add(...arrs) {
  const n = Math.max(...arrs.map((a) => a.length));
  const out = new Float64Array(n);
  for (const a of arrs) for (let i = 0; i < a.length; i++) out[i] += a[i] || 0;
  return out;
}

function scale(a, g) {
  const out = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * g;
  return out;
}

function concat(...arrs) {
  const total = arrs.reduce((s, a) => s + a.length, 0);
  const out = new Float64Array(total);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

const silence = (dur) => new Float64Array(len(dur));

// Normalise to a peak level (0..1)
function normalise(a, peak = 0.85) {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  if (m < 1e-6) return a;
  return scale(a, peak / m);
}

// ───────────── SFX recipes ─────────────

function typewriterTap() {
  const n = mul(noise(0.06), adsr(0.06, 0.001, 0.02, 0));
  const hp = highpass(n, 1200);
  const ting = mul(sine(2800, 0.03), exp_env(0.03, 0.008));
  return normalise(add(hp, scale(ting, 0.35)), 0.75);
}

function typewriterDing() {
  const tone = add(sine(1800, 0.4), scale(sine(3600, 0.4), 0.4));
  const env = exp_env(0.4, 0.14, 0.003);
  return normalise(mul(tone, env), 0.45);
}

function stampThunk() {
  const low = mul(sine(85, 0.35), exp_env(0.35, 0.12, 0.002));
  const slap = mul(noise(0.15), exp_env(0.15, 0.04, 0.002));
  const thud = lowpass(slap, 400);
  return normalise(add(low, scale(thud, 0.5)), 0.9);
}

function markerSmall() {
  const n = noise(0.67);
  const env = adsr(0.67, 0.02, 0.15, 0.6, 0.2);
  const filtered = lowpass(highpass(n, 300), 2500);
  const out = new Float64Array(filtered.length);
  for (let i = 0; i < filtered.length; i++) {
    const t = i / SR;
    const friction = 0.65 + 0.35 * Math.sin(2 * Math.PI * 50 * t);
    out[i] = filtered[i] * env[i] * friction;
  }
  return normalise(out, 0.8);
}

function markerBig() {
  const n = noise(0.83);
  const env = adsr(0.83, 0.03, 0.2, 0.65, 0.25);
  const filtered = lowpass(highpass(n, 250), 2200);
  const out = new Float64Array(filtered.length);
  for (let i = 0; i < filtered.length; i++) {
    const t = i / SR;
    const friction = 0.65 + 0.35 * Math.sin(2 * Math.PI * 40 * t);
    out[i] = filtered[i] * env[i] * friction;
  }
  return normalise(out, 0.85);
}

function highlighter() {
  const n = noise(0.83);
  const env = adsr(0.83, 0.06, 0.2, 0.7, 0.3);
  const filtered = lowpass(highpass(n, 200), 3500);
  return normalise(mul(filtered, env), 0.75);
}

function pencilScribble(dur = 1.0) {
  const n = noise(dur);
  const env = adsr(dur, 0.03, 0.1, 0.6, 0.1);
  const filtered = lowpass(highpass(n, 500), 4000);
  const out = new Float64Array(filtered.length);
  for (let i = 0; i < filtered.length; i++) {
    const t = i / SR;
    const strokes = 0.4 + 0.6 * Math.abs(Math.sin(2 * Math.PI * 16 * t));
    out[i] = filtered[i] * env[i] * strokes;
  }
  return normalise(out, 0.7);
}

function pencilDot() {
  const n = mul(noise(0.1), exp_env(0.1, 0.03, 0.003));
  return normalise(highpass(n, 800), 0.55);
}

function odometerClick() {
  const n = mul(noise(0.03), adsr(0.03, 0.0005, 0.015, 0));
  return normalise(highpass(n, 2000), 0.8);
}

function cardSlap(variant = 0) {
  const dur = 0.3;
  const n = mul(noise(dur), exp_env(dur, 0.05, 0.002));
  const hp = highpass(n, 600);
  const thud = mul(sine(120 + variant * 15, 0.12), exp_env(0.12, 0.04, 0.002));
  return normalise(add(hp, scale(thud, 0.45)), 0.75);
}

function penTick() {
  const one = scale(pencilDot(), 0.8);
  const gap = silence(0.06);
  const two = scale(pencilDot(), 0.7);
  return concat(one, gap, two);
}

function phoneThunk() {
  const low = mul(sine(110, 0.35), exp_env(0.35, 0.12, 0.003));
  const rattle = mul(noise(0.15), exp_env(0.15, 0.04, 0.005));
  const hp = highpass(rattle, 1500);
  return normalise(add(low, scale(hp, 0.25)), 0.85);
}

function telegramPopSend() {
  const dur = 0.15;
  const n = len(dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = 500 + 700 * (t / dur);
    const env = t < 0.003 ? t / 0.003 : Math.exp(-10 * t);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env;
  }
  return normalise(out, 0.6);
}

function telegramPopReceive() {
  const dur = 0.22;
  const n = len(dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = t < 0.08 ? 700 : 900;
    const env = t < 0.003 ? t / 0.003 : Math.exp(-7 * t);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env;
  }
  return normalise(out, 0.55);
}

function telegramConfirmChime() {
  const dur = 0.55;
  const n = len(dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const tones = Math.sin(2 * Math.PI * 523 * t) + 0.8 * Math.sin(2 * Math.PI * 659 * t + 0.3);
    const env = Math.exp(-3 * t);
    out[i] = tones * env;
  }
  return normalise(out, 0.5);
}

function whooshLow() {
  const dur = 0.5;
  const n = noise(dur);
  const env = new Float64Array(n.length);
  for (let i = 0; i < env.length; i++) {
    const t = i / SR;
    const x = t / dur;
    env[i] = x < 0.6 ? Math.pow(x / 0.6, 1.5) : Math.pow(1 - (x - 0.6) / 0.4, 1.2);
  }
  return normalise(mul(lowpass(n, 1200), env), 0.7);
}

function barWhoosh(up = true) {
  const dur = 0.4;
  const n = len(dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = t < 0.015 ? t / 0.015 : Math.exp(-2.5 * t);
    const freq = up ? 300 + 1200 * (t / dur) : 800 - 600 * (t / dur);
    const tone = Math.sin(2 * Math.PI * freq * t) * 0.3;
    const noi = (Math.random() * 2 - 1) * 0.5;
    out[i] = (tone + noi) * env;
  }
  return normalise(lowpass(out, up ? 3000 : 2000), 0.7);
}

function paperRustle(dur = 0.8) {
  const n = noise(dur);
  const filtered = highpass(n, 2000);
  const env = new Float64Array(n.length);
  for (let i = 0; i < env.length; i++) {
    const t = i / SR;
    const fade =
      t < 0.05 ? t / 0.05 : t > dur - 0.1 ? Math.max(0, (dur - t) / 0.1) : 1;
    const texture =
      0.3 + 0.7 * Math.abs(Math.sin(2 * Math.PI * 12 * t) * Math.sin(2 * Math.PI * 35 * t));
    env[i] = fade * texture;
  }
  return normalise(mul(filtered, env), 0.55);
}

// 2-second seamlessly-looping granular tick bed
function counterBed() {
  const dur = 2.0;
  const n = len(dur);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    if (Math.random() > 0.996) out[i] = (Math.random() * 2 - 1) * 0.4;
  }
  const hp = highpass(out, 1500);
  // crossfade endpoints for clean loop
  const xf = Math.round(0.05 * SR);
  for (let i = 0; i < xf; i++) {
    hp[i] *= i / xf;
    hp[hp.length - 1 - i] *= i / xf;
  }
  return normalise(hp, 0.55);
}

// 3-second very quiet room-tone loop
function deskAmbient() {
  const dur = 3.0;
  const n = noise(dur);
  const lp = lowpass(n, 200);
  const xf = Math.round(0.1 * SR);
  for (let i = 0; i < xf; i++) {
    lp[i] *= i / xf;
    lp[lp.length - 1 - i] *= i / xf;
  }
  return scale(lp, 0.18);
}

// ───────────── write all files ─────────────

const OUT = path.join(__dirname, "..", "public", "sfx");
fs.mkdirSync(OUT, { recursive: true });

const recipes = {
  "typewriter-tap.wav": typewriterTap(),
  "typewriter-ding.wav": typewriterDing(),
  "stamp-thunk.wav": stampThunk(),
  "marker-small.wav": markerSmall(),
  "marker-big.wav": markerBig(),
  "highlighter.wav": highlighter(),
  "pencil-scribble-1.wav": pencilScribble(1.0),
  "pencil-dot.wav": pencilDot(),
  "odometer-click.wav": odometerClick(),
  "card-slap-1.wav": cardSlap(0),
  "card-slap-2.wav": cardSlap(1),
  "card-slap-3.wav": cardSlap(2),
  "card-slap-4.wav": cardSlap(3),
  "pen-tick.wav": penTick(),
  "phone-thunk.wav": phoneThunk(),
  "telegram-pop-send.wav": telegramPopSend(),
  "telegram-pop-receive.wav": telegramPopReceive(),
  "telegram-confirm-chime.wav": telegramConfirmChime(),
  "whoosh-low.wav": whooshLow(),
  "bar-whoosh-up.wav": barWhoosh(true),
  "bar-whoosh-down.wav": barWhoosh(false),
  "paper-rustle-1.wav": paperRustle(0.8),
  "counter-bed.wav": counterBed(),
  "desk-ambient.wav": deskAmbient(),
};

let total = 0;
for (const [name, samples] of Object.entries(recipes)) {
  const filepath = path.join(OUT, name);
  writeWav(filepath, samples);
  const sec = samples.length / SR;
  const kb = (samples.length * 2 + 44) / 1024;
  total += samples.length * 2 + 44;
  console.log(`  ${name.padEnd(32)} ${sec.toFixed(2)}s  ${kb.toFixed(0)} KB`);
}
console.log(
  `\nGenerated ${Object.keys(recipes).length} SFX files in ${OUT}\n` +
    `Total: ${(total / 1024 / 1024).toFixed(2)} MB`
);
