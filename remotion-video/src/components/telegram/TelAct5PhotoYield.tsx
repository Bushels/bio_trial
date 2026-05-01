import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { TEL_ACTS } from "./schedule";
import { Bubble, Chip, TelegramPhone, TG } from "./TelegramPhone";

// Act 5 — Two remaining workflows that cover the rest of the season:
// (1) sending a photo — any photo you drop in gets logged automatically
// (2) /yield <number> at harvest — the one event we care about most
export const TelAct5PhotoYield: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.photoYield.start;
  const dur = TEL_ACTS.photoYield.end - TEL_ACTS.photoYield.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ opacity, padding: "70px 80px 90px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div
          style={{
            fontFamily: FONTS.typewriter,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.soilDeep,
            fontSize: 22,
            opacity: 0.78,
          }}
        >
          Step 04 · Through the season
        </div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 68, color: COLORS.ink, marginTop: 4, lineHeight: 1 }}>
          Send a photo. Send your yield. That&apos;s it.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 110,
          alignItems: "center",
          width: "100%",
          maxWidth: 1620,
        }}
      >
        <PhotoColumn local={local} />
        <YieldColumn local={local} />
      </div>
    </AbsoluteFill>
  );
};

const fadeIn = (local: number, start: number, end: number) =>
  interpolate(local, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const PhotoColumn: React.FC<{ local: number }> = ({ local }) => {
  const caption = fadeIn(local, 30, 48);
  const photoBubble = fadeIn(local, 58, 84);
  const confirm = fadeIn(local, 96, 118);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <CornerLabel>Photo at emergence or mid-season</CornerLabel>
      <TelegramPhone
        enterAtFrame={TEL_ACTS.photoYield.start + 4}
        rotate={-3}
        scale={0.82}
        tapeTop={false}
      >
        <Bubble side="bot" opacity={caption}>
          <div style={{ fontSize: 13, color: TG.textDim }}>
            Any photo you send gets attached to your trial.
          </div>
        </Bubble>
        <div style={{ alignSelf: "flex-end", opacity: photoBubble, maxWidth: "78%" }}>
          <FieldPhoto />
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: TG.textDim,
              textAlign: "right",
              fontFamily: FONTS.ui,
            }}
          >
            sent · 2026-07-02
          </div>
        </div>
        <Bubble side="bot" opacity={confirm}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: TG.accent, fontSize: 18, fontWeight: 700 }}>OK</span>
            <span style={{ fontSize: 15 }}>Photo logged to South 80.</span>
          </div>
          <div style={{ fontSize: 12, color: TG.textDim, marginTop: 4 }}>
            Opt-in to show on the public board? Tap the checkbox in your dashboard.
          </div>
        </Bubble>
      </TelegramPhone>
    </div>
  );
};

const YieldColumn: React.FC<{ local: number }> = ({ local }) => {
  const userCmd = fadeIn(local, 32, 50);
  const whichField = fadeIn(local, 58, 72);
  const fieldPick = fadeIn(local, 84, 100);
  const logged = fadeIn(local, 110, 130);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
      <CornerLabel>The harvest number we care about</CornerLabel>
      <TelegramPhone
        enterAtFrame={TEL_ACTS.photoYield.start + 10}
        rotate={2.8}
        scale={0.82}
        tapeTop={false}
      >
        <Bubble side="user" opacity={userCmd}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 16 }}>/yield 52.3</span>
        </Bubble>
        <Bubble side="bot" opacity={whichField}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Which field?</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip>South 80</Chip>
            <Chip>Home quarter</Chip>
          </div>
        </Bubble>
        <Bubble side="user" opacity={fieldPick}>
          <Chip active>South 80</Chip>
        </Bubble>
        <Bubble side="bot" opacity={logged}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: TG.accent, fontSize: 18, fontWeight: 700 }}>OK</span>
            <span style={{ fontSize: 15 }}>52.3 bu/ac logged. Harvest 2026.</span>
          </div>
          <div style={{ fontSize: 12, color: TG.textDim, marginTop: 4 }}>
            Moisture, grade, scale ticket? Send as a reply.
          </div>
        </Bubble>
      </TelegramPhone>
    </div>
  );
};

const CornerLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: FONTS.handwritten,
      fontSize: 32,
      color: COLORS.crimson,
      transform: "rotate(-1.8deg)",
    }}
  >
    {children}
  </div>
);

// A stylized field/canopy photo rendered as SVG so we don't need an image asset
const FieldPhoto: React.FC = () => (
  <div
    style={{
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
      border: "2px solid #25384a",
    }}
  >
    <svg width={220} height={150} viewBox="0 0 220 150">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#b8d4e8" />
          <stop offset="100%" stopColor="#e8d89c" />
        </linearGradient>
        <linearGradient id="canopy" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#7fa54e" />
          <stop offset="100%" stopColor="#3d7a2f" />
        </linearGradient>
      </defs>
      <rect width="220" height="82" fill="url(#sky)" />
      <rect y="82" width="220" height="68" fill="url(#canopy)" />
      {/* canopy rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <path
          key={i}
          d={`M0 ${92 + i * 10} Q 110 ${86 + i * 10} 220 ${94 + i * 10}`}
          stroke="rgba(42,86,32,0.55)"
          strokeWidth="1.4"
          fill="none"
        />
      ))}
      {/* sun glow */}
      <circle cx="170" cy="30" r="16" fill="rgba(255, 240, 180, 0.85)" />
      {/* horizon tractor dot */}
      <rect x="28" y="77" width="14" height="6" fill="#6b4a2b" rx="1" />
    </svg>
  </div>
);
