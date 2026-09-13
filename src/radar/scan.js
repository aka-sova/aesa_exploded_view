// Scan geometry, coverage grid, search patterns and the beam scheduler.
//
// Everything here is deterministic: the only randomness is a seeded LCG used by the
// agile pattern. Per-frame work touches module-scope scratch objects only.

import * as THREE from 'three';
import { COLORS } from '../sim/state.js';
import { dopplerFactor } from './doppler.js';

export const deg = Math.PI / 180;

export const FREQ_GHZ = 9.5;
export const LAMBDA = 0.0316;          // m — c / 9.5 GHz
export const BASE_BW = 4.2;            // ° — full-aperture half-power beamwidth at boresight
export const VIS_BEAM_SCALE = 2;       // drawn width / true width (stated in the HUD)

export const DOME_RADIUS = 10;
export const SCAN_MAX = 70 * deg;

export const AZ_MIN = -70, AZ_MAX = 70, EL_MIN = -10, EL_MAX = 50, CELL_DEG = 5;
export const AZ_CELLS = 28, EL_CELLS = 12, CELL_COUNT = 336;

export const JAM_AZ = 40 * deg, JAM_EL = 15 * deg;
export const PULSE_SPEED = 12;         // scene units / s
export const TRACK_UPDATE_S = 0.1;     // track-beam re-point cadence (10 Hz)
export const PATTERN_PERIOD = { sector: 6, raster: 16, circular: 4, spiral: 8, agile: 0 };

// ---------------------------------------------------------------------------
// Angle helpers
// ---------------------------------------------------------------------------

/** Unit direction for (az, el): boresight is +Z, az positive towards +X, el towards +Y. */
export function dirFromAzEl(az, el, out = new THREE.Vector3()) {
  const ce = Math.cos(el);
  return out.set(ce * Math.sin(az), Math.sin(el), ce * Math.cos(az));
}

/** Inverse of dirFromAzEl; tolerates non-unit vectors. */
export function azElFromDir(dir, out = { az: 0, el: 0 }) {
  out.az = Math.atan2(dir.x, dir.z);
  out.el = Math.atan2(dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z));
  return out;
}

/** Coverage cell index for (az, el) in radians, or −1 outside the az/el rectangle. */
export function cellIndex(azRad, elRad) {
  const ai = Math.floor((azRad / deg - AZ_MIN) / CELL_DEG);
  const ei = Math.floor((elRad / deg - EL_MIN) / CELL_DEG);
  if (ai < 0 || ai >= AZ_CELLS || ei < 0 || ei >= EL_CELLS) return -1;
  return ei * AZ_CELLS + ai;
}

/** Centre of cell `ci` in radians. */
export function cellCenter(ci, out = { az: 0, el: 0 }) {
  const ai = ci % AZ_CELLS;
  const ei = (ci - ai) / AZ_CELLS;
  out.az = (AZ_MIN + (ai + 0.5) * CELL_DEG) * deg;
  out.el = (EL_MIN + (ei + 0.5) * CELL_DEG) * deg;
  return out;
}

// Like cellIndex, but clamps the indices into the rectangle instead of returning −1.
function cellIndexClamped(azRad, elRad) {
  let ai = Math.floor((azRad / deg - AZ_MIN) / CELL_DEG);
  let ei = Math.floor((elRad / deg - EL_MIN) / CELL_DEG);
  ai = ai < 0 ? 0 : ai >= AZ_CELLS ? AZ_CELLS - 1 : ai;
  ei = ei < 0 ? 0 : ei >= EL_CELLS ? EL_CELLS - 1 : ei;
  return ei * AZ_CELLS + ai;
}

// ---------------------------------------------------------------------------
// Scan patterns — take pattern time (s), write radians into `out`
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;
const mod = (a, n) => ((a % n) + n) % n;
const frac = (u) => u - Math.floor(u);
/** Triangle wave, period 1: −1 at u = 0, +1 at u = 0.5, −1 at u = 1. */
const tri = (u) => 1 - 4 * Math.abs(frac(u) - 0.5);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function setDeg(out, azDeg, elDeg) {
  out.az = azDeg * deg;
  out.el = elDeg * deg;
  return out;
}

