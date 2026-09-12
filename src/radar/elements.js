// Aperture face (radiating patches) and T/R module layer.
//
// Both are single InstancedMeshes (576 instances each). All per-element state — steering
// phase fringes, quadrant mode, failures, pulse flashes, hover highlight — is encoded in
// `instanceColor`; geometry only changes when the failed set changes.

import * as THREE from 'three';
import { COLORS } from '../sim/state.js';

export const N = 24;
export const PITCH = 0.1;
export const ELEMENT_COUNT = N * N; // 576

const HALF = (N - 1) / 2;                          // 11.5 — lattice centre
const QUAD = N / 2;                                // 12 elements per quadrant side
const PER_QUADRANT = QUAD * QUAD;                  // 144
const TWO_PI = Math.PI * 2;
const PHASE_STEP = TWO_PI / 64;                    // 6-bit phase shifter

const ELEMENT_RADIUS = 0.035;
const ELEMENT_LIFT = 0.004;                        // patches sit just proud of the plate face (no z-fighting)
const MODULE_SIZE = 0.085;
const MODULE_DEPTH = 0.25;
const FRAME_OUTER = 1.3;                           // matches the 2.6 aperture plate
const FRAME_INNER = 1.24;

const FAILED_ELEMENT_SCALE = 0.6;
const FAILED_MODULE_SCALE_Z = 0.4;
const FLASH_S = 0.08;
const FLASH_ELEMENT = 1.6;
const FLASH_MODULE = 1.4;
const HIGHLIGHT_GAIN = 1.3;
const LCG_SEED = 0x2545f491;

const EMPTY = [];

// Module-scope scratch (no per-frame allocation).
const _color = new THREE.Color();
const _mode = new THREE.Color();
const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const BLACK = new THREE.Color(0x000000);
const STANDBY = new THREE.Color(COLORS.standby);
const FAULT = new THREE.Color(COLORS.fault);

export function elementIndex(ix, iy) {
  return iy * N + ix;
}

export function quadrantOf(ix, iy) {
  return (ix < QUAD ? 0 : 1) + (iy < QUAD ? 0 : 2);
}

function quadrantOfIndex(i) {
  return quadrantOf(i % N, (i / N) | 0);
}

