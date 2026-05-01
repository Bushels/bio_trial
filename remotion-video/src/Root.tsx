import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./MainComposition";
import {
  FIELD_PROOF_DURATION,
  FIELD_PROOF_FPS,
  FieldProofVertical,
} from "./FieldProofVertical";
import { TelegramComposition } from "./TelegramComposition";
import { TEL_DURATION, TEL_FPS } from "./components/telegram/schedule";
import { DURATION, FPS, WIDTH, HEIGHT } from "./theme";
import { loadFonts } from "./fonts";

// Register Google Fonts used by the theme. Remotion loads them during bundling.
loadFonts();

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="FarmerExplainer"
        component={MainComposition}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Square version for Instagram/LinkedIn stories */}
      <Composition
        id="FarmerExplainerSquare"
        component={MainComposition}
        durationInFrames={DURATION}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="FarmerExplainerFieldProof"
        component={FieldProofVertical}
        durationInFrames={FIELD_PROOF_DURATION}
        fps={FIELD_PROOF_FPS}
        width={1080}
        height={1920}
      />

      {/* How-to-use-Telegram walkthrough (30s) */}
      <Composition
        id="TelegramTutorial"
        component={TelegramComposition}
        durationInFrames={TEL_DURATION}
        fps={TEL_FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="TelegramTutorialSquare"
        component={TelegramComposition}
        durationInFrames={TEL_DURATION}
        fps={TEL_FPS}
        width={1080}
        height={1080}
      />
    </>
  );
};
