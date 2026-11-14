import React from "react";
import { HELMET_CONFIG, PALETTE_CONFIG } from "../config/visorConfig";

const BOOM_GRILLE_DOTS: ReadonlyArray<{ dx: number; dy: number; r: number }> = [
  { dx: -14, dy: -6, r: 2.3 },
  { dx: -4, dy: -9, r: 2.5 },
  { dx: 7, dy: -8, r: 2.5 },
  { dx: 16, dy: -3, r: 2.2 },
  { dx: -16, dy: 3, r: 2.2 },
  { dx: -6, dy: 1, r: 2.6 },
  { dx: 5, dy: 2, r: 2.6 },
  { dx: 14, dy: 6, r: 2.2 },
  { dx: -8, dy: 10, r: 2.1 },
  { dx: 3, dy: 11, r: 2.1 },
];

/**
 * First-person EVA helmet interior view:
 * - Soft out-of-focus rounded corner shell leaving the visor field wide open
 * - Sloped light-grey interior cheek cowls on lower-left and lower-right
 * - Curved lower chin gasket lip and stepped center bridge
 * - Left & right out-of-focus interior sensor/mic booms rising into lower view
 * - All geometry, colors, and blur radii sourced from visorConfig.ts
 */
export const VisorFrame: React.FC = () => {
  const {
    viewBoxW,
    viewBoxH,
    aperturePath,
    leftCheekPath,
    rightCheekPath,
    lowerChinPath,
    lowerChinLipPath,
    leftBoom,
    rightBoom,
    shellBlurPx,
    cheekBlurPx,
    boomBlurPx,
    boomTipBlurPx,
    contactShadowBlur,
    contactShadowOpacity,
    contactShadowWidth,
  } = HELMET_CONFIG;

  return (
    <div className="visor-frame-layer" aria-hidden="true">
      <svg
        className="visor-frame-svg"
        viewBox={`0 0 ${viewBoxW} ${viewBoxH}`}
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="helmetInteriorShellGrad" cx="50%" cy="48%" r="72%">
            <stop offset="56%" stopColor={PALETTE_CONFIG.helmetShellMid} />
            <stop offset="88%" stopColor={PALETTE_CONFIG.helmetShellOuter} />
            <stop offset="100%" stopColor={PALETTE_CONFIG.voidBg} />
          </radialGradient>

          <linearGradient id="cheekLeftGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE_CONFIG.helmetCheekLight} />
            <stop offset="48%" stopColor={PALETTE_CONFIG.helmetCheekMid} />
            <stop offset="100%" stopColor={PALETTE_CONFIG.helmetCheekShadow} />
          </linearGradient>

          <linearGradient id="cheekRightGrad" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE_CONFIG.helmetCheekLight} />
            <stop offset="48%" stopColor={PALETTE_CONFIG.helmetCheekMid} />
            <stop offset="100%" stopColor={PALETTE_CONFIG.helmetCheekShadow} />
          </linearGradient>

          <linearGradient id="chinCenterGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={PALETTE_CONFIG.helmetCheekShadow} />
            <stop offset="48%" stopColor={PALETTE_CONFIG.helmetChinCenter} />
            <stop offset="52%" stopColor={PALETTE_CONFIG.helmetChinRight} />
            <stop offset="100%" stopColor={PALETTE_CONFIG.helmetCheekShadow} />
          </linearGradient>

          <linearGradient id="boomArmGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE_CONFIG.helmetBoomBody} />
            <stop offset="55%" stopColor={PALETTE_CONFIG.helmetBoomDark} />
            <stop offset="100%" stopColor="#040405" />
          </linearGradient>

          <radialGradient id="boomTipGrad" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor={PALETTE_CONFIG.helmetBoomHighlight} />
            <stop offset="65%" stopColor={PALETTE_CONFIG.helmetBoomBody} />
            <stop offset="100%" stopColor={PALETTE_CONFIG.helmetBoomDark} />
          </radialGradient>

          <clipPath id="firstPersonApertureClip">
            <path d={aperturePath} />
          </clipPath>

          <filter id="fpShellBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={shellBlurPx} />
          </filter>

          <filter id="fpCheekBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={cheekBlurPx} />
          </filter>

          <filter id="fpBoomBlur" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation={boomBlurPx} />
          </filter>

          <filter id="fpBoomTipBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation={boomTipBlurPx} />
          </filter>

          <filter id="fpContactBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={contactShadowBlur} />
          </filter>
        </defs>

        {/* Subtle extreme-perimeter contact shadow */}
        <g clipPath="url(#firstPersonApertureClip)">
          <path
            d={aperturePath}
            fill="none"
            stroke={PALETTE_CONFIG.voidBg}
            strokeOpacity={contactShadowOpacity}
            strokeWidth={contactShadowWidth}
            filter="url(#fpContactBlur)"
          />
        </g>

        {/* Outer helmet corner mask */}
        <path
          d={`M 0,0 L ${viewBoxW},0 L ${viewBoxW},${viewBoxH} L 0,${viewBoxH} Z ${aperturePath}`}
          fill="url(#helmetInteriorShellGrad)"
          fillRule="evenodd"
          filter="url(#fpShellBlur)"
        />

        {/* Sloped lower-left & lower-right interior cheek liners */}
        <g filter="url(#fpCheekBlur)">
          <path d={leftCheekPath} fill="url(#cheekLeftGrad)" />
          <path d={rightCheekPath} fill="url(#cheekRightGrad)" />
          <path
            d="M 0,742 L 266,978"
            fill="none"
            stroke={PALETTE_CONFIG.helmetCheekShadow}
            strokeWidth="5"
          />
          <path
            d="M 1920,742 L 1654,978"
            fill="none"
            stroke={PALETTE_CONFIG.helmetCheekShadow}
            strokeWidth="5"
          />
        </g>

        {/* Curved bottom chin cowling & stepped center bridge */}
        <g filter="url(#fpShellBlur)">
          <path d={lowerChinPath} fill={PALETTE_CONFIG.helmetShellOuter} />
          <path d={lowerChinLipPath} fill="url(#chinCenterGrad)" />
          <path
            d="M 480,1045 C 770,1022 1150,1022 1440,1045"
            fill="none"
            stroke={PALETTE_CONFIG.helmetCheekLight}
            strokeOpacity="0.45"
            strokeWidth="2.5"
          />
        </g>

        {/* Out-of-focus interior microphone / sensor booms protruding from lower chin */}
        <g filter="url(#fpBoomBlur)">
          <path d={leftBoom.armPath} fill="url(#boomArmGrad)" />
          <path d={leftBoom.ribPath} fill={PALETTE_CONFIG.helmetBoomHighlight} opacity="0.45" />
          <path d={rightBoom.armPath} fill="url(#boomArmGrad)" />
          <path d={rightBoom.ribPath} fill={PALETTE_CONFIG.helmetBoomHighlight} opacity="0.45" />
        </g>

        {/* Acoustic / optical grille heads on the tips of both booms */}
        {[leftBoom, rightBoom].map((boom, idx) => (
          <g
            key={idx}
            filter="url(#fpBoomTipBlur)"
            transform={`translate(${boom.tipCx} ${boom.tipCy}) rotate(${boom.tipRotateDeg})`}
          >
            <ellipse
              cx={0}
              cy={0}
              rx={boom.tipRx}
              ry={boom.tipRy}
              fill="url(#boomTipGrad)"
              stroke={PALETTE_CONFIG.helmetBoomHighlight}
              strokeOpacity="0.45"
              strokeWidth="2"
            />
            {BOOM_GRILLE_DOTS.map((dot, dIdx) => (
              <circle
                key={dIdx}
                cx={dot.dx}
                cy={dot.dy}
                r={dot.r}
                fill="#040406"
                opacity="0.85"
              />
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
};
