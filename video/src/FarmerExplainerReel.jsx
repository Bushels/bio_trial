import React from "react";
import {loadFont as loadInter} from "@remotion/google-fonts/Inter";
import {loadFont as loadMarker} from "@remotion/google-fonts/PermanentMarker";
import {loadFont as loadElite} from "@remotion/google-fonts/SpecialElite";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import biostim from "../Biostim.jpg";
import landingDesktop from "../verify-desktop-trial-desk.png";
import landingMobile from "../verify-mobile-trial-desk.png";
import cropsView from "../crops-view.png";

const {fontFamily: interFamily} = loadInter("normal", {
  weights: ["400", "600", "700", "800"],
  subsets: ["latin"],
  ignoreTooManyRequestsWarning: true,
});
const {fontFamily: markerFamily} = loadMarker("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
const {fontFamily: eliteFamily} = loadElite("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const palette = {
  sky: "#f2ab45",
  skyLight: "#fde0a7",
  soil: "#6b3f1d",
  soilDark: "#2c1607",
  paper: "#f7ecd4",
  paperWarm: "#ecd6a5",
  kraft: "#d7ba84",
  ink: "#1f2f4a",
  inkSoft: "#31476a",
  green: "#3c7d30",
  yellow: "#f4de56",
  red: "#be4c37",
  cream: "#fff8ea",
};

const sceneDurations = [180, 210, 180, 180, 210, 210, 240, 240, 150];

const accumulate = (index) => {
  return sceneDurations.slice(0, index).reduce((sum, value) => sum + value, 0);
};

const entryStyle = (frame, fps, delay = 0, distance = 40) => {
  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: 200,
      mass: 0.8,
      stiffness: 120,
    },
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

const popStyle = (frame, fps, delay = 0) => {
  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: 140,
      stiffness: 170,
      mass: 0.7,
    },
  });

  return {
    opacity: progress,
    transform: `scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
  };
};

const drift = (frame, speed = 1, amplitude = 1) => {
  return Math.sin((frame / 30) * speed) * amplitude;
};

const ReelFrame = ({children}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.soilDark,
        color: palette.cream,
        fontFamily: interFamily,
        overflow: "hidden",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const BaseBackdrop = ({frame}) => {
  const skyShift = drift(frame, 0.45, 18);
  const glowShift = drift(frame, 0.27, 24);

  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${palette.skyLight} 0%, ${palette.sky} 23%, #9f612e 48%, ${palette.soil} 78%, ${palette.soilDark} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.25,
          transform: `translate(${skyShift}px, ${glowShift}px)`,
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.7), transparent 28%), radial-gradient(circle at 80% 12%, rgba(255,220,165,0.5), transparent 24%), radial-gradient(circle at 50% 45%, rgba(0,0,0,0.3), transparent 36%)",
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.18,
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(42,20,8,0.7) 0 170px, rgba(255,255,255,0.05) 170px 172px, rgba(42,20,8,0.72) 172px 340px, rgba(0,0,0,0.24) 340px 342px)",
          mixBlendMode: "multiply",
        }}
      />
      <AbsoluteFill
        style={{
          top: "68%",
          height: "32%",
          background:
            "linear-gradient(180deg, rgba(112,74,36,0) 0%, rgba(42,20,8,0.2) 15%, rgba(27,11,4,0.75) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.22,
          backgroundImage:
            "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.9) 0 2px, transparent 2px), radial-gradient(circle at 72% 30%, rgba(255,240,205,0.65) 0 1.5px, transparent 1.5px), radial-gradient(circle at 52% 62%, rgba(255,240,205,0.7) 0 1.5px, transparent 1.5px), radial-gradient(circle at 84% 72%, rgba(255,255,255,0.7) 0 2px, transparent 2px)",
          transform: `translateY(${drift(frame, 0.18, 16)}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.2,
          backgroundImage:
            "linear-gradient(90deg, transparent 0 4%, rgba(255,240,180,0.7) 4% 4.2%, transparent 4.2% 100%), linear-gradient(90deg, transparent 0 11%, rgba(255,240,180,0.8) 11% 11.15%, transparent 11.15% 100%), linear-gradient(90deg, transparent 0 18%, rgba(255,240,180,0.75) 18% 18.15%, transparent 18.15% 100%), linear-gradient(90deg, transparent 0 27%, rgba(255,240,180,0.75) 27% 27.12%, transparent 27.12% 100%), linear-gradient(90deg, transparent 0 35%, rgba(255,240,180,0.9) 35% 35.12%, transparent 35.12% 100%), linear-gradient(90deg, transparent 0 44%, rgba(255,240,180,0.65) 44% 44.1%, transparent 44.1% 100%), linear-gradient(90deg, transparent 0 52%, rgba(255,240,180,0.9) 52% 52.12%, transparent 52.12% 100%), linear-gradient(90deg, transparent 0 59%, rgba(255,240,180,0.75) 59% 59.13%, transparent 59.13% 100%), linear-gradient(90deg, transparent 0 69%, rgba(255,240,180,0.8) 69% 69.12%, transparent 69.12% 100%), linear-gradient(90deg, transparent 0 78%, rgba(255,240,180,0.7) 78% 78.11%, transparent 78.11% 100%), linear-gradient(90deg, transparent 0 88%, rgba(255,240,180,0.85) 88% 88.11%, transparent 88.11% 100%), linear-gradient(90deg, transparent 0 94%, rgba(255,240,180,0.75) 94% 94.1%, transparent 94.1% 100%)",
          backgroundPosition: `0 ${1040 + drift(frame, 0.35, 18)}px`,
          backgroundRepeat: "no-repeat",
        }}
      />
    </>
  );
};

