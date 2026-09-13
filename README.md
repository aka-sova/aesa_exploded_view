# AESA Radar Lab

Interactive exploded-view visualisation of a traditional AESA (active electronically scanned
array) radar, in the style of the "Astra engine" lab at ivanainai.com: one Three.js WebGL scene,
procedural geometry only, a single explode scalar that spreads the ten-layer component stack,
and an HTML/CSS overlay HUD.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
```

## What it shows

- **Component stack** (front to back): radome, radiating element array (24 × 24 elements),
  T/R module layer, cold plate, RF manifold / beamformer, beam steering controller,
  receiver-exciter, signal & data processor, power conditioning, backplane & chassis.
  The explode slider (or `E`) spreads them along boresight with labels.
- **View modes** (`1`–`4`): assembled, cutaway (geometry swap, no clipping planes), x-ray,
  and signal path (animated RF chain in purple, beam-steering commands in teal).
- **Beams**: a frustum from each subarray's phase centre. The search beam *hops* between
  discrete positions with a dwell per position (no inertia — the defining AESA behaviour);
  track beams re-point in 10 Hz jumps. Beamwidth broadens as 1/cos θ off boresight, gain
  falls as cos^1.3 θ.
- **Pulses**: travelling rings = wavefronts (a tilted plane at emission is the phased
  wavefront); white dots = echoes returning from targets; detection fires when the echo is
  received. Cells on the coverage dome get a faint wash while the beam points at them and a
  full splash when a pulse ring arrives, with a fast "hot" layer and a slow trace.
- **Scan patterns**: sector, 8-bar raster, circular (cued acquisition), spiral, agile
  (pseudo-random hops interleaved with track dwells every 4th hop). The dashed pattern path
  is drawn on the dome.
- **Subarray tasking**: each quadrant can be search / track / standby. Search quadrants pool
  into one beam; each track quadrant grows its own amber beam that acquires and follows a
  target. The face-on aperture inset shows the per-element phase fringes in each quadrant's
  mode colour.
- **Failure simulation**: 15 % T/R module failures (gain loss + diffuse sidelobe floor, no beam
  broadening), a noise jammer strobe, and an adaptive null.

Visual exaggerations are stated in the HUD: beams drawn at 2× true width, 1 of ~100 pulses
drawn, dwells ~10× slow.

## Antenna pattern

The **04 ANTENNA PATTERN** block in the left sidebar draws the array's live radiation pattern:
a translucent dB surface (0 dB = full uniform array, floor −40 dB) recomputed from all 576 element
states — steering phase, taper weight, failed modules, standby quadrants — on every beam hop, one
lobe per beam. Checkboxes toggle the search-beam lobe, the track-beam lobes and the az/el cut
plot; the **SPACING** slider (0.5–1.0 λ) admits grating lobes, the **TAPER** slider trades
sidelobe level for beamwidth and gain. The readout shows the measured −3 dB beamwidth, peak
sidelobe level and peak gain, and flags a grating lobe.

## Tutorial

The **TUTORIAL** button in the top bar starts a 16-station guided tour. Each station configures
the scene itself (camera, view mode, explode, scan pattern, subarray tasking, failure/jamming
state), highlights the relevant control, and explains one idea — from what an AESA is, through
phase steering, beamwidth and scan loss, pulses and echoes, the coverage dome and scan patterns,
search-plus-track by subarray and by time-sharing, the signal path, graceful degradation, jamming
and adaptive nulling, to duty cycle and heat. Navigate with Next / Back or ← →; Esc exits and
restores the settings you had before. Texts live in `src/i18n.tutorial.js` (English and Russian);
stations are defined in `src/ui/tutorial.js`.

## Themes

The **DARK / LIGHT** toggle in the top bar switches the HUD chrome; the choice is remembered per
browser and defaults to the OS preference. The 3-D viewport keeps its dark canvas in both themes
because the beam, pulse and dome glow are additive-blended and would clip to white on a light
background; overlays that float over the canvas keep their dark styling for the same reason.

## Text size

The **A− / 100% / A+** control in the top bar scales the whole HUD between 80 % and 140 % (the 3-D
viewport takes whatever space remains). The choice is remembered per browser; click the percentage
to reset.

## Languages

The HUD is available in **English** and **Russian**; the EN / RU toggle sits in the top bar next
to the status pill. The choice is remembered in `localStorage` and the initial language follows
the browser locale. All strings live in `src/i18n.js` — add a language by adding a dictionary
there and its code to `LANGS`; static HTML is labelled with `data-i18n="key"` and the
parts catalogue is translated per field (`part.<id>.name|description|design|metric`).

## Layout

| File | Purpose |
|---|---|
| `SPEC.md` | The build contract every module follows |
| `src/main.js` | Bootstrap, render loop, post-processing, aperture inset, wiring |
| `src/sim/state.js` | `SimState` — the single mutable data holder |
| `src/sim/targets.js` | Target kinematics and detection bookkeeping |
| `src/radar/scan.js` | Constants, az/el helpers, scan patterns, beam scheduler |
| `src/radar/elements.js` | Instanced aperture elements + T/R modules (phase fringes, failures) |
| `src/radar/assembly.js` | Procedural component stack, explode, view modes, signal paths |
| `src/radar/beams.js` | Beam frusta, pulse rings, echoes, jammer |
| `src/radar/dome.js` | Coverage dome cells, pattern path, target markers |
| `src/radar/pattern.js`, `src/radar/taper.js` | Live array-factor pattern (3-D lobes, az/el cuts, metrics) |
| `src/ui/patternplot.js` | 2-D pattern-cut plot |
| `src/ui/panel.js`, `src/ui/telemetry.js` | HUD bindings and the strip chart |
| `src/i18n.js`, `src/i18n.tutorial.js` | English / Russian dictionaries, `t()`, language toggle |
| `src/ui/tutorial.js` | Guided tour: stations, scene setup, highlights, navigation |
| `src/ui/fontsize.js` | HUD text-size control (root font-size, rem-based layout) |
| `src/ui/theme.js` | Dark / light theme toggle (`data-theme` on `<html>`, CSS tokens) |

`?dpr=1` in the URL forces a 1× pixel ratio for slower GPUs. `window.__lab` exposes the state
and modules for debugging; `__lab.step(dt, n)` advances the simulation deterministically.
