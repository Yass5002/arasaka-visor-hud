import React from "react";

/**
 * Minimal glass optics layer:
 * Keeps the Mars panorama clean, clear, and true to the raw source image,
 * with only a very light outer-edge vignette to blend softly into the helmet rim.
 */
export const VisorOptics: React.FC = () => {
  return (
    <div className="visor-optics-layer" aria-hidden="true">
      <svg
        className="visor-optics-svg"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Very light vignette strictly at the extreme outer edges to blend into the rim */}
          <radialGradient id="glassVignette" cx="50%" cy="50%" r="68%">
            <stop offset="82%" stopColor="#040405" stopOpacity="0" />
            <stop offset="94%" stopColor="#040405" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#030304" stopOpacity="0.24" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="1920" height="1080" fill="url(#glassVignette)" />
      </svg>
    </div>
  );
};
