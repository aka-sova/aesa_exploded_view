# AESA Radar Lab — build contract (v2, post-critique)

Interactive "exploded view" web app of a traditional AESA (active electronically scanned array)
radar, modelled on the engine-lab demo at ivanainai.com/astra-engine: one Three.js WebGL scene,
procedural geometry only (no model files), one `explode` scalar that spreads the component stack,
HTML/CSS overlay UI. Vanilla ES modules, Vite, three@0.180.0. No React, no GSAP, no other deps.

Everything below is a CONTRACT. Modules are implemented in parallel by different people; they
must export exactly these names with exactly these shapes, and must only import what their
`imports:` line allows. If you need something that isn't in the contract, do not reach for it —
put a `// TODO(contract)` comment and keep the contract.

## Contract changes vs v1 (read first)

- Frequency is **9.5 GHz**, `LAMBDA = 0.0316` m, exported from `scan.js`. Phase fringes are computed
  on a λ/2 lattice (`k·d = π`), NOT on the scene pitch, and are encoded as **lightness of the
  quadrant's mode colour**, never as hue.
- `DOME_RADIUS = 10`, `EL_MAX = 50` → 28 × 12 = **336 cells**. Default camera moved so the whole
  dome is in frame. Camera presets renamed: `rear`, `front`, `plan`, `dome`.
- Part order changed: **cold plate now sits directly behind the T/R layer**, manifold behind it.
- Beam pointing is **discrete**: the search beam hops between cell centres (no slew), track beams
  re-point at 10 Hz jumps. `Beam` gains `origin`, `footprint`, `color`, `lastUpdate`, `hops`.
- Beamwidth: `BASE_BW = 4.2°`, broadens as `1/cosθ` with steer angle; gain falls as `cos^1.3 θ`
  and `(1 − failedFraction)`. **Failed modules do not widen the beam** — they lower gain and raise
  a diffuse sidelobe floor.
- Beam body is a **frustum from the subarray's phase centre** (not a cone from the origin).
  Pulses are **rings** (wavefronts); echoes are **white dots**. Detection happens when an echo is
  received (beams `onEcho`), not when the beam points. Dome cells get a faint continuous wash plus a
  full "splash" when a pulse ring arrives (`onPulseArrival`). No intensity-threshold "hot core".
- `createScheduler(elementsApi)` now takes the elements API; `ElementsApi` gains
  `activeCountByQuadrant(q)`, `setQuadrantHighlight(q)`. `createBeams`, `createDome`, scheduler all
  expose `reset()`. `buildAssembly()` returns `partMaterials` (materials are cloned per part).
- `SimState` gains `nulling`, `COLORS`; telemetry gains many fields (see state.js).
- `PATTERNS[p](t, out)`, `cellCenter(ci, out)`, `azElFromDir(dir, out)` use out-params (no per-frame
  object allocation).
- Signal-path lines animate by shifting a pre-allocated `lineDistance` attribute — `dashOffset`
  does not exist in r180 and `computeLineDistances()` must never run per frame.
- `InstancedMesh` has no per-instance opacity: all fades go through `instanceColor` under additive
  blending. Radome has **no transmission**. Post chain is `RenderPass → UnrealBloomPass → OutputPass`.
- Explicit `renderOrder` for every transparent object; `fog: false` on every additive/unlit material.
- New always-on **aperture inset** (face-on orthographic view, scissor-rendered) and **CSS2D part
  labels** when exploded. Subarray tiles are drawn as the front view and mirrored when the camera is
  behind the array.

## Scene conventions

- Units: 1 unit ≈ 1 m of scene (the array is drawn ~6× oversize for legibility). Right-handed, Y up.
- Boresight (array normal) is **+Z**. The aperture plate is centred at the origin in the X-Y plane;
  its front face (radiating elements) is at z = 0 facing +Z. Rear components stack towards −Z.
- Azimuth `az` (rad): rotation from boresight in the X-Z plane, positive towards **+X**.
  Elevation `el` (rad): positive towards **+Y**.
  Direction vector for (az, el): `d = (cos(el)·sin(az), sin(el), cos(el)·cos(az))`.
- Aperture: 2.4 × 2.4 units, **24 × 24 = 576 radiating elements** on `PITCH = 0.1`, element (ix, iy)
  centre at `x = (ix − 11.5)·0.1`, `y = (iy − 11.5)·0.1`, ix, iy ∈ [0, 23], ix increasing +X,
  iy increasing +Y. Physically these represent a λ/2 = 15.8 mm lattice.
- **4 quadrants** (subarrays), index `q = (ix < 12 ? 0 : 1) + (iy < 12 ? 0 : 2)`:
  q0 = lower-left (−X, −Y), q1 = lower-right (+X, −Y), q2 = upper-left, q3 = upper-right,
  **as seen from the front (+Z)**. Quadrant phase centres: `(±0.6, ±0.6, 0.05)`.
- Coverage dome: spherical shell sector of radius `DOME_RADIUS = 10`, centred at the origin,
  az ∈ [−70°, +70°], el ∈ [−10°, +50°] in **5° cells** → `AZ_CELLS = 28`, `EL_CELLS = 12`, 336 cells.
  `ci = elIndex·28 + azIndex`, `azIndex = floor((azDeg + 70)/5)`, `elIndex = floor((elDeg + 10)/5)`.
  Cells whose centre is more than `SCAN_MAX = 70°` off boresight (`acos(dir.z) > 70°`) are drawn at
  40 % of base colour and are never illuminated (outside the scan cone).
- Camera presets (`fov 45`, near 0.1, far 200):
  `rear` (default) `position (10, 7, −10.5)`, `target (0, 2, 2.5)`;
  `front` `(6, 3.5, 7)` → `(0, 0, −1)`; `plan` `(0.5, 14, 2)` → `(0, 0, 2)`;
  `dome` `(0, 6.5, −7)` → `(0, 3, 6)`.
- Colours are the single source of truth in `state.js`:
  `COLORS = { search: 0x2ee6d6, track: 0xf5a623, standby: 0x3a4a5a, detect: 0xffffff,
  fault: 0xe24b4a, signal: 0x7f77dd, control: 0x2ee6d6, dome: 0x0d1620, bg: 0x05080c }`.
- Glyph grammar (keep it everywhere, including the legend): **ring = wavefront/pulse**,
  **dot = echo/point return**, **octahedron = target (bracketed = tracked)**, teal = search,
  amber = track, white = detection, red = fault/jammer, purple = RF path, grey = standby.
- Visual exaggerations (must be stated in the HUD): beam drawn at `VIS_BEAM_SCALE = 2` × true
  width; 1 of ~100 pulses drawn; dwells ~10× slow.
