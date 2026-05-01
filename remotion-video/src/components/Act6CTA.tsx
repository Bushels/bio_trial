import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ACTS, COLORS, FONTS } from "../theme";
import { BrowserCard } from "./BrowserCard";

const landingDesktop = staticFile("assets/landing-desktop.png");

export const Act6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.cta.start;

  const enter = spring({ fps, frame: local, config: { damping: 16, mass: 0.9 } });
  const urlPop = spring({
    fps,
    frame: Math.max(0, local - 20),
    config: { damping: 14, mass: 0.7, stiffness: 150 },
  });
  const underline = interpolate(local, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const pulse = 1 + 0.02 * Math.sin(local / 6);

  return (
    <AbsoluteFill style={{ opacity: enter, alignItems: "center", justifyContent: "center", padding: 84 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.92fr 1.08fr",
          gap: 74,
          alignItems: "center",
          width: "100%",
          maxWidth: 1660,
        }}
      >
        <div style={{ opacity: interpolate(local, [10, 40], [0, 1], { extrapolateRight: "clamp" }) }}>
          <BrowserCard
            src={landingDesktop}
            height={620}
            rotation={-1.4}
            objectPosition="top center"
            caption="the real site farmers land on"
          />
        </div>

        <div>
          <div
            style={{
              fontFamily: FONTS.typewriter,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: COLORS.soilDeep,
              fontSize: 28,
              opacity: 0.75,
              marginBottom: 18,
            }}
          >
            If you're going to test it, put it on the board
          </div>

          <div
            style={{
              position: "relative",
              fontFamily: FONTS.marker,
              fontSize: 140,
              color: COLORS.ink,
              lineHeight: 0.95,
              transform: `scale(${urlPop * pulse})`,
              padding: "0 12px 10px 0",
            }}
          >
            trial.buperac.com
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 80,
                bottom: 0,
                height: 10,
                background: COLORS.yellow,
                transformOrigin: "left center",
                transform: `scaleX(${underline})`,
                borderRadius: 6,
                boxShadow: `0 0 8px ${COLORS.yellow}`,
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginTop: 30,
              opacity: interpolate(local, [28, 58], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            {["$2.80 / ac", "1 L = 2 ac", "pay vendor direct", "no app install"].map((item, index) => (
              <div
                key={item}
                style={{
                  padding: "12px 16px",
                  borderRadius: 999,
                  background: index % 2 === 0 ? "rgba(61,122,47,0.12)" : "rgba(30,42,74,0.08)",
                  color: index % 2 === 0 ? COLORS.greenDeep : COLORS.ink,
                  fontFamily: FONTS.marker,
                  fontSize: 26,
                }}
              >
                {item}
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: FONTS.handwritten,
              fontSize: 52,
              color: COLORS.crimson,
              marginTop: 34,
              transform: "rotate(-1.2deg)",
              opacity: interpolate(local, [45, 70], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            good, bad, or boring - it still counts.
          </div>

          <div
            style={{
              marginTop: 26,
              fontFamily: FONTS.ui,
              fontSize: 30,
              lineHeight: 1.45,
              color: COLORS.graphite,
              maxWidth: 720,
            }}
          >
            Limited 2026 cooperator spots for prairie growers who want an honest answer before buying harder in 2027.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
