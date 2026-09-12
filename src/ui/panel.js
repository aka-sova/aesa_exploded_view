// Binds the HUD DOM to SimState. Reads state every frame (DOM is only touched when text or
// class actually changes) and writes state from input events.
import { SCAN_PATTERNS, SCAN_LABELS, VIEW_MODES, VIEW_LABELS, CAMERA_PRESETS, QUADRANT_MODES, COLORS } from '../sim/state.js';
import { PARTS, PART_BY_ID } from '../data/parts.js';
import { PATTERN_PERIOD } from '../radar/scan.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const VIEW_BTN = { assembled: 'ASSEMBLED', cutaway: 'CUTAWAY', xray: 'X-RAY', signal: 'SIGNAL PATH' };
const GLYPHS = {
  sector: '<path d="M2 8H26M22 4l4 4-4 4M6 4L2 8l4 4"/>',
  raster: '<path d="M2 3h24L2 8h24L2 13h24"/>',
  circular: '<ellipse cx="14" cy="8" rx="10" ry="5"/>',
  spiral: '<path d="M14 8c1-1 3 0 3 1c0 2-3 3-5 2c-3-1-3-5 0-6c4-2 8 0 8 4c0 5-6 8-11 6"/>',
  agile: '<circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="20" cy="3" r="1.5"/><circle cx="25" cy="11" r="1.5"/><circle cx="9" cy="8" r="1.5"/>',
};
const LEGEND = [
  ['◯', COLORS.search, 'SEARCH BEAM / TX PULSE'],
  ['◯', COLORS.track, 'TRACK BEAM'],
  ['●', COLORS.detect, 'ECHO / DETECTION'],
  ['◆', COLORS.detect, 'TARGET (BRACKET = TRACKED)'],
  ['▪', COLORS.fault, 'FAULT / JAMMER'],
  ['▪', COLORS.signal, 'RF PATH'],
  ['▪', COLORS.control, 'STEERING COMMANDS (DASHED)'],
  ['▪', COLORS.standby, 'STANDBY'],
];
const TEL_FMT = {
  beamAzDeg: (v) => v.toFixed(1) + '°', beamElDeg: (v) => v.toFixed(1) + '°',
  steerAngleDeg: (v) => v.toFixed(1) + '°', beamwidthDeg: (v) => v.toFixed(2) + '°',
  scanLossDb: (v) => '−' + v.toFixed(1) + ' dB', prf: (v) => v + ' Hz',
  unambRangeKm: (v) => v.toFixed(1) + ' km', dutyCycle: (v) => (v * 100).toFixed(1) + ' %',
  peakPowerKw: (v) => v.toFixed(2) + ' kW', avgPowerKw: (v) => (v * 1000).toFixed(0) + ' W',
  activeElements: (v) => String(v), activeBeams: (v) => String(v), tracked: (v) => String(v),
  hops: (v) => String(v), dwellMs: (v) => v.toFixed(0) + ' ms', pulsesPerDwell: (v) => String(v),
  eirpLossDb: (v) => '−' + v.toFixed(1) + ' dB', arrayTempC: (v) => v.toFixed(1) + ' °C',
  pulsesSent: (v) => String(v), echoes: (v) => String(v), detected: (v) => String(v),
};

