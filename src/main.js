import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { SimState, COLORS, ts, clamp } from './sim/state.js';
import { PARTS } from './data/parts.js';
import { buildAssembly } from './radar/assembly.js';
import { createScheduler, PATTERNS, PATTERN_PERIOD, DOME_RADIUS, dirFromAzEl, cellIndex } from './radar/scan.js';
import { createBeams } from './radar/beams.js';
import { createDome } from './radar/dome.js';
import { createTargets, updateTargets, markIlluminated } from './sim/targets.js';
import { mountPanel } from './ui/panel.js';
import { createStripChart } from './ui/telemetry.js';
import { tPart, onLangChange } from './i18n.js';

const PRESETS = {
  rear: { pos: [8.5, 6, -9], tgt: [0, 1.6, 2.5] },
  front: { pos: [6, 3.5, 7], tgt: [0, 0, -1] },
  plan: { pos: [0.5, 14, 2], tgt: [0, 0, 2] },
  dome: { pos: [0, 6.5, -7], tgt: [0, 3, 6] },
};
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- renderer / scene --------------------------------------------------------------------
const state = new SimState();
const viewport = document.getElementById('viewport');
const insetEl = document.getElementById('inset');
const dprOverride = parseFloat(new URLSearchParams(location.search).get('dpr'));
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(dprOverride || Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.info.autoReset = false;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.FogExp2(COLORS.bg, 0.012);
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  pmrem.dispose();
}

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);
camera.position.set(...PRESETS.rear.pos);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 3;
controls.maxDistance = 30;
controls.target.set(...PRESETS.rear.tgt);
const camGoal = { pos: new THREE.Vector3(...PRESETS.rear.pos), tgt: new THREE.Vector3(...PRESETS.rear.tgt), active: false };
controls.addEventListener('start', () => { camGoal.active = false; });

scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x0b0f14, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(5, 8, 6); scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc4ff, 0.5); fill.position.set(-6, 4, -4); scene.add(fill);
const rim = new THREE.DirectionalLight(0x2ee6d6, 0.8); rim.position.set(0, 3, -8); scene.add(rim);
const grid = new THREE.GridHelper(40, 40, 0x18222c, 0x0e151c);
grid.position.y = -2.2;
scene.add(grid);

// ---- modules -----------------------------------------------------------------------------
const assembly = buildAssembly();
scene.add(assembly.root);
const scheduler = createScheduler(assembly.elements);
const beams = createBeams(scene, assembly.elements);
const dome = createDome(scene);
state.targets = createTargets();

// ---- post-processing ---------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- CSS2D labels (parts + targets) ----------------------------------------------------------
const labelRenderer = new CSS2DRenderer();
Object.assign(labelRenderer.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '1' });
viewport.appendChild(labelRenderer.domElement);
const partLabels = [];
for (const p of PARTS) {
  const el = document.createElement('div');
  el.className = 'part-label';
  const obj = new CSS2DObject(el);
  obj.position.set(1.5, 0.9, 0);
  assembly.groups[p.id].add(obj);
  partLabels.push({ id: p.id, el, obj, opacity: -1, active: false, part: p });
}
const relabelParts = () => { for (const l of partLabels) l.el.textContent = `${l.part.code}  ${tPart(l.part, 'name').toUpperCase()}`; };
relabelParts();
onLangChange(relabelParts);
const explodeAxis = (() => {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([1.55, 1.0, 2, 1.55, 1.0, -6], 3));
  const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.15, depthWrite: false, fog: false }));
  l.computeLineDistances();
  l.visible = false;
  scene.add(l);
  return l;
})();

// ---- aperture inset camera -------------------------------------------------------------------
const insetCam = new THREE.OrthographicCamera(-1.45, 1.45, 1.45, -1.45, 0.1, 20);
insetCam.position.set(0, 0, 5);
insetCam.lookAt(0, 0, 0);
insetCam.layers.set(1);
const insetClear = new THREE.Color(0x080c12);

// ---- picking -----------------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(2, 2);
let pointerDirty = false, downX = 0, downY = 0, clickPending = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointerDirty = true;
});
renderer.domElement.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - downX, e.clientY - downY) < 4) clickPending = true;
});
renderer.domElement.addEventListener('pointerleave', () => { state.hoveredPart = null; });

function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(assembly.pickables, false);
  const id = hits.length ? hits[0].object.userData.partId : null;
  state.hoveredPart = id;
  renderer.domElement.style.cursor = id ? 'pointer' : '';
  if (clickPending) {
    clickPending = false;
    if (id) state.selectedPart = state.selectedPart === id ? null : id;
  }
}

// ---- wiring --------------------------------------------------------------------------------------
const tm = () => state.telemetry;
beams.onPulse = () => { tm().pulsesSent++; };
beams.onPulseArrival = (b, dir, gain, color) => dome.splash(dir, gain, b.widthDeg, color);
beams.onEcho = (b, t, snr) => {
  markIlluminated(t, state, b.type, snr);
  dome.flashDetection(cellIndex(t.az, t.el));
  assembly.flashReceive(b.color);
  tm().echoes++;
};

const pathBuf = new Float32Array(512 * 3);
const _azel = { az: 0, el: 0 };
const _v = new THREE.Vector3();
function samplePatternPath(pattern) {
  const period = PATTERN_PERIOD[pattern];
  if (!period) { dome.setPatternPath(null); return; }
  for (let k = 0; k < 512; k++) {
    PATTERNS[pattern]((k / 512) * period, _azel);
    dirFromAzEl(_azel.az, _azel.el, _v).multiplyScalar(DOME_RADIUS - 0.05);
    pathBuf[k * 3] = _v.x; pathBuf[k * 3 + 1] = _v.y; pathBuf[k * 3 + 2] = _v.z;
  }
  dome.setPatternPath(pathBuf);
}