- Performance: ≤ ~90 draw calls total (assembly ≤ 30, beams ≤ 15, dome ≤ 8, floor/labels ≤ 5,
  post ≈ 14), no per-frame allocations in update loops (module-scope scratch
  `Vector3/Quaternion/Matrix4/Color`), DPR capped at 1.5, 60 fps target on Intel Iris Xe.
  `InstancedMesh` for every repeated part; `mergeGeometries` (three/addons/utils/BufferGeometryUtils.js)
  for every static multi-piece part. Put `renderer.info.render.calls` in the footer next to FPS.
- Transparent render order (all `depthWrite: false`): assembly transparent parts 0, dome mesh 1,
  dome grid/meridians/pattern path 2, beam frusta + centre lines 3, pulses/echoes/jammer 4,
  target markers/brackets 5. `fog: false` on all of them; fog stays on the assembly + floor only.
- Colour handling: build every attribute/instance colour from `THREE.Color` instances (which
  linearise sRGB hex) and `toArray`/`setColorAt` them; never write raw 0–255 components. HDR values
  > 1 in a colour attribute are allowed and are how the bloom "hot" look is produced.

## File ownership (one owner each — do not edit files you don't own)

| File | Owner | Purpose | imports: |
|---|---|---|---|
| `index.html` | ui | Overlay UI DOM + `<div id="viewport">` | — |
| `vite.config.js` | ui | `build.chunkSizeWarningLimit: 900` | — |
| `src/style.css` | ui | HUD styling | — |
| `src/main.js` | ui | Bootstrap + RAF loop; wires every module | everything, plus three/addons (OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, RoomEnvironment, CSS2DRenderer/CSS2DObject) |
| `src/ui/panel.js` | ui | DOM ↔ `SimState` | `../sim/state.js`, `../data/parts.js` |
| `src/ui/telemetry.js` | ui | 2-D canvas strip chart | none |
| `src/sim/state.js` | ui | `SimState`, constants, `COLORS`, `ts` | none (no three) |
| `src/data/parts.js` | assembly | Parts catalogue | none |
| `src/radar/materials.js` | assembly | Material palette | three |
| `src/radar/assembly.js` | assembly | Component stack, explode, view modes, highlight, signal paths | three, BufferGeometryUtils, `../data/parts.js`, `./materials.js`, `./elements.js`, `../sim/state.js` (COLORS) |
| `src/radar/elements.js` | elements | Aperture face + T/R modules (instanced, phase fringes, modes, failures) | three, `../sim/state.js` (COLORS) |
| `src/radar/scan.js` | scan | Constants, az/el helpers, patterns, beam scheduler | three, `../sim/state.js` (COLORS) |
| `src/radar/beams.js` | beams | Beam frusta, pulse rings, echo dots, jammer, receive/transmit flashes | three, `./scan.js`, `../sim/state.js` (COLORS) |
| `src/radar/dome.js` | dome | Coverage dome cells, pattern path, target markers, tick labels | three, CSS2DObject, `./scan.js`, `../sim/targets.js`, `../sim/state.js` (COLORS) |
| `src/sim/targets.js` | dome | Target kinematics + detection bookkeeping | `../radar/scan.js` |

Dependency graph is acyclic: `scan`, `elements`, `targets`, `parts`, `materials`, `state`,
`telemetry` import no other project module except `state.js`/`scan.js` as listed.

## `src/sim/state.js` — `export class SimState`

Plain mutable data holder. No Three.js imports. All angles in **radians** unless a field name ends
in `Deg`.

```js
export const SCAN_PATTERNS = ['sector', 'raster', 'circular', 'spiral', 'agile'];
export const SCAN_LABELS = { sector: 'SECTOR', raster: 'RASTER (8-BAR)', circular: 'CIRCULAR (CUED ACQ.)', spiral: 'SPIRAL (ACQUISITION)', agile: 'AGILE (SEARCH + TRACK)' };
export const VIEW_MODES = ['assembled', 'cutaway', 'xray', 'signal'];
export const VIEW_LABELS = { assembled: 'ASSEMBLED VIEW', cutaway: 'SECTION VIEW', xray: 'X-RAY VIEW', signal: 'SIGNAL PATH' };
export const CAMERA_PRESETS = ['rear', 'front', 'plan', 'dome'];
export const QUADRANT_MODES = ['search', 'track', 'standby'];
export const COLORS = { search: 0x2ee6d6, track: 0xf5a623, standby: 0x3a4a5a, detect: 0xffffff, fault: 0xe24b4a, signal: 0x7f77dd, control: 0x2ee6d6, dome: 0x0d1620, bg: 0x05080c };

export class SimState {
  running = false;            // radiating. When false: no pulses, no dome splash, beams dim (pointing only)
  time = 0;                   // s, advanced by main only while running
  viewMode = 'assembled';
  explode = 0;                // smoothed 0..1 (main: ts(explode, explodeTarget, 6, dt))
  explodeTarget = 0;
  cameraPreset = 'rear';
  scanPattern = 'raster';
  prf = 1200;                 // Hz (200..4000)
  power = 60;                 // % (10..100)
  scanRate = 1;               // 0.25..3 multiplier on pattern time
  quadrantModes = ['search', 'search', 'search', 'search'];
  failedFraction = 0;         // 0 or 0.15 (button), 0..0.4 allowed
  jamming = false;
  nulling = false;            // adaptive null, only meaningful while jamming
  selectedPart = null;        // part id or null
  hoveredPart = null;
  hoveredQuadrant = null;     // 0..3 or null (tile hover)
  beams = [];                 // Array<Beam> — written by scan.js only
  targets = [];               // Array<Target> — assigned by main from createTargets(), mutated by targets.js/scheduler
  telemetry = {
    beamAzDeg: 0, beamElDeg: 0, steerAngleDeg: 0, beamwidthDeg: 4.2, scanLossDb: 0,
    activeElements: 576, activeSubarrays: 4, activeBeams: 0, tracked: 0, detected: 0,
    hops: 0, dwellMs: 0, pulsesPerDwell: 0,
    dutyCycle: 0.012, pulseWidthUs: 10, peakPowerKw: 0, avgPowerKw: 0, unambRangeKm: 125,
    eirpLossDb: 0, arrayTempC: 22, pulsesSent: 0, echoes: 0, mainbeamJam: false,
  };
  reset() { /* running=false, time=0, telemetry defaults, hoveredQuadrant=null; keeps view/camera/pattern/prf/power/quadrantModes/failedFraction/jamming */ }
}
export const ts = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
```

