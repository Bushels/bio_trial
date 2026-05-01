import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";

// Telegram dark-UI palette (matches the phone mock in Act4HowItWorks).
export const TG = {
  panel: "#17212b",
  panelHeader: "#1f2b38",
  divider: "#243444",
  userBubble: "#2b5278",
  botBubble: "#182533",
  text: "#e4eef5",
  textDim: "#6ea3c6",
  accent: "#4ade80",
  chipBorder: "#3e6b93",
};

export const TelegramPhone: React.FC<{
  enterAtFrame?: number;
  rotate?: number;
  scale?: number;
  header?: { title: string; subtitle: string; avatar: string };
  children?: React.ReactNode;
  tapeTop?: boolean;
  style?: React.CSSProperties;
}> = ({
  enterAtFrame = 0,
  rotate = 3,
  scale = 1,
  header = { title: "@BuperacTrialBot", subtitle: "bot | online", avatar: "BT" },
  children,
  tapeTop = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    fps,
    frame: Math.max(0, frame - enterAtFrame),
    config: { damping: 18, mass: 0.9 },
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${interpolate(s, [0, 1], [44, 0])}px) rotate(${rotate}deg) scale(${scale})`,
        opacity: s,
        ...style,
      }}
    >
      <div
        style={{
          width: 420,
          height: 820,
          borderRadius: 56,
          background: "#0b0e13",
          padding: 14,
          boxShadow: "0 30px 60px -18px rgba(0,0,0,0.6)",
          border: `4px solid ${COLORS.graphite}`,
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 44,
            background: TG.panel,
            padding: "18px 14px",
            fontFamily: FONTS.ui,
            color: TG.text,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            overflow: "hidden",
          }}
        >
          <PhoneHeader {...header} />
          {children}
        </div>
      </div>

      {tapeTop && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "38%",
            width: 170,
            height: 36,
            background: COLORS.tape,
            transform: "rotate(-6deg)",
            boxShadow: `0 4px 8px -3px ${COLORS.tapeShadow}`,
          }}
        />
      )}
    </div>
  );
};

const PhoneHeader: React.FC<{ title: string; subtitle: string; avatar: string }> = ({
  title,
  subtitle,
  avatar,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "4px 6px 12px",
      borderBottom: `1px solid ${TG.divider}`,
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: COLORS.green,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.marker,
        fontSize: 18,
      }}
    >
      {avatar}
    </div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontWeight: 600, fontSize: 17 }}>{title}</div>
      <div style={{ fontSize: 12, color: TG.textDim }}>{subtitle}</div>
    </div>
  </div>
);

export const Bubble: React.FC<{
  side: "user" | "bot";
  opacity: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ side, opacity, children, style }) => {
  const user = side === "user";
  return (
    <div
      style={{
        alignSelf: user ? "flex-end" : "flex-start",
        maxWidth: "82%",
        background: user ? TG.userBubble : TG.botBubble,
        color: TG.text,
        borderRadius: 14,
        padding: "10px 13px",
        fontSize: 15,
        lineHeight: 1.35,
        opacity,
        transform: `translateY(${interpolate(opacity, [0, 1], [10, 0])}px)`,
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{ active?: boolean; children: React.ReactNode }> = ({
  active,
  children,
}) => (
  <span
    style={{
      background: active ? COLORS.green : TG.userBubble,
      border: `1px solid ${active ? COLORS.greenLight : TG.chipBorder}`,
      padding: "5px 11px",
      borderRadius: 14,
      fontSize: 13,
      color: TG.text,
    }}
  >
    {children}
  </span>
);

// Circular fingertip indicator overlaid on the phone to show "tap here".
// Provide appearFrame + position relative to the phone container.
export const TouchCursor: React.FC<{
  appearFrame: number;
  top: number | string;
  left: number | string;
  label?: string;
  hold?: number;
}> = ({ appearFrame, top, left, label, hold = 30 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearFrame;
  if (local < 0 || local > hold + 30) return null;

  const popIn = spring({
    fps,
    frame: Math.max(0, local),
    config: { damping: 12, mass: 0.6, stiffness: 180 },
  });
  const fadeOut = interpolate(local, [hold, hold + 20], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 1 + 0.08 * Math.sin(local / 4);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: `translate(-50%, -50%) scale(${popIn * pulse})`,
        opacity: fadeOut,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(246, 226, 122, 0.35)",
          border: `3px solid ${COLORS.yellow}`,
          boxShadow: `0 0 18px ${COLORS.yellow}, inset 0 0 10px rgba(255,255,255,0.3)`,
        }}
      />
      {label && (
        <div
          style={{
            position: "absolute",
            top: 62,
            left: "50%",
            transform: "translateX(-50%) rotate(-3deg)",
            fontFamily: FONTS.handwritten,
            color: COLORS.crimson,
            fontSize: 24,
            whiteSpace: "nowrap",
            textShadow: "0 2px 6px rgba(250,240,210,0.9)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
