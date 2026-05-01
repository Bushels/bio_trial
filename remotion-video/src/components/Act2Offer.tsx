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

export const Act2Offer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - ACTS.offer.start;
  const dur = ACTS.offer.end - ACTS.offer.start;

  const enter = spring({ fps, frame: local, config: { damping: 16, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;
  const priceReveal = interpolate(local, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ opacity, alignItems: "center", justifyContent: "center", padding: 90 }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.9fr 1.1fr",
          gap: 80,
          alignItems: "center",
          maxWidth: 1660,
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.typewriter,
              color: COLORS.soilDeep,
              letterSpacing: 6,
              fontSize: 24,
              textTransform: "uppercase",
              opacity: 0.75,
            }}
          >
            Sign-up is the easy part
          </div>
          <div
            style={{
              fontFamily: FONTS.marker,
              fontSize: 74,
              color: COLORS.ink,
              lineHeight: 1.02,
            }}
          >
            Three minutes on your phone.
            <br />
            Vendor handles the payment.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {[
              "Enter crop, acres, province, and RM",
              "Choose pickup or shipping",
              "Submit - we follow up and send your dashboard link",
              "Log your season with Telegram or the dashboard",
            ].map((item, index) => (
              <div
                key={item}
                style={{
                  padding: "18px 18px 20px",
                  borderRadius: 18,
                  background: index % 2 === 0 ? COLORS.noteKraft : COLORS.paperWarm,
                  boxShadow: "0 16px 24px -18px rgba(40,20,10,0.5)",
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: COLORS.yellow,
                    color: COLORS.ink,
                    fontFamily: FONTS.marker,
                    fontSize: 20,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  {index + 1}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.handwritten,
                    fontSize: 28,
                    lineHeight: 1.15,
                    color: COLORS.ink,
                  }}
                >
                  {item}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginTop: 4,
            }}
          >
            <PricePill color={COLORS.green} bg="rgba(61,122,47,0.14)">
              $2.80 / ac
            </PricePill>
            <PricePill color={COLORS.ink} bg="rgba(30,42,74,0.08)">
              1 L = 2 ac
            </PricePill>
            <PricePill color={COLORS.crimson} bg="rgba(166,52,44,0.1)">
              80 ac = $224
            </PricePill>
          </div>

          <div
            style={{
              fontFamily: FONTS.typewriter,
              fontSize: 21,
              color: COLORS.graphite,
              lineHeight: 1.5,
              opacity: priceReveal,
            }}
          >
            No payment collection on the site. The vendor handles e-transfer,
            card, cheque, or invoice after follow-up.
          </div>
        </div>

        <div
          style={{
            transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px)`,
            opacity: priceReveal,
          }}
        >
          <BrowserCard
            src={landingDesktop}
            height={710}
            rotation={1.2}
            objectPosition="center 72%"
            caption="real signup form - same one farmers use"
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PricePill: React.FC<{
  children: React.ReactNode;
  color: string;
  bg: string;
}> = ({ children, color, bg }) => (
  <div
    style={{
      padding: "14px 18px",
      borderRadius: 999,
      background: bg,
      color,
      fontFamily: FONTS.marker,
      fontSize: 28,
      lineHeight: 1,
      boxShadow: "0 12px 20px -18px rgba(40,20,10,0.45)",
    }}
  >
    {children}
  </div>
);
