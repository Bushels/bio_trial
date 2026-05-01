import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ACTS, COLORS, FONTS } from "./theme";
import { PaperBackground } from "./components/PaperBackground";
import { Act1Hook } from "./components/Act1Hook";
import { Act2Offer } from "./components/Act2Offer";
import { Act3Claims } from "./components/Act3Claims";
import { Act4HowItWorks } from "./components/Act4HowItWorks";
import { Act5Scoreboard } from "./components/Act5Scoreboard";
import { Act6CTA } from "./components/Act6CTA";

export const MainComposition: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: COLORS.kraft }}>
      <PaperBackground />

      {inRange(frame, ACTS.hook.start - 5, ACTS.hook.end + 5) && <Act1Hook />}
      {inRange(frame, ACTS.offer.start - 5, ACTS.offer.end + 5) && <Act2Offer />}
      {inRange(frame, ACTS.claims.start - 5, ACTS.claims.end + 5) && <Act3Claims />}
      {inRange(frame, ACTS.howItWorks.start - 5, ACTS.howItWorks.end + 5) && <Act4HowItWorks />}
      {inRange(frame, ACTS.scoreboard.start - 5, ACTS.scoreboard.end + 5) && <Act5Scoreboard />}
      {inRange(frame, ACTS.cta.start - 5, ACTS.cta.end + 5) && <Act6CTA />}

      <BrandMark />
    </AbsoluteFill>
  );
};

const inRange = (f: number, a: number, b: number) => f >= a && f <= b;

const BrandMark: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 40,
      left: 50,
      fontFamily: FONTS.marker,
      color: COLORS.soilDeep,
      fontSize: 26,
      letterSpacing: 4,
      opacity: 0.72,
    }}
  >
    buperac<span style={{ color: COLORS.green }}>.</span>trial
  </div>
);
