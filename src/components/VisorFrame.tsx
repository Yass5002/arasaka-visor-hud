import React from "react";

const APERTURE_PATH = `
  M 172,78
  C 472,30 726,26 846,50
  L 900,64 L 1020,64 L 1074,50
  C 1194,26 1448,30 1748,78
  C 1828,92 1866,152 1874,258
  L 1880,446 L 1858,480 L 1858,626 L 1880,660
  C 1872,794 1836,884 1752,930
  L 1406,974 L 1226,1008 L 1088,1000 L 1044,1018
  L 876,1018 L 832,1000 L 694,1008 L 514,974 L 168,930
  C 84,884 48,794 40,660
  L 62,626 L 62,480 L 40,446
  L 46,258
  C 54,152 92,92 172,78 Z
`;

const RIM_OUTER_PATH = `
  M 154,54
  C 468,6 734,2 856,28
  L 904,40 L 1016,40 L 1064,28
  C 1186,2 1452,6 1766,54
  C 1856,70 1898,136 1906,250
  L 1912,440 L 1890,478 L 1890,628 L 1912,666
  C 1904,808 1864,904 1772,954
  L 1416,1000 L 1232,1034 L 1092,1026 L 1052,1044
  L 868,1044 L 828,1026 L 688,1034 L 504,1000 L 148,954
  C 56,904 16,808 8,666
  L 30,628 L 30,478 L 8,440
  L 14,250
  C 22,136 64,70 154,54 Z
`;

const SCREW_POSITIONS: ReadonlyArray<{ x: number; y: number; sunward: boolean }> = [
  { x: 226, y: 31, sunward: false },
  { x: 1694, y: 26, sunward: true },
  { x: 24, y: 492, sunward: false },
  { x: 24, y: 614, sunward: false },
  { x: 1896, y: 492, sunward: true },
  { x: 1896, y: 614, sunward: true },
  { x: 222, y: 978, sunward: false },
  { x: 1698, y: 984, sunward: true },
  { x: 675, y: 1021, sunward: false },
  { x: 1245, y: 1021, sunward: true },
];

/**
 * Physical molded EVA helmet interior frame:
 * - Real tileable composite texture (matte surface grain + fine scratches/wear) on the rim & shell
 * - Real tileable carbon/Nomex twill weave on interior padded bolsters + stitched thread tracks
 * - Uneven directional sun lighting (warmer & brighter on upper-right sun side, deep shadow lower-left)
 * - Molded seam lines, small mounting brackets, and recessed screws
 * - Soft out-of-focus inner rim edge fading onto the glass, clear center, zero neon outlines
 */