## `src/data/parts.js` — `export const PARTS`, `export const PART_IDS`

Array of 10 parts **front to back**: `{ id, code, name, description, design, metric, unit, offset }`.
`offset` = explode displacement along Z at explode = 1. Use these values and texts verbatim:

| code | id | name | offset | metric / unit | design | description |
|---|---|---|---|---|---|---|
| 01 | `radome` | Radome | +1.4 | LOSS / dB (constant 0.4) | A-SANDWICH DIELECTRIC · 0.4 dB LOSS | Low-loss dielectric sandwich shell protecting the aperture; tuned so X-band passes with ~0.4 dB one-way loss. |
| 02 | `aperture` | Radiating element array | 0 | STEER ANGLE / ° (`steerAngleDeg`) | 24 × 24 λ/2 LATTICE · WAIM SHEET | One radiator per T/R module on a half-wavelength lattice (15.8 mm at 9.5 GHz); the element pattern limits useful scan to ±60°. |
| 03 | `trm` | T/R module layer | −0.7 | ACTIVE MODULES / — (`activeElements`) | 576 GaN T/R MODULES · 12 W PEAK · 6-BIT PHASE | One T/R module per element: GaN power amp, LNA, limiter, 6-bit phase shifter and attenuator, reloaded by the BSC every beam. |
| 04 | `coldplate` | Cold plate & cooling manifold | −1.4 | ARRAY TEMP / °C (`arrayTempC`) | PAO LIQUID LOOP · 85 °C LIMIT | Liquid-cooled plate bonded to the T/R layer; removes the amplifier heat that otherwise limits duty cycle and module life. |
| 05 | `manifold` | RF manifold / beamformer | −2.1 | SUBARRAY PORTS / — (`activeSubarrays`) | 4 SUBARRAY PORTS · STRIPLINE COMBINER | Passive corporate feed combining each quadrant's 144 elements to a subarray port; four ports allow independent beams. |
| 06 | `bsc` | Beam steering controller | −2.8 | BEAM HOPS / — (`hops`) | µs BEAM SWITCHING · 6-BIT PHASE | Computes a phase and gain word for every module per beam position, so the beam can jump anywhere in microseconds. |
| 07 | `rex` | Receiver-exciter | −3.5 | PRF / Hz (`prf`) | COHERENT EXCITER · 9.5 GHz | Generates the coherent X-band waveform (PRF, pulse width, frequency agility) and down-converts received echoes. |
| 08 | `sdp` | Signal & data processor | −4.2 | TRACKS / — (`tracked`) | PULSE-DOPPLER · TRACK-WHILE-SCAN | Pulse compression, Doppler filtering and CFAR detection; runs the tracker and schedules search and track dwells. |
| 09 | `psu` | Power conditioning | −4.9 | AVG POWER / W (`avgPowerKw·1000`) | PULSED DC BUS · ENERGY STORAGE | Converts prime power to the pulsed high-current DC bus feeding the module amplifiers; stores energy for each pulse. |
| 10 | `chassis` | Backplane & chassis | −5.8 | MASS / kg (constant 640) | MACHINED AL BACKPLANE · TRUNNION | Backplane carrying RF, DC and control interconnects, with the trunnion mount used to reposition the fixed-face array. |

`metric` is the label, `unit` the suffix; `metricKey` is the telemetry key (or `null` with a
`metricConst` number for constants). Add `metricKey` and `metricConst` fields accordingly.

## `src/radar/materials.js`

```js
export function createMaterials(): Record<string, THREE.Material>
```
Keys: `silver, titanium, dark, shell, inner, gold, copper, coolant, pcb, radome, glass, element, trm`.
All `MeshStandardMaterial` (metalness 0.85–0.95, roughness 0.25–0.5; `coolant` teal-tinted metal,
`pcb` dark green 0x1e3a2a low metalness, `copper` 0xb87333) except:
- `radome`: `MeshPhysicalMaterial({ color 0xdfe6ee, roughness 0.35, metalness 0.05, clearcoat 1,
  transparent, opacity 0.55, depthWrite false, side DoubleSide })` — **no transmission**.
- `glass`: same recipe, opacity 0.3, colour 0xbfd8ff.
- `element`: `MeshStandardMaterial({ color 0xffffff, emissive 0xffffff, emissiveIntensity 0.6,
  roughness 0.6, metalness 0.2 })` with `onBeforeCompile` replacing `#include <emissivemap_fragment>`
  by `#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor;\n#endif`
  so the emissive term follows `instanceColor` (otherwise the fringes wash out grey).
- `trm`: same recipe as `element` with `emissiveIntensity 0.35`, roughness 0.4, metalness 0.7.
Every material records `userData.baseOpacity/baseTransparent/baseWireframe/baseDepthWrite` at
creation. `Material.clone()` deep-copies `userData`, so per-part clones keep these.

## `src/radar/assembly.js`

```js
export function buildAssembly(): {
  root: THREE.Group,
  materials: Record<string, THREE.Material>,          // palette (never mutated after build)
  partMaterials: Record<partId, THREE.Material[]>,     // per-part CLONES; view modes + highlight iterate these
  groups: Record<partId, THREE.Group>,                 // explode: group.position.z = offset · state.explode
  elements: ElementsApi,
  pickables: THREE.Object3D[],                         // plates/boxes only (NOT the instanced meshes); each has userData.partId
  setViewMode(mode): void,
  setHighlight(partId|null, hovered|null): void,       // emissive tint on that part's clones (strong / weak)
  flashHop(): void,                                    // BSC control path flashes (signal mode)
  flashReceive(colorHex): void,                        // aperture frame strips flash emissive in beam colour (e-fold 0.15 s)
  update(dt, state): void,
}
```
Geometry (front to back; primitives only; **merge** every static multi-piece part per material with
`mergeGeometries` so each part is 1–3 draw calls):
- **radome**: cap `SphereGeometry(1.45, 48, 16, 0, 2π, 0, 0.62)` then `.rotateX(Math.PI/2)` so the
  pole faces +Z, positioned so its rim sits at z ≈ +0.15; section variant uses
  `phiStart 2.35, phiLength 2π − 4.7`. Thin rim ring (Torus). Material `radome` (renderOrder 0).
- **aperture**: plate 2.6 × 2.6 × 0.08 (`titanium`) with `elements.face` as a child at z = +0.04;
  4 frame-border strips (merged, `silver`) that `flashReceive` tints — each quarter of the frame
  is a separate mesh group so the quarter next to a quadrant can be emissive-tinted in that
  quadrant's mode colour (see `update`); a WAIM sheet 2.5 × 2.5 × 0.02 `glass` at z = +0.06
  (hidden in xray); small `+X` / `−X` markers (two tiny boxes) on the strips.
