import React from "react";
import { HELMET_CONFIG, OPTICS_CONFIG } from "../config/visorConfig";

/**
 * Curved visor dome glass optics layer:
 * - Preserves the full brightness and clarity of the Mars panorama
 * - Very light outer-edge vignette blending softly into the first-person helmet corners
 * - Soft vertical curved-dome reflection arcs along the upper-left and upper-right interior
 */
export const VisorOptics: React.FC = () => {
  const { vignette, domeReflections } = OPTICS_CONFIG;

  return (
    <div className="visor-optics-layer" aria-hidden="true">
      <svg
        className="visor-optics-svg"
        viewBox={`0 0 ${HELMET_CONFIG.viewBoxW} ${HELMET_CONFIG.viewBoxH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient
            id="glassVignette"
            cx={vignette.cx}
            cy={vignette.cy}
            r={vignette.r}
          >
            <stop offset={vignette.clearStop} stopColor={vignette.color} stopOpacity={0} />
            <stop
              offset={vignette.midStop}
              stopColor={vignette.color}
              stopOpacity={vignette.midOpacity}
            />
            <stop offset="100%" stopColor={vignette.color} stopOpacity={vignette.edgeOpacity} />
          </radialGradient>

          <linearGradient id="domeVerticalGloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="28%" stopColor="#f8f2ea" stopOpacity="0.65" />
            <stop offset="72%" stopColor="#efe6dc" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <filter id="domeGlossBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={domeReflections.blurStdDev} />
          </filter>
        </defs>

        <rect
          x="0"
          y="0"
          width={HELMET_CONFIG.viewBoxW}
          height={HELMET_CONFIG.viewBoxH}
          fill="url(#glassVignette)"
        />

        {/* Curved interior dome vertical gloss streaks seen near upper left/right glass curvature */}
        <g
          className="visor-dome-reflections"
          filter="url(#domeGlossBlur)"
          opacity={domeReflections.opacity}
        >
          <ellipse
            cx={domeReflections.leftX}
            cy={domeReflections.leftY}
            rx={domeReflections.leftRx}
            ry={domeReflections.leftRy}
            fill="none"
            stroke="url(#domeVerticalGloss)"
            strokeWidth="12"
            transform={`rotate(-4 ${domeReflections.leftX} ${domeReflections.leftY})`}
          />
          <ellipse
            cx={domeReflections.rightX}
            cy={domeReflections.rightY}
            rx={domeReflections.rightRx}
            ry={domeReflections.rightRy}
            fill="none"
            stroke="url(#domeVerticalGloss)"
            strokeWidth="12"
            transform={`rotate(4 ${domeReflections.rightX} ${domeReflections.rightY})`}
          />
        </g>
      </svg>
    </div>
  );
};
