# Starborne Garden

A full-screen, red particle artwork with local ripples and gently shifting connections. A static site: no framework, dependencies, build step, accounts, or backend.

## Preview

Install Node.js 18 or newer, then run `npm start` and open http://127.0.0.1:4173. Set `PORT` to use another port. The preview server binds only to your computer and serves only the four public assets. Serve the site over HTTP rather than double-clicking `index.html`, because it uses JavaScript modules.

For deployment, upload `index.html`, `styles.css`, `app.mjs`, and `simulation.mjs` to any static host. Use HTTPS for device motion. The former `test.html` entry point is now `index.html`.

## Explore

- **Tap:** nearby stars ripple outward within 120 logical pixels.
- **Drag:** move at least 8 pixels to create a directional wake.
- **Hold:** after 500 ms, nearby connections dissolve for 1.5 seconds.
- **Pause / Resume:** freeze or resume the garden, including interaction effects.
- **Reset:** restore the original arrangement without changing pause or motion settings.
- **Device motion:** optionally enable gentle movement effects. Permission failures never block touch controls. Hardware support varies; some devices expose the API without supplying acceleration data.

Controls support keyboard navigation, visible focus, and screen-reader labels. Browser zoom remains enabled, including pinch zoom over the artwork. A second touch cancels artwork gestures. Reduced-motion preferences start the garden paused; Resume explicitly enables animation. Hidden tabs stop rendering. The instruction hint can be dismissed for the current page session.

## Configuration and structure

`simulation.mjs` contains particle state, elapsed-time updates, bounded forces, gesture classification, and spatial-grid neighbor searching. Adjust its `config` values to change particle count, connection distance, interaction radius, and gesture timing. The palette retains the original reds. `app.mjs` handles canvas rendering, controls, pointer capture, lifecycle, and optional sensor permission. `styles.css` handles the responsive presentation.

Rendering is capped at 2× device pixel ratio. The garden scales to fit narrow and short screens; connection distance scales with it. Input radius stays at 120 logical pixels. Frames are clamped to 50 ms to prevent jumps after stalls. Particle movement, ripple decay, reconnection timers, and trail opacity use elapsed time.

## Checks

Run `npm test` for deterministic simulation, refresh-rate equivalence, spatial-grid correctness, viewport fit, and gesture tests. Run `npm run benchmark` to compare grid search with exhaustive pair checks on the same seeded arrangement. This measures connection searching, not total frame time or browser FPS.

Before publishing, check a real phone for touch, pinch zoom, motion permission grant/denial, and sensor response. Also check reduced motion, keyboard controls, background-tab return, and portrait/landscape rotation. Browser emulation cannot validate physical device sensors.