// Seeded 32-bit LCG (Numerical Recipes constants). `lcgHash` scrambles a seed so that
// consecutive seeds do not map to neighbouring outputs, which a single LCG step would do.
const LCG_A = 1664525, LCG_C = 1013904223, INV_2_32 = 1 / 4294967296;
const lcgStep = (s) => (Math.imul(s, LCG_A) + LCG_C) >>> 0;
function lcgHash(seed) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  s = lcgStep(s); s ^= s >>> 16;
  s = lcgStep(s); s ^= s >>> 13;
  return lcgStep(s);
}

export const PATTERNS = {
  // Horizontal sweep ±60° at 10° elevation, there and back over 6 s.
  sector: (t, out = { az: 0, el: 0 }) => setDeg(out, 60 * tri(t / 6), 10),

  // 8 bars of 2 s (el 5°…40°); a period-4 triangle sweeps −60→+60 on even bars and
  // +60→−60 on odd bars, so the path is a boustrophedon with no jump between bars.
  raster: (t, out = { az: 0, el: 0 }) => {
    const bar = mod(Math.floor(t / 2), 8);
    return setDeg(out, 60 * tri(t / 4), 5 + 5 * bar);
  },

  // Loop around a cued position (0°, 22°).
  circular: (t, out = { az: 0, el: 0 }) => {
    const w = TWO_PI * t / 4;
    return setDeg(out, 20 * Math.cos(w), 22 + 15 * Math.sin(w));
  },

  // Expanding 4-turn spiral about (0°, 20°), stretched 1.6× in azimuth.
  spiral: (t, out = { az: 0, el: 0 }) => {
    const u = mod(t, 8) / 8;
    const r = 28 * u;
    const th = 8 * Math.PI * u;
    return setDeg(out, 1.6 * r * Math.cos(th), clamp(20 + r * Math.sin(th), -9, 48));
  },

  // Pseudo-random hop every 120 ms, az ∈ [−60, 60), el ∈ [−8, 45) — inside the 70° cone.
  agile: (t, out = { az: 0, el: 0 }) => {
    let s = lcgHash(Math.floor(t / 0.12));
    const az = -60 + 120 * s * INV_2_32;
    s = lcgStep(s ^ (s >>> 16));
    const el = -8 + 53 * s * INV_2_32;
    return setDeg(out, az, el);
  },
};

// ---------------------------------------------------------------------------
// Beam scheduler
// ---------------------------------------------------------------------------

const ELEMENTS_PER_QUADRANT = 144, ELEMENT_TOTAL = 576;
const MIN_COS = 0.34;                       // cos 70°: floor for the 1/cosθ broadening
const FOOTPRINT = [0, 0.6, 0.85, 1.0, 1.2]; // by number of contributing quadrants
const PHASE_CENTRES = [
  new THREE.Vector3(-0.6, -0.6, 0.05),      // q0 lower-left  (−X, −Y)
  new THREE.Vector3(0.6, -0.6, 0.05),       // q1 lower-right (+X, −Y)
  new THREE.Vector3(-0.6, 0.6, 0.05),       // q2 upper-left  (−X, +Y)
  new THREE.Vector3(0.6, 0.6, 0.05),        // q3 upper-right (+X, +Y)
];
const ACQUIRE_FALLBACK_S = 1.5;             // acquiring → take nearest-boresight target after this
const ACQ_ORBIT_RAD = 8 * deg, ACQ_ORBIT_RATE = 1.2;
const COS_SCAN_MAX = Math.cos(SCAN_MAX);

const _azel = { az: 0, el: 0 };

function makeBeam(id, type) {
  return {
    id, type,
    color: type === 'search' ? COLORS.search : COLORS.track,
    az: 0, el: 0,
    dir: new THREE.Vector3(0, 0, 1),
    origin: new THREE.Vector3(0, 0, 0.05),
    footprint: FOOTPRINT[4],
    widthDeg: BASE_BW,
    gain: 0,
    quadrants: [],
    targetId: null,
    dwell: 0,
    lastUpdate: 0,
    hops: 0,
  };
}

