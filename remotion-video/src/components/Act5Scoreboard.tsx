import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ACTS, COLORS, FONTS } from "../theme";

const SAMPLE_CROPS = [
  { crop: "Canola", farms: 12, delta: 2.6, rigor: "Controlled" },
  { crop: "Wheat", farms: 9, delta: 1.8, rigor: "Referenced" },
  { crop: "Peas", farms: 5, delta: 0.4, rigor: "Observational" },
  { crop: "Barley", farms: 7, delta: -0.3, rigor: "Referenced" },
];

export const Act5Scoreboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.scoreboard.start;
  const dur = ACTS.scoreboard.end - ACTS.scoreboard.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ opacity, padding: 80, alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
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
          Sample public board layout - trial.buperac.com/trial
        </div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 72, color: COLORS.ink, marginTop: 12 }}>
          No cherry-picked PDF later.
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: FONTS.handwritten,
            fontSize: 38,
            color: COLORS.crimson,
            transform: "rotate(-1deg)",
          }}
        >
          good, bad, or boring still shows up
        </div>
      </div>

      <div
        style={{
          background: COLORS.ink,
          borderRadius: 14,
          padding: "40px 50px",
          width: "88%",
          maxWidth: 1500,
          boxShadow: "0 30px 60px -20px rgba(0,0,0,0.6)",
          fontFamily: FONTS.ui,
          color: COLORS.paper,
          transform: "rotate(-0.4deg)",
        }}
      >
        <div
          style={{
            marginBottom: 18,
            display: "inline-block",
            padding: "8px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            color: COLORS.yellow,
            fontFamily: FONTS.typewriter,
            fontSize: 15,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Illustration of the live board layout
        </div>

        <div style={{ display: "flex", gap: 48, marginBottom: 28 }}>
          <Stat label="Cooperators" value={counter(local, [5, 50], 33)} />
          <Stat label="Acres enrolled" value={counter(local, [5, 60], 2840).toLocaleString()} />
          <Stat label="Events logged" value={counter(local, [5, 70], 412)} />
          <Stat label="Photos shared" value={counter(local, [5, 75], 86)} />
        </div>

        <div
          style={{
            fontFamily: FONTS.typewriter,
            letterSpacing: 3,
            textTransform: "uppercase",
            fontSize: 18,
            color: "#a9b6cc",
            marginBottom: 14,
          }}
        >
          Yield delta vs check (bu/ac) - sample layout
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {SAMPLE_CROPS.map((c, i) => (
            <DeltaRow key={c.crop} index={i} local={local} {...c} />
          ))}
        </div>

        <div
          style={{
            marginTop: 22,
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: 26,
            alignItems: "start",
            opacity: interpolate(local, [90, 110], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: "#8fa2c0",
              fontFamily: FONTS.typewriter,
            }}
          >
            privacy floor: at least 3 farms per crop before any number shows - no individual result identifies a grower
          </div>
          <div
            style={{
              justifySelf: "end",
              fontFamily: FONTS.handwritten,
              fontSize: 26,
              color: COLORS.paper,
              opacity: 0.9,
            }}
          >
            same board for farmers and company
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div style={{ flex: 1 }}>
    <div style={{ fontSize: 13, letterSpacing: 3, color: "#a9b6cc", textTransform: "uppercase" }}>{label}</div>
    <div
      style={{
        fontFamily: FONTS.marker,
        fontSize: 64,
        color: COLORS.yellow,
        lineHeight: 1,
        marginTop: 4,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
  </div>
);

const DeltaRow: React.FC<{
  index: number;
  local: number;
  crop: string;
  farms: number;
  delta: number;
  rigor: string;
}> = ({ index, local, crop, farms, delta, rigor }) => {
  const appearAt = 28 + index * 10;
  const growth = interpolate(local, [appearAt, appearAt + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const maxAbs = 3.0;
  const pct = (Math.abs(delta) / maxAbs) * 100 * growth;
  const positive = delta >= 0;
  const barColor = positive ? COLORS.greenLight : COLORS.crimson;

  const rigorColor =
    rigor === "Controlled" ? COLORS.greenLight : rigor === "Referenced" ? COLORS.yellow : "#a9b6cc";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "190px 1fr 170px", gap: 22, alignItems: "center" }}>
      <div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 32, color: COLORS.paper }}>{crop}</div>
        <div style={{ fontSize: 14, color: "#a9b6cc" }}>{farms} farms</div>
      </div>
      <div style={{ position: "relative", height: 40, display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            bottom: 0,
            width: 2,
            background: "rgba(255,255,255,0.25)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: positive ? "50%" : `${50 - pct / 2}%`,
            width: `${pct / 2}%`,
            height: 26,
            top: 7,
            background: barColor,
            borderRadius: 4,
            boxShadow: `0 0 18px ${barColor}55`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: positive ? `calc(50% + ${pct / 2}% + 12px)` : `calc(${50 - pct / 2}% - 70px)`,
            fontFamily: FONTS.mono,
            fontSize: 22,
            color: barColor,
            fontVariantNumeric: "tabular-nums",
            opacity: growth,
          }}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}
        </div>
      </div>
      <div
        style={{
          display: "inline-block",
          padding: "4px 12px",
          border: `1px solid ${rigorColor}`,
          color: rigorColor,
          fontFamily: FONTS.typewriter,
          fontSize: 14,
          letterSpacing: 2,
          textTransform: "uppercase",
          textAlign: "center",
          borderRadius: 2,
          opacity: growth,
        }}
      >
        {rigor}
      </div>
    </div>
  );
};

function counter(local: number, range: [number, number], target: number) {
  const t = interpolate(local, range, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return Math.round(target * t);
}
