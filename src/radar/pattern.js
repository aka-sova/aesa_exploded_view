// Live antenna pattern: the array factor of the real element states (steering phase, taper
// weight, failed modules, standby quadrants) drawn as a dB surface around each beam's phase
// centre, plus azimuth / elevation cuts for the 2-D plot.
//
// The lobe is sampled on a uniform grid of direction cosines (u = sin az·cos el, v = sin el),
// where a rectangular lattice makes the array factor separable per quadrant:
//   AF(u, v) = Σ_q AFx_q(u)·AFy_q(v) − Σ_failed w_n·ex_n(u)·ey_n(v)
// so a 97 × 97 grid costs a few milliseconds even with a hundred dead modules.
import * as THREE from 'three';
import { deg, dirFromAzEl } from './scan.js';
import { taperWeight } from './taper.js';

const N = 24, HALF = 11.5, QUAD = 12, NORM = 576;
const NU_SEARCH = 97, NU_TRACK = 65;
const R_MAX = 4.0;          // radius of a 0 dB lobe (scene units)
const FLOOR_DB = 40;        // −40 dB and below collapse to the origin
const CUT_N = 181;          // 1° steps, −90°…+90°
const TRACK_INTERVAL = 0.3; // s between track-lobe recomputes
const ELEMENT_POWER_EXP = 1.3;
const _dir = new THREE.Vector3();

// dB → colour (blue floor, teal sidelobes, white peak)
const STOPS = [[-40, 0.05, 0.10, 0.26], [-24, 0.08, 0.42, 0.60], [-12, 0.18, 0.86, 0.80], [-3, 0.62, 1.0, 0.97], [0, 1, 1, 1]];
function colorAt(db, out, o) {
  if (db <= STOPS[0][0]) { out[o] = STOPS[0][1]; out[o + 1] = STOPS[0][2]; out[o + 2] = STOPS[0][3]; return; }
  for (let k = 1; k < STOPS.length; k++) {
    if (db <= STOPS[k][0]) {
      const a = STOPS[k - 1], b = STOPS[k], f = (db - a[0]) / (b[0] - a[0]);
      out[o] = a[1] + (b[1] - a[1]) * f; out[o + 1] = a[2] + (b[2] - a[2]) * f; out[o + 2] = a[3] + (b[3] - a[3]) * f;
      return;
    }
  }
  out[o] = 1; out[o + 1] = 1; out[o + 2] = 1;
}

// Per-beam workspace sized for its grid resolution.
function createWorkspace(nu) {
  return {
    nu,
    u: Float32Array.from({ length: nu }, (_, i) => -1 + (2 * i) / (nu - 1)),
    exc: new Float32Array(N * nu), exs: new Float32Array(N * nu),
    eyc: new Float32Array(N * nu), eys: new Float32Array(N * nu),
    afxc: new Float32Array(4 * nu), afxs: new Float32Array(4 * nu),
    afyc: new Float32Array(4 * nu), afys: new Float32Array(4 * nu),
    gdb: new Float32Array(nu * nu),
  };
}

function createLobeGeometry(nu) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nu * nu * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nu * nu * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = new Uint32Array((nu - 1) * (nu - 1) * 6);
  let k = 0;
  for (let j = 0; j < nu - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
    idx[k++] = a; idx[k++] = c; idx[k++] = b;
    idx[k++] = b; idx[k++] = c; idx[k++] = d;
  }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