// Fill beam.quadrants from a bitmask and derive origin (mean phase centre) and footprint.
function setQuadrants(beam, mask) {
  const qs = beam.quadrants;
  qs.length = 0;
  beam.origin.set(0, 0, 0);
  for (let q = 0; q < 4; q++) {
    if (mask & (1 << q)) {
      qs.push(q);
      beam.origin.add(PHASE_CENTRES[q]);
    }
  }
  beam.origin.divideScalar(qs.length);
  beam.footprint = FOOTPRINT[qs.length];
}

function findTarget(targets, id) {
  for (let i = 0; i < targets.length; i++) if (targets[i].id === id) return targets[i];
  return null;
}

function inCoverage(target) {
  return cellIndex(target.az, target.el) !== -1
    && Math.cos(target.el) * Math.cos(target.az) >= COS_SCAN_MAX;
}

function mostRecentlySeen(targets) {
  let best = null;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.detected && (best === null || t.lastSeen > best.lastSeen)) best = t;
  }
  return best;
}

function strongestUntracked(targets) {
  let best = null;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.detected && !t.tracked && (best === null || t.strength > best.strength)) best = t;
  }
  return best;
}

// Cued acquisition fallback: any untracked target, detected or not, nearest to boresight.
function nearestBoresight(targets) {
  let best = null, bestCos = -2;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.tracked) continue;
    const c = Math.cos(t.el) * Math.cos(t.az);   // dir.z — larger means closer to boresight
    if (c > bestCos) { bestCos = c; best = t; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Resource manager — the pooled beam is time-shared between tasks
// ---------------------------------------------------------------------------

const SEARCH_DWELL = 0.1;      // s per search position (sim time, ~10× slow)
const TRACK_DWELL = 0.06;      // s per track-while-scan update
const CONFIRM_DWELL = 0.08;    // s to confirm a fresh detection
const LOG_WINDOW = 10;         // s of dwell history kept for the timeline
const LOAD_WINDOW = 4;         // s over which task occupancy is measured
const MAX_MISSES = 3;          // consecutive missed updates before a TWS track is dropped
const DETECT_SNR = 0.15;       // analytic detection threshold for a dedicated dwell
const CONFIRM_WINDOW_S = 0.5;  // a detection must be this fresh to request confirmation
const CONFIRM_COOLDOWN_S = 2;  // after a failed confirm / a drop, before trying again
const DROP_COOLDOWN_S = 2;     // minimum spacing between overload drops

/**
 * Discrete beam scheduler with a resource manager. Writes `state.beams` (stable Beam objects,
 * reordered only when the set changes), target tracked / TWS flags, the dwell log used by the
 * timeline strip, and the beam-related telemetry.
 */
export function createScheduler(elementsApi) {
  const search = makeBeam(0, 'search');
  const tracks = [makeBeam(1, 'track'), makeBeam(2, 'track'), makeBeam(3, 'track'), makeBeam(4, 'track')];
  for (let q = 0; q < 4; q++) setQuadrants(tracks[q], 1 << q);
  search.dwellType = 'search';
  search.trackDwell = false;
  search.patternTime = 0;

  const trackActive = [false, false, false, false];
  let searchMask = 0;     // quadrants pooled into the search beam
  let searchCell = -1;    // cell the search beam currently dwells on
  let membership = -1;    // bit 0 = search beam live, bits 1..4 = track beams live
  let beamsRef = null;    // state.beams array we last filled
  let lastState = null;

  // manager state
  let patternTime = 0;                                   // advances only during search dwells
  const dwell = { type: 'idle', start: 0, until: 0, targetId: null };
  const manager = {
    dwells: [],   // { lane, type, start, end, id }  lane 0 = pooled beam, 1..4 = dedicated quadrants
    events: [],   // { type: 'detect'|'confirmed'|'lost'|'overload', id, t }
    stats: { search: 0, track: 0, confirm: 0, idle: 0, twsTracks: 0, frameS: 0, overload: false },
  };
  let overloadUntil = -Infinity, lastDrop = -Infinity, lastLoadCheck = -Infinity;

  const activeCount = elementsApi && typeof elementsApi.activeCountByQuadrant === 'function'
    ? (q, state) => elementsApi.activeCountByQuadrant(q)
    : (q, state) => Math.round(ELEMENTS_PER_QUADRANT * (1 - state.failedFraction));

  function logDwell(lane, type, start, end, id) { manager.dwells.push({ lane, type, start, end, id }); }
  function logEvent(type, id, t) { manager.events.push({ type, id, t }); }
  function prune(t) {
    const d = manager.dwells; let k = 0;
    while (k < d.length && d[k].end < t - LOG_WINDOW) k++;
    if (k) d.splice(0, k);
    const e = manager.events; k = 0;
    while (k < e.length && e[k].t < t - LOG_WINDOW) k++;
    if (k) e.splice(0, k);
  }

  // Analytic outcome of a dedicated dwell on a target (the visual echoes are 1-in-100 samples
  // and too sparse to gate the tracker on): same SNR law as beams.js, same jamming rules.
  function dwellSnr(target, state) {
    const rr = (0.8 * DOME_RADIUS) / target.range;
    let snr = search.gain * target.rcs * rr * rr * rr * rr;
    if (state.jamming) {
      if (!state.nulling && Math.abs(target.az - JAM_AZ) < 10 * deg) snr = 0;
      else if (state.nulling) {
        const c = Math.cos(target.el) * Math.cos(target.az - JAM_AZ) * Math.cos(JAM_EL) + Math.sin(target.el) * Math.sin(JAM_EL);
        if (c > Math.cos(search.widthDeg * deg)) snr = 0;
      }
    }
    return snr * dopplerFactor(target, search.el, state);
  }

  function illuminate(target, snr, t) {
    target.lastSeen = t;
    target.detected = true;
    target.strength = Math.max(target.strength, Math.min(1, snr));
    target.ping = 1;
  }

  function dropTrack(target, reason, t) {
    target.tws = false;
    target.misses = 0;
    target.cooldownUntil = t + CONFIRM_COOLDOWN_S;
    logEvent(reason, target.id, t);
  }

  function beginDwell(type, duration, target, t) {
    dwell.type = type;
    dwell.start = t;
    dwell.until = t + duration;
    dwell.targetId = target ? target.id : null;
    search.trackDwell = type !== 'search';
    search.dwellType = type === 'search' ? 'search' : 'track';
    search.color = type === 'search' ? COLORS.search : type === 'track' ? COLORS.track : COLORS.detect;
    if (target) { search.az = target.az; search.el = target.el; }
  }

  function closeDwell(state, t) {
    if (dwell.type === 'idle') return;
    logDwell(0, dwell.type, dwell.start, dwell.until, dwell.targetId);
    if (dwell.type === 'search') return;
    const target = findTarget(state.targets, dwell.targetId);
    if (!target) return;
    const snr = dwellSnr(target, state);
    const hit = snr > DETECT_SNR;
    if (dwell.type === 'confirm') {
      target.confirmPending = false;
      if (hit) {
        illuminate(target, snr, t);
        target.tws = true;
        target.misses = 0;
        target.nextUpdate = t + state.trackRevisit;
        logEvent('confirmed', target.id, t);
      } else {
        target.cooldownUntil = t + CONFIRM_COOLDOWN_S;
      }
    } else if (dwell.type === 'track') {
      if (hit) {
        illuminate(target, snr, t);
        target.misses = 0;
      } else {
        target.misses++;
      }
      target.nextUpdate = t + state.trackRevisit;
      if (target.misses >= MAX_MISSES) dropTrack(target, 'lost', t);
    }
  }

  function startNextDwell(state, t) {
    const targets = state.targets;
    // 1. confirmation of the oldest fresh detection
    let pick = null;
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (tg.confirmPending && (pick === null || tg.confirmRequested < pick.confirmRequested)) pick = tg;
    }
    if (pick) { beginDwell('confirm', CONFIRM_DWELL, pick, t); return; }
    // 2. the most overdue track update
    let due = null;
    for (let i = 0; i < targets.length; i++) {
      const tg = targets[i];
      if (tg.tws && tg.nextUpdate <= t && (due === null || tg.nextUpdate < due.nextUpdate)) due = tg;
    }
    if (due) { beginDwell('track', TRACK_DWELL, due, t); return; }
    // 3. search: the pattern only advances here
    patternTime += SEARCH_DWELL * state.scanRate;
    search.patternTime = patternTime;
    const pattern = PATTERNS[state.scanPattern] || PATTERNS.raster;
    pattern(patternTime, _azel);
    const ci = cellIndexClamped(_azel.az, _azel.el);
    if (ci !== searchCell) { searchCell = ci; search.hops++; }
    cellCenter(ci, _azel);
    search.az = _azel.az;
    search.el = _azel.el;
    beginDwell('search', SEARCH_DWELL, null, t);
  }

  function requestConfirmations(state, t) {
    for (let i = 0; i < state.targets.length; i++) {
      const tg = state.targets[i];
      if (tg.detected && !tg.tws && !tg.tracked && !tg.confirmPending && t >= tg.cooldownUntil
        && t - tg.lastSeen < CONFIRM_WINDOW_S && tg.lastSeen > tg.lastConfirmTry) {
        tg.confirmPending = true;
        tg.confirmRequested = t;
        tg.lastConfirmTry = t;
        logEvent('detect', tg.id, t);
      }
    }
  }

  function measureLoad(state, t) {
    let s = 0, tr = 0, c = 0;
    const from = t - LOAD_WINDOW;
    for (let i = 0; i < manager.dwells.length; i++) {
      const d = manager.dwells[i];
      if (d.lane !== 0 || d.end < from) continue;
      const len = Math.min(d.end, t) - Math.max(d.start, from);
      if (len <= 0) continue;
      if (d.type === 'search') s += len; else if (d.type === 'track') tr += len; else if (d.type === 'confirm') c += len;
    }
    const win = Math.min(LOAD_WINDOW, Math.max(0.5, t));
    const st = manager.stats;
    st.search = s / win; st.track = tr / win; st.confirm = c / win;
    st.idle = Math.max(0, 1 - st.search - st.track - st.confirm);
    let n = 0;
    for (let i = 0; i < state.targets.length; i++) if (state.targets[i].tws) n++;
    st.twsTracks = n;
    const period = PATTERN_PERIOD[state.scanPattern] || 0;
    st.frameS = period ? period / Math.max(0.05, st.search) / state.scanRate : 0;

    // overload: the busiest track load allowed; beyond it the farthest TWS track is shed
    if (st.track + st.confirm > state.trackLoadCap && n >= 2 && t - lastDrop > DROP_COOLDOWN_S && t > LOAD_WINDOW) {
      let victim = null;
      for (let i = 0; i < state.targets.length; i++) {
        const tg = state.targets[i];
        if (tg.tws && (victim === null || tg.range > victim.range)) victim = tg;
      }
      if (victim) { dropTrack(victim, 'overload', t); lastDrop = t; overloadUntil = t + 2; }
    }
    st.overload = t < overloadUntil;
  }

  function updateManager(state) {
    const t = state.time;
    if (!state.running) { search.dwell = Math.max(0, t - dwell.start); return; }
    requestConfirmations(state, t);
    if (t >= dwell.until) {
      closeDwell(state, t);
      startNextDwell(state, t);
    }
    if (dwell.type === 'track' || dwell.type === 'confirm') {
      const tg = findTarget(state.targets, dwell.targetId);
      if (tg) { search.az = tg.az; search.el = tg.el; }
    }
    search.dwell = t - dwell.start;
    if (t - lastLoadCheck >= 0.1) { lastLoadCheck = t; measureLoad(state, t); prune(t); }
  }

  // ---- dedicated track quadrants (spatially split beams) --------------------------------------
  function releaseTarget(target, q) {
    if (target.trackedBy === q) {
      target.tracked = false;
      target.trackedBy = null;
    }
  }

  function assign(beam, q, target, time) {
    beam.targetId = target.id;
    beam.dwell = 0;
    beam.lastUpdate = time;
    beam.hops++;
    beam.az = target.az;
    beam.el = target.el;
    target.tracked = true;
    target.trackedBy = q;
  }

  function updateTrack(beam, q, step, state) {
    const targets = state.targets;
    const t = state.time;
    if (!trackActive[q]) {
      trackActive[q] = true;
      beam.targetId = null;
      beam.dwell = 0;
      beam.lastUpdate = t;
    }
    beam.dwell += step;

    let target = beam.targetId !== null ? findTarget(targets, beam.targetId) : null;
    if (beam.targetId !== null && (target === null || !inCoverage(target))) {
      if (target !== null) releaseTarget(target, q);
      target = null;
      beam.targetId = null;
      beam.dwell = 0;
    }

    if (target === null) {
      target = strongestUntracked(targets);
      if (target === null && beam.dwell >= ACQUIRE_FALLBACK_S) target = nearestBoresight(targets);
      if (target !== null) assign(beam, q, target, t);
    }

    if (target !== null) {
      target.tracked = true;
      if (target.trackedBy === null) target.trackedBy = q;
      if (t - beam.lastUpdate >= TRACK_UPDATE_S) {
        beam.az = target.az;
        beam.el = target.el;
        if (state.running) logDwell(1 + q, 'track', beam.lastUpdate, t, target.id);
        beam.lastUpdate = t;
        beam.hops++;
      }
    } else {
      // Acquiring: orbit boresight until something is detected.
      const w = ACQ_ORBIT_RATE * t;
      beam.az = ACQ_ORBIT_RAD * Math.cos(w);
      beam.el = ACQ_ORBIT_RAD * Math.sin(w);
      if (state.running && t - beam.lastUpdate >= TRACK_UPDATE_S) {
        logDwell(1 + q, 'acquire', beam.lastUpdate, t, null);
        beam.lastUpdate = t;
      }
    }
  }

  function deactivateTrack(beam, q, state) {
    if (!trackActive[q]) return;
    trackActive[q] = false;
    if (beam.targetId !== null) {
      const target = findTarget(state.targets, beam.targetId);
      if (target !== null) releaseTarget(target, q);
      beam.targetId = null;
    }
    beam.dwell = 0;
  }

  // Direction, beamwidth and gain for one beam from its pointing and contributing quadrants.
  function finishBeam(beam, state) {
    dirFromAzEl(beam.az, beam.el, beam.dir);
    const cosT = Math.max(beam.dir.z, MIN_COS);
    const qs = beam.quadrants;
    let used = 0;
    for (let i = 0; i < qs.length; i++) used += activeCount(qs[i], state);
    const spacing = state.spacingLambda || 0.5, taper = state.taper || 0;
    beam.widthDeg = BASE_BW * Math.sqrt(ELEMENT_TOTAL / (ELEMENTS_PER_QUADRANT * qs.length)) / cosT * (0.5 / spacing) * (1 + 0.5 * taper);
    beam.gain = (used / ELEMENT_TOTAL) * (state.power / 100) * Math.pow(cosT, 1.3) * (1 - state.failedFraction) * (1 - 0.5 * taper);
  }

  function rebuildBeams(state, smask, tmask) {
    const arr = state.beams;
    arr.length = 0;
    if (smask) arr.push(search);
    for (let q = 0; q < 4; q++) if (tmask & (1 << q)) arr.push(tracks[q]);
    beamsRef = arr;
  }

  function writeTelemetry(state, primary, activeSubarrays) {
    const tel = state.telemetry;
    if (primary !== null) {
      const cosT = Math.max(primary.dir.z, MIN_COS);
      tel.beamAzDeg = primary.az / deg;
      tel.beamElDeg = primary.el / deg;
      tel.steerAngleDeg = Math.acos(clamp(primary.dir.z, -1, 1)) / deg;
      tel.beamwidthDeg = primary.widthDeg;
      tel.scanLossDb = -13 * Math.log10(cosT);
      tel.dwellMs = primary.dwell * 1000;
      tel.pulsesPerDwell = Math.round(state.prf * primary.dwell);
    } else {
      tel.beamAzDeg = 0;
      tel.beamElDeg = 0;
      tel.steerAngleDeg = 0;
      tel.beamwidthDeg = BASE_BW;
      tel.scanLossDb = 0;
      tel.dwellMs = 0;
      tel.pulsesPerDwell = 0;
    }
    tel.activeBeams = state.beams.length;
    tel.activeSubarrays = activeSubarrays;
    tel.hops = search.hops;

    const nq = primary !== null ? primary.quadrants.length : 4;
    const alive = Math.max(1 - state.failedFraction, 1e-3);
    tel.eirpLossDb = -20 * Math.log10(alive) - 20 * Math.log10(nq / 4);

    let tracked = 0, detected = 0;
    const targets = state.targets;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].tracked || targets[i].tws) tracked++;
      if (targets[i].detected) detected++;
    }
    tel.tracked = tracked;
    tel.detected = detected;
    const st = manager.stats;
    tel.rmSearchPct = st.search * 100;
    tel.rmTrackPct = st.track * 100;
    tel.rmConfirmPct = st.confirm * 100;
    tel.rmTracks = st.twsTracks;
    tel.rmFrameS = st.frameS;
    tel.rmOverload = st.overload;
  }

  function update(dt, state) {
    lastState = state;
    const step = state.running ? dt : 0;   // dwell clocks follow the sim clock, which halts when idle
    const modes = state.quadrantModes;

    let smask = 0, tmask = 0, activeSubarrays = 0;
    for (let q = 0; q < 4; q++) {
      const m = modes[q];
      if (m === 'search') { smask |= 1 << q; activeSubarrays++; }
      else if (m === 'track') { tmask |= 1 << q; activeSubarrays++; }
    }

    if (smask !== 0) {
      if (smask !== searchMask) { searchMask = smask; setQuadrants(search, smask); }
      finishBeam(search, state);     // gain is needed by the dwell outcome before re-pointing
      updateManager(state);
      finishBeam(search, state);
    } else if (dwell.type !== 'idle') {
      dwell.type = 'idle';
      search.trackDwell = false;
      search.dwellType = 'search';
      search.color = COLORS.search;
    }

    let primary = smask !== 0 ? search : null;
    for (let q = 0; q < 4; q++) {
      const beam = tracks[q];
      if (tmask & (1 << q)) {
        updateTrack(beam, q, step, state);
        finishBeam(beam, state);
        if (primary === null) primary = beam;
      } else {
        deactivateTrack(beam, q, state);
      }
    }

    const mem = (smask !== 0 ? 1 : 0) | (tmask << 1);
    if (mem !== membership || state.beams !== beamsRef) {
      membership = mem;
      rebuildBeams(state, smask, tmask);
    }

    writeTelemetry(state, primary, activeSubarrays);
  }

  function resetBeam(beam) {
    beam.az = 0;
    beam.el = 0;
    beam.dir.set(0, 0, 1);
    beam.targetId = null;
    beam.dwell = 0;
    beam.lastUpdate = 0;
    beam.hops = 0;
    beam.gain = 0;
    beam.color = beam.type === 'search' ? COLORS.search : COLORS.track;
  }

  function reset() {
    resetBeam(search);
    search.trackDwell = false;
    search.dwellType = 'search';
    search.patternTime = 0;
    for (let q = 0; q < 4; q++) {
      resetBeam(tracks[q]);
      trackActive[q] = false;
    }
    searchMask = 0;
    searchCell = -1;
    membership = -1;
    patternTime = 0;
    dwell.type = 'idle'; dwell.start = 0; dwell.until = 0; dwell.targetId = null;
    manager.dwells.length = 0;
    manager.events.length = 0;
    Object.assign(manager.stats, { search: 0, track: 0, confirm: 0, idle: 0, twsTracks: 0, frameS: 0, overload: false });
    overloadUntil = -Infinity; lastDrop = -Infinity; lastLoadCheck = -Infinity;
    if (lastState !== null) {
      lastState.beams.length = 0;
      const targets = lastState.targets;
      for (let i = 0; i < targets.length; i++) {
        targets[i].tracked = false;
        targets[i].trackedBy = null;
        targets[i].tws = false;
      }
    }
  }

  return { update, reset, manager };
}