const FrameBadge = ({text, dark}) => {
  return (
    <div
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 18px",
        borderRadius: 999,
        border: `1px solid ${dark ? "rgba(255,255,255,0.28)" : "rgba(31,47,74,0.16)"}`,
        background: dark ? "rgba(24, 17, 10, 0.6)" : "rgba(255,248,234,0.92)",
        color: dark ? palette.cream : palette.ink,
        fontFamily: eliteFamily,
        fontSize: 26,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: dark ? palette.yellow : palette.green,
        }}
      />
      {text}
    </div>
  );
};

const HighlightPill = ({text}) => {
  return (
    <div
      style={{
        padding: "18px 24px",
        borderRadius: 24,
        background: "rgba(255,248,234,0.92)",
        color: palette.ink,
        border: "1px solid rgba(31,47,74,0.12)",
        fontSize: 30,
        fontWeight: 700,
        boxShadow: "0 18px 40px rgba(38,16,6,0.18)",
      }}
    >
      {text}
    </div>
  );
};

const TapeCard = ({children, rotation = 0, width = "100%", background = palette.paper}) => {
  return (
    <div
      style={{
        width,
        padding: "36px 34px",
        borderRadius: 24,
        background,
        color: palette.ink,
        border: "2px solid rgba(76,52,24,0.12)",
        boxShadow: "0 30px 60px rgba(18,7,2,0.24)",
        transform: `rotate(${rotation}deg)`,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -18,
          left: "10%",
          width: 120,
          height: 32,
          borderRadius: 6,
          background: "rgba(255,236,179,0.75)",
          transform: "rotate(-4deg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -14,
          right: "12%",
          width: 88,
          height: 28,
          borderRadius: 6,
          background: "rgba(255,236,179,0.68)",
          transform: "rotate(6deg)",
        }}
      />
      {children}
    </div>
  );
};

const Sticky = ({title, body, color = palette.paperWarm}) => {
  return (
    <div
      style={{
        padding: "28px 24px 24px",
        borderRadius: 14,
        background: color,
        color: palette.ink,
        minHeight: 220,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        boxShadow: "0 16px 26px rgba(22,8,2,0.2)",
      }}
    >
      <div
        style={{
          fontFamily: markerFamily,
          fontSize: 36,
          lineHeight: 1.02,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 26,
          lineHeight: 1.42,
          color: palette.inkSoft,
          fontWeight: 600,
        }}
      >
        {body}
      </div>
    </div>
  );
};

