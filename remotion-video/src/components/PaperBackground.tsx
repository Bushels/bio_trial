import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

// Kraft paper background with subtle grain + soft vignette,
// matching the "agronomist's desk" aesthetic of the landing page.
export const PaperBackground: React.FC<{ warm?: boolean }> = ({ warm }) => {
  const base = warm ? COLORS.paperWarm : COLORS.paper;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${base} 0%, ${COLORS.kraft} 78%, ${COLORS.kraftDeep} 100%)`,
      }}
    >
      {/* faint paper fibre texture via layered SVG noise */}
      <AbsoluteFill style={{ opacity: 0.18, mixBlendMode: "multiply" }}>
        <svg width="100%" height="100%">
          <defs>
            <filter id="paperNoise">
              <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
              <feColorMatrix
                type="matrix"
                values="0 0 0 0 0.35   0 0 0 0 0.25   0 0 0 0 0.12   0 0 0 0.6 0"
              />
            </filter>
          </defs>
          <rect width="100%" height="100%" filter="url(#paperNoise)" />
        </svg>
      </AbsoluteFill>
      {/* corner vignette */}
      <AbsoluteFill
        style={{
          boxShadow: "inset 0 0 240px rgba(40,20,10,0.35)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

// A piece of masking tape used to "attach" elements to the desk
export const Tape: React.FC<{
  width?: number;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({ width = 180, rotate = -4, style }) => (
  <div
    style={{
      position: "absolute",
      width,
      height: 42,
      background: COLORS.tape,
      borderLeft: "1px dashed rgba(40,20,10,0.15)",
      borderRight: "1px dashed rgba(40,20,10,0.15)",
      boxShadow: `0 6px 14px -4px ${COLORS.tapeShadow}`,
      transform: `rotate(${rotate}deg)`,
      ...style,
    }}
  />
);
