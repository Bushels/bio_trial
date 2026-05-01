import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const landingMobile = staticFile("assets/landing-mobile.png");
const cropsView = staticFile("assets/crops-view.png");

const ALT = {
  bg: "#08111c",
  bg2: "#0f1d2d",
  panel: "rgba(17, 29, 45, 0.88)",
  panelStrong: "#122235",
  line: "rgba(135, 160, 196, 0.2)",
  text: "#f6f2e8",
  muted: "#96a7c0",
  yellow: "#f0c24b",
  green: "#68c47f",
  red: "#e27d60",
  cyan: "#63b7e7",
  white: "#ffffff",
};

const FPS = 30;
const DURATION = 720;

const SEGMENTS = {
  hook: 120,
  claims: 110,
  signup: 130,
  logging: 140,
  board: 120,
  cta: 100,
};

export const FieldProofVertical: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: ALT.bg, color: ALT.text }}>
      <Backdrop />

      <Sequence from={0} durationInFrames={SEGMENTS.hook}>
        <HookScene />
      </Sequence>
      <Sequence from={SEGMENTS.hook} durationInFrames={SEGMENTS.claims}>
        <ClaimsScene />
      </Sequence>
      <Sequence
        from={SEGMENTS.hook + SEGMENTS.claims}
        durationInFrames={SEGMENTS.signup}
      >
        <SignupScene />
      </Sequence>
      <Sequence
        from={SEGMENTS.hook + SEGMENTS.claims + SEGMENTS.signup}
        durationInFrames={SEGMENTS.logging}
      >
        <LoggingScene />
      </Sequence>
      <Sequence
        from={SEGMENTS.hook + SEGMENTS.claims + SEGMENTS.signup + SEGMENTS.logging}
        durationInFrames={SEGMENTS.board}
      >
        <BoardScene />
      </Sequence>
      <Sequence
        from={
          SEGMENTS.hook +
          SEGMENTS.claims +
          SEGMENTS.signup +
          SEGMENTS.logging +
          SEGMENTS.board
        }
        durationInFrames={SEGMENTS.cta}
      >
        <CtaScene />
      </Sequence>
    </AbsoluteFill>
  );
};

const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + 0.5 * Math.sin(frame / 38);

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 50% 18%, rgba(99,183,231,0.16), transparent 28%), radial-gradient(circle at 50% 52%, rgba(240,194,75,0.12), transparent 34%), linear-gradient(180deg, #0b1522 0%, #08111c 100%)",
        }}
      />
      <AbsoluteFill style={{ opacity: 0.18 }}>
        {Array.from({ length: 16 }).map((_, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${(index / 15) * 100}%`,
              width: 1,
              background: ALT.line,
            }}
          />
        ))}
        {Array.from({ length: 26 }).map((_, index) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: `${(index / 25) * 100}%`,
              height: 1,
              background: ALT.line,
            }}
          />
        ))}
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "12%",
          width: 260,
          height: 4,
          background: ALT.yellow,
          opacity: 0.45 + pulse * 0.35,
          boxShadow: `0 0 24px ${ALT.yellow}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          right: "10%",
          width: 220,
          height: 4,
          background: ALT.green,
          opacity: 0.35 + pulse * 0.3,
          boxShadow: `0 0 24px ${ALT.green}`,
        }}
      />
    </AbsoluteFill>
  );
};

