// Coverage dome: 336 az/el cells on a spherical shell that light up under the beams (a faint
// continuous wash plus a full splash when a pulse ring arrives), the dashed pattern path,
// jammer strobe, and target markers at their true 3-D positions.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  DOME_RADIUS, AZ_MIN, AZ_MAX, EL_MIN, EL_MAX, CELL_DEG, AZ_CELLS, EL_CELLS, CELL_COUNT, SCAN_MAX,
  VIS_BEAM_SCALE, JAM_AZ, JAM_EL, deg, dirFromAzEl,
} from './scan.js';
import { rangeKm } from '../sim/targets.js';
import { COLORS } from '../sim/state.js';
import { t } from '../i18n.js';

const MAX_TARGETS = 5;
const PATH_POINTS = 512;
const TAU_TRACE = 4, TAU_DET = 0.4;
const _dir = new THREE.Vector3();
const _v = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const BASE = new THREE.Color(COLORS.dome);
const FAULT = new THREE.Color(COLORS.fault);
const WHITE = new THREE.Color(0xffffff);
const AMBER = new THREE.Color(COLORS.track);
const JAM_DIR = dirFromAzEl(JAM_AZ, JAM_EL, new THREE.Vector3());

function additiveMaterial(extra = {}) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 1, depthWrite: false, fog: false, ...extra,
  });
}

function textSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 26px "Geist Mono", "JetBrains Mono", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(230,237,243,0.95)';
  ctx.fillText(text, 64, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
  sprite.scale.set(0.9, 0.34, 1);
  sprite.renderOrder = 2;
  return sprite;
}

function bracketGeometry(half = 0.32, arm = 0.12) {
  const p = [];
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    p.push(sx * half, sy * half, 0, sx * (half - arm), sy * half, 0);
    p.push(sx * half, sy * half, 0, sx * half, sy * (half - arm), 0);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}

