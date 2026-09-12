// Procedural component stack: 10 parts front to back, one explode scalar, view modes by
// geometry swap + material overrides, per-part material clones for highlighting, and the two
// animated signal-path lines (RF chain and beam-steering commands).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PARTS } from '../data/parts.js';
import { createMaterials } from './materials.js';
import { buildElements } from './elements.js';
import { COLORS, ts } from '../sim/state.js';

const SHELL_KEYS = new Set(['shell', 'dark', 'titanium', 'silver', 'radome', 'coolant', 'glass']);
const QUAD_SIGN = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const MODE_TINT = { search: 0.25, track: 0.6, standby: 0.1 };
const RF_ANCHORS = [[0, -0.05, -1.55], [0, 0, -1.0], [0, 0, -0.42], [0, 0, -0.02]];
const RF_GROUPS = ['rex', 'manifold', 'trm', 'aperture'];
const BSC_CONNECTOR_X = [-0.9, -0.3, 0.3, 0.9];

const _c = new THREE.Color();
const _rx = new THREE.Color();
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, seg = 16) => new THREE.CylinderGeometry(r, r, h, seg);

// Box with its +X/+Y corner removed (cutaway variant), as one merged geometry.
function notchedBox(w, h, d, nx = 0.4, ny = 0.4) {
  const a = box(w, h * (1 - ny), d).translate(0, (-h * ny) / 2, 0);
  const b = box(w * (1 - nx), h * ny, d).translate((-w * nx) / 2, (h * (1 - ny)) / 2, 0);
  return mergeGeometries([a, b]);
}

function tube(p0, p1, r = 0.02) {
  return new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(...p0), new THREE.Vector3(...p1)), 1, r, 6, false);
}

function dashedLine(color, vertexCount, isSegments) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(vertexCount), 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.LineDashedMaterial({
    color, dashSize: 0.25, gapSize: 0.15, transparent: true, opacity: 0.9, toneMapped: false, fog: false,
    depthWrite: false,
  });
  const line = isSegments ? new THREE.LineSegments(geo, mat) : new THREE.Line(geo, mat);
  line.frustumCulled = false;
  line.renderOrder = 2;
  line.visible = false;
  return line;
}