const SceneFrame: React.FC<{
  number: string;
  label: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ number, label, title, subtitle, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({
    fps,
    frame,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
  });

  return (
    <AbsoluteFill
      style={{
        padding: "84px 72px 72px",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: `1px solid ${ALT.line}`,
              background: "rgba(255,255,255,0.03)",
              fontFamily: "Inter, system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: 1.6,
            }}
          >
            {number}
          </div>
          <div
            style={{
              fontFamily: "'Cutive Mono', 'Courier New', monospace",
              fontSize: 18,
              letterSpacing: 2.2,
              color: ALT.muted,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
        </div>
        <div
          style={{
            fontFamily: "'Cutive Mono', 'Courier New', monospace",
            fontSize: 18,
            letterSpacing: 2.2,
            color: ALT.muted,
          }}
        >
          BUperac Trial
        </div>
      </div>

      <div style={{ marginTop: 40 }}>
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 0.94,
            letterSpacing: -2.4,
            maxWidth: 900,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 22,
              maxWidth: 880,
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 34,
              lineHeight: 1.22,
              color: ALT.muted,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
    </AbsoluteFill>
  );
};

const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const priceReveal = interpolate(frame, [18, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame
      number="01"
      label="Hook"
      title="Biostimulants are easy to market. Harder to prove on your farm."
      subtitle="This program costs $2.80 per acre and puts the result on a public board."
    >
      <div style={{ marginTop: 34, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Pill color={ALT.yellow} text="$2.80 / ac" />
        <Pill color={ALT.green} text="80 ac = $224" />
        <Pill color={ALT.cyan} text="public by default" />
      </div>

      <div
        style={{
          marginTop: 34,
          display: "grid",
          gridTemplateRows: "1.05fr 0.95fr",
          gap: 26,
          flex: 1,
        }}
      >
        <GlowCard>
          <AssetFrame
            src={landingMobile}
            height={720}
            objectPosition="center 32%"
            caption="real landing page"
          />
        </GlowCard>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            opacity: priceReveal,
          }}
        >
          <MetricCard
            label="What you pay"
            value="$224"
            note="40 L covers 80 acres"
          />
          <MetricCard
            label="What you owe"
            value="honest data"
            note="good, bad, or boring"
          />
        </div>
      </div>
    </SceneFrame>
  );
};

const ClaimsScene: React.FC = () => {
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at 20% 18%, rgba(99,183,231,0.18), transparent 30%), radial-gradient(circle at 82% 72%, rgba(104,196,127,0.14), transparent 26%), linear-gradient(180deg, rgba(8,17,28,0.96) 0%, rgba(10,20,31,0.98) 100%)",
        }}
      />
      <SceneFrame
        number="02"
        label="What Gets Tested"
        title="Four claims. One honest test."
        subtitle="If the product helps, the data shows it. If it does not, the data shows that too."
      >
        <div
          style={{
            marginTop: 48,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            flex: 1,
          }}
        >
          {[
            ["01", "Stronger root systems", ALT.yellow],
            ["02", "Better drought and heat tolerance", ALT.cyan],
            ["03", "Healthier canopy and higher yield", ALT.green],
            ["04", "Cut synthetic N without cutting yield", ALT.red],
          ].map(([num, text, color], index) => (
            <ClaimBlock
              key={text}
              index={index}
              num={num}
              text={text}
              color={color}
            />
          ))}
        </div>
      </SceneFrame>
    </AbsoluteFill>
  );
};

const SignupScene: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [22, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame
      number="03"
      label="Sign Up"
      title="Three minutes on your phone."
      subtitle="Fill in the form. Hit submit. We confirm the order. Payment goes through the vendor, not the website."
    >
      <div
        style={{
          marginTop: 38,
          display: "grid",
          gridTemplateRows: "0.95fr 1.05fr",
          gap: 24,
          flex: 1,
        }}
      >
        <GlowCard>
          <AssetFrame
            src={cropsView}
            height={620}
            objectPosition="top center"
            caption="sign-up form crop"
          />
        </GlowCard>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          {[
            "Add your crop, acres, province, and RM",
            "Choose pickup FOB Calgary or shipping follow-up",
            "Submit and trigger the live odometer",
            "Get a private dashboard link by email",
          ].map((item, index) => (
            <StepCard key={item} index={index + 1} text={item} />
          ))}
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            opacity: reveal,
          }}
        >
          <Pill color={ALT.green} text="vendor handles payment" />
          <Pill color={ALT.yellow} text="all payment methods accepted" />
          <Pill color={ALT.cyan} text="no password dashboard link" />
        </div>
      </div>
    </SceneFrame>
  );
};