- **trm**: backing plate 2.6 × 2.6 × 0.06 (`dark`) with `elements.modules` as a child; 4 quadrant
  separator bars (cross shape, merged) whose material is emissive-tinted per quadrant mode; 4 quadrant
  connectors (instanced cylinders) at the plate's rear.
- **coldplate**: plate 2.6 × 2.6 × 0.12 (`coolant`) with a 0.5 × 0.5 central cut-out (build the
  plate as a merged frame of 4 boxes), 16 × 16 instanced cooling pins on its +Z face reaching into
  the T/R layer, inlet/outlet pipes (2 merged tubes, `silver`) looping off the −X side.
- **manifold**: plate 2.4 × 2.4 × 0.05 (`pcb`) + corporate feed tree 1→4→16 (`copper` tubes,
  `LineCurve3` per straight run, 6 radial segs, ALL merged into one mesh) ending in stubs toward
  +Z through the cold plate's cut-out.
- **bsc**: box 2.2 × 0.5 × 0.35 (`shell`) with a `pcb` slab and 4 instanced connectors.
- **rex**: box 2.2 × 0.6 × 0.35 (`shell`) with a `pcb` slab and a `gold` oscillator can inside.
- **sdp**: box 2.2 × 0.8 × 0.4 (`shell`) with 16 heat-sink fins (instanced or merged) on top and a
  `pcb` slab inside.
- **psu**: box 2.2 × 0.6 × 0.45 (`dark`) with two `copper` toroids (merged).
- **chassis**: backplane 2.8 × 2.8 × 0.1 (`shell`); 4 corner longerons as `InstancedMesh(4)`
  whose `scale.z` is set in `update` so they always span backplane → aperture; trunnion pedestal
  below (2 cylinders + yoke, merged).
Every mesh sets `userData.partId`. Boxes get `full` and `section` geometries: section = the same box
with its +X/+Y corner notched (ONE merged L-shaped geometry or `ExtrudeGeometry` of a notched
`Shape`), so cutaway exposes the pcb slabs/internals. Plates: section variant likewise notched.
`setViewMode`: `cutaway` swaps to `section` geometries; `xray` sets on every part clone
`transparent = true`, `opacity` (shells/plates 0.08, others 0.35), `wireframe` on shells/plates,
`depthWrite = false`, hides WAIM; `signal` keeps assembled geometry, shells at opacity 0.25 and
shows the signal paths; `assembled` restores `userData.base*`.
Signal paths (visible only in `signal` mode, animate only when `state.running`): TWO non-indexed
`THREE.Line`s in `root` space with pre-allocated `position` and `lineDistance` attributes
(`DynamicDrawUsage`): RF path (purple `COLORS.signal`) rex → manifold → trm → aperture, and control
path (teal `COLORS.control`) bsc → 4 quadrant connectors on the trm plate. In `update`: rewrite
waypoints from the current `groups[id].position.z`, write cumulative distances plus a running
`dashPhase -= 2.5·dt` into `lineDistance`, set `needsUpdate`. `LineDashedMaterial({ dashSize 0.25,
gapSize 0.15, transparent, opacity 0.9, toneMapped: false, fog: false })`. `flashHop()` makes the
control path dash 6× faster and brighter for 100 ms. When an echo is received (main calls
`flashReceive`) run the RF dashes backwards for 0.3 s.
`update(dt, state)`: explode, longeron scale, signal dashes, quadrant-mode emissive tints on the
trm separator bars / aperture frame quarters (search teal 0.25, track amber 0.6, standby grey 0.1,
hoveredQuadrant ×1.3), receive-flash decay.

## `src/radar/elements.js`

```js
export const N = 24, PITCH = 0.1, ELEMENT_COUNT = 576;
export function elementIndex(ix, iy): number     // iy·24 + ix
export function quadrantOf(ix, iy): number
export function buildElements(materials): ElementsApi
ElementsApi = {
  face: THREE.Group,        // 576 instanced patches (CircleGeometry r 0.035 or 0.07 boxes, z = 0), on layers 0 AND 1, plus a thin square frame ring on layer 1 only
  modules: THREE.Group,     // 576 instanced boxes 0.085 × 0.085 × 0.25 centred z = 0
  update(dt, state): void,
  activeElementCount(): number,        // 576 − failed − standby-quadrant elements
  activeCountByQuadrant(q): number,    // 144 − failed in q (0 if standby)
  failedSet: Set<number>,
  pulseFlash(quadrants: number[]): void,   // 80 ms ×1.6 brightness on those quadrants' elements AND ×1.4 on their modules
  setQuadrantHighlight(q|null): void,
}
```
Colour rules (recompute instanceColor only when inputs changed: beam az/el per quadrant, modes,
failedFraction, flash, highlight):
- For quadrant q find its beam: the beam whose `quadrants` includes q (search or track). Steering
  phase on the λ/2 lattice, independent of scene pitch:
  `phase = −π·((ix − 11.5)·sin(az)·cos(el) + (iy − 11.5)·sin(el))`, quantised to 6 bits
  (`STEP = 2π/64`), wrapped to [0, 2π).
  Element colour = `modeColour · (0.35 + 0.65·(0.5 + 0.5·cos(phase)))` where modeColour is the
  beam's `color` (teal for search, amber for track). Result: parallel fringes perpendicular to the
  steer direction that tighten as the beam steers off boresight and visibly reload on every hop.
- Quadrant with no beam (standby): elements and modules flat `COLORS.standby`.
- Failed elements (deterministic seeded-LCG permutation of 0..575, first `round(f·576)` entries →
  stable, monotonic set): element black + scale 0.6, module `COLORS.fault` + `scale.z 0.4`.
- `pulseFlash` and `setQuadrantHighlight` multiply the affected instances' colours.
- Call `setColorAt` for every instance at build so `instanceColor` exists before the first render.
- `face` meshes call `layers.enable(1)` (the aperture inset renders layer 1 only).

## `src/radar/scan.js`

