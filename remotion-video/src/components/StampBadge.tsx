import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../theme";

// Ink-stamp style badge — lands with a spring + slight rotation,
// faint blur as if ink blotted onto paper.
export const StampBadge: React.FC<{
  text: string;
  color?: string;
  rotate?: number;
  size?: number;
  appearFrame: number;
  style?: React.CSSProperties;
}> = ({ text, color = COLORS.crimson, rotate = -8, size = 260, appearFrame, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - appearFrame;
  if (local < -5) return null;

  const s = spring({
    fps,
    frame: Math.max(0, local),
    config: { damping: 10, mass: 0.6, stiffness: 140 },
  });
  const scale = interpolate(s, [0, 1], [1.6, 1]);
  const opacity = interpolate(local, [0, 4], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `5px solid ${color}`,
        color,
        fontFamily: FONTS.marker,
        fontSize: size * 0.17,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 18,
        letterSpacing: 1,
        lineHeight: 1.05,
        transform: `rotate(${rotate}deg) scale(${scale})`,
        opacity: opacity * 0.92,
        filter: "blur(0.35px)",
        textShadow: `0 0 2px ${color}55`,
        boxShadow: `inset 0 0 0 2px ${color}22`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
