import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";

const Blank: React.FC = () =>
  React.createElement(AbsoluteFill, { style: { background: "tomato" } });

const MinimalRoot: React.FC = () =>
  React.createElement(Composition, {
    id: "Blank",
    component: Blank,
    durationInFrames: 30,
    fps: 30,
    width: 320,
    height: 240,
  });

registerRoot(MinimalRoot);