const BrowserShot = ({src, height = 740, scale = 1, rotation = 0}) => {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 36,
        padding: 18,
        background: "rgba(255,248,234,0.92)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: "0 32px 70px rgba(18,7,2,0.28)",
        transform: `rotate(${rotation}deg) scale(${scale})`,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "8px 12px 16px",
        }}
      >
        {["#ef5a4d", "#f6c945", "#59c36a"].map((dot) => (
          <div
            key={dot}
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              backgroundColor: dot,
            }}
          />
        ))}
      </div>
      <div
        style={{
          height,
          overflow: "hidden",
          borderRadius: 22,
          border: "1px solid rgba(31,47,74,0.1)",
          backgroundColor: "#fff",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </div>
    </div>
  );
};

const PhoneShot = ({src, height = 720}) => {
  return (
    <div
      style={{
        width: 370,
        padding: "18px 14px 22px",
        borderRadius: 50,
        background: "linear-gradient(180deg, #242424, #080808)",
        boxShadow: "0 34px 80px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          width: 108,
          height: 18,
          borderRadius: 999,
          background: "#1b1b1b",
          margin: "0 auto 12px",
        }}
      />
      <div
        style={{
          height,
          overflow: "hidden",
          borderRadius: 34,
          backgroundColor: "#fff",
        }}
      >
        <Img
          src={src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </div>
    </div>
  );
};

const ListLine = ({label, value}) => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 24,
        padding: "18px 0",
        borderBottom: "1px solid rgba(31,47,74,0.1)",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          color: palette.inkSoft,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: palette.ink,
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
};

const HookScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const imageScale = interpolate(frame, [0, 180], [1.08, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{padding: "96px 72px 82px", justifyContent: "space-between"}}>
      <div style={{display: "flex", flexDirection: "column", gap: 28}}>
        <div style={entryStyle(frame, fps, 0, 30)}>
          <FrameBadge text="2026 cooperator trial" />
        </div>
        <div style={entryStyle(frame, fps, 8, 40)}>
          <div
            style={{
              fontFamily: markerFamily,
              fontSize: 100,
              lineHeight: 0.96,
              color: palette.cream,
              textShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            Know what changed
            <br />
            before you sell.
          </div>
        </div>
        <div style={entryStyle(frame, fps, 16, 34)}>
          <div
            style={{
              maxWidth: 860,
              fontSize: 36,
              lineHeight: 1.42,
              color: "rgba(255,248,234,0.9)",
              fontWeight: 600,
            }}
          >
            A public-by-default BioLift trial for prairie growers who want proof,
            not hype.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 18,
            marginTop: 12,
          }}
        >
          {["$2.80 per acre", "1 L treats 2 acres", "Telegram or dashboard"].map(
            (item, index) => (
              <div key={item} style={entryStyle(frame, fps, 24 + index * 6, 28)}>
                <HighlightPill text={item} />
              </div>
            ),
          )}
        </div>
      </div>
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          justifyContent: "center",
          paddingBottom: 10,
          ...entryStyle(frame, fps, 22, 36),
        }}
      >
        <div
          style={{
            width: 880,
            transform: `scale(${imageScale})`,
          }}
        >
          <BrowserShot src={landingDesktop} height={480} rotation={-1.2} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const RealNumbersScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{padding: "92px 72px 100px", gap: 32}}>
      <div style={entryStyle(frame, fps, 0, 34)}>
        <FrameBadge text="Straight-up version" dark />
      </div>
      <div style={entryStyle(frame, fps, 8, 40)}>
        <div
          style={{
            fontFamily: markerFamily,
            fontSize: 84,
            lineHeight: 0.98,
            maxWidth: 900,
          }}
        >
          Real product.
          <br />
          Real field.
          <br />
          Real numbers.
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 18,
          marginTop: 8,
        }}
      >
        {[
          {
            title: "No hidden strings",
            body: "You buy the jug at cooperator pricing and tell us what happened.",
          },
          {
            title: "No yield guarantee",
            body: "Good, bad, or boring data all count if the record is honest.",
          },
          {
            title: "Built for 2027 decisions",
            body: "The whole point is deciding if this earns a place on your farm next year.",
          },
        ].map((card, index) => (
          <div key={card.title} style={popStyle(frame, fps, 18 + index * 6)}>
            <Sticky
              title={card.title}
              body={card.body}
              color={index === 1 ? "#f6e89d" : index === 2 ? "#e7d7b0" : palette.paper}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          ...entryStyle(frame, fps, 34, 28),
        }}
      >
        <TapeCard rotation={-1.3}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: 26,
              alignItems: "center",
            }}
          >
            <div style={{display: "flex", flexDirection: "column", gap: 16}}>
              <div
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  lineHeight: 1.05,
                }}
              >
                Biostimulants are full of marketing.
                <br />
                This trial is trying to do the opposite.
              </div>
              <div
                style={{
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: palette.inkSoft,
                  fontWeight: 600,
                }}
              >
                Every cooperator can see the same program story the company sees.
              </div>
            </div>
            <div
              style={{
                height: 360,
                overflow: "hidden",
                borderRadius: 28,
                boxShadow: "0 18px 36px rgba(0,0,0,0.14)",
              }}
            >
              <Img
                src={cropsView}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "top center",
                }}
              />
            </div>
          </div>
        </TapeCard>
      </div>
    </AbsoluteFill>
  );
};

const ClaimsScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{padding: "84px 58px 86px"}}>
      <div style={{display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 28, height: "100%"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 24}}>
          <div style={entryStyle(frame, fps, 0, 26)}>
            <FrameBadge text="What gets tested" />
          </div>
          <div style={entryStyle(frame, fps, 8, 32)}>
            <div
              style={{
                fontFamily: markerFamily,
                fontSize: 74,
                lineHeight: 0.98,
                color: palette.cream,
              }}
            >
              Four claims.
              <br />
              One honest scoreboard.
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 6,
            }}
          >
            {[
              "Stronger root systems",
              "Better drought and heat tolerance",
              "Healthier canopy and higher yield",
              "Cut synthetic nitrogen without cutting yield",
            ].map((item, index) => (
              <div key={item} style={entryStyle(frame, fps, 18 + index * 5, 20)}>
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    padding: "18px 20px",
                    borderRadius: 22,
                    background: "rgba(255,248,234,0.12)",
                    border: "1px solid rgba(255,248,234,0.18)",
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      marginTop: 4,
                      borderRadius: 999,
                      backgroundColor: palette.yellow,
                      boxShadow: "0 0 0 6px rgba(244,222,86,0.14)",
                    }}
                  />
                  <div
                    style={{
                      fontSize: 30,
                      lineHeight: 1.34,
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={entryStyle(frame, fps, 42, 18)}>
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.45,
                color: "rgba(255,248,234,0.88)",
                fontWeight: 600,
              }}
            >
              If the product works, the data will show it. If it does not, the data
              will show that too.
            </div>
          </div>
        </div>
        <div
          style={{
            position: "relative",
            ...popStyle(frame, fps, 12),
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 38,
              overflow: "hidden",
              boxShadow: "0 28px 80px rgba(0,0,0,0.3)",
            }}
          >
            <Img
              src={biostim}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 38,
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.28) 60%, rgba(0,0,0,0.58) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 30,
              right: 30,
              bottom: 32,
              padding: "26px 28px",
              borderRadius: 28,
              background: "rgba(15,12,8,0.62)",
              border: "1px solid rgba(255,255,255,0.14)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontFamily: eliteFamily,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                fontSize: 24,
                color: palette.yellow,
                marginBottom: 10,
              }}
            >
              Why growers will watch this one
            </div>
            <div
              style={{
                fontSize: 30,
                lineHeight: 1.34,
                fontWeight: 700,
              }}
            >
              The sell is not miracle biology.
              <br />
              The sell is honest proof in public.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SignupScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const signupSteps = [
    "Go to trial.buperac.com",
    "Enter crop, acres, province, and RM",
    "Submit. Vendor confirms payment",
    "Get your private dashboard link",
  ];

  return (
    <AbsoluteFill style={{padding: "72px 50px 82px"}}>
      <div style={{display: "grid", gridTemplateColumns: "0.92fr 1.08fr", gap: 24, height: "100%"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 18}}>
          <div style={entryStyle(frame, fps, 0, 28)}>
            <FrameBadge text="Signup in minutes" />
          </div>
          <div style={entryStyle(frame, fps, 8, 34)}>
            <div
              style={{
                fontFamily: markerFamily,
                fontSize: 62,
                lineHeight: 0.98,
              }}
            >
              Four steps.
              <br />
              About three minutes.
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginTop: 6,
            }}
          >
            {signupSteps.map((item, index) => (
              <div key={item} style={popStyle(frame, fps, 16 + index * 3)}>
                <div
                  style={{
                    minHeight: 144,
                    padding: "16px 14px 14px",
                    borderRadius: 22,
                    background: "rgba(255,248,234,0.12)",
                    border: "1px solid rgba(255,248,234,0.16)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      background: palette.yellow,
                      color: palette.ink,
                      fontSize: 24,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {index + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 20,
                      lineHeight: 1.28,
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={entryStyle(frame, fps, 28, 18)}>
            <TapeCard rotation={-1.1} background={palette.paperWarm}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{fontFamily: eliteFamily, fontSize: 24, textTransform: "uppercase", letterSpacing: 1}}>
                  Pricing math
                </div>
                <div style={{fontSize: 30, fontWeight: 900, color: palette.ink, lineHeight: 1.12}}>
                  1 L = 2 acres
                  <br />
                  80 acres = $224
                </div>
                <div style={{fontSize: 23, lineHeight: 1.36, color: palette.inkSoft, fontWeight: 700}}>
                  Payment is not collected on the website. The vendor handles it after follow-up.
                </div>
              </div>
            </TapeCard>
          </div>
        </div>
        <div
          style={{
            alignSelf: "center",
            ...popStyle(frame, fps, 10),
          }}
        >
          <BrowserShot src={landingDesktop} height={1100} rotation={1.1} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const TrialDesignScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{padding: "86px 60px 92px"}}>
      <div style={{display: "flex", flexDirection: "column", gap: 22}}>
        <div style={entryStyle(frame, fps, 0, 24)}>
          <FrameBadge text="Pick the design that fits your farm" dark />
        </div>
        <div style={entryStyle(frame, fps, 8, 30)}>
          <div
            style={{
              fontFamily: markerFamily,
              fontSize: 70,
              lineHeight: 0.98,
              maxWidth: 900,
            }}
          >
            Honest split-field beats
            <br />
            pretend strip trial.
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          marginTop: 34,
        }}
      >
        {[
          ["Strip trial", "Gold standard. Alternating treated and untreated strips."],
          ["Split field", "Treat half, leave half. Near gold standard."],
          ["Whole field vs history", "Compare to your own 3-year yield history."],
          ["Whole field vs neighbor", "Compare to a similar untreated neighbor field."],
        ].map(([title, body], index) => (
          <div key={title} style={popStyle(frame, fps, 18 + index * 5)}>
            <Sticky title={title} body={body} color={index % 2 === 0 ? palette.paper : "#f6e89d"} />
          </div>
        ))}
        <div
          style={{
            gridColumn: "1 / span 2",
            ...entryStyle(frame, fps, 40, 24),
          }}
        >
          <TapeCard rotation={0.4} background="#f9eac0">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.95fr 1.05fr",
                gap: 22,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: eliteFamily,
                    textTransform: "uppercase",
                    fontSize: 24,
                    letterSpacing: 1.2,
                    color: palette.red,
                    marginBottom: 10,
                  }}
                >
                  Also allowed
                </div>
                <div style={{fontSize: 44, fontWeight: 900, lineHeight: 1.08}}>
                  Observational fields still count.
                </div>
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 27,
                    lineHeight: 1.42,
                    color: palette.inkSoft,
                    fontWeight: 700,
                  }}
                >
                  Lowest rigor, but still useful if the notes and yield are honest.
                </div>
              </div>
              <div
                style={{
                  padding: "24px 26px",
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.62)",
                  border: "1px dashed rgba(31,47,74,0.18)",
                }}
              >
                <div style={{fontSize: 28, fontWeight: 800, color: palette.ink}}>
                  Minimum completed trial
                </div>
                <div style={{marginTop: 18}}>
                  <ListLine label="Application events" value="1+" />
                  <ListLine label="In-season check-ins" value="2+" />
                  <ListLine label="Yield events" value="1" />
                </div>
              </div>
            </div>
          </TapeCard>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CheckInScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{padding: "84px 52px 90px"}}>
      <div style={{display: "flex", flexDirection: "column", gap: 22}}>
        <div style={entryStyle(frame, fps, 0, 24)}>
          <FrameBadge text="Low-friction logging" />
        </div>
        <div style={entryStyle(frame, fps, 8, 30)}>
          <div
            style={{
              fontFamily: markerFamily,
              fontSize: 74,
              lineHeight: 0.98,
              maxWidth: 920,
            }}
          >
            Two-minute check-ins.
            <br />
            Truck or kitchen table.
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "0.72fr 1.28fr",
          gap: 26,
          alignItems: "center",
          marginTop: 26,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            ...popStyle(frame, fps, 14),
          }}
        >
          <PhoneShot src={landingMobile} />
        </div>
        <div style={{display: "flex", flexDirection: "column", gap: 18}}>
          <div style={entryStyle(frame, fps, 20, 18)}>
            <TapeCard rotation={-0.6}>
              <div
                style={{
                  fontFamily: eliteFamily,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  fontSize: 24,
                  color: palette.green,
                  marginBottom: 10,
                }}
              >
                Option A
              </div>
              <div style={{fontSize: 46, fontWeight: 900, lineHeight: 1.08}}>
                Telegram bot
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: palette.inkSoft,
                  fontWeight: 700,
                }}
              >
                Dictate a note. Send a photo. Tap /apply. Type /yield 52.3 at harvest.
              </div>
            </TapeCard>
          </div>
          <div style={entryStyle(frame, fps, 28, 18)}>
            <TapeCard rotation={0.8} background={palette.paperWarm}>
              <div
                style={{
                  fontFamily: eliteFamily,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  fontSize: 24,
                  color: palette.red,
                  marginBottom: 10,
                }}
              >
                Option B
              </div>
              <div style={{fontSize: 46, fontWeight: 900, lineHeight: 1.08}}>
                Web dashboard
              </div>
              <div
                style={{
                  marginTop: 18,
                  fontSize: 28,
                  lineHeight: 1.45,
                  color: palette.inkSoft,
                  fontWeight: 700,
                }}
              >
                Add fields, upload soil reports and photos, track every event on one timeline.
              </div>
            </TapeCard>
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 26,
          ...popStyle(frame, fps, 30),
        }}
      >
        <BrowserShot src={landingDesktop} height={420} rotation={0.5} scale={0.98} />
      </div>
    </AbsoluteFill>
  );
};

const PrivacyScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  return (
    <AbsoluteFill style={{padding: "86px 54px 92px"}}>
      <div style={entryStyle(frame, fps, 0, 24)}>
        <FrameBadge text="Privacy and proof" dark />
      </div>
      <div style={entryStyle(frame, fps, 8, 30)}>
        <div
          style={{
            marginTop: 18,
            fontFamily: markerFamily,
            fontSize: 74,
            lineHeight: 0.98,
            maxWidth: 920,
          }}
        >
          Same scoreboard
          <br />
          farmers and company see.
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginTop: 34,
        }}
      >
        <div style={popStyle(frame, fps, 18)}>
          <TapeCard rotation={-1.1}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: palette.inkSoft,
                marginBottom: 10,
              }}
            >
              What stays private
            </div>
            <div style={{marginTop: 8}}>
              <ListLine label="Name / farm name" value="Private" />
              <ListLine label="Phone / email" value="Private" />
              <ListLine label="Exact legal location" value="Private" />
              <ListLine label="Photos" value="Opt-in only" />
            </div>
          </TapeCard>
        </div>
        <div style={popStyle(frame, fps, 24)}>
          <TapeCard rotation={0.9} background={palette.paperWarm}>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: palette.inkSoft,
                marginBottom: 12,
              }}
            >
              What shows up publicly
            </div>
            <div style={{marginTop: 8}}>
              <ListLine label="Province + crop" value="Visible" />
              <ListLine label="Anonymized activity feed" value="Visible" />
              <ListLine label="Yield deltas by crop" value="After 3 farms" />
              <ListLine label="Rigor tier" value="Visible" />
            </div>
          </TapeCard>
        </div>
      </div>
      <div
        style={{
          marginTop: 26,
          ...entryStyle(frame, fps, 34, 20),
        }}
      >
        <TapeCard rotation={-0.2} background="#f9efcc">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.9fr 1.1fr",
              gap: 22,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: eliteFamily,
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                  fontSize: 24,
                  color: palette.green,
                }}
              >
                Public board logic
              </div>
              <div style={{marginTop: 12, fontSize: 44, fontWeight: 900, lineHeight: 1.08}}>
                No cherry-picking.
                <br />
                No edited numbers.
              </div>
              <div
                style={{
                  marginTop: 16,
                  fontSize: 28,
                  lineHeight: 1.46,
                  color: palette.inkSoft,
                  fontWeight: 700,
                }}
              >
                The whole value prop is credibility. If the program ever starts massaging the result, the whole point dies.
              </div>
            </div>
            <div
              style={{
                padding: "24px 24px 18px",
                borderRadius: 24,
                background: "rgba(255,255,255,0.68)",
                border: "1px solid rgba(31,47,74,0.12)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {[
                "SK canola application logged",
                "AB wheat photo added",
                "MB oat yield reported",
                "Yield table unlocks only after 3 farms on the same crop",
              ].map((line, index) => (
                <div
                  key={line}
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    background: index === 3 ? "rgba(60,125,48,0.14)" : "rgba(31,47,74,0.06)",
                    fontSize: 24,
                    lineHeight: 1.34,
                    color: palette.ink,
                    fontWeight: 700,
                  }}
                >
                  {line}
                </div>
              ))}
            </div>
          </div>
        </TapeCard>
      </div>
    </AbsoluteFill>
  );
};

const OutcomeScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const leftTilt = interpolate(frame, [0, 240], [-1.8, -0.6], {
    extrapolateRight: "clamp",
  });
  const rightTilt = interpolate(frame, [0, 240], [1.8, 0.6], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{padding: "94px 60px 96px"}}>
      <div style={entryStyle(frame, fps, 0, 20)}>
        <FrameBadge text="The actual pitch" />
      </div>
      <div style={entryStyle(frame, fps, 8, 30)}>
        <div
          style={{
            marginTop: 18,
            fontFamily: markerFamily,
            fontSize: 84,
            lineHeight: 0.95,
            maxWidth: 940,
          }}
        >
          If it works,
          <br />
          the data shows it.
          <br />
          If it does not,
          <br />
          the data shows that too.
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 22,
          marginTop: 40,
        }}
      >
        <div style={popStyle(frame, fps, 18)}>
          <TapeCard rotation={leftTilt} background={palette.paper}>
            <div
              style={{
                fontFamily: eliteFamily,
                textTransform: "uppercase",
                fontSize: 22,
                letterSpacing: 1.2,
                color: palette.green,
                marginBottom: 12,
              }}
            >
              If the data is good
            </div>
            <div style={{fontSize: 48, fontWeight: 900, lineHeight: 1.08}}>
              Buy with a cleaner conscience in 2027.
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 28,
                lineHeight: 1.45,
                color: palette.inkSoft,
                fontWeight: 700,
              }}
            >
              Better roots, better stress tolerance, better yield, or less N without losing yield. Whatever is real should survive open comparison.
            </div>
          </TapeCard>
        </div>
        <div style={popStyle(frame, fps, 26)}>
          <TapeCard rotation={rightTilt} background="#f6e89d">
            <div
              style={{
                fontFamily: eliteFamily,
                textTransform: "uppercase",
                fontSize: 22,
                letterSpacing: 1.2,
                color: palette.red,
                marginBottom: 12,
              }}
            >
              If the data is weak
            </div>
            <div style={{fontSize: 48, fontWeight: 900, lineHeight: 1.08}}>
              Save yourself money and skip the story.
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 28,
                lineHeight: 1.45,
                color: palette.inkSoft,
                fontWeight: 700,
              }}
            >
              A weak outcome with clean notes is still useful. Bad data is not failure. Hidden data is.
            </div>
          </TapeCard>
        </div>
      </div>
      <div style={{marginTop: 28, ...entryStyle(frame, fps, 38, 18)}}>
        <BrowserShot src={cropsView} height={460} rotation={-0.4} scale={0.99} />
      </div>
    </AbsoluteFill>
  );
};