```js
export const FREQ_GHZ = 9.5, LAMBDA = 0.0316, BASE_BW = 4.2, VIS_BEAM_SCALE = 2;
export const DOME_RADIUS = 10, SCAN_MAX = 70 * deg;
export const AZ_MIN = -70, AZ_MAX = 70, EL_MIN = -10, EL_MAX = 50, CELL_DEG = 5, AZ_CELLS = 28, EL_CELLS = 12, CELL_COUNT = 336;
export const JAM_AZ = 40 * deg, JAM_EL = 15 * deg;
export const PULSE_SPEED = 12;             // units/s
export const TRACK_UPDATE_S = 0.1;
export const PATTERN_PERIOD = { sector: 6, raster: 16, circular: 4, spiral: 8, agile: 0 };
export const deg = Math.PI / 180;
export function dirFromAzEl(az, el, out = new THREE.Vector3()): THREE.Vector3
export function azElFromDir(dir, out = {az:0, el:0}): {az, el}
export function cellIndex(azRad, elRad): number   // −1 outside the rectangle
export function cellCenter(ci, out = {az:0, el:0}): {az, el}
export const PATTERNS: Record<string, (t: number, out: {az, el}) => {az, el}>   // radians, deterministic
export function createScheduler(elementsApi): { update(dt, state): void, reset(): void }
```
Patterns (degrees here, return radians; `tri(u)` = triangle wave −1..1 with period 1):
- `sector`: `az = 60·tri(t/6)`, `el = 10`.
- `raster`: `bar = floor(t/2) mod 8`, `az = 60·tri(t/2)·(bar even ? 1 : −1)`, `el = 5 + 5·bar`
  (8 bars 5°..40°, 2 s each, period 16 s) — a boustrophedon zigzag.
- `circular`: `az = 20·cos(2πt/4)`, `el = 22 + 15·sin(2πt/4)` (a loop around a cued position).
- `spiral`: `u = (t mod 8)/8`, `r = 28·u`, `θ = 8π·u`, `az = 1.6·r·cos θ`, `el = clamp(20 + r·sin θ, −9, 48)`.
- `agile`: new seeded-LCG position every 120 ms (`seed = floor(t/0.12)`), az ∈ [−60, 60],
  el ∈ [−8, 45] (all inside the 70° scan cone).

`Beam` record (mutated in place; identity stable; `state.beams` reordered only when the set changes):
```js
Beam = { id, type: 'search'|'track', color: number /* COLORS.search|track for THIS dwell */,
  az, el, dir: THREE.Vector3, origin: THREE.Vector3, footprint: number,
  widthDeg, gain, quadrants: number[], targetId: number|null, dwell: number, lastUpdate: number, hops: number }
```
Scheduler rules (deterministic, seeded LCG only):
1. All `search` quadrants pool into ONE search beam (id 0). Pointing is **discrete**: evaluate
   `PATTERNS[p](state.time·state.scanRate, out)`, take `ci = cellIndex(...)` (clamp az/el into the
   rectangle if −1); if `ci` differs from the current cell, jump `beam.az/el` to `cellCenter(ci)`,
   `dwell = 0`, `hops++`; else `dwell += dt`. No smoothing.
   In `agile`, when any target is `detected`, every 4th hop (`hops % 4 === 3`) is a **track dwell**
   on the most recently seen detected target: point at its az/el and set `beam.color = COLORS.track`
   for that dwell (`type` stays 'search'); otherwise `beam.color = COLORS.search`.
2. Each `track` quadrant forms its own track beam (id 1 + q), `color = COLORS.track`. Assignment:
   highest-`strength` detected target not yet tracked; if none, after 1.5 s of dwell acquire the
   detected target nearest boresight; if still none, the beam **circles boresight**
   (`az = 8°·cos(1.2t)`, `el = 8°·sin(1.2t)`) with `targetId = null` ("acquiring"). When assigned,
   re-point in **jumps** every `TRACK_UPDATE_S`: `beam.az/el = target.az/el`. Set
   `target.tracked = true, trackedBy = q`; release (clear both) if the target leaves coverage or the
   quadrant leaves `track`.
3. `standby` quadrants contribute nothing.
4. Per beam every frame: `origin` = mean of contributing quadrant phase centres `(±0.6, ±0.6, 0.05)`
   (recomputed only when `quadrants` changes); `footprint` = 0.6 / 0.85 / 1.0 / 1.2 for 1/2/3/4
   quadrants; `dir = dirFromAzEl(az, el, beam.dir)`; `cosT = max(dir.z, 0.34)`;
   `apertureElements = 144·quadrants.length`; `elementsUsed = Σ elementsApi.activeCountByQuadrant(q)`;
   `widthDeg = BASE_BW · sqrt(576 / apertureElements) / cosT`;
   `gain = (elementsUsed/576) · (state.power/100) · cosT^1.3 · (1 − state.failedFraction)`.
5. Telemetry: `beamAzDeg/beamElDeg/steerAngleDeg (= acos(dir.z)/deg)/beamwidthDeg/scanLossDb
   (= −13·log10(cosT))` from the search beam (or first track beam), `activeBeams`, `activeSubarrays`
   (quadrants not standby), `hops`, `dwellMs = searchBeam.dwell·1000`, `pulsesPerDwell =
   round(prf·dwell)`, `eirpLossDb = −20·log10(1 − failedFraction) − 20·log10(searchQuadrants/4)`,
   `tracked`, `detected` (counts over `state.targets`).
6. `reset()` clears dwell/hops/assignments and empties `state.beams`.

## `src/radar/beams.js`

```js
export function createBeams(scene, elementsApi): {
  group: THREE.Group,
  update(dt, state): void,
  reset(): void,
  onPulse: ((beam) => void) | null,                         // main: telemetry.pulsesSent++
  onPulseArrival: ((beam, dir, gain, colorHex) => void) | null,   // main → dome.splash(dir, gain, widthDeg, colorHex)
  onEcho: ((beam, target, snr) => void) | null,             // main → markIlluminated + dome.flashDetection + assembly.flashReceive
}
```
- **Beam body** per beam (keyed by `beam.id`, created/removed as the set changes; one `Group` per
  beam positioned at `beam.origin` and oriented with `group.lookAt(origin + dir)` so its +Z is the
  beam axis): an open **frustum** `BufferGeometry` (48 segments × 2 rings, non-indexed triangles or
  indexed) with base radius `footprint` at z = 0 and radius `footprint + DOME_RADIUS·tan(halfAngle)`
  at z = `DOME_RADIUS`, where `halfAngle = widthDeg/2 · VIS_BEAM_SCALE · deg`. Rewrite the vertex
  positions only when `widthDeg` or `footprint` changed by > 1e-3. Material `MeshBasicMaterial({
  vertexColors: true, side: DoubleSide, blending: AdditiveBlending, transparent, depthWrite: false,
  fog: false })` with vertex colour = beam colour × (1.0 at the aperture end → 0.25 at the dome
  end), material `opacity = 0.04 + 0.14·sqrt(gain)` (0.03 flat when `!running`). Plus a crisp centre
  `Line` (opacity 0.35; `LineDashedMaterial` while a track beam has `targetId === null`). Update the
  material colour when `beam.color` changes (agile track dwells flip teal → amber). renderOrder 3.
