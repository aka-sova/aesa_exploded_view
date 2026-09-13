/**
 * Beam visuals for the AESA Radar Lab: per-beam frusta with a centre line, one shared
 * InstancedMesh of pulse rings (wavefronts), one shared InstancedMesh of echo dots, the
 * sidelobe floor shown for failed modules, and the jammer (frustum + inward red rings).
 *
 * Contract: SPEC.md § src/radar/beams.js. All per-frame maths runs on module-scope scratch
 * objects; live pulses/echoes live in pre-allocated slot arrays and are never re-created.
 */
import * as THREE from 'three';
import { DOME_RADIUS, VIS_BEAM_SCALE, PULSE_SPEED, JAM_AZ, JAM_EL, deg, dirFromAzEl } from './scan.js';
import { COLORS } from '../sim/state.js';

const PULSE_MAX = 96;                 // ring instances shared by all beams and the jammer
const PULSE_SLOTS = PULSE_MAX / 2;    // each pulse owns two instances: head + tail
const ECHO_MAX = 32;
const SEG = 48;                       // frustum segments

const TAIL_BRIGHTNESS = 0.4;          // tail ring relative to its head
const ECHO_MIN_BRIGHTNESS = 0.4;      // visual floor so weak (SNR ~0.15) echoes stay visible
const JAM_RING_RADIUS = 0.8;
const JAM_RING_RATE = 4;              // rings per second
const JAM_RING_TRAVEL = DOME_RADIUS - 0.25;   // rings vanish just before touching the face
const SIDELOBE_MAX_HALF = 60 * deg;   // clamp on the 4x sidelobe half-angle at wide steer
const EMPTY = [];

// ---- scratch ---------------------------------------------------------------------------
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _Z = new THREE.Vector3(0, 0, 1);
const _BLACK = new THREE.Color(0, 0, 0);
const _HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);   // collapses an instance to nothing

const _jamDir = dirFromAzEl(JAM_AZ, JAM_EL, new THREE.Vector3());     // origin -> jammer
const _jamPos = _jamDir.clone().multiplyScalar(DOME_RADIUS);
const _jamTravel = _jamDir.clone().negate();                          // jammer -> origin

const COS = new Float32Array(SEG);
const SIN = new Float32Array(SEG);
for (let i = 0; i < SEG; i++) {
  const a = (i / SEG) * Math.PI * 2;
  COS[i] = Math.cos(a);
  SIN[i] = Math.sin(a);
}