export function createDome(scene) {
  const group = new THREE.Group();
  group.name = 'dome';
  scene.add(group);

  // ---- cells ------------------------------------------------------------------------------
  const positions = new Float32Array(CELL_COUNT * 12);
  const colors = new Float32Array(CELL_COUNT * 12);
  const index = new Uint16Array(CELL_COUNT * 6);
  const cellDir = new Float32Array(CELL_COUNT * 3);
  const cellAzDeg = new Float32Array(CELL_COUNT);
  const cellElDeg = new Float32Array(CELL_COUNT);
  const outside = new Uint8Array(CELL_COUNT);
  const gridPos = new Float32Array(CELL_COUNT * 24);
  const gridCol = new Float32Array(CELL_COUNT * 24);

  for (let ci = 0; ci < CELL_COUNT; ci++) {
    const a = ci % AZ_CELLS, e = (ci - a) / AZ_CELLS;
    const az0 = (AZ_MIN + a * CELL_DEG) * deg, az1 = az0 + CELL_DEG * deg;
    const el0 = (EL_MIN + e * CELL_DEG) * deg, el1 = el0 + CELL_DEG * deg;
    const corners = [[az0, el0], [az1, el0], [az1, el1], [az0, el1]];
    for (let k = 0; k < 4; k++) {
      dirFromAzEl(corners[k][0], corners[k][1], _dir).multiplyScalar(DOME_RADIUS);
      positions.set([_dir.x, _dir.y, _dir.z], ci * 12 + k * 3);
      const n = (k + 1) % 4;
      dirFromAzEl(corners[n][0], corners[n][1], _v).multiplyScalar(DOME_RADIUS);
      gridPos.set([_dir.x, _dir.y, _dir.z, _v.x, _v.y, _v.z], ci * 24 + k * 6);
    }
    index.set([ci * 4, ci * 4 + 1, ci * 4 + 2, ci * 4, ci * 4 + 2, ci * 4 + 3], ci * 6);
    cellAzDeg[ci] = AZ_MIN + (a + 0.5) * CELL_DEG;
    cellElDeg[ci] = EL_MIN + (e + 0.5) * CELL_DEG;
    dirFromAzEl(cellAzDeg[ci] * deg, cellElDeg[ci] * deg, _dir);
    cellDir.set([_dir.x, _dir.y, _dir.z], ci * 3);
    outside[ci] = Math.acos(Math.min(1, _dir.z)) > SCAN_MAX ? 1 : 0;
  }
  gridCol.fill(1);

  const cellGeo = new THREE.BufferGeometry();
  cellGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  cellGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  cellGeo.setIndex(new THREE.BufferAttribute(index, 1));
  const cells = new THREE.Mesh(cellGeo, additiveMaterial());
  cells.renderOrder = 1;
  cells.frustumCulled = false;
  group.add(cells);

  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute('position', new THREE.BufferAttribute(gridPos, 3));
  gridGeo.setAttribute('color', new THREE.BufferAttribute(gridCol, 3).setUsage(THREE.DynamicDrawUsage));
  const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.12, depthWrite: false, fog: false,
  }));
  grid.renderOrder = 2;
  grid.frustumCulled = false;
  group.add(grid);

  // heavier meridians / parallels every 20°
  {
    const p = [];
    const push = (az, el) => { dirFromAzEl(az * deg, el * deg, _dir).multiplyScalar(DOME_RADIUS + 0.01); p.push(_dir.x, _dir.y, _dir.z); };
    for (let az = -60; az <= 60; az += 20) {
      for (let el = EL_MIN; el < EL_MAX; el += 2.5) { push(az, el); push(az, el + 2.5); }
    }
    for (let el = 0; el <= 40; el += 20) {
      for (let az = AZ_MIN; az < AZ_MAX; az += 2.5) { push(az, el); push(az + 2.5, el); }
    }
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, fog: false }));
    lines.renderOrder = 2;
    lines.frustumCulled = false;
    group.add(lines);
    for (let az = -60; az <= 60; az += 20) {
      const s = textSprite(`${az > 0 ? '+' : ''}${az}°`);
      dirFromAzEl(az * deg, -13.5 * deg, _dir).multiplyScalar(DOME_RADIUS);
      s.position.copy(_dir);
      group.add(s);
    }
    for (let el = 0; el <= 40; el += 20) {
      const s = textSprite(`${el}°`);
      dirFromAzEl(-73.5 * deg, el * deg, _dir).multiplyScalar(DOME_RADIUS);
      s.position.copy(_dir);
      group.add(s);
    }
  }

  // ---- pattern path -----------------------------------------------------------------------
  const pathGeo = new THREE.BufferGeometry();
  pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PATH_POINTS * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const path = new THREE.Line(pathGeo, new THREE.LineDashedMaterial({
    dashSize: 0.15, gapSize: 0.12, color: COLORS.search, opacity: 0.22, transparent: true, depthWrite: false, fog: false,
  }));
  path.renderOrder = 2;
  path.frustumCulled = false;
  path.visible = false;
  group.add(path);

  // ---- targets ----------------------------------------------------------------------------
  const markers = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({
    color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
  }), MAX_TARGETS);
  markers.renderOrder = 5;
  markers.frustumCulled = false;
  markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < MAX_TARGETS; i++) { markers.setMatrixAt(i, _m); markers.setColorAt(i, WHITE); }
  markers.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(markers);

  const brackets = [], labels = [];
  const bracketGeo = bracketGeometry();
  const bracketMat = new THREE.LineBasicMaterial({ color: COLORS.track, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
  for (let i = 0; i < MAX_TARGETS; i++) {
    const b = new THREE.LineSegments(bracketGeo, bracketMat);
    b.renderOrder = 5;
    b.visible = false;
    group.add(b);
    brackets.push(b);
    const el = document.createElement('div');
    el.className = 'dome-label';
    const label = new CSS2DObject(el);
    label.visible = false;
    group.add(label);
    labels.push({ obj: label, el, text: '' });
  }

  // ---- per-cell state -----------------------------------------------------------------------
  const hot = new Float32Array(CELL_COUNT);
  const hotTau = new Float32Array(CELL_COUNT).fill(0.35);
  const trace = new Float32Array(CELL_COUNT);
  const det = new Float32Array(CELL_COUNT);
  const hotR = new Float32Array(CELL_COUNT), hotG = new Float32Array(CELL_COUNT), hotB = new Float32Array(CELL_COUNT);
  const jam = new Float32Array(CELL_COUNT);
  let dirty = true, notchApplied = false, speckleSeed = 1;

  // Gaussian footprint of a beam pointing along `dir`; `splash` adds, otherwise acts as a floor.
  function kernel(dir, gain, widthDeg, colorHex, splash) {
    const sigma = 0.6 * widthDeg * VIS_BEAM_SCALE * deg;
    const cosLimit = Math.cos(1.6 * sigma);
    const tau = colorHex === COLORS.track ? 0.25 : 0.35;
    _c.setHex(colorHex);
    for (let i = 0; i < CELL_COUNT; i++) {
      if (outside[i]) continue;
      const dot = dir.x * cellDir[i * 3] + dir.y * cellDir[i * 3 + 1] + dir.z * cellDir[i * 3 + 2];
      if (dot < cosLimit) continue;
      const d = Math.acos(dot > 1 ? 1 : dot) / sigma;
      const k = gain * Math.exp(-d * d);
      if (k < 0.01) continue;
      if (splash) hot[i] = Math.min(1, hot[i] + k);
      else if (k > hot[i]) hot[i] = k;
      if (k > 0.1 || hot[i] < 0.05) { hotR[i] = _c.r; hotG[i] = _c.g; hotB[i] = _c.b; hotTau[i] = tau; }
      dirty = true;
    }
  }

  function splash(dir, gain, widthDeg, colorHex) { kernel(dir, gain, widthDeg, colorHex, true); }
  function flashDetection(ci) { if (ci >= 0 && ci < CELL_COUNT) { det[ci] = 1; dirty = true; } }

  function setPatternPath(points) {
    if (!points) { path.visible = false; return; }
    pathGeo.attributes.position.array.set(points.subarray(0, PATH_POINTS * 3));
    pathGeo.attributes.position.needsUpdate = true;
    pathGeo.computeBoundingSphere();
    path.computeLineDistances();
    path.visible = true;
  }

  function applyNotch(on) {
    const cosR = Math.cos(8 * deg);
    for (let i = 0; i < CELL_COUNT; i++) {
      const dot = JAM_DIR.x * cellDir[i * 3] + JAM_DIR.y * cellDir[i * 3 + 1] + JAM_DIR.z * cellDir[i * 3 + 2];
      const red = on && dot > cosR;
      for (let k = 0; k < 8; k++) {
        gridCol[i * 24 + k * 3] = red ? 3 : 1;
        gridCol[i * 24 + k * 3 + 1] = red ? 0.35 : 1;
        gridCol[i * 24 + k * 3 + 2] = red ? 0.35 : 1;
      }
    }
    gridGeo.attributes.color.needsUpdate = true;
  }

  function writeColors(time, jamming, nulling) {
    for (let i = 0; i < CELL_COUNT; i++) {
      const base = outside[i] ? 0.4 : 1;
      const lit = Math.min(1, hot[i] + 0.28 * trace[i]);
      const dv = det[i] * 2;
      let r = BASE.r * base + hotR[i] * lit + dv, g = BASE.g * base + hotG[i] * lit + dv, b = BASE.b * base + hotB[i] * lit + dv;
      if (jamming) {
        const j = jam[i];
        r += FAULT.r * j; g += FAULT.g * j; b += FAULT.b * j;
      }
      for (let k = 0; k < 4; k++) { const o = i * 12 + k * 3; colors[o] = r; colors[o + 1] = g; colors[o + 2] = b; }
    }
    cellGeo.attributes.color.needsUpdate = true;
  }

  function updateTargets(state) {
    for (let i = 0; i < MAX_TARGETS; i++) {
      const tg = state.targets[i];
      const label = labels[i];
      if (!tg || (!tg.detected && !tg.tracked)) {
        _m.makeScale(0, 0, 0);
        markers.setMatrixAt(i, _m);
        brackets[i].visible = false;
        label.obj.visible = false;
        continue;
      }
      dirFromAzEl(tg.az, tg.el, _dir).multiplyScalar(tg.range);
      const sc = 1 + 0.6 * Math.sin(Math.PI * (1 - tg.ping));
      _s.setScalar(sc);
      _q.identity();
      markers.setMatrixAt(i, _m.compose(_dir, _q, _s));
      if (tg.tracked) {
        markers.setColorAt(i, AMBER);
        brackets[i].visible = true;
        brackets[i].position.copy(_dir);
        brackets[i].lookAt(0, 0, 0);
        label.obj.visible = true;
        label.obj.position.copy(_dir).y += 0.4;
        const text = t('dome.target', { id: tg.id, km: rangeKm(tg).toFixed(1), rcs: tg.rcs });
        if (text !== label.text) { label.text = text; label.el.textContent = text; }
      } else {
        const age = Math.max(0, state.time - tg.lastSeen);
        markers.setColorAt(i, _c.copy(WHITE).multiplyScalar(Math.max(0.15, 1 - age / 12)));
        brackets[i].visible = false;
        label.obj.visible = false;
      }
    }
    markers.instanceMatrix.needsUpdate = true;
    markers.instanceColor.needsUpdate = true;
  }

  function update(dt, state) {
    const decayTrace = Math.exp(-dt / TAU_TRACE), decayDet = Math.exp(-dt / TAU_DET);
    let active = false;
    for (let i = 0; i < CELL_COUNT; i++) {
      if (hot[i] > 0.001) { hot[i] *= Math.exp(-dt / hotTau[i]); active = true; } else hot[i] = 0;
      if (trace[i] > 0.001) { trace[i] *= decayTrace; active = true; } else trace[i] = 0;
      if (det[i] > 0.001) { det[i] *= decayDet; active = true; } else det[i] = 0;
    }
    if (active) dirty = true;

    const wash = state.running ? 0.25 : 0.06;
    for (const b of state.beams) kernel(b.dir, b.gain * wash, b.widthDeg, b.color, false);

    if (state.failedFraction > 0 && state.running) {
      const g = state.beams.length ? state.beams[0].gain : 0;
      const amp = 0.08 * (state.failedFraction / 0.15) * g;
      for (let k = 0; k < 20; k++) {
        speckleSeed = (Math.imul(speckleSeed, 1664525) + 1013904223) >>> 0;
        const i = speckleSeed % CELL_COUNT;
        if (outside[i] || hot[i] >= amp) continue;
        hot[i] = amp; hotR[i] = 0.18; hotG[i] = 0.9; hotB[i] = 0.84; hotTau[i] = 0.35;
      }
      dirty = true;
    }
    for (let i = 0; i < CELL_COUNT; i++) if (hot[i] > trace[i]) trace[i] = hot[i];

    if (state.jamming) {
      const flicker = 1 + 0.3 * Math.sin(2 * Math.PI * 8 * state.time);
      for (let i = 0; i < CELL_COUNT; i++) {
        const dot = JAM_DIR.x * cellDir[i * 3] + JAM_DIR.y * cellDir[i * 3 + 1] + JAM_DIR.z * cellDir[i * 3 + 2];
        const dJ = Math.acos(dot > 1 ? 1 : dot) / (6 * deg);
        let j = 0.9 * Math.exp(-dJ * dJ) * (state.nulling ? 0.5 : 1);
        if (!state.nulling) { const a = (cellAzDeg[i] - 40) / 8; j += 0.35 * Math.exp(-a * a); }
        jam[i] = j * flicker;
      }
      dirty = true;
    }
    const notch = state.jamming && state.nulling;
    if (notch !== notchApplied) { applyNotch(notch); notchApplied = notch; }

    if (dirty) { writeColors(state.time, state.jamming, state.nulling); dirty = state.jamming; }
    updateTargets(state);
  }

  function reset() {
    hot.fill(0); trace.fill(0); det.fill(0); jam.fill(0);
    dirty = true;
    for (let i = 0; i < MAX_TARGETS; i++) { brackets[i].visible = false; labels[i].obj.visible = false; }
  }

  writeColors(0, false, false);
  return { group, update, splash, flashDetection, setPatternPath, reset };
}
