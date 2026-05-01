import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, ACTS } from "../theme";

const CLAIMS = [
  { title: "Stronger roots", sub: "does it actually build root mass?", icon: "root" },
  { title: "Drought & heat tolerance", sub: "does the canopy hold up in stress?", icon: "sun" },
  { title: "Healthier canopy, more yield", sub: "does the bin weigh more at harvest?", icon: "wheat" },
  { title: "Cut synthetic N", sub: "can we drop nitrogen without losing yield?", icon: "n" },
];

export const Act3Claims: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.claims.start;
  const dur = ACTS.claims.end - ACTS.claims.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = enter * exit;

  return (
    <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center", padding: 90 }}>
      <div style={{ textAlign: "center", marginBottom: 50 }}>
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
          Four claims. One honest test.
        </div>
        <div style={{ fontFamily: FONTS.marker, fontSize: 84, color: COLORS.ink, marginTop: 14 }}>
          What we're actually checking
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 50,
          maxWidth: 1500,
          width: "100%",
        }}
      >
        {CLAIMS.map((c, i) => (
          <ClaimCard key={c.title} index={i} local={local} {...c} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ClaimCard: React.FC<{
  index: number;
  local: number;
  title: string;
  sub: string;
  icon: string;
}> = ({ index, local, title, sub, icon }) => {
  const { fps } = useVideoConfig();
  const stagger = 22;
  const appearAt = 10 + index * stagger;
  const lift = spring({
    fps,
    frame: Math.max(0, local - appearAt),
    config: { damping: 14, mass: 0.7 },
  });
  const checkProgress = interpolate(local, [appearAt + 14, appearAt + 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotate = index % 2 === 0 ? -1.4 : 1.2;

  return (
    <div
      style={{
        position: "relative",
        background: COLORS.noteKraft,
        padding: "38px 42px 42px 54px",
        borderRadius: 4,
        boxShadow: "0 20px 30px -16px rgba(40,20,10,0.45)",
        transform: `translateY(${interpolate(lift, [0, 1], [40, 0])}px) rotate(${rotate * lift}deg)`,
        opacity: lift,
        fontFamily: FONTS.handwritten,
      }}
    >
      {/* tape tab */}
      <div
        style={{
          position: "absolute",
          top: -18,
          left: "45%",
          width: 140,
          height: 32,
          background: COLORS.tape,
          boxShadow: `0 4px 8px -2px ${COLORS.tapeShadow}`,
          transform: "rotate(-3deg)",
        }}
      />

      {/* checkbox */}
      <div style={{ position: "absolute", left: 12, top: 40 }}>
        <div
          style={{
            width: 30,
            height: 30,
            border: `3px solid ${COLORS.ink}`,
            borderRadius: 4,
            position: "relative",
          }}
        >
          <svg viewBox="0 0 30 30" width={34} height={34} style={{ position: "absolute", top: -4, left: -2 }}>
            <path
              d="M4 16 L12 24 L28 6"
              fill="none"
              stroke={COLORS.green}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={40}
              strokeDashoffset={40 * (1 - checkProgress)}
            />
          </svg>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <Icon kind={icon} />
        <div>
          <div style={{ fontSize: 50, color: COLORS.ink, lineHeight: 1 }}>{title}</div>
          <div
            style={{
              marginTop: 10,
              fontFamily: FONTS.typewriter,
              fontSize: 24,
              color: COLORS.graphite,
              letterSpacing: 0.5,
            }}
          >
            {sub}
          </div>
        </div>
      </div>
    </div>
  );
};

const Icon: React.FC<{ kind: string }> = ({ kind }) => {
  const size = 80;
  if (kind === "root") {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80">
        <line x1="40" y1="4" x2="40" y2="30" stroke={COLORS.green} strokeWidth="5" strokeLinecap="round" />
        <path d="M40 30 C 30 44, 18 50, 12 70 M40 30 C 50 44, 62 50, 68 70 M40 30 C 40 50, 40 58, 40 76" stroke={COLORS.soilDeep} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M12 70 L 8 76 M68 70 L72 76 M40 76 L 36 74 M40 76 L 44 74" stroke={COLORS.soilDeep} strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "sun") {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="16" fill={COLORS.yellow} stroke={COLORS.soilDeep} strokeWidth="3" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x1 = 40 + Math.cos(a) * 22;
          const y1 = 40 + Math.sin(a) * 22;
          const x2 = 40 + Math.cos(a) * 34;
          const y2 = 40 + Math.sin(a) * 34;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.soilDeep} strokeWidth="4" strokeLinecap="round" />;
        })}
      </svg>
    );
  }
  if (kind === "wheat") {
    return (
      <svg width={size} height={size} viewBox="0 0 80 80">
        <line x1="40" y1="8" x2="40" y2="74" stroke={COLORS.green} strokeWidth="4" strokeLinecap="round" />
        {[14, 24, 34, 44, 54].map((y, i) => (
          <g key={i}>
            <ellipse cx="30" cy={y} rx="10" ry="5" fill={COLORS.yellow} stroke={COLORS.soilDeep} strokeWidth="2.5" transform={`rotate(-25 30 ${y})`} />
            <ellipse cx="50" cy={y} rx="10" ry="5" fill={COLORS.yellow} stroke={COLORS.soilDeep} strokeWidth="2.5" transform={`rotate(25 50 ${y})`} />
          </g>
        ))}
      </svg>
    );
  }
  // N
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <rect x="8" y="8" width="64" height="64" rx="12" fill={COLORS.green} stroke={COLORS.soilDeep} strokeWidth="3" />
      <text x="40" y="54" textAnchor="middle" fontFamily={FONTS.marker} fontSize="34" fill={COLORS.paper}>N cut</text>
    </svg>
  );
};