export function buildAssembly() {
  const materials = createMaterials();
  const elements = buildElements(materials);
  const root = new THREE.Group();
  root.name = 'assembly';
  const groups = {}, partMaterials = {}, offsets = {}, pickables = [], swappables = [];
  const matCache = new Map();

  for (const p of PARTS) {
    const g = new THREE.Group();
    g.name = p.id;
    groups[p.id] = g;
    partMaterials[p.id] = [];
    offsets[p.id] = p.offset;
    root.add(g);
  }

  function mat(part, key, unique = false) {
    const k = part + '/' + key;
    if (!unique && matCache.has(k)) return matCache.get(k);
    const m = materials[key].clone();
    m.userData.kind = SHELL_KEYS.has(key) ? 'shell' : 'inner';
    partMaterials[part].push(m);
    if (!unique) matCache.set(k, m);
    return m;
  }

  function mesh(part, geom, key, { section = null, pick = true, unique = false, noHighlight = false } = {}) {
    const m = new THREE.Mesh(geom, mat(part, key, unique));
    m.userData.partId = part;
    if (noHighlight) m.material.userData.noHighlight = true;
    if (section) { m.userData.full = geom; m.userData.section = section; swappables.push(m); }
    if (pick) pickables.push(m);
    groups[part].add(m);
    return m;
  }

  function instanced(part, geom, key, count) {
    const im = new THREE.InstancedMesh(geom, mat(part, key), count);
    im.userData.partId = part;
    groups[part].add(im);
    return im;
  }

  // ---- 01 radome -------------------------------------------------------------------------
  {
    const R = 3.2, th = Math.asin(1.45 / R);
    const zShift = -R * Math.cos(th) + 0.15;
    const cap = new THREE.SphereGeometry(R, 48, 16, 0, Math.PI * 2, 0, th).rotateX(Math.PI / 2).translate(0, 0, zShift);
    const capSection = new THREE.SphereGeometry(R, 48, 16, 2.35, Math.PI * 2 - 4.7, 0, th).rotateX(Math.PI / 2).translate(0, 0, zShift);
    const dome = mesh('radome', cap, 'radome', { section: capSection });
    dome.renderOrder = 0;
    mesh('radome', new THREE.TorusGeometry(1.45, 0.04, 8, 64).translate(0, 0, 0.15), 'silver');
  }

  // ---- 02 aperture -----------------------------------------------------------------------
  const frameMats = [];
  let waim;
  {
    mesh('aperture', box(2.6, 2.6, 0.08).translate(0, 0, -0.04), 'titanium', { section: notchedBox(2.6, 2.6, 0.08).translate(0, 0, -0.04) });
    groups.aperture.add(elements.face);
    for (let q = 0; q < 4; q++) {
      const [sx, sy] = QUAD_SIGN[q];
      const h = box(1.3, 0.06, 0.05).translate(sx * 0.65, sy * 1.27, 0.025);
      const v = box(0.06, 1.3, 0.05).translate(sx * 1.27, sy * 0.65, 0.025);
      const strip = mesh('aperture', mergeGeometries([h, v]), 'silver', { pick: false, unique: true, noHighlight: true });
      frameMats.push(strip.material);
    }
    waim = mesh('aperture', box(2.5, 2.5, 0.02).translate(0, 0, 0.06), 'glass', { pick: false });
    waim.renderOrder = 0;
    mesh('aperture', box(0.03, 0.2, 0.07).translate(1.27, 0, 0.06), 'gold', { pick: false });
    mesh('aperture', box(0.03, 0.1, 0.07).translate(-1.27, 0, 0.06), 'dark', { pick: false });
  }

  // ---- 03 T/R module layer ---------------------------------------------------------------
  const sepMats = [];
  {
    elements.modules.position.z = -0.22;
    groups.trm.add(elements.modules);
    mesh('trm', box(2.6, 2.6, 0.06).translate(0, 0, -0.38), 'dark', { section: notchedBox(2.6, 2.6, 0.06).translate(0, 0, -0.38) });
    for (let q = 0; q < 4; q++) {
      const [sx, sy] = QUAD_SIGN[q];
      const h = box(1.3, 0.05, 0.03).translate(sx * 0.65, sy * 0.03, -0.425);
      const v = box(0.05, 1.3, 0.03).translate(sx * 0.03, sy * 0.65, -0.425);
      const bar = mesh('trm', mergeGeometries([h, v]), 'silver', { pick: false, unique: true, noHighlight: true });
      sepMats.push(bar.material);
    }
    const conn = instanced('trm', cyl(0.06, 0.1, 12).rotateX(Math.PI / 2), 'gold', 4);
    for (let q = 0; q < 4; q++) {
      _m.makeTranslation(QUAD_SIGN[q][0] * 0.6, QUAD_SIGN[q][1] * 0.6, -0.46);
      conn.setMatrixAt(q, _m);
    }
  }

  // ---- 04 cold plate ---------------------------------------------------------------------
  {
    const z = -0.62;
    const parts = (topGeom) => mergeGeometries([
      topGeom.translate(0, 0.775, z),
      box(2.6, 1.05, 0.12).translate(0, -0.775, z),
      box(0.5, 0.5, 0.12).translate(-0.5, 0, z),
      box(0.5, 0.5, 0.12).translate(0.5, 0, z),
    ]);
    mesh('coldplate', parts(box(2.6, 1.05, 0.12)), 'coolant', { section: parts(notchedBox(2.6, 1.05, 0.12)) });
    const pins = instanced('coldplate', cyl(0.012, 0.08, 6).rotateX(Math.PI / 2), 'silver', 256);
    _q.identity();
    for (let iy = 0; iy < 16; iy++) for (let ix = 0; ix < 16; ix++) {
      const x = (ix - 7.5) * 0.15, y = (iy - 7.5) * 0.15;
      const inHole = Math.abs(x) < 0.3 && Math.abs(y) < 0.3;
      _p.set(x, y, z + 0.1);
      _s.setScalar(inHole ? 0 : 1);
      pins.setMatrixAt(iy * 16 + ix, _m.compose(_p, _q, _s));
    }
    const pipe = (y) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.2, y, z), new THREE.Vector3(-1.55, y, z), new THREE.Vector3(-1.62, y, z - 0.25), new THREE.Vector3(-1.62, y, z - 0.9),
    ]), 20, 0.04, 8, false);
    mesh('coldplate', mergeGeometries([pipe(0.35), pipe(-0.35)]), 'silver', { pick: false });
  }

  // ---- 05 RF manifold / beamformer -------------------------------------------------------
  {
    const z = -0.8, zT = -0.86;
    mesh('manifold', box(2.4, 2.4, 0.05).translate(0, 0, z), 'pcb', { section: notchedBox(2.4, 2.4, 0.05).translate(0, 0, z) });
    const tubes = [tube([0, 0, -0.98], [0, 0, zT], 0.03), tube([0, 0, zT], [0, 0, -0.58], 0.03)];
    for (const [qx, qy] of QUAD_SIGN) {
      tubes.push(tube([0, 0, zT], [qx * 0.6, qy * 0.6, zT], 0.025));
      for (const [sx, sy] of QUAD_SIGN) {
        const x = qx * 0.6 + sx * 0.3, y = qy * 0.6 + sy * 0.3;
        tubes.push(tube([qx * 0.6, qy * 0.6, zT], [x, y, zT]));
        tubes.push(tube([x, y, zT], [x, y, -0.7]));
      }
    }
    tubes.push(cyl(0.06, 0.12, 12).rotateX(Math.PI / 2).translate(0, 0, -1.0));
    mesh('manifold', mergeGeometries(tubes), 'copper', { pick: false });
  }

  // ---- 06..09 electronics boxes ----------------------------------------------------------
  function electronicsBox(part, w, h, d, z, key, slabY) {
    mesh(part, box(w, h, d).translate(0, 0, z), key, { section: notchedBox(w, h, d).translate(0, 0, z) });
    mesh(part, box(w - 0.2, 0.02, d - 0.06).translate(0, slabY, z), 'pcb', { pick: false });
  }
  {
    electronicsBox('bsc', 2.2, 0.5, 0.35, -1.15, 'shell', -0.15);
    const conn = instanced('bsc', cyl(0.045, 0.08, 12).rotateX(Math.PI / 2), 'gold', 4);
    for (let i = 0; i < 4; i++) { _m.makeTranslation(BSC_CONNECTOR_X[i], 0.1, -0.945); conn.setMatrixAt(i, _m); }

    electronicsBox('rex', 2.2, 0.6, 0.35, -1.55, 'shell', -0.2);
    mesh('rex', cyl(0.08, 0.24, 16).rotateZ(Math.PI / 2).translate(0.5, 0.05, -1.55), 'gold', { pick: false });

    electronicsBox('sdp', 2.2, 0.8, 0.4, -2.0, 'shell', -0.25);
    const fins = [];
    for (let i = 0; i < 16; i++) fins.push(box(0.06, 0.14, 0.36).translate(-1.0 + (i * 2.0) / 15, 0.47, -2.0));
    mesh('sdp', mergeGeometries(fins), 'silver', { pick: false });

    electronicsBox('psu', 2.2, 0.6, 0.45, -2.45, 'dark', -0.22);
    mesh('psu', mergeGeometries([
      new THREE.TorusGeometry(0.15, 0.05, 10, 24).rotateX(Math.PI / 2).translate(-0.6, -0.05, -2.45),
      new THREE.TorusGeometry(0.15, 0.05, 10, 24).rotateX(Math.PI / 2).translate(0.6, -0.05, -2.45),
    ]), 'copper', { pick: false });
  }

  // ---- 10 backplane & chassis ------------------------------------------------------------
  let longerons;
  {
    mesh('chassis', box(2.8, 2.8, 0.1).translate(0, 0, -2.75), 'shell', { section: notchedBox(2.8, 2.8, 0.1).translate(0, 0, -2.75) });
    longerons = instanced('chassis', box(0.08, 0.08, 1), 'silver', 4);
    mesh('chassis', mergeGeometries([
      box(0.7, 0.3, 0.4).translate(0, -1.55, -2.75),
      cyl(0.12, 0.5, 16).rotateZ(Math.PI / 2).translate(-0.6, -1.45, -2.75),
      cyl(0.12, 0.5, 16).rotateZ(Math.PI / 2).translate(0.6, -1.45, -2.75),
      new THREE.CylinderGeometry(0.22, 0.28, 0.5, 16).translate(0, -1.95, -2.75),
      box(1.2, 0.08, 1.2).translate(0, -2.16, -2.75),
    ]), 'shell');
  }

  // ---- signal paths ----------------------------------------------------------------------
  const rfLine = dashedLine(COLORS.signal, 4, false);
  const ctlLine = dashedLine(COLORS.control, 8, true);
  root.add(rfLine, ctlLine);
  let rfPhase = 0, ctlPhase = 0, rfReverse = 0, ctlFlash = 0;
  let rxFlash = 0;
  _rx.setHex(COLORS.search);

  function writeSignalPaths(dt, running) {
    const rfPos = rfLine.geometry.attributes.position.array;
    const rfDist = rfLine.geometry.attributes.lineDistance.array;
    let acc = 0;
    for (let i = 0; i < 4; i++) {
      const a = RF_ANCHORS[i];
      rfPos[i * 3] = a[0]; rfPos[i * 3 + 1] = a[1]; rfPos[i * 3 + 2] = a[2] + groups[RF_GROUPS[i]].position.z;
      if (i > 0) acc += Math.hypot(rfPos[i * 3] - rfPos[i * 3 - 3], rfPos[i * 3 + 1] - rfPos[i * 3 - 2], rfPos[i * 3 + 2] - rfPos[i * 3 - 1]);
      rfDist[i] = acc + rfPhase;
    }
    const cPos = ctlLine.geometry.attributes.position.array;
    const cDist = ctlLine.geometry.attributes.lineDistance.array;
    for (let q = 0; q < 4; q++) {
      const o = q * 6;
      cPos[o] = BSC_CONNECTOR_X[q]; cPos[o + 1] = 0.1; cPos[o + 2] = -0.945 + groups.bsc.position.z;
      cPos[o + 3] = QUAD_SIGN[q][0] * 0.6; cPos[o + 4] = QUAD_SIGN[q][1] * 0.6; cPos[o + 5] = -0.46 + groups.trm.position.z;
      const len = Math.hypot(cPos[o + 3] - cPos[o], cPos[o + 4] - cPos[o + 1], cPos[o + 5] - cPos[o + 2]);
      cDist[q * 2] = ctlPhase;
      cDist[q * 2 + 1] = ctlPhase + len;
    }
    if (running) {
      rfPhase += (rfReverse > 0 ? 2.5 : -2.5) * dt;
      ctlPhase -= (ctlFlash > 0 ? 15 : 2.5) * dt;
    }
    ctlLine.material.opacity = ctlFlash > 0 ? 1 : 0.7;
    _c.setHex(COLORS.control).multiplyScalar(ctlFlash > 0 ? 2 : 1);
    ctlLine.material.color.copy(_c);
    for (const l of [rfLine, ctlLine]) {
      l.geometry.attributes.position.needsUpdate = true;
      l.geometry.attributes.lineDistance.needsUpdate = true;
    }
  }

  // ---- view modes ------------------------------------------------------------------------
  function setViewMode(mode) {
    for (const m of swappables) m.geometry = mode === 'cutaway' ? m.userData.section : m.userData.full;
    for (const id in partMaterials) {
      for (const m of partMaterials[id]) {
        const u = m.userData, shell = u.kind === 'shell';
        if (mode === 'xray') {
          m.transparent = true;
          m.opacity = shell ? 0.08 : 0.35;
          m.wireframe = shell;
          m.depthWrite = false;
        } else if (mode === 'signal') {
          m.transparent = shell ? true : u.baseTransparent;
          m.opacity = shell ? Math.min(0.25, u.baseOpacity) : u.baseOpacity;
          m.wireframe = u.baseWireframe;
          m.depthWrite = shell ? false : u.baseDepthWrite;
        } else {
          m.transparent = u.baseTransparent;
          m.opacity = u.baseOpacity;
          m.wireframe = u.baseWireframe;
          m.depthWrite = u.baseDepthWrite;
        }
        m.needsUpdate = true;
      }
    }
    waim.visible = mode !== 'xray';
    rfLine.visible = ctlLine.visible = mode === 'signal';
  }

  function setHighlight(selected, hovered) {
    for (const id in partMaterials) {
      const k = id === selected ? 0.35 : id === hovered ? 0.12 : 0;
      for (const m of partMaterials[id]) {
        if (m.userData.noHighlight || !m.emissive) continue;
        m.emissive.setHex(COLORS.search);
        m.emissiveIntensity = k;
      }
    }
  }

  function flashHop() { ctlFlash = 0.1; }
  function flashReceive(colorHex) { rxFlash = 1; _rx.setHex(colorHex); rfReverse = 0.3; }

  function update(dt, state) {
    for (const id in groups) groups[id].position.z = offsets[id] * state.explode;

    const len = 2.62 - offsets.chassis * state.explode;
    _q.identity();
    _s.set(1, 1, len);
    for (let i = 0; i < 4; i++) {
      _p.set(QUAD_SIGN[i][0] * 1.3, QUAD_SIGN[i][1] * 1.3, -2.7 + len / 2);
      longerons.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    longerons.instanceMatrix.needsUpdate = true;

    ctlFlash = Math.max(0, ctlFlash - dt);
    rfReverse = Math.max(0, rfReverse - dt);
    rxFlash = ts(rxFlash, 0, 6.7, dt);
    if (rfLine.visible) writeSignalPaths(dt, state.running);

    for (let q = 0; q < 4; q++) {
      const mode = state.quadrantModes[q];
      const hex = mode === 'track' ? COLORS.track : mode === 'search' ? COLORS.search : COLORS.standby;
      const k = MODE_TINT[mode] * (state.hoveredQuadrant === q ? 1.3 : 1);
      _c.setHex(hex).multiplyScalar(k);
      sepMats[q].emissive.copy(_c);
      sepMats[q].emissiveIntensity = 1;
      _c.lerp(_rx, rxFlash);
      frameMats[q].emissive.copy(_c);
      frameMats[q].emissiveIntensity = 1 + rxFlash;
    }
  }

  setHighlight(null, null);
  return { root, materials, partMaterials, groups, elements, pickables, setViewMode, setHighlight, flashHop, flashReceive, update };
}
