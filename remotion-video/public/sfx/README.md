# SFX drop folder

Drop royalty-free `.mp3` files here using the exact filenames listed in
[`docs/sound-script.md`](../../docs/sound-script.md) — the video will pick them
up on the next `npx remotion render` (no code changes needed).

## How this works

1. [`src/sfxCues.ts`](../../src/sfxCues.ts) is the cue sheet (frame → file → volume).
2. [`src/components/SoundTrack.tsx`](../../src/components/SoundTrack.tsx) renders an `<Audio>` tag per cue, wrapped in an error boundary.
3. Missing files are silently skipped at render time — **you can add files one at a time** and re-render to progressively hear the track build up.

## Required filenames (24 total; see `sound-script.md` for the full spec)

```
paper-rustle-1.mp3         stamp-thunk.mp3             card-slap-1.mp3
typewriter-tap.mp3         marker-small.mp3            card-slap-2.mp3
typewriter-ding.mp3        marker-big.mp3              card-slap-3.mp3
pencil-scribble-1.mp3      highlighter.mp3             card-slap-4.mp3
pencil-dot.mp3             pen-tick.mp3                phone-thunk.mp3
odometer-click.mp3         whoosh-low.mp3              counter-bed.mp3
bar-whoosh-up.mp3          bar-whoosh-down.mp3         telegram-pop-send.mp3
telegram-pop-receive.mp3   telegram-confirm-chime.mp3  desk-ambient.mp3
```

## Mix tips

- Keep files **mono** unless specifically noted (whooshes, pops — stereo OK).
- Normalize to roughly -6 dBFS peak; the cue sheet applies the per-cue attenuation.
- Trim silence from the start of each file — cues trigger on the first sample.
- For the looping `counter-bed.mp3` and `desk-ambient.mp3`, make sure the loop seam is clean (zero-crossing snap).

## License discipline

This video is commercial. Use only:
- **CC0** (preferred — no attribution needed)
- **CC-BY** (keep an attributions file in this folder)
- Paid assets from Epidemic/Artlist/Uppbeat/Zapsplat (keep subscription receipt)

**Do NOT use** anything marked CC-BY-NC or with a "non-commercial only" clause.

If you use CC-BY tracks, create `ATTRIBUTIONS.md` here listing each filename, source URL, author, and license.
