# ARASAKA // EVA VISOR HUD

First-person astronaut extravehicular activity (EVA) helmet simulation with real-time collimated optical heads-up display (HUD) and depth-parallax terrain projection.

## Architecture

- **Visor Optics & HUD Projection**: Collimated projection optics rendered onto a 170° H × 120° V curved spherical visor dome mesh with Gaussian sampling, chromatic aberration falloff, and subtle secondary internal glass reflection.
- **Perspective Parallax**: Dual-plane Martian surface projection using depth maps (`mars-depth.png`) for real-time 3D motion parallax across eye translation and head rotation.
- **Physical Helmet Interior**: Procedural PBR materials (matte ballistic cowls, dual atmospheric regulator valves, tactical comms module, chin cushion, perimeter fasteners) rendered with distance-based Depth-of-Field.
- **Telemetry Display**: High-DPI offscreen canvas rendering real-time biometric vitals (O2 saturation, ambient pressure), coordinate tracking, radiation alerts, and system telemetry bars.

## Development

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Production build
npm run build
```

## Deployment

Live site: [https://nasa.yssn.tech](https://nasa.yssn.tech)
