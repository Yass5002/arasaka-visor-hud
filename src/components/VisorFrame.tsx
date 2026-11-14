import React from "react";

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

export const VisorFrame: React.FC = () => {
  return (
    <div className="visor-frame-layer" aria-hidden="true">
      <svg
        className="visor-frame-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle matte composite grain texture */}
          <pattern
            id="matteComposite"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
          >
            <rect width="6" height="6" fill="#060709" />
            <path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#0b0d10" fillOpacity="0.4" />
            <path d="M0 3h3v3H0zM3 0h3v3H3z" fill="#030405" fillOpacity="0.45" />
          </pattern>

          {/* Unified dark matte shell gradient */}
          <radialGradient id="matteShellGrad" cx="50%" cy="48%" r="74%">
            <stop offset="46%" stopColor="#0f1115" />
            <stop offset="76%" stopColor="#090a0d" />
            <stop offset="100%" stopColor="#030405" />
          </radialGradient>

          {/* Matte brow molding gradient with soft warm atmospheric bounce near lip */}
          <linearGradient id="shellUpperGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040507" />
            <stop offset="56%" stopColor="#0b0d11" />
            <stop offset="92%" stopColor="#13151a" />
            <stop offset="100%" stopColor="#0b0c0f" />
          </linearGradient>

          {/* Matte chin-bar gradient */}
          <linearGradient id="chinGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14161b" />
            <stop offset="18%" stopColor="#0d0f13" />
            <stop offset="72%" stopColor="#07080a" />
            <stop offset="100%" stopColor="#020304" />
          </linearGradient>

          {/* Side clamp matte gradient */}
          <linearGradient id="clampGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#050608" />
            <stop offset="52%" stopColor="#121419" />
            <stop offset="100%" stopColor="#08090c" />
          </linearGradient>

          {/* Faint warm Martian sun bounce along top inner edge */}
          <linearGradient id="softTopBounce" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4a3e38" stopOpacity="0.04" />
            <stop offset="30%" stopColor="#5a493e" stopOpacity="0.14" />
            <stop offset="55%" stopColor="#6b5546" stopOpacity="0.22" />
            <stop offset="82%" stopColor="#5a493e" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#4a3e38" stopOpacity="0.04" />
          </linearGradient>

          {/* Soft out-of-focus inner bezel blur & deep glass contact shadow */}
          <clipPath id="visorGlassClip">
            <path d={APERTURE_PATH} />
          </clipPath>

          <filter id="glassEdgeShadowWide" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="24" />
          </filter>

          <filter id="glassEdgeShadowTight" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          <filter id="softInnerBezelBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>

          <radialGradient id="interiorOcclusion" cx="50%" cy="49%" r="57%">
            <stop offset="70%" stopColor="#000000" stopOpacity="0" />
            <stop offset="90%" stopColor="#050404" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#020203" stopOpacity="0.82" />
          </radialGradient>
        </defs>

        {/* Soft ambient falloff & inner shadow cast onto visor glass */}
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
            strokeOpacity="0.85"
            strokeWidth="54"
            filter="url(#glassEdgeShadowWide)"
          />
          <path
            d={APERTURE_PATH}
            fill="none"
            stroke="#020203"
            strokeOpacity="0.94"
            strokeWidth="18"
            filter="url(#glassEdgeShadowTight)"
          />
        </g>

        {/* Outer sculpted helmet shell */}
        <path
          d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
          fill="url(#matteShellGrad)"
          fillRule="evenodd"
        />
        <path
          d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
          fill="url(#matteComposite)"
          fillOpacity="0.28"
          fillRule="evenodd"
        />

        {/* Smooth corner cheek ribs blending left/right sides seamlessly */}
        <path
          d="M 0,115 C 65,90 125,74 175,68 C 98,86 58,144 46,248 L 36,440 L 0,425 Z"
          fill="#090a0d"
          fillOpacity="0.72"
        />
        <path
          d="M 1920,115 C 1855,90 1795,74 1745,68 C 1822,86 1862,144 1874,248 L 1884,440 L 1920,425 Z"
          fill="#090a0d"
          fillOpacity="0.72"
        />
        <path
          d="M 0,682 L 36,664 C 46,792 82,882 162,934 C 102,916 48,885 0,842 Z"
          fill="#07080b"
          fillOpacity="0.78"
        />
        <path
          d="M 1920,682 L 1884,664 C 1874,792 1838,882 1758,934 C 1818,916 1872,885 1920,842 Z"
          fill="#07080b"
          fillOpacity="0.78"
        />

        {/* Upper brow housing & recessed sensor pod (no harsh bright strokes) */}
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
          fillOpacity="0.9"
        />

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
          fill="#0d0f13"
        />

        <path
          d="
            M 260,33
            C 500,13 715,13 855,35
            L 906,47 L 1014,47 L 1065,35
            C 1205,13 1420,13 1660,33
          "
          fill="none"
          stroke="url(#softTopBounce)"
          strokeWidth="2"
          filter="url(#softInnerBezelBlur)"
        />

        <path
          d="M 874,0 L 1046,0 L 1024,44 L 896,44 Z"
          fill="#090b0e"
        />
        <path
          d="M 918,22 L 1002,22 L 994,35 L 926,35 Z"
          fill="#040507"
        />

        {/* Temple hinge clamps (soft matte polymer) */}
        <path
          d="M 0,425 L 44,446 L 54,484 L 54,622 L 44,660 L 0,682 Z"
          fill="url(#clampGrad)"
        />
        <path
          d="M 10,470 L 38,484 L 38,622 L 10,636 Z"
          fill="#07080b"
        />
        <path
          d="M 1920,425 L 1876,446 L 1866,484 L 1866,622 L 1876,660 L 1920,682 Z"
          fill="url(#clampGrad)"
        />
        <path
          d="M 1910,470 L 1882,484 L 1882,622 L 1910,636 Z"
          fill="#07080b"
        />

        {/* Lower EVA mandible / chin-bar assembly */}
        <path
          d="
            M 0,835
            C 58,888 112,922 184,938
            L 525,976 L 734,1008 L 836,1002 L 882,1022
            L 882,1080 L 0,1080 Z
          "
          fill="url(#chinGrad)"
          fillOpacity="0.94"
        />
        <path
          d="
            M 1920,835
            C 1862,888 1808,922 1736,938
            L 1395,976 L 1186,1008 L 1084,1002 L 1038,1022
            L 1038,1080 L 1920,1080 Z
          "
          fill="url(#chinGrad)"
          fillOpacity="0.94"
        />
        <path
          d="M 874,1022 L 1046,1022 L 1068,1080 L 852,1080 Z"
          fill="#08090c"
        />

        {/* Subtle matte molded bevels on mandible (soft warm ambient catchlight) */}
        <path
          d="M 195,940 L 534,978 L 722,1008 L 702,1032 L 502,1004 L 178,964 Z"
          fill="#101217"
        />
        <path
          d="M 1725,940 L 1386,978 L 1198,1008 L 1218,1032 L 1418,1004 L 1742,964 Z"
          fill="#101217"
        />
        <path
          d="M 196,940 L 534,978 L 720,1008"
          fill="none"
          stroke="#4d413a"
          strokeOpacity="0.22"
          strokeWidth="2.5"
          filter="url(#softInnerBezelBlur)"
        />
        <path
          d="M 1724,940 L 1386,978 L 1200,1008"
          fill="none"
          stroke="#4d413a"
          strokeOpacity="0.22"
          strokeWidth="2.5"
          filter="url(#softInnerBezelBlur)"
        />

        {/* Recessed ventilation slots & acoustic grille (soft matte dark) */}
        <g stroke="#040506" strokeWidth="4" strokeLinecap="round">
          <line x1="365" y1="984" x2="430" y2="993" />
          <line x1="354" y1="996" x2="424" y2="1006" />
          <line x1="343" y1="1008" x2="418" y2="1019" />
          <line x1="1555" y1="984" x2="1490" y2="993" />
          <line x1="1566" y1="996" x2="1496" y2="1006" />
          <line x1="1577" y1="1008" x2="1502" y2="1019" />
        </g>
        <g stroke="#13161c" strokeWidth="2">
          <line x1="912" y1="1044" x2="912" y2="1072" />
          <line x1="931" y1="1044" x2="931" y2="1072" />
          <line x1="950" y1="1044" x2="950" y2="1072" />
          <line x1="970" y1="1044" x2="970" y2="1072" />
          <line x1="989" y1="1044" x2="989" y2="1072" />
          <line x1="1008" y1="1044" x2="1008" y2="1072" />
        </g>

        {/* Soft, slightly out-of-focus matte inner rubber gasket (ZERO cyan outlines) */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#07080a"
          strokeWidth="20"
          filter="url(#softInnerBezelBlur)"
        />
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#020203"
          strokeOpacity="0.92"
          strokeWidth="10"
          filter="url(#softInnerBezelBlur)"
        />
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="#3d342f"
          strokeOpacity="0.18"
          strokeWidth="2.5"
          filter="url(#softInnerBezelBlur)"
        />
      </svg>
    </div>
  );
};