// Fixed Fisher–Yates permutation of 0..575 from a seeded LCG. The failed set at fraction f is
// the first round(f·576) entries, so it is deterministic and grows/shrinks monotonically.
function failurePermutation() {
  const perm = new Uint16Array(ELEMENT_COUNT);
  for (let i = 0; i < ELEMENT_COUNT; i++) perm[i] = i;
  let seed = LCG_SEED;
  for (let i = ELEMENT_COUNT - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor((seed / 4294967296) * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  return perm;
}

// Thin square annulus outlining the aperture in the face-on inset (layer 1 only).
function frameGeometry() {
  const shape = new THREE.Shape()
    .moveTo(-FRAME_OUTER, -FRAME_OUTER)
    .lineTo(FRAME_OUTER, -FRAME_OUTER)
    .lineTo(FRAME_OUTER, FRAME_OUTER)
    .lineTo(-FRAME_OUTER, FRAME_OUTER)
    .closePath();
  const hole = new THREE.Path()
    .moveTo(-FRAME_INNER, -FRAME_INNER)
    .lineTo(FRAME_INNER, -FRAME_INNER)
    .lineTo(FRAME_INNER, FRAME_INNER)
    .lineTo(-FRAME_INNER, FRAME_INNER)
    .closePath();
  shape.holes.push(hole);
  return new THREE.ShapeGeometry(shape);
}

export function buildElements(materials) {
  if (!materials || !materials.element || !materials.trm) {
    throw new Error('buildElements: materials.element and materials.trm are required');
  }

  // ---- meshes -------------------------------------------------------------------------------
  const patchGeometry = new THREE.CircleGeometry(ELEMENT_RADIUS, 20).translate(0, 0, ELEMENT_LIFT);
  const patches = new THREE.InstancedMesh(patchGeometry, materials.element, ELEMENT_COUNT);
  patches.name = 'apertureElements';
  patches.userData.partId = 'aperture';
  patches.layers.enable(1);

  const moduleGeometry = new THREE.BoxGeometry(MODULE_SIZE, MODULE_SIZE, MODULE_DEPTH);
  const moduleMesh = new THREE.InstancedMesh(moduleGeometry, materials.trm, ELEMENT_COUNT);
  moduleMesh.name = 'trModules';
  moduleMesh.userData.partId = 'trm';

  const frame = new THREE.Mesh(
    frameGeometry(),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.standby).multiplyScalar(1.8), fog: false }),
  );
  frame.name = 'apertureFrameRing';
  frame.userData.partId = 'aperture';
  frame.layers.set(1);

  const face = new THREE.Group();
  face.name = 'apertureFace';
  face.layers.enable(1);
  face.add(patches, frame);

  const modules = new THREE.Group();
  modules.name = 'trModuleLayer';
  modules.add(moduleMesh);

  // ---- state --------------------------------------------------------------------------------
  const perm = failurePermutation();
  const failedSet = new Set();
  const failed = new Uint8Array(ELEMENT_COUNT);
  const failedInQuadrant = new Int32Array(4);
  let failedCount = 0;

  // Per-quadrant colour inputs; a quadrant is rewritten only when one of these changes.
  const qActive = new Uint8Array(4);
  const qAz = new Float64Array(4);
  const qEl = new Float64Array(4);
  const qColor = new Int32Array(4);
  const qFlash = new Uint8Array(4);
  const flashTimer = new Float64Array(4);
  const dirty = new Uint8Array(4);
  let explicitHighlight = null;   // from setQuadrantHighlight
  let appliedHighlight = null;    // what the colours currently encode
  let lastState = null;

  function writeMatrices() {
    _quat.identity();
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const i = elementIndex(ix, iy);
        _pos.set((ix - HALF) * PITCH, (iy - HALF) * PITCH, 0);
        const s = failed[i] ? FAILED_ELEMENT_SCALE : 1;
        _scale.set(s, s, 1);
        patches.setMatrixAt(i, _mat.compose(_pos, _quat, _scale));
        _scale.set(1, 1, failed[i] ? FAILED_MODULE_SCALE_Z : 1);
        moduleMesh.setMatrixAt(i, _mat.compose(_pos, _quat, _scale));
      }
    }
    patches.instanceMatrix.needsUpdate = true;
    moduleMesh.instanceMatrix.needsUpdate = true;
  }

  // Colour the 144 elements + modules of quadrant q from the cached inputs.
  function writeQuadrant(q) {
    const ix0 = q & 1 ? QUAD : 0;
    const iy0 = q & 2 ? QUAD : 0;
    const active = qActive[q] === 1;
    const hl = appliedHighlight === q ? HIGHLIGHT_GAIN : 1;
    const gainE = (qFlash[q] ? FLASH_ELEMENT : 1) * hl;
    const gainM = (qFlash[q] ? FLASH_MODULE : 1) * hl;

    // Steering phase on the λ/2 lattice (k·d = π), independent of the scene pitch.
    const sx = Math.sin(qAz[q]) * Math.cos(qEl[q]);
    const sy = Math.sin(qEl[q]);
    if (active) _mode.setHex(qColor[q]);

    for (let iy = iy0; iy < iy0 + QUAD; iy++) {
      for (let ix = ix0; ix < ix0 + QUAD; ix++) {
        const i = elementIndex(ix, iy);
        if (failed[i]) {
          patches.setColorAt(i, BLACK);
          moduleMesh.setColorAt(i, _color.copy(FAULT).multiplyScalar(hl));
        } else if (!active) {
          _color.copy(STANDBY).multiplyScalar(hl);
          patches.setColorAt(i, _color);
          moduleMesh.setColorAt(i, _color);
        } else {
          let phase = -Math.PI * ((ix - HALF) * sx + (iy - HALF) * sy);
          phase = Math.round(phase / PHASE_STEP) * PHASE_STEP;
          phase -= TWO_PI * Math.floor(phase / TWO_PI); // wrap to [0, 2π)
          const lightness = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(phase));
          patches.setColorAt(i, _color.copy(_mode).multiplyScalar(lightness * gainE));
          moduleMesh.setColorAt(i, _color.copy(_mode).multiplyScalar(lightness * gainM));
        }
      }
    }
  }

  function applyFailedFraction(fraction) {
    const f = fraction > 0 ? (fraction < 1 ? fraction : 1) : 0;
    const count = Math.round(f * ELEMENT_COUNT);
    if (count === failedCount) return;
    for (let k = failedCount; k < count; k++) {
      const i = perm[k];
      failed[i] = 1;
      failedSet.add(i);
      failedInQuadrant[quadrantOfIndex(i)]++;
    }
    for (let k = count; k < failedCount; k++) {
      const i = perm[k];
      failed[i] = 0;
      failedSet.delete(i);
      failedInQuadrant[quadrantOfIndex(i)]--;
    }
    failedCount = count;
    writeMatrices();
    dirty.fill(1);
  }

  function isStandby(q) {
    return lastState !== null && lastState.quadrantModes[q] === 'standby';
  }

  // ---- initial upload: every instance gets a matrix and a colour before the first render ----
  writeMatrices();
  for (let q = 0; q < 4; q++) writeQuadrant(q);
  patches.instanceColor.setUsage(THREE.DynamicDrawUsage);
  moduleMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  patches.computeBoundingSphere();
  moduleMesh.computeBoundingSphere();

  // ---- api ----------------------------------------------------------------------------------
  function update(dt, state) {
    lastState = state;
    applyFailedFraction(state.failedFraction || 0);

    const beams = state.beams || EMPTY;
    for (let q = 0; q < 4; q++) {
      let beam = null;
      for (let b = 0; b < beams.length; b++) {
        const candidate = beams[b];
        if (candidate.quadrants && candidate.quadrants.includes(q)) { beam = candidate; break; }
      }
      const active = beam ? 1 : 0;
      if (active !== qActive[q]) { qActive[q] = active; dirty[q] = 1; }
      if (beam && (beam.az !== qAz[q] || beam.el !== qEl[q] || beam.color !== qColor[q])) {
        qAz[q] = beam.az;
        qEl[q] = beam.el;
        qColor[q] = beam.color;
        dirty[q] = 1;
      }

      const flash = flashTimer[q] > 0 ? 1 : 0;
      if (flash) flashTimer[q] = Math.max(0, flashTimer[q] - dt);
      if (flash !== qFlash[q]) { qFlash[q] = flash; dirty[q] = 1; }
    }

    // Explicit highlight wins; otherwise follow the panel's tile hover.
    let hl = explicitHighlight !== null ? explicitHighlight : state.hoveredQuadrant;
    if (typeof hl !== 'number' || hl < 0 || hl > 3) hl = null;
    if (hl !== appliedHighlight) {
      if (appliedHighlight !== null) dirty[appliedHighlight] = 1;
      if (hl !== null) dirty[hl] = 1;
      appliedHighlight = hl;
    }

    let changed = false;
    for (let q = 0; q < 4; q++) {
      if (!dirty[q]) continue;
      writeQuadrant(q);
      dirty[q] = 0;
      changed = true;
    }
    if (changed) {
      patches.instanceColor.needsUpdate = true;
      moduleMesh.instanceColor.needsUpdate = true;
    }
  }

  function activeCountByQuadrant(q) {
    return isStandby(q) ? 0 : PER_QUADRANT - failedInQuadrant[q];
  }

  function activeElementCount() {
    let n = 0;
    for (let q = 0; q < 4; q++) n += activeCountByQuadrant(q);
    return n;
  }

  function pulseFlash(quadrants) {
    for (let k = 0; k < quadrants.length; k++) {
      const q = quadrants[k];
      if (q >= 0 && q < 4) flashTimer[q] = FLASH_S;
    }
  }

  function setQuadrantHighlight(q) {
    explicitHighlight = typeof q === 'number' && q >= 0 && q < 4 ? q | 0 : null;
  }

  return {
    face,
    modules,
    update,
    activeElementCount,
    activeCountByQuadrant,
    failedSet,
    pulseFlash,
    setQuadrantHighlight,
  };
}
