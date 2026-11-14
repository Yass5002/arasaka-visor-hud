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

/**
 * Physical molded EVA helmet interior frame:
 * - Visible matte rim with real thickness (light-catching upper/sunward bevel + shadow return lip)
 * - Soft top sensor notch and left/right temple hinge tabs
 * - Faint out-of-focus interior padding, seams, and mounting brackets
 * - Zero neon outlines
 */
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
          {/* Matte molded composite shell gradient */}
          <radialGradient id="helmetShellMatte" cx="52%" cy="46%" r="74%">
            <stop offset="48%" stopColor="#14161b" />
            <stop offset="78%" stopColor="#0d0f13" />
            <stop offset="100%" stopColor="#060709" />
          </radialGradient>

          {/* Subtle textile weave for interior padding */}
          <pattern id="paddingFabric" width="6" height="6" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill="#121419" />
            <path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#1a1d24" fillOpacity="0.45" />
          </pattern>

          {/* Rim light-catching strip (warmer on upper-right facing Martian sun) */}
          <linearGradient id="rimLightStrip" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0%" stopColor="#26282e" />
            <stop offset="38%" stopColor="#353332" />
            <stop offset="68%" stopColor="#463d37" />
            <stop offset="100%" stopColor="#242529" />
          </linearGradient>

          {/* Rim shadow inner return */}
          <linearGradient id="rimShadowStrip" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#07080a" />
            <stop offset="50%" stopColor="#050607" />
            <stop offset="100%" stopColor="#0c0d10" />
          </linearGradient>

          {/* Upper brow molded plate */}
          <linearGradient id="browMatteGrad" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#101216" />
            <stop offset="55%" stopColor="#1c1e23" />
            <stop offset="85%" stopColor="#252322" />
            <stop offset="100%" stopColor="#15171c" />
          </linearGradient>

          {/* Lower mandible matte gradient */}
          <linearGradient id="chinMatteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#292829" />
            <stop offset="18%" stopColor="#181a1f" />
            <stop offset="65%" stopColor="#0e1014" />
            <stop offset="100%" stopColor="#060709" />
          </linearGradient>

          {/* Side temple tab gradient */}
          <linearGradient id="tabLeftGrad" x1="0" y1="0" x2="1" y2="0.2">
            <stop offset="0%" stopColor="#0a0b0e" />
            <stop offset="55%" stopColor="#1c1f26" />
            <stop offset="100%" stopColor="#2a2c32" />
          </linearGradient>
          <linearGradient id="tabRightGrad" x1="1" y1="0" x2="0" y2="0.2">
            <stop offset="0%" stopColor="#0a0b0e" />
            <stop offset="55%" stopColor="#202126" />
            <stop offset="100%" stopColor="#35312e" />
          </linearGradient>

          {/* Clip inside the visor opening for contact shadow */}
          <clipPath id="visorOpeningClip">
            <path d={APERTURE_PATH} />
          </clipPath>

          {/* Clip outside the aperture (for interior helmet details) */}
          <clipPath id="helmetBodyClip">
            <path d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`} clipRule="evenodd" />
          </clipPath>

          {/* Soft DOF blurs: physical closeness to eye */}
          <filter id="interiorDofBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>

          <filter id="rimSoftBlur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.6" />
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
            strokeOpacity="0.62"
            strokeWidth="28"
            filter="url(#glassContactShadow)"
          />
        </g>

        {/* ============================================================
            2. BASE MOLDED HELMET SHELL + OUT-OF-FOCUS INTERIOR DETAILS
           ============================================================ */}
        <path
          d={`M 0,0 L 1920,0 L 1920,1080 L 0,1080 Z ${APERTURE_PATH}`}
          fill="url(#helmetShellMatte)"
          fillRule="evenodd"
        />

        {/* Faint out-of-focus interior helmet padding, seams, and brackets */}
        <g clipPath="url(#helmetBodyClip)" filter="url(#interiorDofBlur)">
          {/* Upper brow quilted foam cushions */}
          <path
            d="M 190,0 L 490,0 L 470,22 C 360,26 260,38 175,54 Z"
            fill="url(#paddingFabric)"
            opacity="0.7"
          />
          <path
            d="M 520,0 L 820,0 L 810,24 C 710,16 610,16 510,22 Z"
            fill="url(#paddingFabric)"
            opacity="0.7"
          />
          <path
            d="M 1100,0 L 1400,0 L 1410,22 C 1310,16 1210,16 1110,24 Z"
            fill="url(#paddingFabric)"
            opacity="0.75"
          />
          <path
            d="M 1430,0 L 1730,0 L 1745,54 C 1660,38 1560,26 1450,22 Z"
            fill="url(#paddingFabric)"
            opacity="0.75"
          />

          {/* Cheek / jaw interior padding bolsters (bottom-left & bottom-right) */}
          <path
            d="M 0,760 C 28,835 66,900 130,948 L 280,982 L 245,1080 L 0,1080 Z"
            fill="url(#paddingFabric)"
            opacity="0.72"
          />
          <path
            d="M 1920,760 C 1892,835 1854,900 1790,948 L 1640,982 L 1675,1080 L 1920,1080 Z"
            fill="url(#paddingFabric)"
            opacity="0.72"
          />

          {/* Faint recessed padding seam lines & shell parting lines */}
          <g fill="none" stroke="#060709" strokeWidth="3.5" strokeOpacity="0.85">
            <path d="M 160,12 C 460,4 700,8 845,26" />
            <path d="M 1760,12 C 1460,4 1220,8 1075,26" />
            <path d="M 48,150 C 26,240 20,340 20,435" />
            <path d="M 1872,150 C 1894,240 1900,340 1900,435" />
            <path d="M 55,830 C 105,895 165,935 290,965" />
            <path d="M 1865,830 C 1815,895 1755,935 1630,965" />
          </g>
          {/* Faint seam highlight stitch edge */}
          <g fill="none" stroke="#2c2e34" strokeWidth="1.2" strokeOpacity="0.45">
            <path d="M 160,14 C 460,6 700,10 845,28" />
            <path d="M 1760,14 C 1460,6 1220,10 1075,28" />
            <path d="M 57,832 C 107,897 167,937 292,967" />
            <path d="M 1863,832 C 1813,897 1753,937 1628,967" />
          </g>

          {/* Small out-of-focus interior mounting brackets & fasteners */}
          <g fill="#191b21" stroke="#2d2f36" strokeWidth="1.2" strokeOpacity="0.5">
            {/* Upper-left & upper-right brow latch brackets */}
            <rect x="208" y="22" width="38" height="16" rx="3" transform="rotate(-8 208 22)" />
            <rect x="1674" y="17" width="38" height="16" rx="3" transform="rotate(8 1674 17)" />
            {/* Lower cheek anchor brackets */}
            <rect x="198" y="968" width="46" height="18" rx="3" transform="rotate(10 198 968)" />
            <rect x="1676" y="976" width="46" height="18" rx="3" transform="rotate(-10 1676 976)" />
          </g>
          {[
            [227, 30],
            [1693, 30],
            [220, 979],
            [1700, 979],
            [675, 1022],
            [1245, 1022],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="5.5" fill="#08090c" stroke="#2e3038" strokeWidth="1.4" />
              <circle cx={cx} cy={cy} r="2.2" fill="#1b1d23" />
            </g>
          ))}
        </g>

        {/* ============================================================
            3. VISIBLE MATTE RIM WITH REAL THICKNESS
               (Outer shell -> Lighter bevel strip -> Darker shadow inner lip)
           ============================================================ */}
        {/* Thick stepped matte rim molding */}
        <path
          d={`${RIM_OUTER_PATH} ${APERTURE_PATH}`}
          fill="url(#browMatteGrad)"
          fillRule="evenodd"
          filter="url(#rimSoftBlur)"
        />

        {/* Lighter matte strip along the beveled face catching ambient & sun light */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="url(#rimLightStrip)"
          strokeWidth="16"
          filter="url(#rimSoftBlur)"
        />

        {/* Deeper shadow strip right at the inner turn into the visor glass */}
        <path
          d={APERTURE_PATH}
          fill="none"
          stroke="url(#rimShadowStrip)"
          strokeWidth="9"
          filter="url(#rimSoftBlur)"
        />

        {/* Soft caught specular edge on the sun-facing upper-right rim ridge */}
        <path
          d="M 1074,48 C 1196,24 1450,28 1750,76 C 1824,89 1862,145 1872,248"
          fill="none"
          stroke="#5c4d43"
          strokeOpacity="0.34"
          strokeWidth="2.5"
          filter="url(#rimSoftBlur)"
        />

        {/* ============================================================
            4. TOP SENSOR NOTCH & SIDE TEMPLE TABS (SOFT PHYSICAL FORM)
           ============================================================ */}
        {/* Top central sensor notch housing */}
        <g filter="url(#rimSoftBlur)">
          <path
            d="M 862,0 L 1058,0 L 1034,58 L 1018,64 L 902,64 L 886,58 Z"
            fill="#15171c"
          />
          {/* Beveled lighter side shoulders of top notch */}
          <path
            d="M 868,0 L 892,52 L 906,58 L 1014,58 L 1028,52 L 1052,0"
            fill="none"
            stroke="#2f3138"
            strokeWidth="2.2"
          />
          {/* Recessed dark sensor bay */}
          <path
            d="M 910,20 L 1010,20 L 1000,44 L 920,44 Z"
            fill="#07080a"
            stroke="#22252c"
            strokeWidth="1.2"
          />
          {/* Dual dark optical lenses (no neon) */}
          <circle cx="940" cy="32" r="4" fill="#0d0f14" stroke="#2b2d35" strokeWidth="1.2" />
          <circle cx="980" cy="32" r="4" fill="#0d0f14" stroke="#2b2d35" strokeWidth="1.2" />
        </g>

        {/* Left temple hinge tab */}
        <g filter="url(#rimSoftBlur)">
          <path
            d="M 0,418 L 46,440 L 66,478 L 66,628 L 46,666 L 0,688 Z"
            fill="url(#tabLeftGrad)"
          />
          {/* Top light-catching chamfer & bottom shadow edge */}
          <path d="M 4,422 L 46,442 L 64,478" fill="none" stroke="#363840" strokeWidth="2.2" />
          <path d="M 64,628 L 46,664 L 4,684" fill="none" stroke="#060709" strokeWidth="3" />
          {/* Recessed inner latch plate */}
          <path
            d="M 14,472 L 48,486 L 48,620 L 14,634 Z"
            fill="#0a0b0e"
            stroke="#24272f"
            strokeWidth="1.2"
          />
          <line x1="22" y1="553" x2="40" y2="553" stroke="#2e313a" strokeWidth="2.5" />
        </g>

        {/* Right temple hinge tab */}
        <g filter="url(#rimSoftBlur)">
          <path
            d="M 1920,418 L 1874,440 L 1854,478 L 1854,628 L 1874,666 L 1920,688 Z"
            fill="url(#tabRightGrad)"
          />
          {/* Sunward warm light-catching top chamfer */}
          <path d="M 1916,422 L 1874,442 L 1856,478" fill="none" stroke="#4d443d" strokeWidth="2.4" />
          <path d="M 1856,628 L 1874,664 L 1916,684" fill="none" stroke="#060709" strokeWidth="3" />
          {/* Recessed inner latch plate */}
          <path
            d="M 1906,472 L 1872,486 L 1872,620 L 1906,634 Z"
            fill="#0a0b0e"
            stroke="#282930"
            strokeWidth="1.2"
          />
          <line x1="1898" y1="553" x2="1880" y2="553" stroke="#353437" strokeWidth="2.5" />
        </g>

        {/* ============================================================
            5. LOWER MANDIBLE / CHIN-BAR WITH BEVEL & VENT LOUVERS
           ============================================================ */}
        <g filter="url(#rimSoftBlur)">
          {/* Left mandible bevel shoulder */}
          <path
            d="M 168,930 L 516,974 L 700,1008 L 682,1040 L 494,1006 L 154,962 Z"
            fill="url(#chinMatteGrad)"
          />
          {/* Right mandible bevel shoulder */}
          <path
            d="M 1752,930 L 1404,974 L 1220,1008 L 1238,1040 L 1426,1006 L 1766,962 Z"
            fill="url(#chinMatteGrad)"
          />
          {/* Lighter top edge catching ambient Mars skylight */}
          <path d="M 172,931 L 516,974 L 696,1007" fill="none" stroke="#3a3634" strokeWidth="2" />
          <path d="M 1748,931 L 1404,974 L 1224,1007" fill="none" stroke="#473e38" strokeWidth="2.2" />

          {/* Central acoustic rebreather bridge */}
          <path
            d="M 866,1018 L 1054,1018 L 1078,1080 L 842,1080 Z"
            fill="#0d0e12"
            stroke="#23252c"
            strokeWidth="1.4"
          />
          <g stroke="#060709" strokeWidth="3.5" strokeLinecap="round">
            <line x1="365" y1="984" x2="430" y2="993" />
            <line x1="354" y1="996" x2="424" y2="1006" />
            <line x1="1555" y1="984" x2="1490" y2="993" />
            <line x1="1566" y1="996" x2="1496" y2="1006" />
          </g>
          <g stroke="#1b1d24" strokeWidth="2">
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