- **Pulse rings**: ONE `InstancedMesh` of `RingGeometry(0.82, 1, 48)` (facing +Z), `PULSE_MAX = 96`
  instances shared by all beams and the jammer; material `MeshBasicMaterial({ color 0xffffff,
  blending Additive, transparent, opacity 1, depthWrite false, fog false })`; per-instance fade is
  encoded in `instanceColor` (black adds nothing). Live pulse `{ beamId, dist, prevDist, dir, origin,
  colorHex, gain, widthDeg, footprint, type, isTail }`. `dist` advances at `PULSE_SPEED`; radius =
  `footprint + dist·tan(halfAngle)`; orientation `quaternion.setFromUnitVectors(+Z, dir)`; position
  `origin + dir·dist`; brightness 0.9 at emission → 0.45 at the dome (never lower). Each pulse has a
  **tail** instance at `dist − (0.25 + 0.05·pulseWidthUs/10)` at 40 % brightness. At emission
  (`dist = 0`) the ring IS the subarray footprint tilted by the steer angle — the phased wavefront.
  Spawn only when `state.running`: search beam `visualRate = 2 + 8·ln(prf/200)/ln(20)` per second,
  each track beam `visualRate/3`; on spawn call `elementsApi.pulseFlash(beam.quadrants)` and
  `onPulse?.(beam)`. When full, overwrite the oldest pulse. When `dist ≥ DOME_RADIUS` call
  `onPulseArrival?.(beam, dir, gain, colorHex)` and free the instance.
- **Echoes**: a second `InstancedMesh` of `SphereGeometry(0.11, 12, 8)` white, 32 instances, same
  additive recipe. When a pulse crosses a target's range (`prevDist < target.range ≤ dist`) and the
  target lies within `widthDeg·1.5·deg` (great-circle) of `pulse.dir`, compute
  `snr = gain · exp(−(Δθ/(0.6·widthDeg·deg))²) · target.rcs · (0.8·DOME_RADIUS/target.range)^4`;
  if `snr > 0.3` (search) or `> 0.15` (track), spawn an echo at `target.range·dirFromAzEl(target.az,
  target.el)` travelling to `beam.origin` at `PULSE_SPEED`, brightness `min(1, snr)`. On arrival call
  `onEcho?.(beam, target, snr)`. While jamming and `!nulling`, echoes from targets with
  `|azDeg − 40| < 10` are suppressed; while nulling only targets within `widthDeg` of the jammer are.
- **Sidelobe floor**: when `state.failedFraction > 0`, each beam gets one extra faint coaxial frustum
  with 4× the half-angle, same colour, opacity `0.05·(failedFraction/0.15)`.
- **Jammer** (`state.jamming`): a faint red frustum from `dirFromAzEl(JAM_AZ, JAM_EL)·DOME_RADIUS`
  pointing at the origin, and red rings (radius 0.8, from the shared pulse mesh) travelling inward at
  `PULSE_SPEED`, 4 per second. When any beam's dir is within `widthDeg·deg` of the jammer set
  `state.telemetry.mainbeamJam = true` (else false) and flash the receive indicator red via
  `onEcho`-independent path: expose nothing extra — main reads `mainbeamJam` and calls
  `assembly.flashReceive(COLORS.fault)` on its rising edge.
- `reset()` frees all pulses/echoes and removes beam groups.
All per-frame maths on module-scope scratch objects; renderOrder 4 on pulses/echoes/jammer.

## `src/sim/targets.js`

```js
export class Target { id; az; el; range; vaz; vel; rcs; detected = false; tracked = false; trackedBy = null; lastSeen = -Infinity; strength = 0; ping = 0 }
export function createTargets(count = 5): Target[]   // deterministic: rcs [0.5, 1, 2, 5, 20] m², ranges 0.6..0.92·DOME_RADIUS, spread across coverage, |vaz|,|vel| 1–4 °/s
export function updateTargets(dt, state): void        // drift (bounce inside az ±60°, el −5..45°), detected=false when time − lastSeen > 12 s (tracked targets stay detected), strength = ts(strength, 0, 0.3, dt), ping decays
export function markIlluminated(target, state, beamType, snr): void   // lastSeen = time, detected = true, strength = max(strength, min(1, snr)), ping = 1
export const rangeKm = (t) => t.range / DOME_RADIUS * 150
```

## `src/radar/dome.js`

```js
export function createDome(scene): {
  group: THREE.Group,
  update(dt, state): void,
  splash(dir: THREE.Vector3, gain: number, widthDeg: number, colorHex: number): void,   // full-strength illumination on pulse arrival
  flashDetection(ci: number): void,                                                      // white detection flash on a cell (e-fold 0.4 s)
  setPatternPath(points: Float32Array | null): void,                                     // dashed trajectory overlay (main samples PATTERNS)
  reset(): void,
}
```
- Cells: one `BufferGeometry` with 336 quads (indexed, 4 verts each) on the sphere of radius
  `DOME_RADIUS` and a Float32 `color` attribute (`DynamicDrawUsage`); `MeshBasicMaterial({
  vertexColors: true, side: DoubleSide, blending: AdditiveBlending, transparent, opacity: 1,
  depthWrite: false, fog: false })`, renderOrder 1. Precompute per cell: unit direction
  (`Float32Array(336·3)`), az/el, and `outsideScanCone` (`acos(dir.z) > SCAN_MAX`).
  Per cell state: `hot` (e-fold 0.35 s search / 0.25 s track), `trace` (e-fold 4 s, `trace =
  max(trace, hot)`), `det` (e-fold 0.4 s), `hotColor` (last colour). Vertex colour =
  `COLORS.dome·(outside ? 0.4 : 1) + hotColor·min(1, hot + 0.28·trace) + white·det·2` (HDR > 1 makes
  bloom produce the hot core). Rewrite the attribute only when something changed.
- `update`: decay; continuous **pointing wash** at `0.25·gain` for every beam in `state.beams`
  (when running; 0.06 when not); `splash` applies the full kernel: for cells with
  `Δθ = acos(clamp(dir·cellDir))` < `1.6·sigma`, `sigma = 0.6·widthDeg·VIS_BEAM_SCALE·deg`, add
  `gain·exp(−(Δθ/sigma)²)` into `hot` (cheap dot-product pre-test before acos; never for
  `outsideScanCone` cells). Sidelobe speckle: when `failedFraction > 0`, each frame add
  `0.08·(failedFraction/0.15)·gain` to a seeded-random 6 % of cells. Jamming: per cell `dJ` =
  great-circle to the jammer; `jam = 0.9·exp(−(dJ/6°)²) + (nulling ? 0 : 0.35·exp(−((azDeg−40)/8)²))`,
  × `(1 + 0.3·sin(2π·8·time))`, colour `COLORS.fault`, added to the vertex colour directly (never
  white); when nulling, cells within 8° of the jammer render at base colour with their grid outline
  red (a visible notch).
