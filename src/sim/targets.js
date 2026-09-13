import { DOME_RADIUS, deg } from '../radar/scan.js';

export class Target {
  constructor(id, azDeg, elDeg, rangeFrac, vazDeg, velDeg, rcs, vr = 0) {
    this.id = id;
    this.az = azDeg * deg;
    this.el = elDeg * deg;
    this.range = rangeFrac * DOME_RADIUS;
    this.vaz = vazDeg * deg;
    this.vel = velDeg * deg;
    this.rcs = rcs;
    this.vr = vr;               // radial velocity, m/s, positive = closing
    this.detected = false;
    this.tracked = false;
    this.trackedBy = null;
    this.lastSeen = -Infinity;
    this.strength = 0;
    this.ping = 0;
    // resource-manager (track-while-scan) bookkeeping
    this.tws = false;
    this.confirmPending = false;
    this.confirmRequested = -Infinity;
    this.lastConfirmTry = -Infinity;
    this.nextUpdate = 0;
    this.misses = 0;
    this.cooldownUntil = -Infinity;
  }
}

// az°, el°, range (× DOME_RADIUS), az rate °/s, el rate °/s, RCS m², radial velocity m/s (+ closing)
// T2's 56.9 m/s is 3× the 1200 Hz blind speed (PRF·λ/2 = 18.96 m/s): it folds onto zero Doppler.
const INITIAL = [
  [-35, 12, 0.72, 2.2, 0.6, 20, -120],
  [10, 28, 0.85, -1.6, 0.9, 5, 235],
  [42, 8, 0.66, -2.8, 1.2, 2, 56.9],
  [-12, 38, 0.92, 1.4, -1.1, 1, -2],
  [25, 18, 0.9, -3.5, -0.7, 0.5, 300],
];
const UNITS_PER_M = DOME_RADIUS / 150000;   // 10 scene units = 150 km
const RANGE_LO = 0.55 * DOME_RADIUS, RANGE_HI = 0.95 * DOME_RADIUS;

const AZ_LIM = 60 * deg, EL_LO = -5 * deg, EL_HI = 45 * deg;
const DETECT_MEMORY_S = 12;

export function createTargets(count = 5) {
  const out = [];
  for (let i = 0; i < Math.min(count, INITIAL.length); i++) out.push(new Target(i, ...INITIAL[i]));
  return out;
}

export function updateTargets(dt, state) {
  const running = state.running;
  for (const t of state.targets) {
    if (running) {
      t.az += t.vaz * dt;
      t.el += t.vel * dt;
      if (t.az > AZ_LIM) { t.az = AZ_LIM; t.vaz = -Math.abs(t.vaz); }
      else if (t.az < -AZ_LIM) { t.az = -AZ_LIM; t.vaz = Math.abs(t.vaz); }
      if (t.el > EL_HI) { t.el = EL_HI; t.vel = -Math.abs(t.vel); }
      else if (t.el < EL_LO) { t.el = EL_LO; t.vel = Math.abs(t.vel); }
      t.range -= t.vr * dt * UNITS_PER_M;
      if (t.range < RANGE_LO) { t.range = RANGE_LO; t.vr = -Math.abs(t.vr); }
      else if (t.range > RANGE_HI) { t.range = RANGE_HI; t.vr = Math.abs(t.vr); }
    }
    if (t.detected && !t.tracked && !t.tws && state.time - t.lastSeen > DETECT_MEMORY_S) t.detected = false;
    t.strength *= Math.exp(-0.3 * dt);
    t.ping = Math.max(0, t.ping - dt / 0.3);
  }
}

export function markIlluminated(target, state, beamType, snr) {
  target.lastSeen = state.time;
  target.detected = true;
  target.strength = Math.max(target.strength, Math.min(1, snr));
  target.ping = 1;
}

export const rangeKm = (t) => (t.range / DOME_RADIUS) * 150;
