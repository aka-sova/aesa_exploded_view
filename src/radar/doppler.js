// Pulse-Doppler relations and the range–Doppler map of the current dwell.
//
// Everything here is in real units (m/s, km, Hz) at X-band. The scene's PRF slider covers
// 200–4000 Hz — all "low PRF" in the usual sense: range is unambiguous out to c/2·PRF, but
// Doppler is sampled far too slowly for aircraft speeds and folds into ±PRF·λ/4.
export const LAMBDA_M = 0.0316;
export const C_M_S = 299792458;
export const RD_NV = 64, RD_NR = 40;            // map bins: velocity × range
const DEG = Math.PI / 180;
const DOME_KM = 150, DOME_UNITS = 10;           // scene range units → km
const CLUTTER_V_SIGMA = 0.8;                    // m/s — spectral width of the clutter ridge
const BLOB_SIGMA = 1.2;                         // bins

export const vUnamb = (prf) => (prf * LAMBDA_M) / 4;              // ± m/s
export const blindSpeed = (prf) => (prf * LAMBDA_M) / 2;          // m/s, spacing of MTI notches
export const rUnambKm = (prf) => C_M_S / (2 * prf) / 1000;
export const rangeKmOf = (target) => (target.range / DOME_UNITS) * DOME_KM;

export function foldVelocity(vr, prf) {
  const vu = vUnamb(prf);
  let f = (vr + vu) % (2 * vu);
  if (f < 0) f += 2 * vu;
  return f - vu;
}
export function foldRangeKm(km, prf) {
  const ru = rUnambKm(prf);
  return km - ru * Math.floor(km / ru);
}
/** Single-delay-canceller MTI: zero at every multiple of the blind speed (including 0). */
export const mtiGain = (vr, prf) => Math.abs(Math.sin((Math.PI * vr) / blindSpeed(prf)));

/** Ground clutter seen at a given range when the beam points at elevation `el` (rad). */
export function clutterLevel(rangeKm, el) {
  const g = Math.max(0, 1 - el / DEG / 15);
  return g > 0 ? 3 * g * Math.exp(-rangeKm / 40) : 0;
}

/** Multiplier on a target's SNR from Doppler processing: MTI notches, or burial in clutter. */
export function dopplerFactor(target, beamEl, state) {
  if (state.mti) return Math.max(mtiGain(target.vr, state.prf), 0.02);
  if (Math.abs(foldVelocity(target.vr, state.prf)) < 1.5 && clutterLevel(rangeKmOf(target), beamEl) > 0.05) return 0.15;
  return 1;
}

let noiseSeed = 12345;
const rand = () => { noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0; return noiseSeed / 4294967296; };

export function createRdSample() {
  return { cells: new Float32Array(RD_NV * RD_NR), blips: [], vUa: 0, rU: 0, strongest: null };
}

/** Fill `out` with the range–Doppler picture of `beam`'s current dwell. */
export function computeRdMap(state, beam, targets, out) {
  const prf = state.prf;
  const vUa = vUnamb(prf), rU = rUnambKm(prf);
  out.vUa = vUa; out.rU = rU;
  const cells = out.cells;
  const dv = (2 * vUa) / RD_NV, dr = rU / RD_NR;
  // receiver noise
  for (let i = 0; i < cells.length; i++) cells[i] = 0.004 * (0.3 + rand());
  // ground clutter ridge at zero velocity
  if (beam) {
    for (let rb = 0; rb < RD_NR; rb++) {
      const cl = clutterLevel((rb + 0.5) * dr, beam.el);
      if (cl < 0.01) continue;
      for (let vb = 0; vb < RD_NV; vb++) {
        const v = -vUa + (vb + 0.5) * dv;
        const g = Math.exp(-(v * v) / (2 * CLUTTER_V_SIGMA * CLUTTER_V_SIGMA));
        if (g > 0.01) cells[rb * RD_NV + vb] += cl * g * (0.7 + 0.6 * rand());
      }
    }
  }
  // targets inside the beam
  out.blips.length = 0;
  out.strongest = null;
  if (beam) {
    const sigma = 0.6 * beam.widthDeg * DEG;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const cosD = Math.cos(t.el) * Math.cos(beam.el) * Math.cos(t.az - beam.az) + Math.sin(t.el) * Math.sin(beam.el);
      const d = Math.acos(Math.min(1, Math.max(-1, cosD))) / sigma;
      const k = Math.exp(-d * d);
      if (k < 0.02) continue;
      const rr = (0.8 * DOME_UNITS) / t.range;
      const amp = beam.gain * t.rcs * rr * rr * rr * rr * k;
      if (amp < 0.003) continue;
      const fv = foldVelocity(t.vr, prf), fr = foldRangeKm(rangeKmOf(t), prf);
      const vc = (fv + vUa) / dv - 0.5, rc = fr / dr - 0.5;
      for (let rb = Math.max(0, Math.floor(rc - 3)); rb <= Math.min(RD_NR - 1, Math.ceil(rc + 3)); rb++) {
        for (let vb = Math.max(0, Math.floor(vc - 3)); vb <= Math.min(RD_NV - 1, Math.ceil(vc + 3)); vb++) {
          const e = ((vb - vc) ** 2 + (rb - rc) ** 2) / (2 * BLOB_SIGMA * BLOB_SIGMA);
          cells[rb * RD_NV + vb] += amp * Math.exp(-e);
        }
      }
      out.blips.push({ id: t.id, vBin: vc, rBin: rc, amp, vr: t.vr, fv });
      if (!out.strongest || amp > out.strongest.amp) out.strongest = out.blips[out.blips.length - 1];
    }
  }
  // MTI: notch zero Doppler (and, by periodicity, every blind speed)
  if (state.mti) {
    for (let vb = 0; vb < RD_NV; vb++) {
      const v = -vUa + (vb + 0.5) * dv;
      const h = Math.abs(Math.sin((Math.PI * v) / (2 * vUa)));
      for (let rb = 0; rb < RD_NR; rb++) cells[rb * RD_NV + vb] *= h;
    }
  }
  return out;
}
