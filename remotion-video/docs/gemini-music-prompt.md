# Gemini Music Creator — Prompt for Bio-Trial Farmer Explainer

**How to use:** open Gemini (or Gemini Music creator), attach `out/bio-trial-farmer.mp4` as a reference video, and paste the block below as the prompt. Gemini will sync the generated audio to your actual cut rather than guessing timings.

If the model pushes back on running the full 30 seconds in one shot, generate it in two 15-second halves (Acts 1–3 then Acts 4–6) and splice in post.

---

## Copy-paste prompt

```
Create a 30-second diegetic sound design track for this video. The attached MP4 is the locked cut — sync every hit to the frames shown. No musical bed, no melodies, no synth pads. This is an "agronomist's desk" aesthetic: paper, typewriter, rubber stamp, felt-tip marker, pencil, with a subtle analog-to-digital shift at 15 s when we move from the field journal to a phone screen.

STYLE
- Palette: mechanical typewriter, rubber stamp on wood, felt-tip marker squeak on paper, pencil scribble, paper rustle, cardstock slap. All mono except the phone/UI elements in seconds 15–25 which can be subtle stereo.
- Tone: tactile, warm, slightly vintage. Imagine a farmer's kitchen table at dusk — no room reverb beyond a short natural tail.
- Absolutely no music: no chords, no pads, no percussion loops, no strings, no piano, no drones. If you add a bed, make it room tone (faint desk ambience, refrigerator hum, barn in the distance) at -28 dBFS.
- Master target: -14 LUFS integrated, true-peak -1 dBTP. Foreground SFX -6 to -3 dBFS. Background SFX -18 to -12 dBFS.

ACT-BY-ACT CUE SHEET (sync to the video)

Act 1 — Hook (0.0–4.0 s)
- 0.00 s: single paper rustle / sheet shuffle, 0.8 s (-15 dB)
- 0.17–1.83 s: mechanical typewriter — ~17 irregular key-strikes while the headline "Biostimulants are full of marketing" types on screen (-12 dB)
- 1.67 s: rubber stamp THUNK landing (wooden handle, single impact, short reverb tail) when the "COOPERATOR PRICING $2.80/ac" stamp lands bottom-right (-4 dB, this is a hero hit)
- 1.83 s: optional typewriter carriage ding (warm bell) at end of line
- 2.00–2.67 s: felt-tip MARKER SQUEAK — single wet red stroke as "marketing" is struck through (-5 dB, hero hit)
- 2.33–3.33 s: pencil/pen scribble as the handwritten "this one lives or dies on the data." line appears (-10 dB)

Act 2 — Offer (4.0–9.0 s)
- 4.00 s: paper flutter + soft wooden thunk as the receipt tilts in (-8 dB)
- 4.67–7.67 s: MECHANICAL ODOMETER CLICKS — 12–16 discrete ticks, ease-in then ease-out, as numbers roll 0000 → 01450. Bright and short, each click distinguishable (-8 dB, hero sequence)
- 5.17–6.00 s: bigger, wetter marker squeak when "$2.80" price reveal appears in green marker (-6 dB)
- 7.67–8.50 s: shorter pencil scribble for the "80 acres → 40 L → $224" handwriting (-12 dB)

Act 3 — Claims (9.0–15.0 s)
Four note-cards slap down sequentially. Each card is a paper-on-wood slap (-6 dB) followed ~0.4 s later by a quick pen-tick checkmark (two strokes, -8 dB). Use a slightly different card-slap texture each time — don't let them feel identical.
- 9.33 s card 1 slap → 9.80 s pen tick
- 10.07 s card 2 slap → 10.53 s pen tick
- 10.80 s card 3 slap → 11.27 s pen tick
- 11.53 s card 4 slap → 12.00 s pen tick
Faint tape-rip undertone on each slap is welcome.

Act 4 — How it works (15.0–20.0 s)
This is the analog→digital bridge. Keep the desk feel but introduce the phone.
- 15.00 s: soft low whoosh as we transition to the phone/steps view (-14 dB)
- 15.33 / 16.33 / 17.33 / 18.33 s: four small pen-ticks / highlighter strokes revealing the 4 steps (-10 dB)
- ~17.5 s: a single TELEGRAM "pop" (the classic short bubble pop, -8 dB) as a bot message appears on the phone mock
- ~18.5 s: second telegram pop, slightly different pitch (reply)
- ~19.0 s: subtle confirm chime (single soft tone, -12 dB) — this is the ONLY pitched element permitted in the whole track; keep it brief and bell-like

Act 5 — Scoreboard (20.0–25.0 s)
- 20.00 s: paper/cardstock slap as the scoreboard panel lands (-6 dB)
- 20.5–23.5 s: four soft bar-growth whooshes timed to each crop bar animating up/down — very low-amplitude, airy, -16 dB, one per bar
- 23.0 s: tiny pen tick as the "illustrative" stamp/label settles (-10 dB)

Act 6 — CTA (25.0–30.0 s)
- 25.00 s: final paper-rustle settle (-12 dB)
- 25.5–26.5 s: yellow-highlighter stroke across "trial.buperac.com" — broad felt-tip drag, 1 s, warm and confident (-6 dB, closing hero hit)
- 27.0 s: faint rubber stamp or pen tick punctuating the sign-off (-10 dB)
- 28.0–30.0 s: let the room tone ride out; end on silence, not a musical button

DELIVERABLE
One stereo WAV, 48 kHz, 24-bit, 30.000 seconds, -14 LUFS integrated. Do not include any music, melody, rhythm loops, or synthesized instruments. Every sound must be plausibly something you'd hear at a desk with paper, pen, marker, stamp, typewriter, and a phone.
```

---

## Notes for iteration

If Gemini produces a version with music you didn't ask for, reply: **"Remove all music, chords, pads, and rhythm. Keep only the diegetic desk SFX: paper, typewriter, stamp, marker, pencil, card slaps, odometer clicks, telegram pops, highlighter. Regenerate at -14 LUFS."**

If the odometer ticks feel too mechanical/uniform, reply: **"Make the odometer 12–16 ticks feel human — ease-in then ease-out, with slight irregularity. Each click should be bright but not identical."**

If it sounds too clean, ask for **"tape hiss at -32 dBFS underneath, light room tone, vintage warmth."**
