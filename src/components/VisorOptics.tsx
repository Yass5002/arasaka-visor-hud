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
          <linearGradient id="diagonalSunGlare" x1="0.88" y1="0.06" x2="0.24" y2="0.72">
            <stop offset="0%" stopColor="#ffe1b8" stopOpacity="0.19" />
            <stop offset="30%" stopColor="#f6bc88" stopOpacity="0.095" />
            <stop offset="65%" stopColor="#df925c" stopOpacity="0.028" />
            <stop offset="100%" stopColor="#df925c" stopOpacity="0" />
          </linearGradient>

          {/* Secondary curved visor edge specular sweep */}
          <linearGradient id="curvedRimSpecular" x1="0.25" y1="0" x2="0.95" y2="0.55">
            <stop offset="0%" stopColor="#ffdfb8" stopOpacity="0" />
            <stop offset="55%" stopColor="#f8c28c" stopOpacity="0.055" />
            <stop offset="85%" stopColor="#f8c28c" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#ffdfb8" stopOpacity="0" />
          </linearGradient>

          {/* Ghost reflection gradient for helmet interior reflected on glass */}
          <linearGradient id="interiorGhostGrad" x1="0.5" y1="1" x2="0.5" y2="0">
            <stop offset="0%" stopColor="#edd0b2" stopOpacity="0.105" />
            <stop offset="50%" stopColor="#cfa98a" stopOpacity="0.048" />
            <stop offset="100%" stopColor="#b08b6e" stopOpacity="0" />
          </linearGradient>

          {/* Sun-proximity radial mask: dust specks & smudges ONLY catch light near upper-right sun */}
          <radialGradient id="sunProximityGrad" cx="78%" cy="17%" r="29%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="42%" stopColor="#d4d4d4" stopOpacity="0.62" />
            <stop offset="78%" stopColor="#2c2c2c" stopOpacity="0.10" />
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
              M 176,858
              C 295,884 480,896 692,918
              L 826,908 L 872,928 L 1048,928 L 1094,908 L 1228,918
              C 1440,896 1625,884 1744,858
              L 1706,808
              C 1580,845 1405,866 1222,880
              L 1086,870 L 1040,888 L 880,888 L 834,870 L 698,880
              C 515,866 340,845 214,808 Z
            "
            fill="url(#interiorGhostGrad)"
          />
          {/* Faint reflected rebreather rib ghost ticks */}
          <g stroke="#edd0b2" strokeOpacity="0.072" strokeWidth="4.5">
            <line x1="908" y1="892" x2="908" y2="922" />
            <line x1="942" y1="892" x2="942" y2="922" />
            <line x1="978" y1="892" x2="978" y2="922" />
            <line x1="1012" y1="892" x2="1012" y2="922" />
          </g>
          {/* Faint reflected upper brow edge ghost near top curve */}
          <path
            d="M 420,122 C 660,98 840,104 892,132 L 1028,132 C 1080,104 1260,98 1500,122 C 1270,136 1100,136 1028,154 L 892,154 C 820,136 650,136 420,122 Z"
            fill="#e8c3a2"
            fillOpacity="0.042"
          />
          {/* Faint curved side cheek/temple interior reflection along left & right edges */}
          <path
            d="M 108,290 C 148,405 158,575 126,745 C 98,640 94,460 108,290 Z"
            fill="#dec0a4"
            fillOpacity="0.052"
          />
          <path
            d="M 1812,290 C 1772,405 1762,575 1794,745 C 1822,640 1826,460 1812,290 Z"
            fill="#ecc9a8"
            fillOpacity="0.068"
          />
        </g>

        {/* ============================================================
            2. SOFT WARM DIAGONAL SUN GLARE ON THE CURVED GLASS
           ============================================================ */}
        <g className="visor-optics-reflections" filter="url(#glareBlur)">
          {/* Soft diagonal sunlight shaft across upper-right quadrant toward lower-mid-left */}
          <path
            d="M 1190,62 L 1780,104 L 1812,290 L 790,695 L 590,545 Z"
            fill="url(#diagonalSunGlare)"
          />
          {/* Subtle upper curved visor dome specular arc */}
          <path
            d="M 480,108 C 860,72 1280,82 1690,148 C 1460,188 1020,156 590,214 C 460,230 410,154 480,108 Z"
            fill="url(#curvedRimSpecular)"
          />
        </g>

        {/* ============================================================
            3. DUST SPECKS & SMUDGES (ONLY CATCHING LIGHT NEAR THE SUN)
           ============================================================ */}
        <g className="visor-optics-specks" mask="url(#sunProximityMask)">
          {/* Soft warm-lit translucent smudges near upper-right sun */}
          <g filter="url(#smudgeBlur)" fill="#ffe0bd">
            <ellipse cx="1495" cy="204" rx="72" ry="24" transform="rotate(-24 1495 204)" fillOpacity="0.075" />
            <ellipse cx="1605" cy="270" rx="50" ry="17" transform="rotate(-14 1605 270)" fillOpacity="0.065" />
            <ellipse cx="1362" cy="166" rx="46" ry="15" transform="rotate(-32 1362 166)" fillOpacity="0.055" />
          </g>

          {/* Few out-of-focus warm-lit dust specks catching sunlight near the sun */}
          <g filter="url(#dustBlur)" fill="#ffebd2">
            <circle cx="1420" cy="178" r="2.0" fillOpacity="0.54" />
            <circle cx="1468" cy="216" r="1.3" fillOpacity="0.46" />
            <circle cx="1524" cy="162" r="2.3" fillOpacity="0.62" />
            <circle cx="1558" cy="236" r="1.5" fillOpacity="0.48" />
            <circle cx="1612" cy="186" r="2.1" fillOpacity="0.58" />
            <circle cx="1645" cy="254" r="1.4" fillOpacity="0.46" />
            <circle cx="1690" cy="202" r="1.8" fillOpacity="0.52" />
            <circle cx="1585" cy="304" r="1.4" fillOpacity="0.38" />
            <circle cx="1340" cy="226" r="1.2" fillOpacity="0.36" />
            <circle cx="1725" cy="278" r="1.5" fillOpacity="0.42" />
            <circle cx="1475" cy="288" r="1.2" fillOpacity="0.36" />
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