- Grid: `LineSegments` of all cell edges (opacity 0.12) + heavier meridians/parallels every 20°
  (opacity 0.3), renderOrder 2, `fog: false`. Tick labels: `Sprite`s with canvas textures (10 px
  mono, opacity 0.5) on the bottom rim every 20° az (`−60°`…`+60°`) and on the az = 0 meridian at
  0°, 20°, 40° el. HUD chip text lives in the UI, not here.
- Pattern path: a `Line` with `LineDashedMaterial({ dashSize 0.15, gapSize 0.12, color COLORS.search,
  opacity 0.22, transparent, depthWrite false, fog false })` at radius `DOME_RADIUS − 0.05`; set
  its position attribute from `setPatternPath(points)` (512 × 3 floats, pre-allocated; call
  `computeLineDistances()` only inside `setPatternPath`, never per frame); `null` hides it.
- Targets: `InstancedMesh` of `OctahedronGeometry(0.18)` (5 instances) at the **true 3-D position**
  `target.range·dirFromAzEl(az, el)`; undetected → scale 0; detected → white, brightness
  `1 − age/12` (age = time − lastSeen), scale pulses 1 → 1.6 → 1 over 0.3 s on `ping`; tracked →
  amber, steady, with a corner-bracket (`LineSegments`, 8 short segments) that follows it, and a
  `CSS2DObject` label `T{id} · {rangeKm} km · σ {rcs} m²` in amber 10 px mono, 0.3 units above.
  renderOrder 5. Markers never call `markIlluminated` — detection is driven by main from `onEcho`.
- `reset()` zeroes hot/trace/det, hides the bracket/labels.

## `src/main.js` (ui owner)

Bootstrap: renderer (`antialias`, `outputColorSpace SRGB`, `toneMapping ACESFilmic`, exposure 1.1,
`setPixelRatio(min(devicePixelRatio, 1.5))`, `?dpr=` query override) → scene (background
`COLORS.bg`, `FogExp2(COLORS.bg, 0.012)`, `scene.environment = pmrem.fromScene(new
RoomEnvironment(), 0.04).texture`, `scene.environmentIntensity = 0.5`) → camera 45°, near 0.1, far
200 → `OrbitControls` (damping, `minDistance 3`, `maxDistance 30`) → lights (hemisphere + 2
directional + rim from behind) → `GridHelper(40, 40)` very dark at y = −2.2 (fog on) →
`buildAssembly()` → `createScheduler(assembly.elements)` → `createBeams(scene, assembly.elements)`
→ `createDome(scene)` → `state.targets = createTargets()` → `EffectComposer`: `RenderPass` →
`UnrealBloomPass(new Vector2(w/2, h/2), 0.55, 0.4, 0.85)` → `OutputPass()`; on resize
`renderer.setSize`, `composer.setSize`, `composer.setPixelRatio(renderer.getPixelRatio())` →
`CSS2DRenderer` overlay (`pointer-events: none`, same size) for part labels and target labels →
part labels: one `CSS2DObject` per part (`"01  RADOME"`, 10 px mono uppercase) added to
`assembly.groups[id]` at local `(1.5, 0.9, 0)`, CSS opacity `smoothstep(0.35, 0.75, explode)`,
accent colour when hovered/selected; a dashed explode axis along Z (z −6…+2, opacity 0.15) shown
when explode > 0.35 → raycaster: `pointerDirty` flag on `pointermove`, raycast at most once per
frame with `intersectObjects(assembly.pickables, false)`; click sets `selectedPart`, hover
`hoveredPart`, cursor pointer → `mountPanel(state, api)`.
Wiring: `beams.onPulse = () => telemetry.pulsesSent++`; `beams.onPulseArrival = (b, dir, gain,
color) => dome.splash(dir, gain, b.widthDeg, color)`; `beams.onEcho = (b, t, snr) => {
markIlluminated(t, state, b.type, snr); dome.flashDetection(cellIndex(t.az, t.el));
assembly.flashReceive(b.color); telemetry.echoes++ }`; on the rising edge of `telemetry.mainbeamJam`
call `assembly.flashReceive(COLORS.fault)`; on every search-beam hop (`beams[0].hops` changed)
call `assembly.flashHop()`; when `state.scanPattern` changes sample `PATTERNS[p](t, out)` for 512
values of `t ∈ [0, PATTERN_PERIOD[p])` into a `Float32Array` at radius `DOME_RADIUS − 0.05` and
call `dome.setPatternPath(points)` (`null` for agile).
RAF loop: `dt = min(clock.getDelta(), 0.05)`; if running `state.time += dt`; `state.explode =
ts(explode, explodeTarget, 6, dt)`; `telemetry.activeElements = elements.activeElementCount()`;
update order **targets → scheduler → elements → assembly → beams → dome → telemetry derivations →
panel**; camera preset animation: lerp `camera.position` and `controls.target` with `ts(…, 3, dt)`
BEFORE `controls.update()`, cancelled on the controls `start` event; `composer.render()`; then the
**aperture inset**: `renderer.autoClear = false; setScissorTest(true); setViewport/setScissor` to a
200 × 200 px square at the viewport's bottom-right (above the bottom bar); `clearDepth()`; render
`scene` with an `OrthographicCamera(−1.45, 1.45, 1.45, −1.45, 0.1, 20)` at `(0, 0, 5)` looking at
the origin, `camera.layers.set(1)`; restore viewport/scissor/autoClear; then `cssRenderer.render`.
Telemetry derivations: `pulseWidthUs = 10`, `dutyCycle = prf·pulseWidthUs·1e-6`, `peakPowerKw =
0.012·activeElements·power/100`, `avgPowerKw = peakPowerKw·dutyCycle`, `unambRangeKm = 150000/prf`,
`arrayTempC = clamp(ts(arrayTempC, 22 + 65·(dutyCycle/0.04)·(activeElements/576)·(power/100),
0.15, dt), 22, 90)`. `api = { setViewMode, setCameraPreset, reset }` with `reset = state.reset();
scheduler.reset(); beams.reset(); dome.reset(); state.targets = createTargets()`. Keyboard: `Space`
toggles running, `1–4` view modes, `E` toggles explodeTarget 0 ↔ 1.