function setCameraPreset(name) {
  state.cameraPreset = name;
  camGoal.pos.set(...PRESETS[name].pos);
  camGoal.tgt.set(...PRESETS[name].tgt);
  camGoal.active = true;
}
const api = {
  setViewMode(mode) { state.viewMode = mode; assembly.setViewMode(mode); },
  setCameraPreset,
  reset() {
    state.reset();
    scheduler.reset();
    beams.reset();
    dome.reset();
    state.targets = createTargets();
    lastHops = -1;
  },
  isCameraBehind: () => camera.position.z < 0,
  stats: () => stats,
};
const panel = mountPanel(state, api);
const chart = createStripChart(document.getElementById('strip-chart'));

// ---- resize ------------------------------------------------------------------------------------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  composer.setPixelRatio(renderer.getPixelRatio());
  bloom.resolution.set(w / 2, h / 2);
  labelRenderer.setSize(w, h);
}
new ResizeObserver(resize).observe(viewport);
resize();

// ---- loop --------------------------------------------------------------------------------------
const clock = new THREE.Clock();
const stats = { fps: 0, calls: 0 };
let frames = 0, fpsClock = 0, lastHops = -1, lastPattern = null, lastSel = null, lastHov = null, lastJam = false;

function tick(dt) {
  renderer.info.reset();
  if (state.running) state.time += dt;
  state.explode = ts(state.explode, state.explodeTarget, 6, dt);
  const t = state.telemetry;
  t.activeElements = assembly.elements.activeElementCount();

  if (state.scanPattern !== lastPattern) { lastPattern = state.scanPattern; samplePatternPath(lastPattern); }
  if (pointerDirty || clickPending) { pointerDirty = false; pick(); }
  if (state.selectedPart !== lastSel || state.hoveredPart !== lastHov) {
    lastSel = state.selectedPart; lastHov = state.hoveredPart;
    assembly.setHighlight(lastSel, lastHov);
  }

  updateTargets(dt, state);
  scheduler.update(dt, state);
  assembly.elements.update(dt, state);
  assembly.update(dt, state);
  beams.update(dt, state);
  dome.update(dt, state);

  const search = state.beams.length && state.beams[0].type === 'search' ? state.beams[0] : null;
  if (search && search.hops !== lastHops) { if (lastHops >= 0) assembly.flashHop(); lastHops = search.hops; }
  if (t.mainbeamJam && !lastJam) assembly.flashReceive(COLORS.fault);
  lastJam = t.mainbeamJam;

  // telemetry derivations
  t.pulseWidthUs = 10;
  t.dutyCycle = state.prf * t.pulseWidthUs * 1e-6;
  t.peakPowerKw = 0.012 * t.activeElements * (state.power / 100);
  t.avgPowerKw = t.peakPowerKw * t.dutyCycle;
  t.avgPowerW = t.avgPowerKw * 1000;
  t.unambRangeKm = 150000 / state.prf;
  const tTarget = state.running ? 22 + 65 * (t.dutyCycle / 0.04) * (t.activeElements / 576) * (state.power / 100) : 22;
  t.arrayTempC = clamp(ts(t.arrayTempC, tTarget, 0.15, dt), 22, 90);
  chart.push(t.beamAzDeg, t.beamElDeg, t.arrayTempC, state.time);

  // part labels + explode axis
  const op = smoothstep(0.35, 0.75, state.explode);
  for (const l of partLabels) {
    if (l.opacity !== op) { l.opacity = op; l.el.style.opacity = op.toFixed(3); }
    const active = l.id === state.selectedPart || l.id === state.hoveredPart;
    if (active !== l.active) { l.active = active; l.el.classList.toggle('active', active); }
  }
  explodeAxis.visible = state.explode > 0.35;

  // camera preset animation runs before controls.update so damping does not fight it
  if (camGoal.active) {
    const k = 1 - Math.exp(-3 * dt);
    camera.position.lerp(camGoal.pos, k);
    controls.target.lerp(camGoal.tgt, k);
    if (camera.position.distanceTo(camGoal.pos) < 0.01) camGoal.active = false;
  }
  controls.update();

  composer.render();

  // aperture inset (layer 1 only), scissor-rendered into the placeholder square
  {
    const cr = renderer.domElement.getBoundingClientRect();
    const ir = insetEl.getBoundingClientRect();
    const x = ir.left - cr.left, y = cr.bottom - ir.bottom, w = ir.width, h = ir.height;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.setClearColor(insetClear, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, insetCam);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cr.width, cr.height);
    renderer.autoClear = true;
  }
  labelRenderer.render(scene, camera);

  stats.calls = renderer.info.render.calls;
  frames++; fpsClock += dt;
  if (fpsClock >= 0.5) { stats.fps = Math.round(frames / fpsClock); frames = 0; fpsClock = 0; }
  panel.update(state);
}

function frame() {
  requestAnimationFrame(frame);
  tick(Math.min(clock.getDelta(), 0.05));
}

assembly.setViewMode(state.viewMode);
window.__lab = { state, renderer, scene, camera, assembly, beams, dome, scheduler, stats, api, step: (dt = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) tick(dt); } };
frame();
