import React from "react";

/**
 * Heavy molded EVA helmet inner glass opening (heavier brow & lower chin-bar,
 * clear wide central field of view, soft top sensor notch & side hinge tabs).
 */
const APERTURE_PATH = `
  M 176,120
  C 462,72 712,68 836,92
  L 892,108 L 1028,108 L 1084,92
  C 1208,68 1458,72 1744,120
  C 1824,136 1860,192 1866,290
  L 1872,448 L 1846,482 L 1846,622 L 1872,656
  C 1864,774 1826,854 1742,896
  L 1408,940 L 1228,974 L 1094,966 L 1048,988
  L 872,988 L 826,966 L 692,974 L 512,940 L 178,896
  C 94,854 56,774 48,656
  L 74,622 L 74,482 L 48,448
  L 54,290
  C 60,192 96,136 176,120 Z
`;

/**
 * Stepped outer boundary of the thick beveled helmet rim.
 * Leaves interior cavity between screen edges and RIM_OUTER_PATH for
 * out-of-focus quilted padding, routed cables, seams, and small hardware.
 */
const RIM_OUTER_PATH = `
  M 148,74
  C 456,24 720,20 848,46
  L 900,62 L 1020,62 L 1072,46
  C 1200,20 1464,24 1772,74
  C 1862,90 1902,154 1908,266
  L 1914,436 L 1890,476 L 1890,628 L 1914,668
  C 1906,804 1864,892 1772,940
  L 1424,988 L 1238,1022 L 1098,1014 L 1058,1036
  L 862,1036 L 822,1014 L 682,1022 L 496,988 L 148,940
  C 56,892 14,804 6,668
  L 30,628 L 30,476 L 6,436
  L 12,266
  C 18,154 58,90 148,74 Z
`;

const HARDWARE_SCREWS: ReadonlyArray<{ x: number; y: number; sunward: boolean }> = [
  { x: 242, y: 42, sunward: false },
  { x: 646, y: 20, sunward: false },
  { x: 1274, y: 20, sunward: true },
  { x: 1678, y: 42, sunward: true },
  { x: 22, y: 492, sunward: false },
  { x: 22, y: 612, sunward: false },
  { x: 1898, y: 492, sunward: true },
  { x: 1898, y: 612, sunward: true },
  { x: 244, y: 970, sunward: false },
  { x: 656, y: 1018, sunward: false },
  { x: 1264, y: 1018, sunward: true },
  { x: 1676, y: 970, sunward: true },
];

