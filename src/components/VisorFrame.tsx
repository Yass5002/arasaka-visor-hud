import React from "react";

export type VisorStatus = "nominal" | "warning" | "critical";

interface VisorFrameProps {
  status?: VisorStatus;
}

const STATUS_COLOR: Record<VisorStatus, string> = {
  nominal: "#00e5ff",
  warning: "#ffb300",
  critical: "#ff3b3b",
};

const APERTURE_PATH = `
  M 165,68
  C 470,22 730,18 850,42
  L 904,54 L 1016,54 L 1070,42
  C 1190,18 1450,22 1755,68
  C 1835,82 1874,142 1882,250
  L 1888,450 L 1872,482 L 1872,624 L 1888,658
  C 1880,795 1844,888 1758,934
  L 1410,978 L 1228,1012 L 1088,1004 L 1044,1022
  L 876,1022 L 832,1004 L 692,1012 L 510,978 L 162,934
  C 76,888 40,795 32,658
  L 48,624 L 48,482 L 32,450
  L 38,250
  C 46,142 85,82 165,68 Z
`;

/**
 * Physical interior EVA helmet visor shell and optical gasket frame.
 * Rendered entirely with live multi-layered SVG geometry, leaving the
 * central field of view unobstructed.
 */
export const VisorFrame: React.FC<VisorFrameProps> = ({ status = "nominal" }) => {
  const accent = STATUS_COLOR[status];

  return (
    <div className="visor-frame-layer" aria-hidden="true">
      <svg
        className="visor-frame-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle micro-weave texture layered softly into the matte polymer shell */}
          <pattern
            id="carbonWeave"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="8" fill="#070a0f" />
            <path
              d="M0 0h4v4H0zM4 4h4v4H4z"
              fill="#0e141e"
              fillOpacity="0.45"
            />
            <path
              d="M0 4h4v4H0zM4 0h4v4H4z"
              fill="#030508"
              fillOpacity="0.55"
            />
          </pattern>

          {/* Unified matte shell gradient so left/right corners blend seamlessly */}
          <radialGradient id="matteShellGrad" cx="50%" cy="48%" r="72%">
            <stop offset="48%" stopColor="#121a26" />
            <stop offset="78%" stopColor="#0b1018" />
            <stop offset="100%" stopColor="#04060a" />
          </radialGradient>

          {/* Subtle matte bevel gradient for brow & upper bezel */}
          <linearGradient id="shellUpperGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#05070b" />
            <stop offset="48%" stopColor="#0d131d" />
            <stop offset="88%" stopColor="#16202e" />
            <stop offset="100%" stopColor="#0b1018" />
          </linearGradient>

          {/* Lower mandible / chin-bar matte gradient */}
          <linearGradient id="chinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#182231" />
            <stop offset="16%" stopColor="#101722" />
            <stop offset="68%" stopColor="#090d14" />
            <stop offset="100%" stopColor="#030508" />
          </linearGradient>

          {/* Side clamp metallic matte gradient */}
          <linearGradient id="clampGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#070a0f" />
            <stop offset="52%" stopColor="#182231" />
            <stop offset="100%" stopColor="#0b1018" />
          </linearGradient>

          {/* Faint overhead specular highlight along top bezel edges */}
          <linearGradient id="topEdgeHighlight" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4c6280" stopOpacity="0.06" />
            <stop offset="22%" stopColor="#5c7699" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#6c8ab3" stopOpacity="0.44" />
            <stop offset="78%" stopColor="#5c7699" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#4c6280" stopOpacity="0.06" />
          </linearGradient>

          {/* Soft inner shadow where visor glass seats into the frame */}
          <clipPath id="visorGlassClip">
            <path d={APERTURE_PATH} />
          </clipPath>

          <filter id="glassEdgeShadowWide" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="18" />
          </filter>

          <filter id="glassEdgeShadowTight" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="5" />
          </filter>

          {/* Subtle status rim bounce along the inner optical gasket */}
          <filter id="rimGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Soft ambient edge occlusion inside helmet aperture */}
          <radialGradient id="interiorOcclusion" cx="50%" cy="49%" r="58%">
            <stop offset="74%" stopColor="#000000" stopOpacity="0" />
            <stop offset="92%" stopColor="#020408" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#010204" stopOpacity="0.9" />
          </radialGradient>
        </defs>

        {/* Soft inner shadow cast onto the glass perimeter where it meets the frame */}
        <g clipPath="url(#visorGlassClip)">
          <rect
            x="0"
            y="0"
            width="1920"
            height="1080"
            fill="url(#interiorOcclusion)"
          />
          <path
            d={APERTURE_PATH}
            fill="none"
            stroke="#000000"
            strokeOpacity="0.82"
            strokeWidth="44"
            filter="url(#glassEdgeShadowWide)"
          />
          <path
            d={APERTURE_PATH}
            fill="none"
            stroke="#010204"
            strokeOpacity="0.92"
            strokeWidth="16"
            filter="url(#glassEdgeShadowTight)"
          />
        </g>

        {/* ============================================================
            1. OUTER SCULPTED HELMET SHELL APERTURE (unified matte shell)
           ============================================================ */}
        <path
          d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
          fill="url(#matteShellGrad)"
          fillRule="evenodd"
        />
        <path
          d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
          fill="url(#carbonWeave)"
          fillOpacity="0.34"
          fillRule="evenodd"
        />

        {/* Continuous molded corner cheek ribs blending left & right corners into bezel */}
        <path
          d="M 0,115 C 65,90 125,74 175,68 C 98,86 58,144 46,248 L 36,440 L 0,425 Z"
          fill="#0b1018"
          fillOpacity="0.72"
        />
        <path
          d="M 1920,115 C 1855,90 1795,74 1745,68 C 1822,86 1862,144 1874,248 L 1884,440 L 1920,425 Z"
          fill="#0b1018"
          fillOpacity="0.72"
        />
        <path
          d="M 0,682 L 36,664 C 46,792 82,882 162,934 C 102,916 48,885 0,842 Z"
          fill="#090d14"
          fillOpacity="0.76"
        />
        <path
          d="M 1920,682 L 1884,664 C 1874,792 1838,882 1758,934 C 1818,916 1872,885 1920,842 Z"
          fill="#090d14"
          fillOpacity="0.76"
        />

        {/* ============================================================
            2. UPPER BROW HOUSING & SENSOR BRIDGE
           ============================================================ */}
        <path
          d="
            M 0,0 L 1920,0 L 1920,112
            C 1860,78 1805,66 1720,56
            C 1450,24 1210,18 1070,42
            L 1016,56 L 904,56 L 850,42
            C 710,18 470,24 200,56
            C 115,66 60,78 0,112 Z
          "
          fill="url(#shellUpperGrad)"
          fillOpacity="0.88"
        />

        {/* Upper brow recessed chamfer plate */}
        <path
          d="
            M 255,34
            C 500,14 715,14 855,36
            L 906,48 L 1014,48 L 1065,36
            C 1205,14 1420,14 1665,34
            L 1648,47
            C 1415,28 1205,28 1068,48
            L 1016,60 L 904,60 L 852,48
            C 715,28 505,28 272,47 Z
          "
          fill="#111824"
          stroke="#27364b"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Faint top-edge highlight grazing the upper brow ridge */}
        <path
          d="
            M 260,33
            C 500,13 715,13 855,35
            L 906,47 L 1014,47 L 1065,35
            C 1205,13 1420,13 1660,33
          "
          fill="none"
          stroke="url(#topEdgeHighlight)"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />

        {/* Center-top optical sensor housing pod */}
        <path
          d="M 874,0 L 1046,0 L 1024,44 L 896,44 Z"
          fill="#0b1017"
          stroke="#243144"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 918,22 L 1002,22 L 994,35 L 926,35 Z"
          fill="#05080c"
          stroke="#1d2838"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* Dual optical micro-lenses in brow pod */}
        <circle cx="942" cy="28.5" r="3" fill="#0e1724" stroke={accent} strokeOpacity="0.45" strokeWidth="1" />
        <circle cx="978" cy="28.5" r="3" fill="#0e1724" stroke={accent} strokeOpacity="0.45" strokeWidth="1" />

        {/* ============================================================
            3. LEFT & RIGHT TEMPLE HINGE CLAMPS
           ============================================================ */}
        {/* Left hinge housing */}
        <path
          d="M 0,425 L 44,446 L 54,484 L 54,622 L 44,660 L 0,682 Z"
          fill="url(#clampGrad)"
          stroke="#263347"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 10,470 L 38,484 L 38,622 L 10,636 Z"
          fill="#080c12"
          stroke="#1d2838"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line x1="18" y1="504" x2="32" y2="504" stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" />
        <line x1="18" y1="553" x2="34" y2="553" stroke="#364863" strokeWidth="2" />
        <line x1="18" y1="602" x2="32" y2="602" stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" />

        {/* Right hinge housing */}
        <path
          d="M 1920,425 L 1876,446 L 1866,484 L 1866,622 L 1876,660 L 1920,682 Z"
          fill="url(#clampGrad)"
          stroke="#263347"
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 1910,470 L 1882,484 L 1882,622 L 1910,636 Z"
          fill="#080c12"
          stroke="#1d2838"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <line x1="1902" y1="504" x2="1888" y2="504" stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" />
        <line x1="1902" y1="553" x2="1886" y2="553" stroke="#364863" strokeWidth="2" />
        <line x1="1902" y1="602" x2="1888" y2="602" stroke={accent} strokeOpacity="0.35" strokeWidth="1.5" />

        {/* ============================================================
            4. LOWER EVA MANDIBLE / CHIN-BAR ASSEMBLY
           ============================================================ */}
        {/* Left angled mandible strut */}
        <path
          d="
            M 0,835
            C 58,888 112,922 184,938
            L 525,976 L 734,1008 L 836,1002 L 882,1022
            L 882,1080 L 0,1080 Z
          "
          fill="url(#chinGrad)"
          fillOpacity="0.92"
        />
        {/* Right angled mandible strut */}
        <path
          d="
            M 1920,835
            C 1862,888 1808,922 1736,938
            L 1395,976 L 1186,1008 L 1084,1002 L 1038,1022
            L 1038,1080 L 1920,1080 Z
          "
          fill="url(#chinGrad)"
          fillOpacity="0.92"
        />
        {/* Central rebreather / acoustic bridge */}
        <path
          d="M 874,1022 L 1046,1022 L 1068,1080 L 852,1080 Z"
          fill="#090d13"
          stroke="#222f42"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Machined top bevel plates on left & right chin-bars */}
        <path
          d="M 195,940 L 534,978 L 722,1008 L 702,1032 L 502,1004 L 178,964 Z"
          fill="#141d2a"
          stroke="#2d3e56"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 1725,940 L 1386,978 L 1198,1008 L 1218,1032 L 1418,1004 L 1742,964 Z"
          fill="#141d2a"
          stroke="#2d3e56"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Faint top-edge catchlight on mandible top bevels */}
        <path
          d="M 196,940 L 534,978 L 720,1008"
          fill="none"
          stroke="#556d8f"
          strokeOpacity="0.34"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 1724,940 L 1386,978 L 1200,1008"
          fill="none"
          stroke="#556d8f"
          strokeOpacity="0.34"
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Recessed ventilation slots on left mandible */}
        <g stroke="#040609" strokeWidth="4" strokeLinecap="round">
          <line x1="365" y1="984" x2="430" y2="993" />
          <line x1="354" y1="996" x2="424" y2="1006" />
          <line x1="343" y1="1008" x2="418" y2="1019" />
        </g>
        <g stroke="#29394f" strokeWidth="1" strokeLinecap="round">
          <line x1="365" y1="986" x2="430" y2="995" />
          <line x1="354" y1="998" x2="424" y2="1008" />
          <line x1="343" y1="1010" x2="418" y2="1021" />
        </g>

        {/* Recessed ventilation slots on right mandible */}
        <g stroke="#040609" strokeWidth="4" strokeLinecap="round">
          <line x1="1555" y1="984" x2="1490" y2="993" />
          <line x1="1566" y1="996" x2="1496" y2="1006" />
          <line x1="1577" y1="1008" x2="1502" y2="1019" />
        </g>
        <g stroke="#29394f" strokeWidth="1" strokeLinecap="round">
          <line x1="1555" y1="986" x2="1490" y2="995" />
          <line x1="1566" y1="998" x2="1496" y2="1008" />
          <line x1="1577" y1="1010" x2="1502" y2="1021" />
        </g>

        {/* Central acoustic grille ribs */}
        <g stroke="#1b2636" strokeWidth="2">
          <line x1="912" y1="1044" x2="912" y2="1072" />
          <line x1="931" y1="1044" x2="931" y2="1072" />
          <line x1="950" y1="1044" x2="950" y2="1072" />
          <line x1="970" y1="1044" x2="970" y2="1072" />
          <line x1="989" y1="1044" x2="989" y2="1072" />
          <line x1="1008" y1="1044" x2="1008" y2="1072" />
        </g>

        {/* Hex socket fasteners on brow & chin assemblies */}
        {[
          [224, 52],
          [538, 30],
          [1382, 30],
          [1696, 52],
          [242, 958],
          [668, 1014],
          [1252, 1014],
          [1678, 958],
        ].map(([cx, cy], idx) => (
          <g key={idx}>
            <circle
              cx={cx}
              cy={cy}
              r="5.5"
              fill="#0a0f16"
              stroke="#2a3a52"
              strokeWidth="1.2"
            />
            <circle cx={cx} cy={cy} r="2.2" fill="#182231" />
          </g>
        ))}

        {/* ============================================================
            5. HEAVY BEZEL SHOULDER, GASKET & UNCHANGED CYAN HAIRLINE
           ============================================================ */}
        {/* Thicker matte outer bezel shoulder framing the aperture */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#0a0f17"
          strokeWidth="18"
          vectorEffect="non-scaling-stroke"
        />

        {/* Deep dark rubber gasket contour */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#020305"
          strokeWidth="9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Specular machined shoulder + faint top-edge bezel highlight */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#2c3d54"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        {/* Subtle inner optical seal hairline (cyan / amber / red status bounce) */}
        <path
          d="
            M 178,78
            C 472,33 726,28 844,51
            L 900,63 L 1020,63 L 1076,51
            C 1194,28 1448,33 1742,78
            C 1820,92 1860,148 1868,252
            L 1874,446 L 1858,478 L 1858,628 L 1874,660
            C 1866,790 1832,878 1748,922
            L 1404,966 L 1224,999 L 1086,991 L 1042,1009
            L 878,1009 L 834,991 L 696,999 L 516,966 L 172,922
            C 88,878 54,790 46,660
            L 62,628 L 62,478 L 46,446
            L 52,252
            C 60,148 100,92 178,78 Z
          "
          fill="none"
          stroke={accent}
          strokeOpacity="0.28"
          strokeWidth="1.1"
          filter="url(#rimGlow)"
          vectorEffect="non-scaling-stroke"
        />

        {/* Perimeter optical registration ticks (corners & midpoints) */}
        <g stroke={accent} strokeOpacity="0.48" strokeWidth="1.5">
          <line x1="960" y1="63" x2="960" y2="75" />
          <line x1="916" y1="63" x2="916" y2="70" />
          <line x1="1004" y1="63" x2="1004" y2="70" />
          <line x1="960" y1="1009" x2="960" y2="997" />
          <line x1="900" y1="1009" x2="900" y2="1002" />
          <line x1="1020" y1="1009" x2="1020" y2="1002" />
          <line x1="62" y1="540" x2="78" y2="540" />
          <line x1="1858" y1="540" x2="1842" y2="540" />
        </g>
      </svg>
    </div>
  );
};
