import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { COLORS } from "./theme";
import { PaperBackground } from "./components/PaperBackground";

const Probe: React.FC = () =>
  React.createElement(AbsoluteFill, { style: { background: COLORS.kraft } },
    React.createElement(PaperBackground));

const Root1: React.FC = () =>
  React.createElement(Composition, {
    id: "Probe",
    component: Probe,
    durationInFrames: 30,
    fps: 30,
    width: 1920,
    height: 1080,
  });

registerRoot(Root1);