/**
 * Physical heavy EVA helmet interior & visor rim:
 * - Heavier, darker top brow and lower chin-bar with varied dirty grey composite tones
 * - Edge wear & chipped scuff highlights along beveled shoulders and tabs
 * - Visible recessed parting seams and small anodized fasteners/brackets
 * - Out-of-focus interior details just past the rim (quilted weave padding, routed cables, clips & hardware)
 * - Uneven directional Martian lighting (brighter upper-right sun side, darker lower-left)
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
          {/* Tileable dirty-grey matte composite with mottled wear and fine scratches */}
          <pattern
            id="rimCompositeTex"
            width="230"
            height="230"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={`${base}helmet/rim-composite.png`}
              width="230"
              height="230"
              preserveAspectRatio="none"
            />
          </pattern>

          {/* Tileable ballistic / carbon twill weave for interior padded bolsters */}
          <pattern
            id="paddingWeaveTex"
            width="132"
            height="132"
            patternUnits="userSpaceOnUse"
          >
            <image
              href={`${base}helmet/interior-weave.png`}
              width="132"
              height="132"
              preserveAspectRatio="none"
            />
          </pattern>

          {/* Heavy dark shell mass: deepens top brow & lower chin-bar while keeping dirty-grey texture visible */}
          <linearGradient id="topBottomWeightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#040506" stopOpacity="0.72" />
            <stop offset="16%" stopColor="#0d0e11" stopOpacity="0.46" />
            <stop offset="50%" stopColor="#1b1d22" stopOpacity="0.18" />
            <stop offset="84%" stopColor="#0a0b0e" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#030405" stopOpacity="0.78" />
          </linearGradient>

          {/* Uneven directional lighting across helmet: warmer upper-right sun catch vs deep shadow lower-left */}
          <radialGradient id="unevenSunLightShell" cx="84%" cy="14%" r="88%">
            <stop offset="0%" stopColor="#8e735c" stopOpacity="0.34" />
            <stop offset="30%" stopColor="#52463d" stopOpacity="0.18" />
            <stop offset="65%" stopColor="#121418" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#030405" stopOpacity="0.72" />
          </radialGradient>

          {/* Uneven rim bevel shading: preserves varied dirty grey mottling on sun side & mid, darker at top/bottom/left */}
          <linearGradient id="rimBevelUnevenGrad" x1="0.06" y1="0.92" x2="0.92" y2="0.08">
            <stop offset="0%" stopColor="#090a0d" stopOpacity="0.72" />
            <stop offset="34%" stopColor="#17191e" stopOpacity="0.55" />
            <stop offset="62%" stopColor="#2e2d2e" stopOpacity="0.40" />
            <stop offset="86%" stopColor="#5d4f44" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#776150" stopOpacity="0.58" />
          </linearGradient>

          {/* Inner shadow lip turning down into the glass */}
          <linearGradient id="rimShadowStrip" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#020304" />
            <stop offset="55%" stopColor="#060709" />
            <stop offset="100%" stopColor="#141315" />
          </linearGradient>

          {/* Padded bolster shading */}
          <linearGradient id="cushionShadeLeft" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#050608" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#26282e" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id="cushionShadeRight" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6b5747" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#07080b" stopOpacity="0.64" />
          </linearGradient>

          {/* Side temple tab uneven light */}
          <linearGradient id="tabLeftShade" x1="0" y1="0" x2="1" y2="0.4">
            <stop offset="0%" stopColor="#040507" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#24272e" stopOpacity="0.26" />
          </linearGradient>
          <linearGradient id="tabRightShade" x1="1" y1="0" x2="0" y2="0.4">
            <stop offset="0%" stopColor="#7c6350" stopOpacity="0.36" />
            <stop offset="58%" stopColor="#3c342e" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#0a0b0e" stopOpacity="0.58" />
          </linearGradient>

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

          {/* Out-of-focus filters for foreground helmet interior & inner rim edge */}
          <filter id="interiorDofBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>

          <filter id="rimMidBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.15" />
          </filter>

          <filter id="rimInnerSoftBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>

          <filter id="glassContactShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>

        {/* ============================================================
            1. DEEP CONTACT SHADOW ON GLASS WHERE IT MEETS THE HEAVY RIM
           ============================================================ */}
        <g clipPath="url(#visorOpeningClip)">
          <path
            d={APERTURE_PATH}
            fill="none"
            stroke="#020203"
            strokeOpacity="0.70"
            strokeWidth="32"
            filter="url(#glassContactShadow)"
          />
        </g>

        {/* ============================================================
            2. BASE MOLDED COMPOSITE SHELL (DIRTY GREY MOTTLING + HEAVY DARK WEIGHT)
           ============================================================ */}
        <g clipPath="url(#helmetBodyClip)">
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimCompositeTex)" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#topBottomWeightGrad)" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#unevenSunLightShell)" />
        </g>

        {/* ============================================================
            3. OUT-OF-FOCUS INTERIOR DETAILS JUST PAST THE RIM
               (Padded bolsters, stitching, routed cables, clamps, hardware)
           ============================================================ */}
        <g clipPath="url(#helmetBodyClip)" filter="url(#interiorDofBlur)">
          {/* Upper brow quilted foam/Nomex cushions */}
          <path
            d="M 156,0 L 500,0 L 478,34 C 362,42 254,54 148,74 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 156,0 L 500,0 L 478,34 C 362,42 254,54 148,74 Z"
            fill="url(#cushionShadeLeft)"
          />

          <path
            d="M 528,0 L 838,0 L 826,38 C 722,26 618,26 516,32 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 528,0 L 838,0 L 826,38 C 722,26 618,26 516,32 Z"
            fill="url(#cushionShadeLeft)"
          />

          <path
            d="M 1082,0 L 1392,0 L 1404,32 C 1302,26 1198,26 1094,38 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1082,0 L 1392,0 L 1404,32 C 1302,26 1198,26 1094,38 Z"
            fill="url(#cushionShadeRight)"
          />

          <path
            d="M 1420,0 L 1764,0 L 1772,74 C 1666,54 1558,42 1442,34 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1420,0 L 1764,0 L 1772,74 C 1666,54 1558,42 1442,34 Z"
            fill="url(#cushionShadeRight)"
          />

          {/* Lower cheek / mandible woven cushions */}
          <path
            d="M 0,720 C 26,812 68,888 148,940 L 348,968 L 310,1080 L 0,1080 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 0,720 C 26,812 68,888 148,940 L 348,968 L 310,1080 L 0,1080 Z"
            fill="url(#cushionShadeLeft)"
          />
          <path
            d="M 1920,720 C 1894,812 1852,888 1772,940 L 1572,968 L 1610,1080 L 1920,1080 Z"
            fill="url(#paddingWeaveTex)"
          />
          <path
            d="M 1920,720 C 1894,812 1852,888 1772,940 L 1572,968 L 1610,1080 L 1920,1080 Z"
            fill="url(#cushionShadeRight)"
          />

          {/* Quilted thread stitching tracks along pads */}
          <g fill="none" strokeLinecap="round">
            <g stroke="#040507" strokeWidth="3" strokeOpacity="0.9">
              <path d="M 164,60 C 266,42 368,32 468,26" />
              <path d="M 530,24 C 626,18 724,18 818,28" />
              <path d="M 1102,28 C 1196,18 1294,18 1390,24" />
              <path d="M 1452,26 C 1552,32 1654,42 1756,60" />
              <path d="M 16,748 C 46,826 86,892 154,932 L 322,958" />
              <path d="M 1904,748 C 1874,826 1834,892 1766,932 L 1598,958" />
            </g>
            <g stroke="#444750" strokeWidth="1.6" strokeDasharray="6 6" strokeOpacity="0.78">
              <path d="M 164,60 C 266,42 368,32 468,26" />
              <path d="M 530,24 C 626,18 724,18 818,28" />
              <path d="M 16,748 C 46,826 86,892 154,932 L 322,958" />
            </g>
            <g stroke="#6c5e52" strokeWidth="1.7" strokeDasharray="6 6" strokeOpacity="0.88">
              <path d="M 1102,28 C 1196,18 1294,18 1390,24" />
              <path d="M 1452,26 C 1552,32 1654,42 1756,60" />
              <path d="M 1904,748 C 1874,826 1834,892 1766,932 L 1598,958" />
            </g>
          </g>

          {/* Routed out-of-focus comms / sensor cables tucked in brow & mandible channels */}
          <g fill="none" strokeLinecap="round">
            {/* Upper-left & upper-right brow harness cables */}
            <path
              d="M 118,52 C 260,30 430,22 615,24 C 710,25 795,30 858,42"
              stroke="#050608"
              strokeWidth="9.5"
            />
            <path
              d="M 118,50 C 260,28 430,20 615,22 C 710,23 795,28 858,40"
              stroke="#2a2d33"
              strokeWidth="3.2"
              strokeDasharray="4 3"
              strokeOpacity="0.65"
            />
            <path
              d="M 1802,52 C 1660,30 1490,22 1305,24 C 1210,25 1125,30 1062,42"
              stroke="#050608"
              strokeWidth="9.5"
            />
            <path
              d="M 1802,50 C 1660,28 1490,20 1305,22 C 1210,23 1125,28 1062,40"
              stroke="#4d443e"
              strokeWidth="3.4"
              strokeDasharray="4 3"
              strokeOpacity="0.72"
            />

            {/* Lower-left & lower-right ribbed oxygen / mic conduits */}
            <path
              d="M 78,906 C 190,964 360,992 560,1012 L 736,1028"
              stroke="#050608"
              strokeWidth="12"
            />
            <path
              d="M 78,904 C 190,962 360,990 560,1010 L 736,1026"
              stroke="#33353b"
              strokeWidth="4.2"
              strokeDasharray="5 4"
              strokeOpacity="0.6"
            />
            <path
              d="M 1842,906 C 1730,964 1560,992 1360,1012 L 1184,1028"
              stroke="#050608"
              strokeWidth="12"
            />
            <path
              d="M 1842,904 C 1730,962 1560,990 1360,1010 L 1184,1026"
              stroke="#51463e"
              strokeWidth="4.2"
              strokeDasharray="5 4"
              strokeOpacity="0.7"
            />
          </g>

          {/* Cable P-clips & small interior hardware brackets */}
          <g>
            {/* Cable clips along brow cables */}
            <rect x="422" y="14" width="14" height="22" rx="2" fill="#181a20" stroke="#363942" strokeWidth="1.2" />
            <rect x="748" y="20" width="14" height="22" rx="2" fill="#181a20" stroke="#363942" strokeWidth="1.2" />
            <rect x="1158" y="20" width="14" height="22" rx="2" fill="#282524" stroke="#625246" strokeWidth="1.3" />
            <rect x="1484" y="14" width="14" height="22" rx="2" fill="#282524" stroke="#625246" strokeWidth="1.3" />

            {/* Lower conduit clamps */}
            <rect x="444" y="990" width="18" height="24" rx="2" transform="rotate(8 444 990)" fill="#16181e" stroke="#33363e" strokeWidth="1.2" />
            <rect x="1458" y="990" width="18" height="24" rx="2" transform="rotate(-8 1458 990)" fill="#242221" stroke="#5b4d43" strokeWidth="1.3" />

            {/* Brow latch plates */}
            <rect
              x="220"
              y="32"
              width="48"
              height="20"
              rx="3"
              transform="rotate(-8 220 32)"
              fill="#181a1f"
              stroke="#3a3d45"
              strokeWidth="1.4"
            />
            <rect
              x="1652"
              y="26"
              width="48"
              height="20"
              rx="3"
              transform="rotate(8 1652 26)"
              fill="#2b2725"
              stroke="#705d4e"
              strokeWidth="1.5"
            />

            {/* Chin anchor hardware blocks */}
            <rect
              x="216"
              y="958"
              width="56"
              height="24"
              rx="3"
              transform="rotate(9 216 958)"
              fill="#15171c"
              stroke="#34373f"
              strokeWidth="1.4"
            />
            <rect
              x="1648"
              y="966"
              width="56"
              height="24"
              rx="3"
              transform="rotate(-9 1648 966)"
              fill="#272422"
              stroke="#685649"
              strokeWidth="1.5"
            />
          </g>

          {/* Visible interior shell parting seams (deep dark groove + worn dirty-grey seam shoulder) */}
          <g fill="none">
            <g stroke="#030405" strokeWidth="4.6" strokeOpacity="0.95">
              <path d="M 140,46 C 454,10 714,12 854,40" />
              <path d="M 1780,46 C 1466,10 1206,12 1066,40" />
              <path d="M 38,162 C 18,256 12,346 10,434" />
              <path d="M 1882,162 C 1902,256 1908,346 1910,434" />
              <path d="M 46,826 C 98,894 168,940 314,974 L 680,1022" />
              <path d="M 1874,826 C 1822,894 1752,940 1606,974 L 1240,1022" />
              {/* Vertical jaw module seam */}
              <path d="M 526,956 L 502,1080" />
              <path d="M 1394,956 L 1418,1080" />
            </g>
            <g stroke="#3f4249" strokeWidth="1.6" strokeOpacity="0.72">
              <path d="M 140,49 C 454,13 714,15 854,43" />
              <path d="M 40,162 C 20,256 14,346 12,434" />
              <path d="M 48,828 C 100,896 170,942 316,976" />
              <path d="M 529,956 L 505,1080" />
            </g>
            <g stroke="#706154" strokeWidth="1.8" strokeOpacity="0.86">
              <path d="M 1780,49 C 1466,13 1206,15 1066,43" />
              <path d="M 1880,162 C 1900,256 1906,346 1908,434" />
              <path d="M 1872,828 C 1820,896 1750,942 1604,976" />
              <path d="M 1391,956 L 1415,1080" />
            </g>
          </g>

          {/* Small recessed screws & socket-head hardware */}
          {HARDWARE_SCREWS.map(({ x, y, sunward }, i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={y}
                r="6.6"
                fill="#050608"
                stroke={sunward ? "#746152" : "#34373f"}
                strokeWidth="1.6"
              />
              <circle cx={x} cy={y} r="4.2" fill={sunward ? "#332c28" : "#1c1f26"} />
              <line
                x1={x - 2.4}
                y1={y - 1.2}
                x2={x + 2.4}
                y2={y + 1.2}
                stroke="#030405"
                strokeWidth="1.7"
              />
            </g>
          ))}
        </g>

        {/* ============================================================
            4. HEAVY DIRTY-GREY COMPOSITE RIM + SEAMS + EDGE WEAR
           ============================================================ */}
        {/* Main textured composite rim bevel */}
        <g clipPath="url(#rimBevelClip)" filter="url(#rimMidBlur)">
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimCompositeTex)" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#topBottomWeightGrad)" opacity="0.65" />
          <rect x="0" y="0" width="1920" height="1080" fill="url(#rimBevelUnevenGrad)" />
        </g>

        {/* Visible seam lines cutting across the molded rim bevel itself */}
        <g clipPath="url(#rimBevelClip)" filter="url(#rimMidBlur)" fill="none">
          <g stroke="#040507" strokeWidth="3.6" strokeOpacity="0.92">
            <path d="M 480,26 L 494,94" />
            <path d="M 1440,26 L 1426,94" />
            <path d="M 656,956 L 642,1022" />
            <path d="M 1264,956 L 1278,1022" />
            <path d="M 22,296 L 66,308" />
            <path d="M 1898,296 L 1854,308" />
          </g>
          <g stroke="#504d4b" strokeWidth="1.4" strokeOpacity="0.65">
            <path d="M 483,26 L 497,94" />
            <path d="M 659,956 L 645,1022" />
          </g>
          <g stroke="#786657" strokeWidth="1.6" strokeOpacity="0.78">
            <path d="M 1437,26 L 1423,94" />
            <path d="M 1261,956 L 1275,1022" />
          </g>
        </g>

        {/* Outer stepped seam groove around the entire thick rim */}
        <path
          d={RIM_OUTER_PATH}
          fill="none"
          stroke="#040507"
          strokeWidth="4.2"
          filter="url(#rimMidBlur)"
        />

        {/* Soft out-of-focus dark inner shadow lip fading into the glass */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="url(#rimShadowStrip)"
          strokeWidth="12"
          filter="url(#rimInnerSoftBlur)"
        />

        {/* Chipped / scuffed composite edge wear (broken irregular strokes — never a solid neon line) */}
        <g filter="url(#rimInnerSoftBlur)" fill="none" strokeLinecap="round">
          {/* Sun-facing upper-right rim wear */}
          <path
            d="M 1038,94 C 1180,68 1448,72 1744,120 C 1824,136 1860,192 1866,290 L 1872,448"
            stroke="#887362"
            strokeOpacity="0.52"
            strokeWidth="6"
            strokeDasharray="42 18 14 26 68 22"
          />
          {/* Sun-side brow dirty-grey edge abrasion */}
          <path
            d="M 1160,78 C 1340,74 1560,88 1756,124"
            stroke="#9a8878"
            strokeOpacity="0.34"
            strokeWidth="2.4"
            strokeDasharray="16 28 8 42 26 19"
          />
          {/* Opposite shadow-side dull scuffed rim edge */}
          <path
            d="M 882,94 C 740,68 472,72 176,120 C 96,136 60,192 54,290"
            stroke="#363941"
            strokeOpacity="0.40"
            strokeWidth="5"
            strokeDasharray="34 24 12 30"
          />
          {/* Lower chin edge wear */}
          <path
            d="M 1228,972 L 1408,938 L 1732,896"
            stroke="#6a5a4d"
            strokeOpacity="0.44"
            strokeWidth="4"
            strokeDasharray="28 16 10 24"
          />
          <path
            d="M 692,972 L 512,938 L 188,896"
            stroke="#34373e"
            strokeOpacity="0.36"
            strokeWidth="3.5"
            strokeDasharray="24 20 12 28"
          />
        </g>

        {/* ============================================================
            5. HEAVY TOP SENSOR NOTCH & SIDE TEMPLE HARDWARE TABS
           ============================================================ */}
        {/* Heavy top central brow housing */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 848,0 L 1072,0 L 1044,98 L 1026,108 L 894,108 L 876,98 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 848,0 L 1072,0 L 1044,98 L 1026,108 L 894,108 L 876,98 Z"
            fill="url(#topBottomWeightGrad)"
            opacity="0.72"
          />
          <path
            d="M 856,0 L 882,88 L 900,98 L 1020,98 L 1038,88 L 1064,0"
            fill="none"
            stroke="#4e4945"
            strokeWidth="2.8"
          />
          <path
            d="M 906,40 L 1014,40 L 1002,76 L 918,76 Z"
            fill="#060709"
            stroke="#2f3036"
            strokeWidth="1.5"
          />
          <circle cx="940" cy="58" r="5" fill="#0d0f14" stroke="#34363e" strokeWidth="1.3" />
          <circle cx="980" cy="58" r="5" fill="#0d0f14" stroke="#5a4f46" strokeWidth="1.3" />
        </g>

        {/* Left temple hinge tab (shadow side) */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 0,414 L 54,438 L 78,480 L 78,624 L 54,666 L 0,690 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 0,414 L 54,438 L 78,480 L 78,624 L 54,666 L 0,690 Z"
            fill="url(#tabLeftShade)"
          />
          <path d="M 4,418 L 54,440 L 74,480" fill="none" stroke="#363942" strokeWidth="2.6" />
          <path d="M 74,624 L 54,664 L 4,686" fill="none" stroke="#040507" strokeWidth="3.5" />
          <path
            d="M 14,474 L 56,488 L 56,616 L 14,630 Z"
            fill="#08090c"
            stroke="#262931"
            strokeWidth="1.4"
          />
          <line x1="22" y1="552" x2="46" y2="552" stroke="#343740" strokeWidth="3" />
        </g>

        {/* Right temple hinge tab (sun-facing side with worn edge highlights) */}
        <g filter="url(#rimMidBlur)">
          <path
            d="M 1920,414 L 1866,438 L 1842,480 L 1842,624 L 1866,666 L 1920,690 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 1920,414 L 1866,438 L 1842,480 L 1842,624 L 1866,666 L 1920,690 Z"
            fill="url(#tabRightShade)"
          />
          <path d="M 1916,418 L 1866,440 L 1846,480" fill="none" stroke="#856b58" strokeWidth="3.2" />
          <path d="M 1846,624 L 1866,664 L 1916,686" fill="none" stroke="#050608" strokeWidth="3.5" />
          <path
            d="M 1906,474 L 1864,488 L 1864,616 L 1906,630 Z"
            fill="#0a0b0e"
            stroke="#4b4039"
            strokeWidth="1.5"
          />
          <line x1="1898" y1="552" x2="1874" y2="552" stroke="#665548" strokeWidth="3" />
        </g>

        {/* ============================================================
            6. HEAVIER, DARKER LOWER MANDIBLE / CHIN-BAR WITH SEAMS & LOUVERS
           ============================================================ */}
        <g filter="url(#rimMidBlur)">
          {/* Left & right mandible shoulders */}
          <path
            d="M 178,896 L 514,940 L 696,974 L 678,1020 L 494,986 L 148,940 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 178,896 L 514,940 L 696,974 L 678,1020 L 494,986 L 148,940 Z"
            fill="url(#cushionShadeLeft)"
          />
          <path
            d="M 1742,896 L 1406,940 L 1224,974 L 1242,1020 L 1426,986 L 1772,940 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 1742,896 L 1406,940 L 1224,974 L 1242,1020 L 1426,986 L 1772,940 Z"
            fill="url(#cushionShadeRight)"
            opacity="0.72"
          />

          {/* Heavy dark chin core & acoustic bridge */}
          <path
            d="M 858,988 L 1062,988 L 1094,1080 L 826,1080 Z"
            fill="url(#rimCompositeTex)"
          />
          <path
            d="M 858,988 L 1062,988 L 1094,1080 L 826,1080 Z"
            fill="url(#topBottomWeightGrad)"
            opacity="0.82"
          />
          <path
            d="M 858,988 L 1062,988 L 1094,1080 L 826,1080 Z"
            fill="none"
            stroke="#3a393b"
            strokeWidth="1.6"
          />

          {/* Mandible intake louvers */}
          <g stroke="#040507" strokeWidth="4" strokeLinecap="round">
            <line x1="364" y1="956" x2="432" y2="965" />
            <line x1="352" y1="969" x2="424" y2="979" />
            <line x1="1556" y1="956" x2="1488" y2="965" />
            <line x1="1568" y1="969" x2="1496" y2="979" />
          </g>
          {/* Acoustic grille slots */}
          <g stroke="#1b1d24" strokeWidth="2.4">
            <line x1="904" y1="1018" x2="904" y2="1062" />
            <line x1="926" y1="1018" x2="926" y2="1062" />
            <line x1="948" y1="1018" x2="948" y2="1062" />
            <line x1="972" y1="1018" x2="972" y2="1062" />
            <line x1="994" y1="1018" x2="994" y2="1062" />
            <line x1="1016" y1="1018" x2="1016" y2="1062" />
          </g>
        </g>
      </svg>
    </div>
  );
};
