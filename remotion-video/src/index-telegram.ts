// Isolated entry point that registers ONLY the Telegram tutorial compositions.
// Useful when the shared Root.tsx depends on other compositions that are
// mid-edit or have transient bundle issues — this entry bypasses those imports.
import React from "react";
import { Composition, registerRoot } from "remotion";
import { TelegramComposition } from "./TelegramComposition";
import { TEL_DURATION, TEL_FPS } from "./components/telegram/schedule";
import { WIDTH, HEIGHT } from "./theme";
import { loadFonts } from "./fonts";

loadFonts();

const TelegramOnlyRoot: React.FC = () =>
  React.createElement(React.Fragment, null,
    React.createElement(Composition, {
      id: "TelegramTutorial",
      component: TelegramComposition,
      durationInFrames: TEL_DURATION,
      fps: TEL_FPS,
      width: WIDTH,
      height: HEIGHT,
    }),
    React.createElement(Composition, {
      id: "TelegramTutorialSquare",
      component: TelegramComposition,
      durationInFrames: TEL_DURATION,
      fps: TEL_FPS,
      width: 1080,
      height: 1080,
    }),
  );

registerRoot(TelegramOnlyRoot);
