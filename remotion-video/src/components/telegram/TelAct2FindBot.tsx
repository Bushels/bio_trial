import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../../theme";
import { TEL_ACTS } from "./schedule";
import { TelegramPhone, TG, TouchCursor } from "./TelegramPhone";

// Act 2 — Find the bot in Telegram. Show the search screen with @BuperacTrialBot,
// the result appearing, and a Start button highlighted.
export const TelAct2FindBot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - TEL_ACTS.findBot.start;
  const dur = TEL_ACTS.findBot.end - TEL_ACTS.findBot.start;

  const enter = spring({ fps, frame: local, config: { damping: 18, mass: 0.9 } });
  const exit = interpolate(local, [dur - 20, dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = enter * exit;

  // Typing the handle in the search bar
  const query = "@BuperacTrialBot";
  const typed = Math.floor(
    interpolate(local, [16, 50], [0, query.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const resultAppear = interpolate(local, [54, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatAppear = interpolate(local, [96, 116], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const botWelcome = interpolate(local, [124, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity, padding: "90px 110px", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 100,
          alignItems: "center",
          width: "100%",
          maxWidth: 1660,
        }}
      >
        <InstructionCard
          stepNumber="01"
          title="Find the bot"
          body={`Open Telegram. Tap the search bar\nat the top and type @BuperacTrialBot.\nTap the result, then tap Start.`}
        />

        <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
          <TelegramPhone
            enterAtFrame={TEL_ACTS.findBot.start + 4}
            rotate={-2}
            header={{ title: "Search", subtitle: "chats and contacts", avatar: "Q" }}
            tapeTop
          >
            <SearchBar query={query.slice(0, typed)} caret={typed < query.length && (local % 16) < 8} />
            {resultAppear > 0 && chatAppear < 1 && (
              <SearchResult appear={resultAppear} />
            )}
            {chatAppear > 0 && (
              <div style={{ opacity: chatAppear }}>
                <div
                  style={{
                    fontSize: 12,
                    color: TG.textDim,
                    textAlign: "center",
                    padding: "6px 0",
                  }}
                >
                  Bot | 1 subscriber
                </div>
                <BotIntroCard appear={botWelcome} />
              </div>
            )}
          </TelegramPhone>

          {/* Tap-Start cursor appears after the result is on screen, before chat opens */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <TouchCursor
              appearFrame={TEL_ACTS.findBot.start + 78}
              top={320}
              left="50%"
              label="tap Start"
              hold={24}
            />
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SearchBar: React.FC<{ query: string; caret: boolean }> = ({ query, caret }) => (
  <div
    style={{
      background: "#0f1722",
      borderRadius: 12,
      padding: "10px 14px",
      fontFamily: FONTS.ui,
      fontSize: 16,
      color: TG.text,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    <span style={{ color: TG.textDim, fontSize: 18 }}>🔍</span>
    <span>{query || <span style={{ color: TG.textDim }}>Search</span>}</span>
    {caret && <span style={{ marginLeft: 1 }}>|</span>}
  </div>
);

const SearchResult: React.FC<{ appear: number }> = ({ appear }) => (
  <div
    style={{
      marginTop: 8,
      padding: "10px 12px",
      background: "#1d2a38",
      border: "1px solid #25384a",
      borderRadius: 12,
      display: "flex",
      gap: 12,
      alignItems: "center",
      opacity: appear,
      transform: `translateY(${interpolate(appear, [0, 1], [12, 0])}px)`,
    }}
  >
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        background: COLORS.green,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONTS.marker,
        fontSize: 20,
      }}
    >
      BT
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontWeight: 600, fontSize: 16, color: TG.text }}>Buperac Trial Bot</div>
      <div style={{ fontSize: 13, color: TG.textDim }}>@BuperacTrialBot · Bot</div>
    </div>
  </div>
);

const BotIntroCard: React.FC<{ appear: number }> = ({ appear }) => (
  <div
    style={{
      marginTop: 10,
      padding: "14px 16px",
      background: TG.botBubble,
      borderRadius: 16,
      fontSize: 14,
      color: TG.text,
      lineHeight: 1.4,
      opacity: appear,
      transform: `translateY(${interpolate(appear, [0, 1], [12, 0])}px)`,
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>Welcome to Buperac Trial Bot</div>
    <div>Logs applications, photos, and yield for your 2026 trial fields.</div>
    <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
      <div
        style={{
          flex: 1,
          padding: "10px 12px",
          background: COLORS.green,
          color: "white",
          borderRadius: 10,
          textAlign: "center",
          fontWeight: 700,
          fontFamily: FONTS.ui,
          letterSpacing: 1,
        }}
      >
        START
      </div>
    </div>
  </div>
);

const InstructionCard: React.FC<{ stepNumber: string; title: string; body: string }> = ({
  stepNumber,
  title,
  body,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: "50%",
          background: COLORS.green,
          color: COLORS.paper,
          fontFamily: FONTS.marker,
          fontSize: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 12px 20px -10px rgba(40,20,10,0.55)",
          transform: "rotate(-4deg)",
        }}
      >
        {stepNumber}
      </div>
      <div
        style={{
          fontFamily: FONTS.marker,
          fontSize: 72,
          color: COLORS.ink,
          lineHeight: 1,
        }}
      >
        {title}
      </div>
    </div>
    <div
      style={{
        fontFamily: FONTS.handwritten,
        fontSize: 40,
        color: COLORS.graphite,
        whiteSpace: "pre-line",
        lineHeight: 1.25,
        maxWidth: 600,
      }}
    >
      {body}
    </div>
  </div>
);
