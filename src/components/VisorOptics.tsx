import React, { useEffect, useRef } from "react";

/**
 * Physical visor glass optics layer:
 * - Faint ghost reflection of the helmet interior (chin-bar, rebreather & cheek silhouette)
 * - Soft warm diagonal glare from the Martian sun (zero green tint)
 * - Dust specks and smudges masked so they only catch light near the sun
 * - Subtle live photographic film grain canvas + soft optical vignette
 */
export const VisorOptics: React.FC = () => {
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = grainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 220;
    canvas.width = size;
    canvas.height = size;
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    let animId = 0;
    let lastTime = 0;

    const drawGrain = (time: number) => {
      if (time - lastTime > 60) {
        lastTime = time;
        for (let i = 0; i < data.length; i += 4) {
          const n = Math.random();
          const v = n > 0.5 ? 166 : 90;
          const a = Math.floor(Math.random() * 22);
          data[i] = v;
          data[i + 1] = v - 4;
          data[i + 2] = v - 8;
          data[i + 3] = a;
        }
        ctx.putImageData(imgData, 0, 0);
      }
      animId = requestAnimationFrame(drawGrain);
    };

    animId = requestAnimationFrame(drawGrain);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="visor-optics-layer" aria-hidden="true">
      {/* Live fine photographic film grain */}
      <canvas ref={grainCanvasRef} className="visor-film-grain" />

      <svg
        className="visor-optics-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Warm soft diagonal sunlight glare sweeping from upper-right sun */}
          <linearGradient id="diagonalSunGlare" x1="0.88" y1="0.06" x2="0.28" y2="0.68">
            <stop offset="0%" stopColor="#ffd7a8" stopOpacity="0.16" />
            <stop offset="32%" stopColor="#f5b47c" stopOpacity="0.075" />
            <stop offset="68%" stopColor="#df8f58" stopOpacity="0.022" />
            <stop offset="100%" stopColor="#df8f58" stopOpacity="0" />
          </linearGradient>

          {/* Secondary curved visor edge specular sweep */}
          <linearGradient id="curvedRimSpecular" x1="0.25" y1="0" x2="0.95" y2="0.55">
            <stop offset="0%" stopColor="#ffdfb8" stopOpacity="0" />
            <stop offset="55%" stopColor="#f8c28c" stopOpacity="0.048" />
            <stop offset="85%" stopColor="#f8c28c" stopOpacity="0.075" />
            <stop offset="100%" stopColor="#ffdfb8" stopOpacity="0" />
          </linearGradient>

          {/* Ghost reflection gradient for helmet interior reflected on glass */}
          <linearGradient id="interiorGhostGrad" x1="0.5" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor="#e8c3a0" stopOpacity="0.065" />
            <stop offset="45%" stopColor="#c9a586" stopOpacity="0.032" />
            <stop offset="100%" stopColor="#b08b6e" stopOpacity="0" />
          </linearGradient>

          {/* Sun-proximity radial mask: dust specks & smudges ONLY catch light near upper-right sun */}
          <radialGradient id="sunProximityGrad" cx="79%" cy="15%" r="32%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="45%" stopColor="#cccccc" stopOpacity="0.55" />
            <stop offset="82%" stopColor="#333333" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
          <mask id="sunProximityMask">
            <rect x="0" y="0" width="1920" height="1080" fill="url(#sunProximityGrad)" />
          </mask>

          {/* Soft optical lens vignette */}
          <radialGradient id="glassVignette" cx="50%" cy="48%" r="62%">
            <stop offset="64%" stopColor="#050404" stopOpacity="0" />
            <stop offset="90%" stopColor="#070505" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#020203" stopOpacity="0.48" />
          </radialGradient>

          <filter id="glareBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="24" />
          </filter>

          <filter id="ghostBlur" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="8" />
          </filter>

          <filter id="smudgeBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="11" />
          </filter>

          <filter id="dustBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.3" />
          </filter>
        </defs>

        {/* Soft lens/visor vignette */}
        <rect x="0" y="0" width="1920" height="1080" fill="url(#glassVignette)" />

        {/* ============================================================
            1. FAINT GHOST REFLECTION OF HELMET INTERIOR ON THE GLASS
               (soft upward-shifted reflection of chin-bar, bridge & cheek pads)
           ============================================================ */}
        <g className="visor-optics-reflections" filter="url(#ghostBlur)">
          {/* Faint reflected lower mandible & acoustic bridge ghost along bottom third */}
          <path
            d="
              M 160,885
              C 280,910 470,922 690,944
              L 825,934 L 875,952 L 1045,952 L 1095,934 L 1230,944
              C 1450,922 1640,910 1760,885
              L 1720,835
              C 1590,872 1410,892 1220,906
              L 1085,896 L 1038,912 L 882,912 L 835,896 L 700,906
              C 510,892 330,872 200,835 Z
            "
            fill="url(#interiorGhostGrad)"
          />
          {/* Faint reflected rebreather rib ghost ticks */}
          <g stroke="#e6c09c" strokeOpacity="0.045" strokeWidth="4">
            <line x1="912" y1="918" x2="912" y2="946" />
            <line x1="944" y1="918" x2="944" y2="946" />
            <line x1="976" y1="918" x2="976" y2="946" />
            <line x1="1008" y1="918" x2="1008" y2="946" />
          </g>
          {/* Faint curved side cheek/temple interior reflection along left & right edges */}
          <path
            d="M 105,310 C 145,420 155,585 125,750 C 98,645 92,470 105,310 Z"
            fill="#d6b496"
            fillOpacity="0.032"
          />
          <path
            d="M 1815,310 C 1775,420 1765,585 1795,750 C 1822,645 1828,470 1815,310 Z"
            fill="#e6be98"
            fillOpacity="0.042"
          />
        </g>

        {/* ============================================================
            2. SOFT WARM DIAGONAL SUN GLARE ON THE CURVED GLASS
           ============================================================ */}
        <g className="visor-optics-reflections" filter="url(#glareBlur)">
          {/* Soft diagonal sunlight shaft across upper-right quadrant toward center */}
          <path
            d="M 1180,35 L 1790,70 L 1820,260 L 820,660 L 610,510 Z"
            fill="url(#diagonalSunGlare)"
          />
          {/* Subtle upper curved visor dome specular arc */}
          <path
            d="M 480,68 C 860,34 1280,44 1690,108 C 1460,152 1020,118 590,178 C 460,196 410,118 480,68 Z"
            fill="url(#curvedRimSpecular)"
          />
        </g>

        {/* ============================================================
            3. DUST SPECKS & SMUDGES (ONLY CATCHING LIGHT NEAR THE SUN)
           ============================================================ */}
        <g className="visor-optics-specks" mask="url(#sunProximityMask)">
          {/* Soft warm-lit translucent smudges/finger-wipe haze near upper-right sun */}
          <g filter="url(#smudgeBlur)" fill="#ffd8b0">
            <ellipse cx="1495" cy="188" rx="74" ry="26" transform="rotate(-24 1495 188)" fillOpacity="0.065" />
            <ellipse cx="1605" cy="256" rx="52" ry="18" transform="rotate(-14 1605 256)" fillOpacity="0.055" />
            <ellipse cx="1360" cy="142" rx="48" ry="16" transform="rotate(-32 1360 142)" fillOpacity="0.045" />
          </g>

          {/* A few out-of-focus warm-lit dust specks near the sun */}
          <g filter="url(#dustBlur)" fill="#ffe4c4">
            <circle cx="1420" cy="152" r="1.8" fillOpacity="0.34" />
            <circle cx="1468" cy="196" r="1.1" fillOpacity="0.28" />
            <circle cx="1524" cy="138" r="2.2" fillOpacity="0.38" />
            <circle cx="1558" cy="218" r="1.4" fillOpacity="0.30" />
            <circle cx="1612" cy="166" r="1.9" fillOpacity="0.36" />
            <circle cx="1645" cy="238" r="1.2" fillOpacity="0.28" />
            <circle cx="1690" cy="184" r="1.6" fillOpacity="0.32" />
            <circle cx="1585" cy="292" r="1.3" fillOpacity="0.24" />
            <circle cx="1340" cy="210" r="1.1" fillOpacity="0.22" />
            <circle cx="1725" cy="264" r="1.4" fillOpacity="0.25" />
            <circle cx="1475" cy="272" r="1.0" fillOpacity="0.22" />
          </g>

          {/* Tiny hairline micro-scratches catching sun glare */}
          <g stroke="#ffe0bc" strokeOpacity="0.14" strokeWidth="1.1" fill="none" strokeLinecap="round">
            <path d="M 1510,192 Q 1542,202 1568,220" />
            <path d="M 1595,152 Q 1618,158 1636,170" />
          </g>
        </g>
      </svg>
    </div>
  );
};
