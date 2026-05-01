import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { TEL_ACTS } from "./schedule";
import { Bubble, TelegramPhone, TG } from "./TelegramPhone";

const BIND_CODE = "FERN-CLOVE-4271";

// Act 3 — Bind Telegram to the trial dashboard by pasting a one-time code.
// Left side shows a mock dashboard card with the code; right side shows the
// phone where the code is pasted and the bot confirms.
export const TelAct3Bind: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.bind.start;
  const dur = TEL_ACTS.bind.end - TEL_ACTS.bind.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  const codeCardSpring = spring({
    fps,
    frame: Math.max(0, local - 10),
    config: { damping: 16, mass: 0.9 },
  });

  // Arrow drawing between dashboard and phone
  const arrowProgress = interpolate(local, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Message timings (frames local to this act)
  const typed = Math.floor(
    interpolate(local, [62, 94], [0, BIND_CODE.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const userBubbleOpacity = interpolate(local, [96, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const botReplyOpacity = interpolate(local, [118, 138], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const successStamp = interpolate(local, [146, 162], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, padding: "90px 100px", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            fontFamily: FONTS.typewriter,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.soilDeep,
            fontSize: 24,
            opacity: 0.78,
          }}
        >
          Step 02 · Connect it to your trial
        </div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 64, color: COLORS.ink, marginTop: 6 }}>
          Paste the code once. Done forever.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 60,
          alignItems: "center",
          width: "100%",
          maxWidth: 1660,
        }}
      >
        <DashboardCard code={BIND_CODE} scale={codeCardSpring} typedCount={typed} />

        <FlowArrow progress={arrowProgress} />

        <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
          <TelegramPhone enterAtFrame={TEL_ACTS.bind.start + 8} rotate={2.4}>
            <Bubble side="bot" opacity={interpolate(local, [26, 42], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}>
              <div style={{ fontWeight: 600, marginBottom: 2 }}>Paste your binding code</div>
              <div style={{ fontSize: 13, color: TG.textDim }}>
                Copy it from the dashboard · sent to you by email
              </div>
            </Bubble>

            <Bubble side="user" opacity={userBubbleOpacity}>
              <div style={{ fontFamily: FONTS.mono, letterSpacing: 1.3 }}>
                {BIND_CODE.slice(0, typed)}
                {typed < BIND_CODE.length && (
                  <span style={{ opacity: (local % 16) < 8 ? 1 : 0 }}>|</span>
                )}
              </div>
            </Bubble>

            <Bubble side="bot" opacity={botReplyOpacity}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: TG.accent, fontSize: 18, fontWeight: 700 }}>OK</span>
                <span style={{ fontSize: 15 }}>Connected to your trial.</span>
              </div>
              <div style={{ fontSize: 13, color: TG.textDim, marginTop: 6 }}>
                Fields on file: South 80 · Home quarter
              </div>
              <div style={{ fontSize: 13, color: TG.textDim, marginTop: 2 }}>
                Try /apply, /yield, or just send a photo.
              </div>
            </Bubble>
          </TelegramPhone>

          {/* handwritten stamp */}
          <div
            style={{
              position: "absolute",
              bottom: -10,
              right: 10,
              fontFamily: FONTS.handwritten,
              fontSize: 34,
              color: COLORS.green,
              transform: `rotate(-4deg) scale(${successStamp})`,
              opacity: successStamp,
            }}
          >
            you&apos;re in.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const DashboardCard: React.FC<{ code: string; scale: number; typedCount: number }> = ({
  code,
  scale,
  typedCount,
}) => {
  const highlighting = typedCount > 0 && typedCount < code.length;
  return (
    <div
      style={{
        transform: `rotate(-1.5deg) scale(${scale})`,
        opacity: scale,
        background: "rgba(255, 248, 228, 0.94)",
        borderRadius: 16,
        padding: "26px 28px",
        boxShadow: "0 20px 30px -16px rgba(40,20,10,0.45)",
        border: "1px solid rgba(109, 86, 40, 0.25)",
      }}
    >
      <div
        style={{
          fontFamily: FONTS.typewriter,
          fontSize: 18,
          color: COLORS.soilDeep,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        trial.buperac.com · your dashboard
      </div>
      <div
        style={{
          fontFamily: FONTS.marker,
          fontSize: 40,
          color: COLORS.ink,
          lineHeight: 1.05,
          marginBottom: 18,
        }}
      >
        Link your Telegram
      </div>
      <div
        style={{
          fontFamily: FONTS.handwritten,
          fontSize: 26,
          color: COLORS.graphite,
          lineHeight: 1.25,
          marginBottom: 14,
        }}
      >
        One-time binding code — valid for 24 hours:
      </div>
      <div
        style={{
          background: highlighting ? COLORS.noteYellow : COLORS.paperWarm,
          border: `2px dashed ${COLORS.soilDeep}`,
          padding: "14px 22px",
          borderRadius: 8,
          fontFamily: FONTS.mono,
          fontSize: 44,
          color: COLORS.ink,
          letterSpacing: 3,
          textAlign: "center",
          fontWeight: 700,
          transition: "background 200ms",
        }}
      >
        {code}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: FONTS.ui,
          fontSize: 15,
          color: COLORS.graphiteSoft,
          fontStyle: "italic",
        }}
      >
        Tap to copy · paste into Telegram
      </div>
    </div>
  );
};

const FlowArrow: React.FC<{ progress: number }> = ({ progress }) => (
  <svg width={150} height={80} viewBox="0 0 150 80" style={{ opacity: progress }}>
    <defs>
      <marker
        id="arrowhead-bind"
        markerWidth="10"
        markerHeight="10"
        refX="6"
        refY="5"
        orient="auto"
      >
        <path d="M0,0 L0,10 L10,5 z" fill={COLORS.crimson} />
      </marker>
    </defs>
    <path
      d={`M10,40 C 50,20 100,60 ${10 + progress * 130},40`}
      stroke={COLORS.crimson}
      strokeWidth="4"
      fill="none"
      strokeDasharray="6 4"
      markerEnd={progress > 0.9 ? "url(#arrowhead-bind)" : undefined}
      strokeLinecap="round"
    />
  </svg>
);
