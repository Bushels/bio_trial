import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { TEL_ACTS } from "./schedule";

export const TelAct1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.hook.start;
  const dur = TEL_ACTS.hook.end - TEL_ACTS.hook.start;

  const enter = spring({ fps, frame: local, config: { damping: 16, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  const planeSpring = spring({
    fps,
    frame: Math.max(0, local - 6),
    config: { damping: 14, mass: 0.7, stiffness: 140 },
  });

  const typewriter = "How to log your trial from your phone";
  const chars = Math.floor(
    interpolate(local, [4, 46], [0, typewriter.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  const subAppear = interpolate(local, [50, 76], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center", padding: 90 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <TelegramPlane scale={planeSpring} />

        <div
          style={{
            fontFamily: FONTS.typewriter,
            fontSize: 28,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.soilDeep,
            opacity: 0.78,
          }}
        >
          {typewriter.slice(0, chars)}
          {chars < typewriter.length && (
            <span style={{ opacity: (local % 16) < 8 ? 1 : 0 }}>|</span>
          )}
        </div>

        <div
          style={{
            fontFamily: FONTS.marker,
            fontSize: 148,
            color: COLORS.ink,
            lineHeight: 1,
            transform: `scale(${planeSpring})`,
          }}
        >
          Just text a bot.
        </div>

        <div
          style={{
            fontFamily: FONTS.handwritten,
            fontSize: 54,
            color: COLORS.crimson,
            transform: `translateY(${interpolate(subAppear, [0, 1], [18, 0])}px) rotate(-1.4deg)`,
            opacity: subAppear,
            marginTop: 4,
          }}
        >
          same Telegram you use for family group chats.
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "14px 22px",
            display: "inline-block",
            borderRadius: 16,
            background: "rgba(255,248,234,0.72)",
            boxShadow: "0 12px 24px -16px rgba(40,20,10,0.5)",
            fontFamily: FONTS.typewriter,
            fontSize: 24,
            color: COLORS.graphite,
            letterSpacing: 1.2,
            opacity: interpolate(local, [64, 88], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          no app install. no login. two minutes a check-in.
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TelegramPlane: React.FC<{ scale: number }> = ({ scale }) => (
  <div
    style={{
      width: 180,
      height: 180,
      borderRadius: "50%",
      background: "linear-gradient(135deg, #37aee2 0%, #1e96c8 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 20px 40px -14px rgba(30, 150, 200, 0.5), inset 0 -8px 20px rgba(0,0,0,0.15)",
      transform: `scale(${scale}) rotate(${interpolate(scale, [0, 1], [-20, 0])}deg)`,
    }}
  >
    <svg width="94" height="94" viewBox="0 0 240 240" fill="none">
      <path
        d="M220 40 L30 120 L90 140 L110 200 L140 160 L200 200 L220 40 Z M90 140 L200 60"
        fill="white"
        stroke="white"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M90 140 L200 60" stroke="#d4e6ef" strokeWidth="3" />
      <path d="M90 140 L110 200 L140 160" fill="#d4e6ef" />
    </svg>
  </div>
);
