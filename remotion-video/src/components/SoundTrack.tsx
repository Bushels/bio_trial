import React, { useEffect, useState } from "react";
import { Audio, Sequence, staticFile, delayRender, continueRender } from "remotion";
import { SFX_CUES, SfxCue } from "../sfxCues";

// SFX track — reads cues from sfxCues.ts and renders an <Audio> per cue.
//
// Preflight: Remotion's <Audio> uses delayRender() internally to fetch media
// duration. A missing file hangs the render for 28s and then fails. So we
// HEAD-check each unique file up-front and only render cues whose files exist.
// Missing files are silently skipped with a console warning — you can drop
// SFX files into public/sfx/ one at a time and re-render progressively.

type Props = {
  enabled?: boolean;
};

export const SoundTrack: React.FC<Props> = ({ enabled = true }) => {
  const available = useAvailableSfxFiles(enabled);

  if (!enabled || available === null) return null;

  return (
    <>
      {SFX_CUES.filter((cue) => available.has(cue.file)).map((cue, i) => (
        <Sequence key={`${cue.file}-${cue.frame}-${i}`} from={cue.frame} layout="none">
          <Audio
            src={staticFile(`sfx/${cue.file}`)}
            volume={cue.volume}
            loop={cue.loop}
          />
        </Sequence>
      ))}
    </>
  );
};

// HEAD-check every unique SFX filename against the public folder. Returns a
// Set of filenames that actually exist. Blocks Remotion rendering via
// delayRender until the check completes.
function useAvailableSfxFiles(enabled: boolean): Set<string> | null {
  const [available, setAvailable] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAvailable(new Set());
      return;
    }

    const handle = delayRender("SFX file preflight (HEAD checks)");
    const uniqueFiles = Array.from(new Set(SFX_CUES.map((c) => c.file)));

    Promise.all(
      uniqueFiles.map(async (file) => {
        try {
          const res = await fetch(staticFile(`sfx/${file}`), { method: "HEAD" });
          return res.ok ? file : null;
        } catch {
          return null;
        }
      })
    )
      .then((results) => {
        const found = results.filter((x): x is string => x !== null);
        const missing = uniqueFiles.filter((f) => !found.includes(f));
        if (missing.length > 0) {
          // eslint-disable-next-line no-console
          console.warn(
            `[sfx] ${found.length}/${uniqueFiles.length} SFX files present. ` +
              `Missing (skipped silently): ${missing.join(", ")}`
          );
        }
        setAvailable(new Set(found));
        continueRender(handle);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[sfx] preflight failed, disabling SFX track:", err);
        setAvailable(new Set());
        continueRender(handle);
      });
  }, [enabled]);

  return available;
}
