import React from "react";
import {Composition} from "remotion";
import {FarmerExplainerReel} from "./FarmerExplainerReel";

export const Root = () => {
  return (
    <Composition
      id="FarmerExplainerReel"
      component={FarmerExplainerReel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={1800}
    />
  );
};
