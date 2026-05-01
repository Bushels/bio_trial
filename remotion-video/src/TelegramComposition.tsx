import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS } from "./theme";
import { PaperBackground } from "./components/PaperBackground";
import { TelAct1Hook } from "./components/telegram/TelAct1Hook";
import { TelAct2FindBot } from "./components/telegram/TelAct2FindBot";
import { TelAct3Bind } from "./components/telegram/TelAct3Bind";
import { TelAct4Apply } from "./components/telegram/TelAct4Apply";
import { TelAct5PhotoYield } from "./components/telegram/TelAct5PhotoYield";
import { TelAct6CTA } from "./components/telegram/TelAct6CTA";
import { TEL_ACTS } from "./components/telegram/schedule";

export { TEL_ACTS, TEL_DURATION, TEL_FPS } from "./components/telegram/schedule";

export const TelegramComposition: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COLORS.kraft }}>
      <PaperBackground />

      {inRange(frame, TEL_ACTS.hook.start       - 5, TEL_ACTS.hook.end       + 5) && <TelAct1Hook />}
      {inRange(frame, TEL_ACTS.findBot.start    - 5, TEL_ACTS.findBot.end    + 5) && <TelAct2FindBot />}
      {inRange(frame, TEL_ACTS.bind.start       - 5, TEL_ACTS.bind.end       + 5) && <TelAct3Bind />}
      {inRange(frame, TEL_ACTS.apply.start      - 5, TEL_ACTS.apply.end      + 5) && <TelAct4Apply />}
      {inRange(frame, TEL_ACTS.photoYield.start - 5, TEL_ACTS.photoYield.end + 5) && <TelAct5PhotoYield />}
      {inRange(frame, TEL_ACTS.cta.start        - 5, TEL_ACTS.cta.end        + 5) && <TelAct6CTA />}

      <BrandMark />
      <ActChip />
    </AbsoluteFill>
  );
};

const inRange = (f: number, a: number, b: number) => f >= a && f <= b;

const BrandMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 40,
      left: 50,
      fontFamily: FONTS.marker,
      color: COLORS.soilDeep,
      fontSize: 26,
      letterSpacing: 4,
      opacity: 0.72,
    }}
  >
    buperac<span style={{ color: COLORS.green }}>.</span>trial
  </div>
);

// Small top-right chip that names the current act — helps first-time viewers
// know which of the four steps they're on without a full table of contents.
const ActChip: React.FC = () => {
  const frame = useCurrentFrame();
  let label: string | null = null;
  if (inRange(frame, TEL_ACTS.findBot.start, TEL_ACTS.findBot.end)) label = "01 · find the bot";
  else if (inRange(frame, TEL_ACTS.bind.start, TEL_ACTS.bind.end)) label = "02 · connect to trial";
  else if (inRange(frame, TEL_ACTS.apply.start, TEL_ACTS.apply.end)) label = "03 · log an application";
  else if (inRange(frame, TEL_ACTS.photoYield.start, TEL_ACTS.photoYield.end)) label = "04 · photos and yield";

  if (!label) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        right: 50,
        padding: "10px 16px",
        borderRadius: 999,
        background: "rgba(255,248,234,0.78)",
        boxShadow: "0 8px 18px -12px rgba(40,20,10,0.45)",
        fontFamily: FONTS.typewriter,
        fontSize: 20,
        letterSpacing: 3,
        textTransform: "uppercase",
        color: COLORS.soilDeep,
      }}
    >
      {label}
    </div>
  );
};