const LoggingScene: React.FC = () => {
  return (
    <SceneFrame
      number="04"
      label="Logging"
      title="Bot in the truck. Dashboard at home."
      subtitle="Roughly two minutes per check-in. Farmers can use Telegram, the dashboard, or both."
    >
      <div
        style={{
          marginTop: 44,
          display: "grid",
          gridTemplateRows: "1fr auto",
          gap: 28,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.95fr 1.05fr",
            gap: 24,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              "/apply to log the pass",
              "send a photo when something changes",
              "type /yield 52.3 at harvest",
              "one application + two check-ins + yield = complete trial",
            ].map((item, index) => (
              <LineItem
                key={item}
                index={index}
                text={item}
                color={index === 3 ? ALT.yellow : ALT.cyan}
              />
            ))}
          </div>

          <PhoneChat />
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Pill color={ALT.green} text="no app install" />
          <Pill color={ALT.cyan} text="same Telegram farmers already use" />
          <Pill color={ALT.yellow} text="web dashboard still available" />
        </div>
      </div>
    </SceneFrame>
  );
};

const BoardScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <SceneFrame
      number="05"
      label="Public Board"
      title="You see the same board the company sees."
      subtitle="No cherry-picked PDF six months later. The board fills in live as real farm data arrives."
    >
      <div
        style={{
          marginTop: 42,
          flex: 1,
          borderRadius: 34,
          background: ALT.panelStrong,
          border: `1px solid ${ALT.line}`,
          boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
          padding: 30,
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <BoardStat label="Cooperators" value={countUp(frame, 33)} />
          <BoardStat label="Acres enrolled" value={countUp(frame, 2840).toLocaleString()} />
          <BoardStat label="Events logged" value={countUp(frame, 412)} />
          <BoardStat label="Photos shared" value={countUp(frame, 86)} />
        </div>

        <div
          style={{
            fontFamily: "'Cutive Mono', 'Courier New', monospace",
            fontSize: 18,
            letterSpacing: 1.8,
            color: ALT.muted,
            textTransform: "uppercase",
          }}
        >
          Yield delta vs check
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            ["Canola", 2.6, ALT.green],
            ["Wheat", 1.8, ALT.green],
            ["Peas", 0.4, ALT.yellow],
            ["Barley", -0.3, ALT.red],
          ].map(([crop, value, color], index) => (
            <BarRow
              key={crop}
              index={index}
              crop={crop}
              value={Number(value)}
              color={String(color)}
            />
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            alignItems: "end",
          }}
        >
          <div
            style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 24,
              lineHeight: 1.3,
              color: ALT.muted,
            }}
          >
            Yield numbers show only once at least 3 farms report on the same crop.
          </div>
          <div
            style={{
              justifySelf: "end",
              padding: "12px 16px",
              borderRadius: 18,
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${ALT.line}`,
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 700,
            }}
          >
            privacy floor: 3 farms per crop
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

const CtaScene: React.FC = () => {
  const frame = useCurrentFrame();
  const scale = 1 + 0.02 * Math.sin(frame / 8);

  return (
    <SceneFrame
      number="06"
      label="Call To Action"
      title="If you are going to test it, put it on the board."
      subtitle="Prairie cooperator spots for 2026 are limited."
    >
      <div
        style={{
          marginTop: 44,
          display: "grid",
          gridTemplateRows: "auto auto 1fr",
          gap: 26,
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 0.96,
            letterSpacing: -2.8,
            color: ALT.white,
            transform: `scale(${scale})`,
            transformOrigin: "left center",
          }}
        >
          trial.buperac.com
        </div>
        <div
          style={{
            height: 10,
            width: "100%",
            borderRadius: 999,
            background: ALT.yellow,
            boxShadow: `0 0 28px ${ALT.yellow}`,
          }}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "0.7fr 1.3fr",
            gap: 24,
            flex: 1,
          }}
        >
          <GlowCard>
            <AssetFrame
              src={landingMobile}
              height={720}
              objectPosition="center 34%"
              caption="sign up on phone or laptop"
            />
          </GlowCard>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
            }}
          >
            {[
              "$2.80 / ac cooperator pricing",
              "payment handled through the vendor",
              "dashboard link sent by email",
              "same public scoreboard for farmers and company",
            ].map((line, index) => (
              <LineItem
                key={line}
                index={index}
                text={line}
                color={index % 2 === 0 ? ALT.yellow : ALT.green}
              />
            ))}
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};

const GlowCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      borderRadius: 34,
      background: ALT.panel,
      border: `1px solid ${ALT.line}`,
      boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
      padding: 18,
    }}
  >
    {children}
  </div>
);

const AssetFrame: React.FC<{
  src: string;
  height: number;
  objectPosition?: string;
  caption: string;
}> = ({ src, height, objectPosition = "center center", caption }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "6px 4px 0",
      }}
    >
      {["#ff725c", "#f0c24b", "#68c47f"].map((dot) => (
        <div
          key={dot}
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: dot,
          }}
        />
      ))}
    </div>
    <div
      style={{
        height,
        borderRadius: 24,
        overflow: "hidden",
        background: ALT.bg2,
        border: `1px solid ${ALT.line}`,
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
        }}
      />
    </div>
    <div
      style={{
        fontFamily: "'Cutive Mono', 'Courier New', monospace",
        fontSize: 18,
        letterSpacing: 1.8,
        textTransform: "uppercase",
        color: ALT.muted,
      }}
    >
      {caption}
    </div>
  </div>
);

const MetricCard: React.FC<{
  label: string;
  value: string;
  note: string;
}> = ({ label, value, note }) => (
  <div
    style={{
      borderRadius: 24,
      background: ALT.panel,
      border: `1px solid ${ALT.line}`,
      padding: "24px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div
      style={{
        fontFamily: "'Cutive Mono', 'Courier New', monospace",
        fontSize: 16,
        letterSpacing: 1.8,
        textTransform: "uppercase",
        color: ALT.muted,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 44,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 24,
        lineHeight: 1.25,
        color: ALT.muted,
      }}
    >
      {note}
    </div>
  </div>
);

const ClaimBlock: React.FC<{
  index: number;
  num: string;
  text: string;
  color: string;
}> = ({ index, num, text, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({
    fps,
    frame: Math.max(0, frame - index * 8),
    config: { damping: 18, mass: 0.8 },
  });

  return (
    <div
      style={{
        borderRadius: 28,
        background: "rgba(10,18,28,0.72)",
        border: `1px solid ${ALT.line}`,
        padding: "24px 22px",
        boxShadow: "0 16px 44px rgba(0,0,0,0.28)",
        transform: `translateY(${interpolate(reveal, [0, 1], [22, 0])}px)`,
        opacity: reveal,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 18,
          background: color,
          color: ALT.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 900,
          fontSize: 24,
        }}
      >
        {num}
      </div>
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 34,
          lineHeight: 1.12,
          fontWeight: 700,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const StepCard: React.FC<{
  index: number;
  text: string;
}> = ({ index, text }) => (
  <div
    style={{
      borderRadius: 24,
      background: ALT.panel,
      border: `1px solid ${ALT.line}`,
      padding: "20px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}
  >
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: ALT.yellow,
        color: ALT.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 900,
        fontSize: 22,
      }}
    >
      {index}
    </div>
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 28,
        lineHeight: 1.18,
      }}
    >
      {text}
    </div>
  </div>
);

const PhoneChat: React.FC = () => {
  const frame = useCurrentFrame();
  const messageOpacity = (offset: number) =>
    interpolate(frame, [18 + offset, 34 + offset], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <div
      style={{
        justifySelf: "end",
        width: 420,
        height: 760,
        borderRadius: 52,
        background: "#091019",
        border: `2px solid ${ALT.line}`,
        boxShadow: "0 28px 70px rgba(0,0,0,0.36)",
        padding: 16,
      }}
    >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 38,
            background: "#0f1b29",
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingBottom: 10,
              borderBottom: `1px solid ${ALT.line}`,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: ALT.green,
                }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>@BuperacTrialBot</div>
                <div style={{ fontSize: 12, color: ALT.muted }}>online</div>
              </div>
            </div>
            <div
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                fontSize: 12,
                color: ALT.muted,
              }}
            >
              Telegram
            </div>
          </div>

          <Bubble side="user" opacity={messageOpacity(0)}>
            /apply
          </Bubble>
          <Bubble side="bot" opacity={messageOpacity(14)}>
            Which field? South 80 or Home quarter
          </Bubble>
          <Bubble side="user" opacity={messageOpacity(28)}>
            South 80 - 0.5 L/ac foliar
          </Bubble>
          <Bubble side="bot" opacity={messageOpacity(42)}>
            Logged. Add a photo any time.
          </Bubble>
          <Bubble side="user" opacity={messageOpacity(56)}>
            /yield 52.3
          </Bubble>
        </div>
    </div>
  );
};

const Bubble: React.FC<{
  side: "user" | "bot";
  opacity: number;
  children: React.ReactNode;
}> = ({ side, opacity, children }) => (
  <div
    style={{
      alignSelf: side === "user" ? "flex-end" : "flex-start",
      maxWidth: "82%",
      padding: "12px 14px",
      borderRadius: 20,
      background: side === "user" ? "#1e4266" : "#17283a",
      color: ALT.text,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 18,
      lineHeight: 1.25,
      opacity,
      transform: `translateY(${interpolate(opacity, [0, 1], [10, 0])}px)`,
    }}
  >
    {children}
  </div>
);

const BoardStat: React.FC<{
  label: string;
  value: string | number;
}> = ({ label, value }) => (
  <div
    style={{
      flex: 1,
      minWidth: 190,
      borderRadius: 20,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${ALT.line}`,
      padding: "18px 16px",
    }}
  >
    <div
      style={{
        fontFamily: "'Cutive Mono', 'Courier New', monospace",
        fontSize: 15,
        letterSpacing: 1.6,
        color: ALT.muted,
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div
      style={{
        marginTop: 10,
        fontFamily: "Inter, system-ui, sans-serif",
        fontWeight: 800,
        fontSize: 44,
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  </div>
);

const BarRow: React.FC<{
  index: number;
  crop: string;
  value: number;
  color: string;
}> = ({ index, crop, value, color }) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [16 + index * 8, 44 + index * 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const width = Math.abs(value) / 3.0;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr 90px",
        gap: 18,
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {crop}
      </div>
      <div
        style={{
          position: "relative",
          height: 26,
          borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: `${width * progress * 100}%`,
            borderRadius: 999,
            background: color,
            boxShadow: `0 0 18px ${color}`,
          }}
        />
      </div>
      <div
        style={{
          fontFamily: "'Cutive Mono', 'Courier New', monospace",
          fontSize: 24,
          color,
          textAlign: "right",
        }}
      >
        {value > 0 ? "+" : ""}
        {value.toFixed(1)}
      </div>
    </div>
  );
};

const LineItem: React.FC<{
  index: number;
  text: string;
  color: string;
}> = ({ index, text, color }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [10 + index * 8, 26 + index * 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr",
        gap: 14,
        alignItems: "start",
        opacity: reveal,
        transform: `translateX(${interpolate(reveal, [0, 1], [-12, 0])}px)`,
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: color,
          marginTop: 12,
          boxShadow: `0 0 14px ${color}`,
        }}
      />
      <div
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 30,
          lineHeight: 1.2,
        }}
      >
        {text}
      </div>
    </div>
  );
};

const Pill: React.FC<{
  color: string;
  text: string;
}> = ({ color, text }) => (
  <div
    style={{
      padding: "12px 16px",
      borderRadius: 999,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      color,
      fontFamily: "Inter, system-ui, sans-serif",
      fontSize: 22,
      fontWeight: 700,
      lineHeight: 1,
    }}
  >
    {text}
  </div>
);

function countUp(frame: number, target: number) {
  const progress = interpolate(frame, [8, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return Math.round(target * progress);
}

export const FIELD_PROOF_FPS = FPS;
export const FIELD_PROOF_DURATION = DURATION;