function setText(el, s) { if (el && el.__t !== s) { el.__t = s; el.textContent = s; } }
function setClass(el, cls, on) { if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
function setStyle(el, prop, v) { if (el && el.__s?.[prop] !== v) { (el.__s ||= {})[prop] = v; el.style[prop] = v; } }

export function mountPanel(state, api) {
  // ---- build static lists -----------------------------------------------------------------
  const viewBtns = {};
  for (const m of VIEW_MODES) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = `<span class="ico">${VIEW_MODES.indexOf(m) + 1}</span>${VIEW_BTN[m]}`;
    b.onclick = () => api.setViewMode(m);
    $('view-modes').appendChild(b);
    viewBtns[m] = b;
  }
  const camBtns = {};
  for (const c of CAMERA_PRESETS) {
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.textContent = c.toUpperCase();
    b.onclick = () => api.setCameraPreset(c);
    $('camera-presets').appendChild(b);
    camBtns[c] = b;
  }
  const partItems = {};
  for (const p of PARTS) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="code">${p.code}</span><span class="name">${p.name}</span><span class="arrow">↗</span>`;
    li.onclick = () => { state.selectedPart = state.selectedPart === p.id ? null : p.id; };
    li.onpointerenter = () => { state.hoveredPart = p.id; };
    li.onpointerleave = () => { if (state.hoveredPart === p.id) state.hoveredPart = null; };
    $('parts-list').appendChild(li);
    partItems[p.id] = li;
  }
  const patBtns = {};
  for (const p of SCAN_PATTERNS) {
    const b = document.createElement('button');
    b.className = 'pat-btn';
    b.innerHTML = `<svg viewBox="0 0 28 16" width="28" height="16" fill="none" stroke="currentColor" stroke-width="1.4">${GLYPHS[p]}</svg><span>${SCAN_LABELS[p]}</span>`;
    b.onclick = () => { state.scanPattern = p; };
    $('scan-patterns').appendChild(b);
    patBtns[p] = b;
  }
  $('legend').innerHTML = LEGEND.map(([g, c, t]) => `<span class="chip"><i style="color:${hex(c)}">${g}</i>${t}</span>`).join('');
  const tiles = [];
  for (let q = 0; q < 4; q++) {
    const d = document.createElement('div');
    d.className = 'tile';
    d.innerHTML = `<b>Q${q}</b><span class="mode"></span><span class="tgt"></span>`;
    d.onclick = () => {
      const i = QUADRANT_MODES.indexOf(state.quadrantModes[q]);
      state.quadrantModes[q] = QUADRANT_MODES[(i + 1) % QUADRANT_MODES.length];
    };
    d.onpointerenter = () => { state.hoveredQuadrant = q; };
    d.onpointerleave = () => { if (state.hoveredQuadrant === q) state.hoveredQuadrant = null; };
    $('tiles').appendChild(d);
    tiles.push(d);
  }

  // ---- controls ---------------------------------------------------------------------------
  const startBtn = $('btn-start');
  const toggleRun = () => { state.running = !state.running; };
  startBtn.onclick = toggleRun;
  $('btn-reset').onclick = () => api.reset();
  const bind = (id, get, set, fmt) => {
    const input = $(id), val = $(id + '-val');
    input.value = get();
    input.oninput = () => { set(parseFloat(input.value)); };
    return () => { const v = get(); if (parseFloat(input.value) !== v && document.activeElement !== input) input.value = v; setText(val, fmt(v)); };
  };
  const syncSliders = [
    bind('scan-rate', () => state.scanRate, (v) => { state.scanRate = v; }, (v) => v.toFixed(2) + '×'),
    bind('prf', () => state.prf, (v) => { state.prf = v; }, (v) => v + ' Hz'),
    bind('power', () => state.power, (v) => { state.power = v; }, (v) => v + ' %'),
    bind('explode', () => Math.round(state.explodeTarget * 100), (v) => { state.explodeTarget = v / 100; }, (v) => v + ' %'),
  ];
  $('btn-fail').onclick = () => { state.failedFraction = state.failedFraction > 0 ? 0 : 0.15; };
  $('btn-jam').onclick = () => { state.jamming = !state.jamming; if (!state.jamming) state.nulling = false; };
  $('btn-null').onclick = () => { if (state.jamming) state.nulling = !state.nulling; };

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
    if (e.code === 'Space') { e.preventDefault(); toggleRun(); }
    else if (e.key >= '1' && e.key <= '4') api.setViewMode(VIEW_MODES[Number(e.key) - 1]);
    else if (e.key === 'e' || e.key === 'E') state.explodeTarget = state.explodeTarget > 0.5 ? 0 : 1;
  });

  // ---- per-frame update -------------------------------------------------------------------
  const pill = $('status-pill');
  const tel = document.querySelectorAll('[data-tel]');
  const insp = { code: $('insp-code'), name: $('insp-name'), desc: $('insp-desc'), design: $('insp-design'), mlabel: $('insp-metric-label'), mval: $('insp-metric-value'), munit: $('insp-metric-unit') };
  let shownPart = undefined;

  function statusPill() {
    const t = state.telemetry;
    if (t.arrayTempC > 80) return ['OVERTEMP', 'amber'];
    if (state.jamming) return state.nulling ? ['NULLED', 'teal'] : ['JAMMED', 'red'];
    if (state.failedFraction > 0) return [`DEGRADED −${(-20 * Math.log10(1 - state.failedFraction)).toFixed(1)} dB`, 'amber'];
    return state.running ? ['RADIATING', 'teal'] : ['SYSTEM READY', 'grey'];
  }

  function rosterLine(b) {
    const qs = b.quadrants.map((q) => 'Q' + q).join(' ');
    if (b.type === 'search') {
      const period = PATTERN_PERIOD[state.scanPattern];
      let where;
      if (state.scanPattern === 'raster') where = `BAR ${Math.floor(((state.time * state.scanRate) % 16) / 2) + 1}/8`;
      else if (state.scanPattern === 'agile') where = b.trackDwell ? 'TRACK DWELL' : `HOP #${b.hops}`;
      else where = `${Math.round((((state.time * state.scanRate) % period) / period) * 100)} %`;
      const pps = (2 + (8 * Math.log(state.prf / 200)) / Math.log(20)).toFixed(1);
      return `B${b.id}  SEARCH · ${qs} · ${state.scanPattern.toUpperCase()} ${where} · ${b.widthDeg.toFixed(1)}° · ${pps} PPS`;
    }
    const tgt = b.targetId === null ? 'ACQUIRING' : `→ T${b.targetId} · DWELL ${b.dwell.toFixed(1)} s`;
    return `B${b.id}  TRACK · ${qs} · ${tgt} · ${b.widthDeg.toFixed(1)}°`;
  }

  function update() {
    const [ptxt, pcls] = statusPill();
    setText(pill, ptxt);
    for (const c of ['grey', 'teal', 'amber', 'red']) setClass(pill, c, c === pcls);

    for (const m of VIEW_MODES) setClass(viewBtns[m], 'active', state.viewMode === m);
    for (const c of CAMERA_PRESETS) setClass(camBtns[c], 'active', state.cameraPreset === c);
    for (const p of PARTS) {
      setClass(partItems[p.id], 'active', state.selectedPart === p.id);
      setClass(partItems[p.id], 'hover', state.hoveredPart === p.id);
    }
    for (const p of SCAN_PATTERNS) setClass(patBtns[p], 'active', state.scanPattern === p);
    setText($('vp-subtitle'), `${VIEW_LABELS[state.viewMode]} / 576 T/R MODULES / 4 SUBARRAYS`);
    setClass($('idle-chip'), 'hidden', state.running || state.time > 0);
    setText(startBtn, state.running ? 'STOP RADIATING' : 'START RADIATING');
    setClass(startBtn, 'active', state.running);
    for (const s of syncSliders) s();

    const roster = $('beam-roster');
    const lines = state.beams.map((b) => `<div class="row"><i style="background:${hex(b.color)}"></i>${rosterLine(b)}</div>`).join('');
    if (roster.__h !== lines) { roster.__h = lines; roster.innerHTML = lines; }

    // subarray tiles: front view unless the camera is behind the array
    const behind = api.isCameraBehind();
    const order = behind ? [3, 2, 1, 0] : [2, 3, 0, 1];
    setText($('tiles-caption'), behind ? 'REAR VIEW (−Z) · MIRRORED' : 'FRONT VIEW (+Z)');
    for (let q = 0; q < 4; q++) {
      const d = tiles[q], mode = state.quadrantModes[q];
      setStyle(d, 'order', String(order.indexOf(q)));
      for (const m of QUADRANT_MODES) setClass(d, m, mode === m);
      setText(d.children[1], mode === 'standby' ? 'STBY' : mode.toUpperCase());
      const beam = state.beams.find((b) => b.type === 'track' && b.quadrants[0] === q);
      setText(d.children[2], mode === 'track' ? (beam && beam.targetId !== null ? `→ T${beam.targetId}` : 'ACQ') : '');
    }
    setClass($('btn-fail'), 'active', state.failedFraction > 0);
    setText($('fail-readout'), state.failedFraction > 0 ? `EIRP −${(-20 * Math.log10(1 - state.failedFraction)).toFixed(1)} dB · SIDELOBE FLOOR ≈ −35 dB` : 'ALL 576 MODULES NOMINAL');
    setClass($('btn-jam'), 'active', state.jamming);
    setClass($('btn-null'), 'active', state.nulling);
    $('btn-null').disabled = !state.jamming;

    // inspector
    if (shownPart !== state.selectedPart) {
      shownPart = state.selectedPart;
      const p = shownPart ? PART_BY_ID[shownPart] : null;
      setText(insp.code, p ? `SYS · ${p.code}` : 'SYS · —');
      setText(insp.name, p ? p.name : 'Select a component');
      setText(insp.desc, p ? p.description : 'Click a part in the 3-D view or in the systems list to inspect it.');
      setText(insp.design, p ? p.design : '');
      setText(insp.mlabel, p ? p.metric : '');
      setText(insp.munit, p ? p.unit : '');
    }
    if (shownPart) {
      const p = PART_BY_ID[shownPart];
      const v = p.metricKey ? (p.metricKey in state.telemetry ? state.telemetry[p.metricKey] : state[p.metricKey]) : p.metricConst;
      setText(insp.mval, typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(1)) : '—');
    } else setText(insp.mval, '');

    for (const el of tel) {
      const k = el.dataset.tel;
      const v = k in state.telemetry ? state.telemetry[k] : state[k];
      setText(el, TEL_FMT[k] ? TEL_FMT[k](v) : String(v));
    }
    setClass($('jam-warning'), 'hidden', !state.telemetry.mainbeamJam);
    const st = api.stats();
    setText($('foot-calls'), String(st.calls));
    setText($('foot-fps'), String(st.fps));
  }

  return { update };
}