const ClosingScene = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const scale = interpolate(frame, [0, 150], [0.94, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        padding: "120px 68px 110px",
        justifyContent: "space-between",
        transform: `scale(${scale})`,
      }}
    >
      <div style={{display: "flex", flexDirection: "column", gap: 30}}>
        <div style={entryStyle(frame, fps, 0, 24)}>
          <FrameBadge text="Claim your acres" />
        </div>
        <div style={entryStyle(frame, fps, 8, 30)}>
          <div
            style={{
              fontFamily: markerFamily,
              fontSize: 96,
              lineHeight: 0.95,
            }}
          >
            trial.buperac.com
          </div>
        </div>
        <div style={entryStyle(frame, fps, 18, 22)}>
          <div
            style={{
              maxWidth: 880,
              fontSize: 38,
              lineHeight: 1.42,
              fontWeight: 700,
              color: "rgba(255,248,234,0.9)",
            }}
          >
            Limited 2026 cooperator spots. Prairie farmers only need a real field,
            an honest check-in, and a willingness to let the numbers speak.
          </div>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
          alignItems: "end",
        }}
      >
        <div style={popStyle(frame, fps, 26)}>
          <TapeCard rotation={-0.7}>
            <div
              style={{
                fontFamily: eliteFamily,
                textTransform: "uppercase",
                fontSize: 22,
                letterSpacing: 1.2,
                color: palette.green,
              }}
            >
              Best for
            </div>
            <div style={{marginTop: 14, fontSize: 46, fontWeight: 900, lineHeight: 1.08}}>
              Farmers who want evidence before buying in.
            </div>
          </TapeCard>
        </div>
        <div style={popStyle(frame, fps, 32)}>
          <TapeCard rotation={0.8} background="#f9efcc">
            <div
              style={{
                fontFamily: eliteFamily,
                textTransform: "uppercase",
                fontSize: 22,
                letterSpacing: 1.2,
                color: palette.red,
              }}
            >
              Easy to use
            </div>
            <div style={{marginTop: 14, fontSize: 46, fontWeight: 900, lineHeight: 1.08}}>
              No app install.
              <br />
              Telegram or dashboard.
            </div>
          </TapeCard>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const FarmerExplainerReel = () => {
  const frame = useCurrentFrame();

  return (
    <ReelFrame>
      <BaseBackdrop frame={frame} />

      <Sequence from={accumulate(0)} durationInFrames={sceneDurations[0]}>
        <HookScene />
      </Sequence>

      <Sequence from={accumulate(1)} durationInFrames={sceneDurations[1]}>
        <RealNumbersScene />
      </Sequence>

      <Sequence from={accumulate(2)} durationInFrames={sceneDurations[2]}>
        <ClaimsScene />
      </Sequence>

      <Sequence from={accumulate(3)} durationInFrames={sceneDurations[3]}>
        <SignupScene />
      </Sequence>

      <Sequence from={accumulate(4)} durationInFrames={sceneDurations[4]}>
        <TrialDesignScene />
      </Sequence>

      <Sequence from={accumulate(5)} durationInFrames={sceneDurations[5]}>
        <CheckInScene />
      </Sequence>

      <Sequence from={accumulate(6)} durationInFrames={sceneDurations[6]}>
        <PrivacyScene />
      </Sequence>

      <Sequence from={accumulate(7)} durationInFrames={sceneDurations[7]}>
        <OutcomeScene />
      </Sequence>

      <Sequence from={accumulate(8)} durationInFrames={sceneDurations[8]}>
        <ClosingScene />
      </Sequence>
    </ReelFrame>
  );
};
