// Sound effect cue sheet — mirrors docs/sound-script.md.
// Each cue is absolute-frame-indexed against the full 900-frame composition.
//
// Fields:
//   frame    — global frame where the sound should start
//   file     — filename in public/sfx/
//   volume   — 0..1 (converted from the dB target in the script)
//   label    — for your own debugging; also shown in Remotion Studio dev markers
//   loop     — repeat the clip (for ambient beds)
//
// Missing files are silently skipped at render time by SoundTrack.tsx,
// so you can add SFX incrementally without breaking renders.

export type SfxCue = {
  frame: number;
  file: string;
  volume: number;
  label: string;
  loop?: boolean;
};

// dB → linear gain (vol = 10^(dB/20))
const db = (d: number) => Math.pow(10, d / 20);

export const SFX_CUES: SfxCue[] = [
  // ── Act 1: Hook ─────────────────────────────────────────────
  { frame: 0,   file: "paper-rustle-1.mp3",   volume: db(-15), label: "1.1 scene-load rustle" },
  // typewriter taps — 17 strikes spread over frames 5..55 (1.67s)
  ...Array.from({ length: 17 }, (_, i) => ({
    frame: 5 + Math.round(i * (50 / 17)),
    file: "typewriter-tap.mp3",
    volume: db(-12),
    label: `1.2 typewriter tap #${i + 1}`,
  })),
  { frame: 50,  file: "stamp-thunk.mp3",      volume: db(-4),  label: "1.3 cooperator stamp" },
  { frame: 55,  file: "typewriter-ding.mp3",  volume: db(-10), label: "1.4 carriage ding" },
  { frame: 60,  file: "marker-small.mp3",     volume: db(-5),  label: "1.5 red strike-through" },
  { frame: 70,  file: "pencil-scribble-1.mp3",volume: db(-10), label: "1.6 'we want real numbers'" },

  // ── Act 2: Offer ────────────────────────────────────────────
  { frame: 120, file: "paper-rustle-1.mp3",   volume: db(-8),  label: "2.1 receipt tilts in" },
  // odometer clicks — 14 ticks, accelerating then decelerating over frames 140..230
  ...odometerTicks(140, 230, 14).map((f, i) => ({
    frame: f,
    file: "odometer-click.mp3",
    volume: db(-8),
    label: `2.2 odometer tick #${i + 1}`,
  })),
  { frame: 155, file: "marker-big.mp3",       volume: db(-6),  label: "2.3 $2.80 marker" },
  { frame: 230, file: "pencil-scribble-1.mp3",volume: db(-12), label: "2.4 '80 acres → 40 L'" },

  // ── Act 3: Claims ───────────────────────────────────────────
  { frame: 280, file: "card-slap-1.mp3",      volume: db(-6),  label: "3.1 card 1 lands" },
  { frame: 294, file: "pen-tick.mp3",         volume: db(-8),  label: "3.2 check 1" },
  { frame: 302, file: "card-slap-2.mp3",      volume: db(-6),  label: "3.3 card 2 lands" },
  { frame: 316, file: "pen-tick.mp3",         volume: db(-8),  label: "3.4 check 2" },
  { frame: 324, file: "card-slap-3.mp3",      volume: db(-6),  label: "3.5 card 3 lands" },
  { frame: 338, file: "pen-tick.mp3",         volume: db(-8),  label: "3.6 check 3" },
  { frame: 346, file: "card-slap-4.mp3",      volume: db(-6),  label: "3.7 card 4 lands" },
  { frame: 360, file: "pen-tick.mp3",         volume: db(-8),  label: "3.8 check 4" },

  // ── Act 4: How It Works ─────────────────────────────────────
  { frame: 462, file: "pencil-dot.mp3",       volume: db(-10), label: "4.1 step 01 dot" },
  { frame: 470, file: "phone-thunk.mp3",      volume: db(-6),  label: "4.5 phone lands" },
  { frame: 476, file: "pencil-dot.mp3",       volume: db(-10), label: "4.2 step 02 dot" },
  { frame: 490, file: "pencil-dot.mp3",       volume: db(-10), label: "4.3 step 03 dot" },
  { frame: 500, file: "telegram-pop-send.mp3",volume: db(-6),  label: "4.6 bubble 1 /apply" },
  { frame: 504, file: "pencil-dot.mp3",       volume: db(-10), label: "4.4 step 04 dot" },
  { frame: 520, file: "telegram-pop-receive.mp3", volume: db(-6), label: "4.7 bubble 2 bot reply" },
  { frame: 545, file: "telegram-pop-send.mp3",volume: db(-6),  label: "4.8 bubble 3 user" },
  { frame: 570, file: "telegram-pop-receive.mp3", volume: db(-6), label: "4.9a bubble 4 bot" },
  { frame: 574, file: "telegram-confirm-chime.mp3", volume: db(-5), label: "4.9b success chime" },

  // ── Act 5: Scoreboard ───────────────────────────────────────
  { frame: 630, file: "whoosh-low.mp3",       volume: db(-8),  label: "5.1 scoreboard whoosh" },
  { frame: 635, file: "counter-bed.mp3",      volume: db(-14), label: "5.2 counter bed" },
  { frame: 658, file: "bar-whoosh-up.mp3",    volume: db(-8),  label: "5.3 canola +2.6" },
  { frame: 668, file: "bar-whoosh-up.mp3",    volume: db(-9),  label: "5.4 wheat +1.8" },
  { frame: 678, file: "bar-whoosh-up.mp3",    volume: db(-10), label: "5.5 peas +0.4" },
  { frame: 688, file: "bar-whoosh-down.mp3",  volume: db(-10), label: "5.6 barley -0.3" },

  // ── Act 6: CTA ──────────────────────────────────────────────
  { frame: 800, file: "marker-big.mp3",       volume: db(-4),  label: "6.1 URL marker" },
  { frame: 815, file: "highlighter.mp3",      volume: db(-6),  label: "6.2 yellow underline" },
  { frame: 855, file: "pencil-scribble-1.mp3",volume: db(-10), label: "6.3 tagline" },
  { frame: 895, file: "stamp-thunk.mp3",      volume: db(-4),  label: "6.4 end-card stamp" },

  // ── Ambient bed (loops entire video) ────────────────────────
  { frame: 0,   file: "desk-ambient.mp3",     volume: db(-28), label: "ambient bed", loop: true },
];

// Spread N clicks across [startFrame..endFrame] with an ease-in-out curve so
// the odometer speeds up, then decelerates into its final value.
function odometerTicks(startFrame: number, endFrame: number, n: number): number[] {
  const frames: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    // ease-in-out cubic
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    frames.push(Math.round(startFrame + eased * (endFrame - startFrame)));
  }
  return frames;
}