export function createPatternView(scene, elementsApi) {
  const group = new THREE.Group();
  group.name = 'pattern';
  scene.add(group);
  const lobes = new Map();     // beam.id → { mesh, ws, key, time }
  const failedIx = new Int16Array(NORM), failedIy = new Int16Array(NORM);
  const wx = new Float32Array(N), wy = new Float32Array(N);
  const cutAz = new Float32Array(CUT_N), cutEl = new Float32Array(CUT_N);
  const metrics = { beamwidthDeg: 0, beamwidthElDeg: 0, sidelobeDb: -13.3, peakDb: 0, gratingLobe: false };
  let version = 0;
  let cutKey = '';
  let activeMask = 0, failedCount = 0, u0 = 0, v0 = 0, kd = Math.PI;

  // ---- shared set-up for one beam: weights, steering, active quadrants, failed list ---------
  function prepare(beam, state) {
    u0 = Math.sin(beam.az) * Math.cos(beam.el);
    v0 = Math.sin(beam.el);
    kd = 2 * Math.PI * state.spacingLambda;
    for (let i = 0; i < N; i++) { wx[i] = taperWeight(i, state.taper); wy[i] = wx[i]; }
    activeMask = 0;
    for (const q of beam.quadrants) activeMask |= 1 << q;
    failedCount = 0;
    for (const n of elementsApi.failedSet) {
      const ix = n % N, iy = (n - ix) / N;
      const q = (ix < QUAD ? 0 : 1) + (iy < QUAD ? 0 : 2);
      if (activeMask & (1 << q)) { failedIx[failedCount] = ix; failedIy[failedCount] = iy; failedCount++; }
    }
  }

  // Array factor at one direction (u, v) — used for the 1-D cuts.
  function afAt(u, v) {
    let re = 0, im = 0;
    for (let q = 0; q < 4; q++) {
      if (!(activeMask & (1 << q))) continue;
      const x0 = q & 1 ? QUAD : 0, y0 = q & 2 ? QUAD : 0;
      let xc = 0, xs = 0, yc = 0, ys = 0;
      for (let k = 0; k < QUAD; k++) {
        const px = kd * (x0 + k - HALF) * (u - u0), py = kd * (y0 + k - HALF) * (v - v0);
        xc += wx[x0 + k] * Math.cos(px); xs += wx[x0 + k] * Math.sin(px);
        yc += wy[y0 + k] * Math.cos(py); ys += wy[y0 + k] * Math.sin(py);
      }
      re += xc * yc - xs * ys; im += xc * ys + xs * yc;
    }
    for (let f = 0; f < failedCount; f++) {
      const px = kd * (failedIx[f] - HALF) * (u - u0), py = kd * (failedIy[f] - HALF) * (v - v0);
      const w = wx[failedIx[f]] * wy[failedIy[f]];
      const c = Math.cos(px + py) * w, s = Math.sin(px + py) * w;
      re -= c; im -= s;
    }
    return re * re + im * im;
  }

  const toDb = (p2, cosT) => 10 * Math.log10(Math.max((p2 / (NORM * NORM)) * Math.pow(Math.max(cosT, 0), ELEMENT_POWER_EXP), 1e-7));

  // ---- 2-D grid for the 3-D lobe ------------------------------------------------------------
  function computeGrid(ws) {
    const { nu, u, exc, exs, eyc, eys, afxc, afxs, afyc, afys, gdb } = ws;
    for (let ix = 0; ix < N; ix++) {
      const kx = kd * (ix - HALF), w = wx[ix];
      for (let i = 0; i < nu; i++) { const p = kx * (u[i] - u0); exc[ix * nu + i] = w * Math.cos(p); exs[ix * nu + i] = w * Math.sin(p); }
    }
    for (let iy = 0; iy < N; iy++) {
      const ky = kd * (iy - HALF), w = wy[iy];
      for (let j = 0; j < nu; j++) { const p = ky * (u[j] - v0); eyc[iy * nu + j] = w * Math.cos(p); eys[iy * nu + j] = w * Math.sin(p); }
    }
    afxc.fill(0); afxs.fill(0); afyc.fill(0); afys.fill(0);
    for (let q = 0; q < 4; q++) {
      if (!(activeMask & (1 << q))) continue;
      const x0 = q & 1 ? QUAD : 0, y0 = q & 2 ? QUAD : 0;
      for (let k = 0; k < QUAD; k++) {
        const ix = x0 + k, iy = y0 + k;
        for (let i = 0; i < nu; i++) { afxc[q * nu + i] += exc[ix * nu + i]; afxs[q * nu + i] += exs[ix * nu + i]; }
        for (let j = 0; j < nu; j++) { afyc[q * nu + j] += eyc[iy * nu + j]; afys[q * nu + j] += eys[iy * nu + j]; }
      }
    }
    for (let j = 0; j < nu; j++) {
      const v = u[j];
      for (let i = 0; i < nu; i++) {
        const rr = u[i] * u[i] + v * v;
        if (rr > 1) { gdb[j * nu + i] = -FLOOR_DB; continue; }
        let re = 0, im = 0;
        for (let q = 0; q < 4; q++) {
          if (!(activeMask & (1 << q))) continue;
          const xc = afxc[q * nu + i], xs = afxs[q * nu + i], yc = afyc[q * nu + j], ys = afys[q * nu + j];
          re += xc * yc - xs * ys; im += xc * ys + xs * yc;
        }
        for (let f = 0; f < failedCount; f++) {
          const xc = exc[failedIx[f] * nu + i], xs = exs[failedIx[f] * nu + i];
          const yc = eyc[failedIy[f] * nu + j], ys = eys[failedIy[f] * nu + j];
          re -= xc * yc - xs * ys; im -= xc * ys + xs * yc;
        }
        gdb[j * nu + i] = toDb(re * re + im * im, Math.sqrt(1 - rr));
      }
    }
  }

  function writeLobe(lobe, origin) {
    const { nu, u, gdb } = lobe.ws;
    const pos = lobe.mesh.geometry.attributes.position.array;
    const col = lobe.mesh.geometry.attributes.color.array;
    for (let j = 0; j < nu; j++) {
      const v = u[j];
      for (let i = 0; i < nu; i++) {
        const k = j * nu + i, o = k * 3;
        const rr = u[i] * u[i] + v * v;
        const g = gdb[k];
        const r = rr > 1 ? 0 : R_MAX * Math.max(0, 1 + g / FLOOR_DB);
        const w = rr > 1 ? 0 : Math.sqrt(1 - rr);
        pos[o] = origin.x + u[i] * r; pos[o + 1] = origin.y + v * r; pos[o + 2] = origin.z + w * r;
        colorAt(g, col, o);
      }
    }
    lobe.mesh.geometry.attributes.position.needsUpdate = true;
    lobe.mesh.geometry.attributes.color.needsUpdate = true;
  }

  // ---- 1-D cuts + metrics ---------------------------------------------------------------------
  function computeCuts(beam) {
    for (let k = 0; k < CUT_N; k++) {
      const a = (k - 90) * deg;
      dirFromAzEl(a, beam.el, _dir);
      cutAz[k] = toDb(afAt(_dir.x, _dir.y), _dir.z);
      dirFromAzEl(beam.az, a, _dir);
      cutEl[k] = toDb(afAt(_dir.x, _dir.y), _dir.z);
    }
    metrics.beamwidthDeg = widthOf(cutAz);
    metrics.beamwidthElDeg = widthOf(cutEl);
    const s = sidelobeOf(cutAz), t = sidelobeOf(cutEl);
    metrics.peakDb = Math.max(...peakOf(cutAz), ...peakOf(cutEl));
    metrics.sidelobeDb = Math.max(s, t);
    metrics.gratingLobe = metrics.sidelobeDb > -6;
  }
  function peakOf(c) { let m = -Infinity; for (let k = 0; k < CUT_N; k++) if (c[k] > m) m = c[k]; return [m]; }
  function argmax(c) { let m = -Infinity, km = 0; for (let k = 0; k < CUT_N; k++) if (c[k] > m) { m = c[k]; km = k; } return km; }
  function widthOf(c) {
    const kp = argmax(c), lvl = c[kp] - 3;
    let l = kp, r = kp;
    while (l > 0 && c[l] > lvl) l--;
    while (r < CUT_N - 1 && c[r] > lvl) r++;
    const li = l < kp ? l + (lvl - c[l]) / (c[l + 1] - c[l]) : l;
    const ri = r > kp ? r - (lvl - c[r]) / (c[r - 1] - c[r]) : r;
    return Math.max(0.1, ri - li);
  }
  function sidelobeOf(c) {
    const kp = argmax(c), peak = c[kp];
    let l = kp; while (l > 0 && c[l - 1] < c[l]) l--;
    let r = kp; while (r < CUT_N - 1 && c[r + 1] < c[r]) r++;
    let m = -Infinity;
    for (let k = 0; k < l; k++) if (c[k] > m) m = c[k];
    for (let k = r + 1; k < CUT_N; k++) if (c[k] > m) m = c[k];
    return m === -Infinity ? -FLOOR_DB : m - peak;
  }

  // ---- per frame ------------------------------------------------------------------------------
  function keyOf(beam, state) {
    return `${beam.az.toFixed(4)}|${beam.el.toFixed(4)}|${beam.quadrants.join('')}|${elementsApi.failedSet.size}|${state.spacingLambda}|${state.taper}`;
  }

  function update(dt, state) {
    const seen = new Set();
    let primary = null;
    for (const beam of state.beams) {
      seen.add(beam.id);
      const isSearch = beam.type === 'search';
      if (!primary || (isSearch && primary.type !== 'search')) primary = beam;
      const visible = isSearch ? state.patternSearch : state.patternTrack;
      let lobe = lobes.get(beam.id);
      if (!visible) { if (lobe) lobe.mesh.visible = false; continue; }
      if (!lobe) {
        const nu = isSearch ? NU_SEARCH : NU_TRACK;
        const mesh = new THREE.Mesh(createLobeGeometry(nu), new THREE.MeshBasicMaterial({
          vertexColors: true, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, fog: false,
        }));
        mesh.renderOrder = 2;
        mesh.frustumCulled = false;
        group.add(mesh);
        lobe = { mesh, ws: createWorkspace(nu), key: '', time: -Infinity };
        lobes.set(beam.id, lobe);
      }
      lobe.mesh.visible = true;
      const key = keyOf(beam, state);
      const due = isSearch || state.time - lobe.time >= TRACK_INTERVAL || lobe.key === '';
      if (key !== lobe.key && due) {
        prepare(beam, state);
        computeGrid(lobe.ws);
        writeLobe(lobe, beam.origin);
        lobe.key = key;
        lobe.time = state.time;
      }
    }
    for (const [id, lobe] of lobes) if (!seen.has(id)) lobe.mesh.visible = false;

    if (primary) {
      const key = keyOf(primary, state);
      if (key !== cutKey) {
        cutKey = key;
        prepare(primary, state);
        computeCuts(primary);
        version++;
      }
    }
  }

  function reset() {
    for (const [, lobe] of lobes) { group.remove(lobe.mesh); lobe.mesh.geometry.dispose(); lobe.mesh.material.dispose(); }
    lobes.clear();
    cutKey = '';
  }

  return { group, update, reset, cutAz, cutEl, metrics, get version() { return version; }, CUT_N };
}