// ---- frustum geometry (two rings of SEG vertices, quads between them) --------------------
function createFrustumGeometry() {
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(SEG * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const col = new THREE.BufferAttribute(new Float32Array(SEG * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const idx = new Uint16Array(SEG * 6);
  for (let s = 0; s < SEG; s++) {
    const a = s, b = (s + 1) % SEG, c = SEG + s, d = SEG + b;
    const o = s * 6;
    idx[o] = a; idx[o + 1] = b; idx[o + 2] = c;
    idx[o + 3] = b; idx[o + 4] = d; idx[o + 5] = c;
  }
  geo.setAttribute('position', pos);
  geo.setAttribute('color', col);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

/** Base ring (radius baseR) at z = 0, far ring (radius tipR) at z = DOME_RADIUS. */
function writeFrustumShape(geo, baseR, tipR) {
  const a = geo.attributes.position.array;
  for (let i = 0; i < SEG; i++) {
    const n = i * 3, f = (SEG + i) * 3;
    a[n] = COS[i] * baseR; a[n + 1] = SIN[i] * baseR; a[n + 2] = 0;
    a[f] = COS[i] * tipR;  a[f + 1] = SIN[i] * tipR;  a[f + 2] = DOME_RADIUS;
  }
  geo.attributes.position.needsUpdate = true;
}

/** Vertex colour = color x nearMul at the base ring, color x farMul at the far ring. */
function writeFrustumColor(geo, color, nearMul, farMul) {
  const a = geo.attributes.color.array;
  for (let i = 0; i < SEG; i++) {
    const n = i * 3, f = (SEG + i) * 3;
    a[n] = color.r * nearMul; a[n + 1] = color.g * nearMul; a[n + 2] = color.b * nearMul;
    a[f] = color.r * farMul;  a[f + 1] = color.g * farMul;  a[f + 2] = color.b * farMul;
  }
  geo.attributes.color.needsUpdate = true;
}

function createFrustumMaterial(opacity) {
  return new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
  });
}

// ---- per-beam body ----------------------------------------------------------------------
function createBeamBody(id) {
  const group = new THREE.Group();
  group.name = `beam-${id}`;

  const frustumGeo = createFrustumGeometry();
  const frustumMat = createFrustumMaterial(0.03);
  const frustum = new THREE.Mesh(frustumGeo, frustumMat);
  frustum.renderOrder = 3;
  frustum.frustumCulled = false;

  const sidelobeGeo = createFrustumGeometry();
  const sidelobeMat = createFrustumMaterial(0.05);
  const sidelobe = new THREE.Mesh(sidelobeGeo, sidelobeMat);
  sidelobe.renderOrder = 3;
  sidelobe.frustumCulled = false;
  sidelobe.visible = false;

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, DOME_RADIUS], 3));
  const lineSolid = new THREE.LineBasicMaterial({
    transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const lineDashed = new THREE.LineDashedMaterial({
    dashSize: 0.3, gapSize: 0.2,
    transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const line = new THREE.Line(lineGeo, lineSolid);
  line.computeLineDistances();   // once: the segment never changes in local space
  line.renderOrder = 3;
  line.frustumCulled = false;

  group.add(frustum, sidelobe, line);

  return {
    id, group,
    frustum, frustumGeo, frustumMat,
    sidelobe, sidelobeGeo, sidelobeMat,
    line, lineSolid, lineDashed,
    colorHex: -1, widthDeg: -1, footprint: -1,   // cached inputs; -1 forces the first write
    spawnAcc: 0,
    attached: false,
    seen: false,
  };
}

// ---- public factory ---------------------------------------------------------------------
export function createBeams(scene, elementsApi) {
  const root = new THREE.Group();
  root.name = 'beams';
  scene.add(root);

  // Shared pulse rings.
  const pulseMesh = new THREE.InstancedMesh(
    new THREE.RingGeometry(0.82, 1, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 1,
      depthWrite: false, fog: false,
    }),
    PULSE_MAX,
  );
  pulseMesh.name = 'pulses';
  pulseMesh.renderOrder = 4;
  pulseMesh.frustumCulled = false;
  pulseMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < PULSE_MAX; i++) {
    pulseMesh.setMatrixAt(i, _HIDDEN);
    pulseMesh.setColorAt(i, _BLACK);   // creates instanceColor before the first render
  }
  pulseMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  root.add(pulseMesh);

  // Shared echo dots.
  const echoMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.11, 12, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 1,
      depthWrite: false, fog: false,
    }),
    ECHO_MAX,
  );
  echoMesh.name = 'echoes';
  echoMesh.renderOrder = 4;
  echoMesh.frustumCulled = false;
  echoMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < ECHO_MAX; i++) {
    echoMesh.setMatrixAt(i, _HIDDEN);
    echoMesh.setColorAt(i, _BLACK);
  }
  echoMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  root.add(echoMesh);

  // Jammer: faint red frustum from the jammer position, +Z pointing at the array.
  const jamGroup = new THREE.Group();
  jamGroup.name = 'jammer';
  jamGroup.position.copy(_jamPos);
  jamGroup.visible = false;
  const jamGeo = createFrustumGeometry();
  writeFrustumShape(jamGeo, 0.35, 1.5);
  writeFrustumColor(jamGeo, _c.setHex(COLORS.fault), 1, 0.5);
  const jamMat = createFrustumMaterial(0.08);
  const jamMesh = new THREE.Mesh(jamGeo, jamMat);
  jamMesh.renderOrder = 4;
  jamMesh.frustumCulled = false;
  jamGroup.add(jamMesh);
  root.add(jamGroup);
  jamGroup.lookAt(0, 0, 0);
  let jamAcc = 0;
  let jamClock = 0;

  // Pulse slots (head instance 2i, tail instance 2i + 1).
  const pulses = [];
  for (let i = 0; i < PULSE_SLOTS; i++) {
    pulses.push({
      live: false, seq: 0, beam: null, type: 'search',
      dist: 0, prevDist: 0, travel: DOME_RADIUS,
      dir: new THREE.Vector3(), origin: new THREE.Vector3(),
      color: new THREE.Color(), colorHex: 0,
      gain: 0, widthDeg: 0, footprint: 0, tanHalf: 0,
      cosLimit: 1, sigma: 1,   // detection kernel cached at emission
    });
  }

  // Echo slots.
  const echoes = [];
  for (let i = 0; i < ECHO_MAX; i++) {
    echoes.push({
      live: false, seq: 0, beam: null, target: null, snr: 0,
      from: new THREE.Vector3(), to: new THREE.Vector3(),
      len: 1, dist: 0, brightness: 0,
    });
  }

  const bodies = [];          // beam bodies keyed by beam.id (linear search, <= 4 entries)
  let seq = 0;                // monotonic spawn counter used to find the oldest slot
  let pulsesDirty = false;
  let echoesDirty = false;

  const api = {
    group: root,
    update,
    reset,
    onPulse: null,
    onPulseArrival: null,
    onEcho: null,
  };

  // ---- beam bodies ----------------------------------------------------------------------
  function getBody(id) {
    for (let i = 0; i < bodies.length; i++) if (bodies[i].id === id) return bodies[i];
    const body = createBeamBody(id);
    bodies.push(body);
    return body;
  }

  function attachBody(body) {
    root.add(body.group);
    body.attached = true;
  }

  function detachBody(body) {
    root.remove(body.group);
    body.attached = false;
    body.spawnAcc = 0;
    body.colorHex = -1;   // force a full rewrite when the beam reappears
    body.widthDeg = -1;
    body.footprint = -1;
  }

  function updateBody(body, beam, state, running) {
    const g = body.group;
    g.position.copy(beam.origin);
    _v1.copy(beam.origin).add(beam.dir);
    g.lookAt(_v1);   // non-camera lookAt: local +Z becomes the beam axis

    if (Math.abs(beam.widthDeg - body.widthDeg) > 1e-3 || Math.abs(beam.footprint - body.footprint) > 1e-3) {
      body.widthDeg = beam.widthDeg;
      body.footprint = beam.footprint;
      const half = beam.widthDeg * 0.5 * VIS_BEAM_SCALE * deg;
      writeFrustumShape(body.frustumGeo, beam.footprint, beam.footprint + DOME_RADIUS * Math.tan(half));
      const sideHalf = Math.min(half * 4, SIDELOBE_MAX_HALF);
      writeFrustumShape(body.sidelobeGeo, beam.footprint, beam.footprint + DOME_RADIUS * Math.tan(sideHalf));
    }

    if (beam.color !== body.colorHex) {
      body.colorHex = beam.color;
      _c.setHex(beam.color);
      writeFrustumColor(body.frustumGeo, _c, 1, 0.25);
      writeFrustumColor(body.sidelobeGeo, _c, 1, 0.25);
      body.lineSolid.color.copy(_c);
      body.lineDashed.color.copy(_c);
    }

    body.frustumMat.opacity = running ? 0.04 + 0.14 * Math.sqrt(Math.max(0, beam.gain)) : 0.03;

    const failed = state.failedFraction > 0;
    body.sidelobe.visible = failed;
    if (failed) {
      // Diffuse floor from failed modules; dimmed with the main lobe when not radiating.
      body.sidelobeMat.opacity = (running ? 0.05 : 0.03) * (state.failedFraction / 0.15);
    }

    const dashed = beam.type === 'track' && beam.targetId === null;
    const lineMat = dashed ? body.lineDashed : body.lineSolid;
    if (body.line.material !== lineMat) body.line.material = lineMat;
  }

  // ---- pulses ---------------------------------------------------------------------------
  function acquirePulseSlot() {
    let oldest = null;
    for (let i = 0; i < PULSE_SLOTS; i++) {
      const p = pulses[i];
      if (!p.live) return p;
      if (oldest === null || p.seq < oldest.seq) oldest = p;
    }
    return oldest;   // full: overwrite the oldest in flight
  }

  function hidePulseInstances(slot) {
    const head = slot * 2;
    pulseMesh.setMatrixAt(head, _HIDDEN);
    pulseMesh.setMatrixAt(head + 1, _HIDDEN);
    pulseMesh.setColorAt(head, _BLACK);
    pulseMesh.setColorAt(head + 1, _BLACK);
    pulsesDirty = true;
  }

  function freePulse(slot) {
    const p = pulses[slot];
    p.live = false;
    p.beam = null;
    hidePulseInstances(slot);
  }

  function spawnBeamPulse(beam) {
    const p = acquirePulseSlot();
    p.live = true;
    p.seq = ++seq;
    p.beam = beam;
    p.type = beam.dwellType || beam.type;
    p.dist = 0;
    p.prevDist = 0;
    p.travel = DOME_RADIUS;
    p.dir.copy(beam.dir);
    p.origin.copy(beam.origin);
    p.colorHex = beam.color;
    p.color.setHex(beam.color);
    p.gain = beam.gain;
    p.widthDeg = beam.widthDeg;
    p.footprint = beam.footprint;
    p.tanHalf = Math.tan(beam.widthDeg * 0.5 * VIS_BEAM_SCALE * deg);
    p.cosLimit = Math.cos(beam.widthDeg * 1.5 * deg);
    p.sigma = 0.6 * beam.widthDeg * deg;
    elementsApi.pulseFlash(beam.quadrants);
    if (api.onPulse) api.onPulse(beam);
  }

  function spawnJamRing() {
    const p = acquirePulseSlot();
    p.live = true;
    p.seq = ++seq;
    p.beam = null;
    p.type = 'jam';
    p.dist = 0;
    p.prevDist = 0;
    p.travel = JAM_RING_TRAVEL;
    p.dir.copy(_jamTravel);
    p.origin.copy(_jamPos);
    p.colorHex = COLORS.fault;
    p.color.setHex(COLORS.fault);
    p.gain = 0;
    p.widthDeg = 0;
    p.footprint = JAM_RING_RADIUS;
    p.tanHalf = 0;
    p.cosLimit = 1;
    p.sigma = 1;
  }

  /** 0.9 at emission falling to 0.45 at the dome, never lower. */
  function ringBrightness(dist) {
    const b = 0.9 - 0.45 * (dist / DOME_RADIUS);
    return b < 0.45 ? 0.45 : b;
  }

  function writeRing(index, p, dist, brightness) {
    const r = p.footprint + dist * p.tanHalf;
    _v1.copy(p.dir).multiplyScalar(dist).add(p.origin);
    _q.setFromUnitVectors(_Z, p.dir);
    _scale.set(r, r, 1);
    _m.compose(_v1, _q, _scale);
    pulseMesh.setMatrixAt(index, _m);
    _c.copy(p.color).multiplyScalar(brightness);
    pulseMesh.setColorAt(index, _c);
  }

  function advancePulses(dt, state) {
    const tailGap = 0.25 + 0.05 * (state.telemetry.pulseWidthUs / 10);
    for (let i = 0; i < PULSE_SLOTS; i++) {
      const p = pulses[i];
      if (!p.live) continue;
      p.prevDist = p.dist;
      p.dist += PULSE_SPEED * dt;
      if (p.type !== 'jam') detectEchoes(p, state);
      if (p.dist >= p.travel) {
        if (p.type !== 'jam' && api.onPulseArrival) api.onPulseArrival(p.beam, p.dir, p.gain, p.colorHex);
        freePulse(i);
        continue;
      }
      const head = i * 2;
      writeRing(head, p, p.dist, ringBrightness(p.dist));
      const tailDist = p.dist - tailGap;
      if (tailDist > 0) {
        writeRing(head + 1, p, tailDist, ringBrightness(tailDist) * TAIL_BRIGHTNESS);
      } else {
        pulseMesh.setMatrixAt(head + 1, _HIDDEN);
        pulseMesh.setColorAt(head + 1, _BLACK);
      }
      pulsesDirty = true;
    }
  }

  // ---- echoes ---------------------------------------------------------------------------
  function acquireEchoSlot() {
    let oldest = null;
    for (let i = 0; i < ECHO_MAX; i++) {
      const e = echoes[i];
      if (!e.live) return e;
      if (oldest === null || e.seq < oldest.seq) oldest = e;
    }
    return oldest;
  }

  function freeEcho(slot) {
    const e = echoes[slot];
    e.live = false;
    e.beam = null;
    e.target = null;
    echoMesh.setMatrixAt(slot, _HIDDEN);
    echoMesh.setColorAt(slot, _BLACK);
    echoesDirty = true;
  }

  /** Jamming suppression: sector around the jammer az, or only the beam-width notch when nulling. */
  function isSuppressedByJamming(target, targetDir, p, state) {
    if (!state.jamming) return false;
    if (!state.nulling) return Math.abs(target.az - JAM_AZ) < 10 * deg;
    return targetDir.dot(_jamDir) > Math.cos(p.widthDeg * deg);
  }

  function detectEchoes(p, state) {
    const targets = state.targets || EMPTY;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (!(p.prevDist < t.range && t.range <= p.dist)) continue;   // wavefront crossed the target this frame
      dirFromAzEl(t.az, t.el, _v2);
      const dot = p.dir.dot(_v2);
      if (dot < p.cosLimit) continue;                                 // outside 1.5 beamwidths
      const dTheta = Math.acos(dot > 1 ? 1 : dot);
      const x = dTheta / p.sigma;
      const rr = (0.8 * DOME_RADIUS) / t.range;
      const snr = p.gain * Math.exp(-x * x) * t.rcs * rr * rr * rr * rr;
      if (snr <= (p.type === 'track' ? 0.15 : 0.3)) continue;
      if (isSuppressedByJamming(t, _v2, p, state)) continue;
      spawnEcho(p, t, snr, _v2);
    }
  }

  function spawnEcho(p, target, snr, targetDir) {
    const e = acquireEchoSlot();
    e.live = true;
    e.seq = ++seq;
    e.beam = p.beam;
    e.target = target;
    e.snr = snr;
    e.from.copy(targetDir).multiplyScalar(target.range);
    e.to.copy(p.origin);
    e.len = Math.max(1e-3, e.from.distanceTo(e.to));
    e.dist = 0;
    e.brightness = Math.max(ECHO_MIN_BRIGHTNESS, Math.min(1, snr));
  }

  function advanceEchoes(dt) {
    for (let i = 0; i < ECHO_MAX; i++) {
      const e = echoes[i];
      if (!e.live) continue;
      e.dist += PULSE_SPEED * dt;
      if (e.dist >= e.len) {
        if (api.onEcho) api.onEcho(e.beam, e.target, e.snr);
        freeEcho(i);
        continue;
      }
      _v1.lerpVectors(e.from, e.to, e.dist / e.len);
      _m.makeTranslation(_v1.x, _v1.y, _v1.z);
      echoMesh.setMatrixAt(i, _m);
      _c.setRGB(e.brightness, e.brightness, e.brightness);
      echoMesh.setColorAt(i, _c);
      echoesDirty = true;
    }
  }

  // ---- jammer ---------------------------------------------------------------------------
  function updateJammer(dt, state) {
    jamGroup.visible = state.jamming;
    if (!state.jamming) {
      jamAcc = 0;
      return;
    }
    jamClock += dt;
    jamMat.opacity = 0.07 + 0.025 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 8 * jamClock));
    jamAcc += JAM_RING_RATE * dt;
    if (jamAcc > 2) jamAcc = 1;
    while (jamAcc >= 1) {
      jamAcc -= 1;
      spawnJamRing();
    }
  }

  function updateMainbeamJam(state) {
    let jam = false;
    if (state.jamming) {
      const beams = state.beams;
      for (let i = 0; i < beams.length; i++) {
        const b = beams[i];
        if (b.dir && b.dir.dot(_jamDir) > Math.cos(b.widthDeg * deg)) { jam = true; break; }
      }
    }
    state.telemetry.mainbeamJam = jam;
  }

  // ---- frame ----------------------------------------------------------------------------
  function update(dt, state) {
    const running = !!state.running;
    const beams = state.beams || EMPTY;
    const searchRate = 2 + 8 * Math.log(Math.max(state.prf, 200) / 200) / Math.log(20);

    for (let i = 0; i < bodies.length; i++) bodies[i].seen = false;

    for (let i = 0; i < beams.length; i++) {
      const beam = beams[i];
      if (!beam.dir || !beam.origin) continue;   // scheduler has not filled this beam yet
      const body = getBody(beam.id);
      body.seen = true;
      if (!body.attached) attachBody(body);
      updateBody(body, beam, state, running);

      if (running) {
        body.spawnAcc += (beam.type === 'search' ? searchRate : searchRate / 3) * dt;
        if (body.spawnAcc > 2) body.spawnAcc = 1;   // no bursts after a stall
        while (body.spawnAcc >= 1) {
          body.spawnAcc -= 1;
          spawnBeamPulse(beam);
        }
      } else {
        body.spawnAcc = 0;
      }
    }

    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      if (!body.seen && body.attached) detachBody(body);
    }

    updateJammer(dt, state);
    advancePulses(dt, state);
    advanceEchoes(dt);
    updateMainbeamJam(state);

    if (pulsesDirty) {
      pulseMesh.instanceMatrix.needsUpdate = true;
      pulseMesh.instanceColor.needsUpdate = true;
      pulsesDirty = false;
    }
    if (echoesDirty) {
      echoMesh.instanceMatrix.needsUpdate = true;
      echoMesh.instanceColor.needsUpdate = true;
      echoesDirty = false;
    }
  }

  function reset() {
    for (let i = 0; i < PULSE_SLOTS; i++) if (pulses[i].live) freePulse(i); else hidePulseInstances(i);
    for (let i = 0; i < ECHO_MAX; i++) freeEcho(i);
    for (let i = 0; i < bodies.length; i++) if (bodies[i].attached) detachBody(bodies[i]);
    jamAcc = 0;
    jamClock = 0;
    pulseMesh.instanceMatrix.needsUpdate = true;
    pulseMesh.instanceColor.needsUpdate = true;
    echoMesh.instanceMatrix.needsUpdate = true;
    echoMesh.instanceColor.needsUpdate = true;
    pulsesDirty = false;
    echoesDirty = false;
  }

  return api;
}
