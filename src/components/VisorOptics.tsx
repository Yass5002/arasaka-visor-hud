import React, { useEffect, useRef } from "react";

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
      if (time - lastTime > 55) {
        lastTime = time;
        for (let i = 0; i < data.length; i += 4) {
          const n = Math.random();
          const v = n > 0.5 ? 168 : 88;
          const a = Math.floor(Math.random() * 24);
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
      {/* Live subtle film grain */}
      <canvas ref={grainCanvasRef} className="visor-film-grain" />

      {/* Faint polycarbonate glass reflections, dust specks, and soft vignette */}
      <svg
        className="visor-optics-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="upperCurvedGlare" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="#f5cfa8" stopOpacity="0" />
            <stop offset="35%" stopColor="#f5cfa8" stopOpacity="0.055" />
            <stop offset="68%" stopColor="#d8b99c" stopOpacity="0.028" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="lowerBounceGlare" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#d99f73" stopOpacity="0" />
            <stop offset="48%" stopColor="#e4b28a" stopOpacity="0.042" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="glassVignette" cx="50%" cy="48%" r="60%">
            <stop offset="62%" stopColor="#050404" stopOpacity="0" />
            <stop offset="88%" stopColor="#070505" stopOpacity="0.26" />
            <stop offset="100%" stopColor="#020203" stopOpacity="0.58" />
          </radialGradient>

          <filter id="glassSoftBlur" x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="16" />
          </filter>

          <filter id="speckBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>

        {/* Soft lens/visor vignette */}
        <rect x="0" y="0" width="1920" height="1080" fill="url(#glassVignette)" />

        {/* Faint curved visor glass reflections (shift gently with head movement) */}
        <g className="visor-optics-reflections" filter="url(#glassSoftBlur)">
          {/* Upper right-sweeping polycarbonate skylight sheen */}
          <path
            d="M 280,82 C 680,44 1140,42 1580,104 C 1380,170 840,148 390,235 C 275,258 215,170 280,82 Z"
            fill="url(#upperCurvedGlare)"
          />
          {/* Subtle lower-left internal cheek/suit bounce arc */}
          <path
            d="M 150,790 C 260,885 480,930 760,945 C 540,975 300,955 155,895 C 110,875 110,820 150,790 Z"
            fill="url(#lowerBounceGlare)"
          />
          {/* Subtle right curved edge reflection */}
          <path
            d="M 1735,210 C 1810,330 1825,520 1775,715 C 1750,590 1755,390 1690,255 Z"
            fill="#ecc29a"
            fillOpacity="0.032"
          />
        </g>

        {/* A few subtle out-of-focus surface dust specks & faint micro-scratches near edges */}
        <g className="visor-optics-specks">
          <g filter="url(#speckBlur)" fill="#eed6be">
            <circle cx="218" cy="194" r="1.9" fillOpacity="0.22" />
            <circle cx="242" cy="212" r="1.1" fillOpacity="0.16" />
            <circle cx="310" cy="148" r="1.4" fillOpacity="0.14" />
            <circle cx="1635" cy="172" r="2.2" fillOpacity="0.24" />
            <circle cx="1674" cy="204" r="1.2" fillOpacity="0.18" />
            <circle cx="1548" cy="136" r="1.5" fillOpacity="0.16" />
            <circle cx="1712" cy="318" r="1.3" fillOpacity="0.15" />
            <circle cx="195" cy="742" r="1.8" fillOpacity="0.2" />
            <circle cx="264" cy="804" r="1.2" fillOpacity="0.15" />
            <circle cx="1668" cy="792" r="2.0" fillOpacity="0.2" />
            <circle cx="1592" cy="842" r="1.1" fillOpacity="0.14" />
            <circle cx="428" cy="872" r="1.3" fillOpacity="0.12" />
            <circle cx="1440" cy="158" r="1.0" fillOpacity="0.13" />
          </g>

          {/* Ultra-faint hairline micro-scratches catching low sun angle */}
          <g stroke="#f0d7be" strokeOpacity="0.085" strokeWidth="1" fill="none" strokeLinecap="round">
            <path d="M 1590,220 Q 1618,228 1642,244" />
            <path d="M 275,768 Q 298,776 314,790" />
            <path d="M 1495,848 Q 1522,844 1546,834" />
          </g>
        </g>
      </svg>
    </div>
  );
};
