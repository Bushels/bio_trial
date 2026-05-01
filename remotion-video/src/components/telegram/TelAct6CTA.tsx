import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { StampBadge } from "../StampBadge";
import { TEL_ACTS } from "./schedule";

// Act 6 — CTA. Lean on the established "Telegram in the truck. Dashboard at
// home." line from the farmer-explainer so both videos close consistently.
export const TelAct6CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.cta.start;

  const enter = spring({ fps, frame: local, config: { damping: 16, mass: 0.9 } });
  const urlPop = spring({
    fps,
    frame: Math.max(0, local - 22),
    config: { damping: 14, mass: 0.7, stiffness: 150 },
  });
  const underline = interpolate(local, [42, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 1 + 0.02 * Math.sin(local / 6);

  const lineOneAppear = interpolate(local, [4, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineTwoAppear = interpolate(local, [26, 48], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: enter, alignItems: "center", justifyContent: "center", padding: 90 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div
          style={{
            fontFamily: FONTS.typewriter,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.soilDeep,
            fontSize: 26,
            opacity: 0.78,
          }}
        >
          That&apos;s the whole tutorial.
        </div>

        <div
          style={{
            fontFamily: FONTS.marker,
            fontSize: 104,
            color: COLORS.ink,
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          <div
            style={{
              opacity: lineOneAppear,
              transform: `translateY(${interpolate(lineOneAppear, [0, 1], [16, 0])}px)`,
            }}
          >
            Telegram in the truck.
          </div>
          <div
            style={{
              opacity: lineTwoAppear,
              transform: `translateY(${interpolate(lineTwoAppear, [0, 1], [16, 0])}px)`,
              color: COLORS.greenDeep,
            }}
          >
            Dashboard at home.
          </div>
        </div>

        <div
          style={{
            position: "relative",
            fontFamily: FONTS.marker,
            fontSize: 128,
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
              right: 64,
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
            gap: 38,
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.handwritten,
              fontSize: 40,
              color: COLORS.graphite,
              maxWidth: 600,
              lineHeight: 1.25,
              transform: "rotate(-1deg)",
              opacity: interpolate(local, [30, 56], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            after you sign up, search{" "}
            <span style={{ fontFamily: FONTS.mono, color: COLORS.green, fontWeight: 700 }}>
              @BuperacTrialBot
            </span>{" "}
            and tap Start.
          </div>

          <StampBadge
            text={"2 MIN\nA CHECK-IN"}
            appearFrame={TEL_ACTS.cta.start + 28}
            color={COLORS.green}
            rotate={-9}
            size={210}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
