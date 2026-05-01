import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { TEL_ACTS } from "./schedule";
import { Bubble, Chip, TelegramPhone, TG } from "./TelegramPhone";

// Act 4 — /apply walk-through. The heart of the video: shows every step
// the bot takes the farmer through when logging an application event.
export const TelAct4Apply: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.apply.start;
  const dur = TEL_ACTS.apply.end - TEL_ACTS.apply.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  // 6-step conversation: bubbles appear sequentially
  const b1 = fadeIn(local, 14, 28);   // user: /apply
  const b2 = fadeIn(local, 34, 50);   // bot: Which field? + chips
  const b3 = fadeIn(local, 66, 82);   // user: South 80
  const b4 = fadeIn(local, 88, 104);  // bot: method?
  const b5 = fadeIn(local, 118, 134); // user: Foliar, 0.5 L/ac
  const b6 = fadeIn(local, 140, 156); // bot: OK logged

  return (
    <AbsoluteFill style={{ opacity, padding: "90px 100px", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 70,
          alignItems: "center",
          width: "100%",
          maxWidth: 1660,
        }}
      >
        {/* Left: narrative */}
        <div>
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
            Step 03 · Log an application
          </div>
          <div style={{ fontFamily: FONTS.marker, fontSize: 84, color: COLORS.ink, marginTop: 12, lineHeight: 1 }}>
            Type <span style={{ color: COLORS.green }}>/apply</span>.
            <br />
            The bot does the rest.
          </div>

          <div
            style={{
              fontFamily: FONTS.handwritten,
              fontSize: 34,
              color: COLORS.graphite,
              marginTop: 24,
              lineHeight: 1.35,
              maxWidth: 620,
            }}
          >
            Tap the field. Tap the method. Type the rate. That&apos;s the whole event — about 10 seconds in the cab.
          </div>

          <CommandCheatsheet local={local} />
        </div>

        {/* Right: the phone with a full /apply conversation */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <TelegramPhone enterAtFrame={TEL_ACTS.apply.start + 4} rotate={-2}>
            <Bubble side="user" opacity={b1}>
              <span style={{ fontFamily: FONTS.mono }}>/apply</span>
            </Bubble>

            <Bubble side="bot" opacity={b2}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Which field?</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip>South 80</Chip>
                <Chip>Home quarter</Chip>
                <Chip>North 160</Chip>
              </div>
            </Bubble>

            <Bubble side="user" opacity={b3}>
              <Chip active>South 80</Chip>
            </Bubble>

            <Bubble side="bot" opacity={b4}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Seed treatment or foliar?</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip>Seed treatment</Chip>
                <Chip>Foliar spray</Chip>
              </div>
            </Bubble>

            <Bubble side="user" opacity={b5}>
              <div>
                <Chip active>Foliar spray</Chip>{" "}
                <span style={{ fontFamily: FONTS.mono, marginLeft: 6 }}>0.5 L/ac</span>
              </div>
            </Bubble>

            <Bubble side="bot" opacity={b6}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: TG.accent, fontSize: 18, fontWeight: 700 }}>OK</span>
                <span style={{ fontSize: 15 }}>Logged. South 80 · foliar · 0.5 L/ac.</span>
              </div>
              <div style={{ fontSize: 13, color: TG.textDim, marginTop: 4 }}>
                2026-06-14 · tap to attach a photo
              </div>
            </Bubble>
          </TelegramPhone>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const fadeIn = (local: number, start: number, end: number) =>
  interpolate(local, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const COMMANDS: Array<{ cmd: string; body: string }> = [
  { cmd: "/apply", body: "Log an application" },
  { cmd: "/yield 52.3", body: "Log harvest yield" },
  { cmd: "/field", body: "See your fields" },
  { cmd: "any text", body: "Free observation" },
];

const CommandCheatsheet: React.FC<{ local: number }> = ({ local }) => {
  const appear = interpolate(local, [40, 72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        marginTop: 34,
        padding: "18px 22px",
        background: "rgba(255,248,234,0.78)",
        borderRadius: 16,
        boxShadow: "0 14px 26px -16px rgba(40,20,10,0.45)",
        fontFamily: FONTS.ui,
        opacity: appear,
        transform: `translateY(${interpolate(appear, [0, 1], [14, 0])}px)`,
        maxWidth: 560,
      }}
    >
      <div
        style={{
          fontFamily: FONTS.typewriter,
          fontSize: 18,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: COLORS.soilDeep,
          opacity: 0.75,
          marginBottom: 10,
        }}
      >
        the whole command list
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", rowGap: 8, columnGap: 22 }}>
        {COMMANDS.map((c) => (
          <React.Fragment key={c.cmd}>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 22,
                color: COLORS.green,
                fontWeight: 700,
              }}
            >
              {c.cmd}
            </div>
            <div style={{ fontFamily: FONTS.handwritten, fontSize: 24, color: COLORS.graphite }}>
              {c.body}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
