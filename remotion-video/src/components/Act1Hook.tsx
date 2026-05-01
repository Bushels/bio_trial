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
import { StampBadge } from "./StampBadge";

const landingDesktop = staticFile("assets/landing-desktop.png");

export const Act1Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.hook.start;
  const dur = ACTS.hook.end - ACTS.hook.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const masterOpacity = enter * exit;

  const heading1 = "Biostimulants are full of ";
  const heading2 = "marketing";
  const totalChars = heading1.length + heading2.length;
  const typed = Math.floor(
    interpolate(local, [5, 55], [0, totalChars], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const chars1 = Math.min(heading1.length, typed);
  const chars2 = Math.max(0, typed - heading1.length);

  const strikeProgress = interpolate(local, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subProgress = interpolate(local, [70, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity: masterOpacity,
        alignItems: "center",
        justifyContent: "center",
        padding: "90px 110px 80px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 80,
          alignItems: "center",
          width: "100%",
          maxWidth: 1660,
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              fontFamily: FONTS.typewriter,
              color: COLORS.soilDeep,
              letterSpacing: 6,
              fontSize: 26,
              textTransform: "uppercase",
              opacity: interpolate(local, [0, 25], [0, 0.75], {
                extrapolateRight: "clamp",
              }),
              marginBottom: 26,
            }}
          >
            The 2026 Buperac x SixRing Trial
          </div>

          <div
            style={{
              fontFamily: FONTS.marker,
              fontSize: 82,
              color: COLORS.ink,
              lineHeight: 1.02,
              maxWidth: 760,
            }}
          >
            <span>{heading1.slice(0, chars1)}</span>
            <span style={{ position: "relative", display: "inline-block" }}>
              {heading2.slice(0, chars2)}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: "56%",
                  height: 11,
                  background: COLORS.crimson,
                  transformOrigin: "left center",
                  transform: `scaleX(${strikeProgress})`,
                  boxShadow: `0 0 2px ${COLORS.crimson}`,
                  filter: "blur(0.4px)",
                  borderRadius: 3,
                }}
              />
            </span>
            {typed < totalChars && (
              <span style={{ opacity: (local % 16) < 8 ? 1 : 0, color: COLORS.ink }}>|</span>
            )}
          </div>

          <div
            style={{
              fontFamily: FONTS.handwritten,
              fontSize: 66,
              color: COLORS.crimson,
              marginTop: 20,
              opacity: subProgress,
              transform: `translateY(${interpolate(subProgress, [0, 1], [14, 0])}px) rotate(-1.5deg)`,
            }}
          >
            this one lives or dies on the data.
          </div>

          <div
            style={{
              marginTop: 46,
              padding: "20px 26px",
              display: "inline-block",
              borderRadius: 18,
              background: "rgba(255,248,234,0.74)",
              boxShadow: "0 16px 30px -18px rgba(40,20,10,0.45)",
              fontFamily: FONTS.typewriter,
              fontSize: 26,
              color: COLORS.graphite,
              letterSpacing: 1.3,
              opacity: interpolate(local, [86, 112], [0, 1], {
                extrapolateRight: "clamp",
              }),
            }}
          >
            Farmers see the same board the company sees.
          </div>
        </div>

        <div
          style={{
            transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
          }}
        >
          <BrowserCard
            src={landingDesktop}
            height={620}
            rotation={1.8}
            objectPosition="center 38%"
            caption="actual landing page - price, odometer, and sign-up"
          />
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 70, right: 120 }}>
        <StampBadge
          text={"COOPERATOR\nPRICING\n$2.80 / ac"}
          appearFrame={ACTS.hook.start + 50}
          color={COLORS.green}
          rotate={-11}
          size={240}
        />
      </div>
    </AbsoluteFill>
  );
};