export const VisorFrame: React.FC = () => {
  const base = import.meta.env.BASE_URL;

  return (
    <div className="visor-frame-layer" aria-hidden="true">
      <svg
        className="visor-frame-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Tileable matte composite with micro-scratches and wear */}
          <pattern
            id="rimCompositeTex"
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={`${base}helmet/rim-composite.png`}
              width="240"
              height="240"
              preserveAspectRatio="none"
            />
          </pattern>

          {/* Tileable carbon / ballistic Nomex weave for interior padded bolsters */}
          <pattern
            id="paddingWeaveTex"
            width="136"
            height="136"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={`${base}helmet/interior-weave.png`}
              width="136"
              height="136"
              preserveAspectRatio="none"
            />
          </pattern>

          {/* Directional uneven lighting wash: warm sunlit upper-right vs deep shadow lower-left */}
          <radialGradient id="unevenSunLightShell" cx="84%" cy="14%" r="88%">
            <stop offset="0%" stopColor="#94745c" stopOpacity="0.34" />
            <stop offset="28%" stopColor="#5a493e" stopOpacity="0.20" />
            <stop offset="62%" stopColor="#14161a" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#030405" stopOpacity="0.68" />
          </radialGradient>

          {/* Uneven rim bevel catchlight: bright warm on upper-right/right, dim on opposite left */}
          <linearGradient id="rimBevelUnevenGrad" x1="0.06" y1="0.92" x2="0.92" y2="0.08">
            <stop offset="0%" stopColor="#0e1014" stopOpacity="0.92" />
            <stop offset="32%" stopColor="#1b1e24" stopOpacity="0.88" />
            <stop offset="58%" stopColor="#353231" stopOpacity="0.82" />
            <stop offset="82%" stopColor="#6c594b" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#856b58" stopOpacity="0.84" />
          </linearGradient>

          {/* Inner rim shadow return strip against visor glass */}
          <linearGradient id="rimShadowStrip" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#030304" />
            <stop offset="55%" stopColor="#050608" />
            <stop offset="100%" stopColor="#111012" />
          </linearGradient>

          {/* Padding bolster directional shading (upper-right warmer, opposite side deep shadow) */}
          <linearGradient id="cushionShadeLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#060709" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#26282e" stopOpacity="0.20" />
          </linearGradient>
          <linearGradient id="cushionShadeRight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6a5444" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#08090c" stopOpacity="0.58" />
          </linearGradient>

          {/* Side temple tab uneven directional light */}
          <linearGradient id="tabLeftShade" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#050608" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#262930" stopOpacity="0.25" />
          </linearGradient>
          <linearGradient id="tabRightShade" x1="1" y1="0" x2="0" y2="0.4">
            <stop offset="0%" stopColor="#7a614e" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#3a322d" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0b0c0f" stopOpacity="0.55" />
          </linearGradient>

          {/* Clip regions */}
          <clipPath id="visorOpeningClip">
            <path d={APERTURE_PATH} />
          </clipPath>

          <clipPath id="helmetBodyClip">
            <path
              d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
              clipRule="evenodd"
            />
          </clipPath>

          <clipPath id="rimBevelClip">
            <path d={`${RIM_OUTER_PATH} ${APERTURE_PATH}`} clipRule="evenodd" />
          </clipPath>

          {/* Soft out-of-focus filters appropriate to extreme proximity to the eye */}
          <filter id="interiorDofBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>

          <filter id="rimMidBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>

          <filter id="rimInnerSoftBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>

          <filter id="glassContactShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
        </defs>

        {/* ============================================================
            1. SOFT CONTACT SHADOW ON GLASS WHERE IT MEETS THE RIM
           ============================================================ */}
        <g clipPath="url(#visorOpeningClip)">
          <path
            d={APERTURE_PATH}
            fill="none"
            stroke="#020203"
            strokeOpacity="0.64"
            strokeWidth="28"
            filter="url(#glassContactShadow)"
          />
        </g>

        {/* ============================================================
            2. TEXTURED MOLDED COMPOSITE SHELL + UNEVEN SUN LIGHTING
           ============================================================ */}
        <g clipPath="url(#helmetBodyClip)">
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimCompositeTex)" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#unevenSunLightShell)" />
        </g>

        {/* ============================================================
            3. PADDED FABRIC / CARBON-WEAVE INTERIOR + STITCHING + BRACKETS
           ============================================================ */}
        <g clipPath="url(#helmetBodyClip)" filter="url(#interiorDofBlur)">
          {/* Upper-left & mid-left brow quilted pads (shadow side) */}
          <path
            d="M 184,0 L 492,0 L 470,22 C 360,26 260,38 170,54 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 184,0 L 492,0 L 470,22 C 360,26 260,38 170,54 Z"
            fill="url(#cushionShadeLeft)"
          />
          <path
            d="M 520,0 L 826,0 L 814,24 C 712,16 610,16 508,22 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 520,0 L 826,0 L 814,24 C 712,16 610,16 508,22 Z"
            fill="url(#cushionShadeLeft)"
          />

          {/* Upper-right & mid-right brow quilted pads (sunward side) */}
          <path
            d="M 1094,0 L 1400,0 L 1412,22 C 1310,16 1208,16 1106,24 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1094,0 L 1400,0 L 1412,22 C 1310,16 1208,16 1106,24 Z"
            fill="url(#cushionShadeRight)"
          />
          <path
            d="M 1428,0 L 1736,0 L 1750,54 C 1660,38 1560,26 1450,22 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1428,0 L 1736,0 L 1750,54 C 1660,38 1560,26 1450,22 Z"
            fill="url(#cushionShadeRight)"
          />

          {/* Lower-left & lower-right cheek / mandible fabric bolsters */}
          <path
            d="M 0,746 C 28,828 66,898 134,948 L 288,984 L 250,1080 L 0,1080 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 0,746 C 28,828 66,898 134,948 L 288,984 L 250,1080 L 0,1080 Z"
            fill="url(#cushionShadeLeft)"
          />
          <path
            d="M 1920,746 C 1892,828 1854,898 1786,948 L 1632,984 L 1670,1080 L 1920,1080 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1920,746 C 1892,828 1854,898 1786,948 L 1632,984 L 1670,1080 L 1920,1080 Z"
            fill="url(#cushionShadeRight)"
          />

          {/* Stitched thread tracks along quilted cushions (thread recess + bright stitch dashes) */}
          <g fill="none" strokeLinecap="round">
            {/* Cushion stitch grooves */}
            <g stroke="#050608" strokeWidth="2.8" strokeOpacity="0.9">
              <path d="M 186,44 C 272,30 364,20 462,16" />
              <path d="M 522,16 C 618,12 714,12 806,18" />
              <path d="M 1114,18 C 1206,12 1302,12 1398,16" />
              <path d="M 1458,16 C 1556,20 1648,30 1734,44" />
              <path d="M 14,768 C 44,840 82,902 146,942 L 270,972" />
              <path d="M 1906,768 C 1876,840 1838,902 1774,942 L 1650,972" />
            </g>
            {/* Actual dashed thread stitches (brighter warm-tinted thread on sun side, muted grey on shadow side) */}
            <g
              stroke="#3a3d46"
              strokeWidth="1.5"
              strokeDasharray="6 6"
              strokeOpacity="0.78"
            >
              <path d="M 186,44 C 272,30 364,20 462,16" />
              <path d="M 522,16 C 618,12 714,12 806,18" />
              <path d="M 14,768 C 44,840 82,902 146,942 L 270,972" />
            </g>
            <g
              stroke="#6a5a4e"
              strokeWidth="1.6"
              strokeDasharray="6 6"
              strokeOpacity="0.88"
            >
              <path d="M 1114,18 C 1206,12 1302,12 1398,16" />
              <path d="M 1458,16 C 1556,20 1648,30 1734,44" />
              <path d="M 1906,768 C 1876,840 1838,902 1774,942 L 1650,972" />
            </g>
          </g>

          {/* Molded composite shell parting seam lines (recessed gap + directional shoulder highlight) */}
          <g fill="none">
            <g stroke="#040507" strokeWidth="3.6" strokeOpacity="0.92">
              <path d="M 150,24 C 460,4 715,8 852,27" />
              <path d="M 1770,24 C 1460,4 1205,8 1068,27" />
              <path d="M 38,148 C 20,245 14,340 12,438" />
              <path d="M 1882,148 C 1900,245 1906,340 1908,438" />
              <path d="M 48,832 C 98,898 164,940 302,970" />
              <path d="M 1872,832 C 1822,898 1756,940 1618,970" />
              <path d="M 702,1028 L 832,1022" />
              <path d="M 1218,1028 L 1088,1022" />
            </g>
            {/* Caught seam bevel edge: dimmer on shadow left, noticeably lighter & warmer on sun right */}
            <g stroke="#2c2f37" strokeWidth="1.2" strokeOpacity="0.65">
              <path d="M 150,26 C 460,6 715,10 852,29" />
              <path d="M 40,148 C 22,245 16,340 14,438" />
              <path d="M 50,834 C 100,900 166,942 304,972" />
            </g>
            <g stroke="#6c594b" strokeWidth="1.5" strokeOpacity="0.82">
              <path d="M 1770,26 C 1460,6 1205,10 1068,29" />
              <path d="M 1880,148 C 1898,245 1904,340 1906,438" />
              <path d="M 1870,834 C 1820,900 1754,942 1616,972" />
            </g>
          </g>

          {/* Interior anodized mounting brackets */}
          <g>
            {/* Left brow & cheek brackets (shadow side) */}
            <rect
              x="204"
              y="22"
              width="44"
              height="18"
              rx="3"
              transform="rotate(-8 204 22)"
              fill="#15171c"
              stroke="#2a2d35"
              strokeWidth="1.3"
            />
            <rect
              x="196"
              y="967"
              width="52"
              height="20"
              rx="3"
              transform="rotate(10 196 967)"
              fill="#14161b"
              stroke="#292c34"
              strokeWidth="1.3"
            />
            {/* Right brow & cheek brackets (sunward side — warmer metallic catchlight) */}
            <rect
              x="1672"
              y="17"
              width="44"
              height="18"
              rx="3"
              transform="rotate(8 1672 17)"
              fill="#262322"
              stroke="#675548"
              strokeWidth="1.5"
            />
            <rect
              x="1672"
              y="974"
              width="52"
              height="20"
              rx="3"
              transform="rotate(-10 1672 974)"
              fill="#242120"
              stroke="#5b4c42"
              strokeWidth="1.5"
            />
          </g>

          {/* Small recessed Torx / hex screws with directional rim highlights */}
          {SCREW_POSITIONS.map(({ x, y, sunward }, i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="6.2"
                fill="#060709"
                stroke={sunward ? "#6e5a4c" : "#2b2e36"}
                strokeWidth="1.5"
              />
              <circle
                cx={x}
                cy={y}
                r="4.0"
                fill={sunward ? "#2c2623" : "#15171d"}
              />
              {/* Screw drive slot */}
              <line
                x1={x - 2.3}
                y1={y - 1.2}
                x2={x + 2.3}
                y2={y + 1.2}
                stroke="#040507"
                strokeWidth="1.6"
              />
            </g>
          ))}
        </g>

        {/* ============================================================
            4. VISIBLE MATTE TEXTURED RIM WITH UNEVEN SUN/SHADOW LIGHTING
           ============================================================ */}
        {/* Textured composite beveled rim body */}
        <g clipPath="url(#rimBevelClip)" filter="url(#rimMidBlur)">
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimCompositeTex)" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimBevelUnevenGrad)" />
        </g>

        {/* Outer stepped composite chamfer edge */}
        <path
          d={RIM_OUTER_PATH}
          fill="none"
          stroke="#050608"
          strokeWidth="3.5"
          filter="url(#rimMidBlur)"
        />

        {/* Soft out-of-focus dark inner shadow return right along the glass lip */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="url(#rimShadowStrip)"
          strokeWidth="11"
          filter="url(#rimInnerSoftBlur)"
        />

        {/* Sunward broad diffuse catchlight on upper-right rim shoulder (NO neon line) */}
        <path
          d="M 1038,52 C 1175,26 1445,28 1752,78 C 1832,92 1868,154 1876,264 L 1880,446"
          fill="none"
          stroke="#7b614e"
          strokeOpacity="0.46"
          strokeWidth="10"
          filter="url(#rimInnerSoftBlur)"
        />

        {/* Opposite shadow-side faint ambient rim shoulder (much darker) */}
        <path
          d="M 880,52 C 745,26 475,28 168,78 C 88,92 52,154 44,264"
          fill="none"
          stroke="#252830"
          strokeOpacity="0.34"
          strokeWidth="7"
          filter="url(#rimInnerSoftBlur)"
        />

        {/* ============================================================
            5. TOP SENSOR NOTCH & SIDE TEMPLE TABS (TEXTURED + SOFT EDGE)
           ============================================================ */}
        {/* Top central sensor notch */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 862,0 L 1058,0 L 1034,58 L 1018,64 L 902,64 L 886,58 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 862,0 L 1058,0 L 1034,58 L 1018,64 L 902,64 L 886,58 Z"
            fill="url(#cushionShadeRight)"
            opacity="0.55"
          />
          <path
            d="M 868,0 L 892,52 L 906,58 L 1014,58 L 1028,52 L 1052,0"
            fill="none"
            stroke="#4c433e"
            strokeWidth="2.4"
          />
          <path
            d="M 910,20 L 1010,20 L 1000,44 L 920,44 Z"
            fill="#07080a"
            stroke="#2a2b31"
            strokeWidth="1.3"
          />
          <circle cx="940" cy="32" r="4" fill="#0d0f14" stroke="#30323a" strokeWidth="1.2" />
          <circle cx="980" cy="32" r="4" fill="#0d0f14" stroke="#4d443d" strokeWidth="1.2" />
        </g>

        {/* Left temple hinge tab (shadow side) */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 0,418 L 46,440 L 66,478 L 66,628 L 46,666 L 0,688 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 0,418 L 46,440 L 66,478 L 66,628 L 46,666 L 0,688 Z"
            fill="url(#tabLeftShade)"
          />
          <path d="M 4,422 L 46,442 L 64,478" fill="none" stroke="#2c2f37" strokeWidth="2.2" />
          <path d="M 64,628 L 46,664 L 4,684" fill="none" stroke="#040507" strokeWidth="3.2" />
          <path
            d="M 14,472 L 48,486 L 48,620 L 14,634 Z"
            fill="#090a0d"
            stroke="#22252d"
            strokeWidth="1.3"
          />
          <line x1="22" y1="553" x2="40" y2="553" stroke="#2d3038" strokeWidth="2.5" />
        </g>

        {/* Right temple hinge tab (sun-facing side: noticeably warmer & brighter bevel) */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 1920,418 L 1874,440 L 1854,478 L 1854,628 L 1874,666 L 1920,688 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 1920,418 L 1874,440 L 1854,478 L 1854,628 L 1874,666 L 1920,688 Z"
            fill="url(#tabRightShade)"
          />
          <path d="M 1916,422 L 1874,442 L 1856,478" fill="none" stroke="#7d6452" strokeWidth="3" />
          <path d="M 1856,628 L 1874,664 L 1916,684" fill="none" stroke="#050608" strokeWidth="3" />
          <path
            d="M 1906,472 L 1872,486 L 1872,620 L 1906,634 Z"
            fill="#0b0b0e"
            stroke="#423935"
            strokeWidth="1.4"
          />
          <line x1="1898" y1="553" x2="1880" y2="553" stroke="#5b4c42" strokeWidth="2.5" />
        </g>

        {/* ============================================================
            6. LOWER MANDIBLE / CHIN-BAR WITH TEXTURE & LOUVERS
           ============================================================ */}
        <g filter="url(#rimMidBlur)">
          {/* Left mandible bevel (shadowed) */}
          <path
            d="M 168,930 L 516,974 L 700,1008 L 682,1040 L 494,1006 L 154,962 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 168,930 L 516,974 L 700,1008 L 682,1040 L 494,1006 L 154,962 Z"
            fill="url(#cushionShadeLeft)"
          />
          {/* Right mandible bevel (warmer light catch) */}
          <path
            d="M 1752,930 L 1404,974 L 1220,1008 L 1238,1040 L 1426,1006 L 1766,962 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 1752,930 L 1404,974 L 1220,1008 L 1238,1040 L 1426,1006 L 1766,962 Z"
            fill="url(#cushionShadeRight)"
            opacity="0.7"
          />
          {/* Uneven upper catchlight on mandible shelves */}
          <path d="M 172,931 L 516,974 L 696,1007" fill="none" stroke="#2c2e34" strokeWidth="2" />
          <path d="M 1748,931 L 1404,974 L 1224,1007" fill="none" stroke="#645145" strokeWidth="2.5" />

          {/* Central acoustic rebreather bridge */}
          <path
            d="M 866,1018 L 1054,1018 L 1078,1080 L 842,1080 Z"
            fill="url(#rimCompositeTex)"
            stroke="#2a2b31"
            strokeWidth="1.4"
          />
          <g stroke="#050608" strokeWidth="3.5" strokeLinecap="round">
            <line x1="365" y1="984" x2="430" y2="993" />
            <line x1="354" y1="996" x2="424" y2="1006" />
            <line x1="1555" y1="984" x2="1490" y2="993" />
            <line x1="1566" y1="996" x2="1496" y2="1006" />
          </g>
          <g stroke="#1d1f26" strokeWidth="2">
            <line x1="912" y1="1042" x2="912" y2="1072" />
            <line x1="931" y1="1042" x2="931" y2="1072" />
            <line x1="950" y1="1042" x2="950" y2="1072" />
            <line x1="970" y1="1042" x2="970" y2="1072" />
            <line x1="989" y1="1042" x2="989" y2="1072" />
            <line x1="1008" y1="1042" x2="1008" y2="1072" />
          </g>
        </g>
      </svg>
    </div>
  );
};
