import React from "react";
import { Img } from "remotion";
import { COLORS, FONTS } from "../theme";
import { Tape } from "./PaperBackground";

type Props = {
  src: string;
  height: number;
  rotation?: number;
  objectPosition?: string;
  caption?: string;
  width?: number | string;
  style?: React.CSSProperties;
};

export const BrowserCard: React.FC<Props> = ({
  src,
  height,
  rotation = 0,
  objectPosition = "top center",
  caption,
  width = "100%",
  style,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width,
        transform: `rotate(${rotation}deg)`,
        ...style,
      }}
    >
      <Tape width={150} rotate={-6} style={{ top: -18, left: 60 }} />
      <Tape width={110} rotate={7} style={{ top: -12, right: 70 }} />

      <div
        style={{
          padding: 16,
          borderRadius: 24,
          background: "rgba(255,248,234,0.96)",
          border: `1px solid ${COLORS.kraftDeep}44`,
          boxShadow: "0 28px 54px -24px rgba(40,20,10,0.55)",
        }}
      >
        <div style={{ display: "flex", gap: 10, padding: "6px 8px 14px" }}>
          {["#ef5a4d", "#f6c945", "#59c36a"].map((dot) => (
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
            overflow: "hidden",
            borderRadius: 18,
            border: `1px solid ${COLORS.kraftDeep}22`,
            background: "#ffffff",
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
        {caption ? (
          <div
            style={{
              marginTop: 14,
              fontFamily: FONTS.typewriter,
              fontSize: 18,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: COLORS.graphiteSoft,
            }}
          >
            {caption}
          </div>
        ) : null}
      </div>
    </div>
  );
};
