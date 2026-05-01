import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACTS, COLORS, FONTS } from "../theme";

const STEPS = [
  { num: "01", title: "Application", body: "send /apply and log the pass\nwhile you're still in the truck" },
  { num: "02", title: "Field photo", body: "drop in a canopy shot, strip photo,\nor anything you want on the record" },
  { num: "03", title: "Harvest yield", body: "send /yield 52.3 or use the dashboard\nfor strip and split details" },
  { num: "04", title: "Anything weird", body: "hail, heat, frost, sprayer miss -\ncontext matters as much as outcome" },
];

export const Act4HowItWorks: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.howItWorks.start;
  const dur = ACTS.howItWorks.end - ACTS.howItWorks.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ opacity, padding: 90, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div
          style={{
            fontFamily: FONTS.typewriter,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: COLORS.soilDeep,
            fontSize: 26,
            opacity: 0.75,
          }}
        >
          Built for real farm days
        </div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 76, color: COLORS.ink, marginTop: 14 }}>
          Telegram in the truck.
          <br />
          Dashboard at home.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1fr",
          gap: 80,
          alignItems: "center",
          width: "100%",
          maxWidth: 1650,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {STEPS.map((s, i) => (
            <Step key={s.num} index={i} local={local} {...s} />
          ))}
        </div>

        <PhoneMock local={local} />
      </div>
    </AbsoluteFill>
  );
};

const Step: React.FC<{ index: number; local: number; num: string; title: string; body: string }> = ({
  index,
  local,
  num,
  title,
  body,
}) => {
  const { fps } = useVideoConfig();
  const appearAt = 12 + index * 14;
  const s = spring({ fps, frame: Math.max(0, local - appearAt), config: { damping: 16, mass: 0.8 } });

  return (
    <div
      style={{
        display: "flex",
        gap: 26,
        alignItems: "center",
        transform: `translateX(${interpolate(s, [0, 1], [-30, 0])}px)`,
        opacity: s,
      }}
    >
      <div
        style={{
          flex: "0 0 auto",
          width: 88,
          height: 88,
          borderRadius: "50%",
          background: COLORS.green,
          color: COLORS.paper,
          fontFamily: FONTS.marker,
          fontSize: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 16px -8px rgba(40,20,10,0.55)",
          transform: `rotate(${index % 2 === 0 ? -4 : 3}deg)`,
        }}
      >
        {num}
      </div>
      <div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 46, color: COLORS.ink, lineHeight: 1 }}>{title}</div>
        <div
          style={{
            fontFamily: FONTS.handwritten,
            fontSize: 27,
            color: COLORS.graphite,
            marginTop: 6,
            lineHeight: 1.2,
            whiteSpace: "pre-line",
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
};

const PhoneMock: React.FC<{ local: number }> = ({ local }) => {
  const { fps } = useVideoConfig();
  const phoneSpring = spring({ fps, frame: Math.max(0, local - 20), config: { damping: 18, mass: 0.9 } });

  const m1 = interpolate(local, [46, 58], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const m2 = interpolate(local, [64, 78], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const m3 = interpolate(local, [92, 108], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const m4 = interpolate(local, [118, 134], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const m5 = interpolate(local, [142, 158], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "relative",
        height: 740,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `translateY(${interpolate(phoneSpring, [0, 1], [40, 0])}px) rotate(${interpolate(phoneSpring, [0, 1], [8, 3])}deg)`,
        opacity: phoneSpring,
      }}
    >
      <div
        style={{
          width: 380,
          height: 720,
          borderRadius: 52,
          background: "#0b0e13",
          padding: 14,
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
          border: `4px solid ${COLORS.graphite}`,
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            borderRadius: 42,
            background: "#17212b",
            padding: "18px 14px",
            fontFamily: FONTS.ui,
            color: "#e2eaf0",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 6px",
              borderBottom: "1px solid #243444",
              paddingBottom: 10,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
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
              BT
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>@BuperacTrialBot</div>
              <div style={{ fontSize: 12, color: "#6ea3c6" }}>bot | online</div>
            </div>
          </div>

          <Bubble side="user" opacity={m1}>
            <div>/apply</div>
          </Bubble>
          <Bubble side="bot" opacity={m2}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Which field?</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip>South 80</Chip>
              <Chip>Home quarter</Chip>
            </div>
          </Bubble>
          <Bubble side="user" opacity={m3}>
            <div>South 80 - 0.5 L/ac foliar</div>
          </Bubble>
          <Bubble side="bot" opacity={m4}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#4ade80", fontSize: 18 }}>OK</span>
              <span style={{ fontSize: 15 }}>Logged. South 80, foliar, 2026-06-14.</span>
            </div>
            <div style={{ fontSize: 12, color: "#6ea3c6", marginTop: 4 }}>Tap to attach a photo - any time</div>
          </Bubble>
          <Bubble side="user" opacity={m5}>
            <div>/yield 52.3</div>
          </Bubble>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: 20,
          left: "40%",
          width: 160,
          height: 36,
          background: COLORS.tape,
          transform: "rotate(-6deg)",
          boxShadow: `0 4px 8px -3px ${COLORS.tapeShadow}`,
          opacity: phoneSpring,
        }}
      />
    </div>
  );
};

const Bubble: React.FC<{ side: "user" | "bot"; children: React.ReactNode; opacity: number }> = ({
  side,
  children,
  opacity,
}) => {
  const user = side === "user";
  return (
    <div
      style={{
        alignSelf: user ? "flex-end" : "flex-start",
        maxWidth: "78%",
        background: user ? "#2b5278" : "#182533",
        color: "#e4eef5",
        borderRadius: 14,
        padding: "10px 13px",
        fontSize: 15,
        lineHeight: 1.35,
        opacity,
        transform: `translateY(${interpolate(opacity, [0, 1], [10, 0])}px)`,
        boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
      }}
    >
      {children}
    </div>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      background: "#2b5278",
      border: "1px solid #3e6b93",
      padding: "4px 10px",
      borderRadius: 14,
      fontSize: 13,
    }}
  >
    {children}
  </span>
);