## `index.html` + `src/style.css` + `src/ui/panel.js` + `src/ui/telemetry.js` (ui owner)

```js
export function mountPanel(state, api): { update(state): void }     // panel.js
export function createStripChart(canvas): { push(azDeg, elDeg, tempC, t): void, draw(): void }  // telemetry.js; ResizeObserver-driven width, 76 CSS px tall, DPR-aware
```
Layout mirrors the engine-lab: full-viewport dark HUD (`#05080c` bg, `#e6edf3` text, `#2ee6d6`
accent, hairline borders `rgba(255,255,255,.08)`, uppercase 10–11 px letter-spaced monospace
micro-labels, 16–20 px sans headings, no emoji). Regions:
- **Top bar**: "AESA / X-BAND" wordmark; "ARRAY SYSTEMS / VIRTUAL TEST CELL 01"; status pill:
  `SYSTEM READY` (grey) / `RADIATING` (teal) / `DEGRADED −x.x dB` (amber, failedFraction > 0) /
  `JAMMED` (red) / `NULLED` (teal, jamming && nulling) / `OVERTEMP` (amber, arrayTempC > 80).
- **Left sidebar**: "01 VISUALIZATION" — Assembled / Cutaway / X-ray / Signal path;
  "02 CAMERA" — Rear / Front / Plan / Dome; "03 RADAR SYSTEMS" — the 10 parts (code + name), click
  selects, hover highlights.
- **Centre viewport**: `<div id="viewport">`; overlay headline "Aperture, exposed." with subtitle
  `${VIEW_LABELS[viewMode]} / 576 T/R MODULES / 4 SUBARRAYS`; idle chip "PRESS SPACE OR START TO
  RADIATE" until first start; bottom hint "DRAG TO ORBIT · SCROLL TO ZOOM · CLICK TO INSPECT";
  **beam roster** (bottom-left, one row per `state.beams` with a colour bar: `B0 SEARCH · Q0 Q1 Q2 ·
  RASTER 3/8 · 4.6° · 7 PPS` / `B4 TRACK · Q3 → T2 · 8.9° · DWELL 4.2 s` or `· ACQUIRING`; bar index
  from `(time·scanRate) mod PATTERN_PERIOD`); **legend chips** with the actual glyphs (`◯ teal —
  search beam / TX pulse`, `◯ amber — track beam`, `● white — echo / detection`, `◆ target
  (bracketed = tracked)`, `▪ red — fault / jammer`, `▪ purple — RF path`, `▪ teal dashes — steering
  commands`, `▪ grey — standby`); chip row "BEAM DRAWN 2× TRUE WIDTH · 1 OF 100 PULSES DRAWN ·
  DWELLS ~10× SLOW · COVERAGE AZ ±70° EL −10…50° · 5° CELLS"; label "APERTURE · FROM FRONT" over the
  inset square (bottom-right, 200 × 200, reserve the space with a bordered div).
- **Right panel**: "04 COMPONENT INSPECTOR" (selected part: code, name, description, design, live
  metric via `metricKey`/`metricConst`); "LIVE TELEMETRY": beam az/el, steer angle, beamwidth, scan
  loss, PRF, unambiguous range, duty, peak power, avg power, active elements, beams, tracks, hops,
  dwell, pulses/dwell, EIRP loss, array temp, pulses sent, echoes; `MAINBEAM JAM — RECEIVER
  SATURATED` warning row when `mainbeamJam`; the strip chart (beam az teal, el amber, temp red,
  rolling 60 s).
- **Bottom bar** (5 blocks): **Radar control** (Start/Stop, Reset); **Scan pattern** (5 segmented
  buttons with inline 28 × 16 SVG trajectory glyphs — line, zigzag, loop, spiral, scattered dots —
  labels from `SCAN_LABELS`, hint "BEAM HOPS IN µs — NO INERTIA · A REAL AESA TIME-SHARES THE FULL
  APERTURE BETWEEN SEARCH AND TRACK DWELLS", scan-rate slider 0.25–3×); **Emission** (PRF slider
  200–4000 Hz with hint "Rᵤ = c / 2·PRF", power slider 10–100 %, explode slider 0–100 %);
  **Subarray tasking**: 2×2 tiles drawn as the FRONT view (top row Q2 Q3, bottom Q0 Q1, caption
  "FRONT VIEW (+Z)"), mirrored horizontally (Q3 Q2 / Q1 Q0, caption "REAR VIEW") whenever
  `cameraPreset === 'rear'` or the camera's z < 0 (api exposes `isCameraBehind()`); each tile shows
  Q-number, mode word, 25 % mode-colour fill and full-colour border, `→ T2` when tracking, all search
  tiles share one outer outline (they pool into one beam); click cycles search → track → standby;
  hover shows the next mode and sets `state.hoveredQuadrant`; hint "SPLITTING THE FACE GIVES
  SIMULTANEOUS BEAMS BUT EACH LOSES 6 dB EIRP PER HALVING AND DOUBLES ITS BEAMWIDTH";
  **Failure simulation** ("Fail 15 % of T/R modules" toggles `failedFraction` 0 ↔ 0.15 with readout
  "EIRP −1.4 dB · SIDELOBE FLOOR ≈ −35 dB"; "Simulate jamming" toggles `jamming`; "Adaptive null"
  toggles `nulling`, enabled only while jamming).
- Footer: "CONCEPTUAL ENGINEERING VISUALIZATION" left; right "X-BAND 9.5 GHz / λ 31.6 mm /
  <calls> CALLS / <fps> FPS".
`panel.update(state)` writes DOM only when text changed.

## Definition of done

`npm run build` exits 0 with no warnings; `npm run dev` shows the assembled radar from the rear
preset with the entire dome (el ≤ 45°) and, at explode = 1, all 10 labelled layers inside a
1600 × 900 frame; the explode slider spreads the layers with smooth easing; Start makes the search
beam hop along the chosen pattern (the dashed pattern path visible on the dome) with ring pulses
travelling out, cells splashing on arrival and fading in two layers; echoes (white dots) return from
targets inside the beam and detections flash white on the dome cell and the aperture frame; a
quadrant switched to `track` grows an amber frustum from its own phase centre that acquires and
follows a detected target in 10 Hz jumps while its face quadrant shows amber fringes; `agile`
interleaves amber track dwells; failure/jamming/nulling change the picture as specified; X-ray,
cutaway and signal-path modes work; the aperture inset shows the fringes face-on; no console errors;
≥ 50 fps on an Intel Iris Xe at 1600 × 900 with ≤ 90 draw calls.
