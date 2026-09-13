// Binds the HUD DOM to SimState. Reads state every frame (DOM is only touched when text or
// class actually changes) and writes state from input events. All user-facing strings come
// from i18n so the language toggle can relabel everything in place.
import { SCAN_PATTERNS, VIEW_MODES, CAMERA_PRESETS, QUADRANT_MODES, COLORS } from '../sim/state.js';
import { PARTS, PART_BY_ID } from '../data/parts.js';
import { PATTERN_PERIOD } from '../radar/scan.js';
import { foldVelocity, rangeKmOf } from '../radar/doppler.js';
import { t, tPart, getLang, setLang, onLangChange, applyStatic, LANGS } from '../i18n.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const GLYPHS = {
  sector: '<path d="M2 8H26M22 4l4 4-4 4M6 4L2 8l4 4"/>',
  raster: '<path d="M2 3h24L2 8h24L2 13h24"/>',
  circular: '<ellipse cx="14" cy="8" rx="10" ry="5"/>',
  spiral: '<path d="M14 8c1-1 3 0 3 1c0 2-3 3-5 2c-3-1-3-5 0-6c4-2 8 0 8 4c0 5-6 8-11 6"/>',
  agile: '<circle cx="4" cy="4" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="20" cy="3" r="1.5"/><circle cx="25" cy="11" r="1.5"/><circle cx="9" cy="8" r="1.5"/>',
};
const LEGEND = [
  ['◯', COLORS.search, 'legend.search'],
  ['◯', COLORS.track, 'legend.track'],
  ['●', COLORS.detect, 'legend.echo'],
  ['◆', COLORS.detect, 'legend.target'],
  ['▪', COLORS.fault, 'legend.fault'],
  ['▪', COLORS.signal, 'legend.rf'],
  ['▪', COLORS.control, 'legend.control'],
  ['▪', COLORS.standby, 'legend.standby'],
  ['◗', 0x2fd6ff, 'legend.pattern'],
];
// unit keys for parts whose `unit` is a plain English token
const UNIT_KEY = { dB: 'unit.db', Hz: 'unit.hz', W: 'unit.w', kg: 'unit.kg', '°C': 'unit.c', '°': null, '': null };
const TEL_FMT = {
  beamAzDeg: (v) => v.toFixed(1) + '°', beamElDeg: (v) => v.toFixed(1) + '°',
  steerAngleDeg: (v) => v.toFixed(1) + '°', beamwidthDeg: (v) => v.toFixed(2) + '°',
  scanLossDb: (v) => '−' + v.toFixed(1) + ' ' + t('unit.db'), prf: (v) => v + ' ' + t('unit.hz'),
  unambRangeKm: (v) => v.toFixed(1) + ' ' + t('unit.km'), dutyCycle: (v) => (v * 100).toFixed(1) + ' %',
  peakPowerKw: (v) => v.toFixed(2) + ' ' + t('unit.kw'), avgPowerKw: (v) => (v * 1000).toFixed(0) + ' ' + t('unit.w'),
  activeElements: (v) => String(v), activeBeams: (v) => String(v), tracked: (v) => String(v),
  hops: (v) => String(v), dwellMs: (v) => v.toFixed(0) + ' ' + t('unit.ms'), pulsesPerDwell: (v) => String(v),
  eirpLossDb: (v) => '−' + v.toFixed(1) + ' ' + t('unit.db'), arrayTempC: (v) => v.toFixed(1) + ' °C',
  pulsesSent: (v) => String(v), echoes: (v) => String(v), detected: (v) => String(v),
  vUnambMs: (v) => '±' + v.toFixed(1) + ' ' + t('unit.mps'), blindSpeedMs: (v) => v.toFixed(1) + ' ' + t('unit.mps'),
};

function setText(el, s) { if (el && el.__t !== s) { el.__t = s; el.textContent = s; } }
function setClass(el, cls, on) { if (el && el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
function setStyle(el, prop, v) { if (el && el.__s?.[prop] !== v) { (el.__s ||= {})[prop] = v; el.style[prop] = v; } }

export function mountPanel(state, api) {
  applyStatic();

  // ---- build static lists -----------------------------------------------------------------
  const viewBtns = {};
  for (const m of VIEW_MODES) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.innerHTML = `<span class="ico">${VIEW_MODES.indexOf(m) + 1}</span><span class="lbl"></span>`;
    b.onclick = () => api.setViewMode(m);
    $('view-modes').appendChild(b);
    viewBtns[m] = b;
  }
  const camBtns = {};
  for (const c of CAMERA_PRESETS) {
    const b = document.createElement('button');
    b.className = 'seg-btn';
    b.onclick = () => api.setCameraPreset(c);
    $('camera-presets').appendChild(b);
    camBtns[c] = b;
  }
  const partItems = {};
  for (const p of PARTS) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="code">${p.code}</span><span class="name"></span><span class="arrow">↗</span>`;
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
    b.innerHTML = `<svg viewBox="0 0 28 16" width="28" height="16" fill="none" stroke="currentColor" stroke-width="1.4">${GLYPHS[p]}</svg><span></span>`;
    b.onclick = () => { state.scanPattern = p; };
    $('scan-patterns').appendChild(b);
    patBtns[p] = b;
  }
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
  const langBtns = {};
  for (const b of $('lang-toggle').querySelectorAll('[data-lang]')) {
    langBtns[b.dataset.lang] = b;
    b.onclick = () => setLang(b.dataset.lang);
  }

  // Everything built above that carries translated text is (re)labelled here.
  let shownPart = undefined;
  function relabel() {
    for (const m of VIEW_MODES) viewBtns[m].querySelector('.lbl').textContent = t(`view.${m}`);
    for (const c of CAMERA_PRESETS) camBtns[c].textContent = t(`cam.${c}`);
    for (const p of PARTS) partItems[p.id].querySelector('.name').textContent = tPart(p, 'name');
    for (const p of SCAN_PATTERNS) patBtns[p].querySelector('span').textContent = t(`pattern.${p}`);
    $('legend').innerHTML = LEGEND.map(([g, c, k]) => `<span class="chip"><i style="color:${hex(c)}">${g}</i>${t(k)}</span>`).join('');
    $('track-table').title = t('trk.hint');
    shownPart = undefined;
  }
  relabel();
  onLangChange(relabel);

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
    bind('prf', () => state.prf, (v) => { state.prf = v; }, (v) => v + ' ' + t('unit.hz')),
    bind('power', () => state.power, (v) => { state.power = v; }, (v) => v + ' %'),
    bind('explode', () => Math.round(state.explodeTarget * 100), (v) => { state.explodeTarget = v / 100; }, (v) => v + ' %'),
  ];
  const chk = (id, key) => {
    const el = $(id);
    el.checked = state[key];
    el.onchange = () => { state[key] = el.checked; };
    return () => { if (el.checked !== state[key]) el.checked = state[key]; };
  };
  const syncChecks = [chk('pat-search', 'patternSearch'), chk('pat-track', 'patternTrack'), chk('pat-cuts', 'patternCuts'), chk('rm-timeline', 'timelineVisible'), chk('rd-map', 'rdMapVisible'), chk('mti', 'mti')];
  syncSliders.push(
    bind('spacing', () => state.spacingLambda, (v) => { state.spacingLambda = v; }, (v) => v.toFixed(2) + ' λ'),
    bind('taper', () => Math.round(state.taper * 100), (v) => { state.taper = v / 100; }, (v) => v + ' %'),
    bind('revisit', () => state.trackRevisit, (v) => { state.trackRevisit = v; }, (v) => v.toFixed(1) + ' s'),
    bind('loadcap', () => Math.round(state.trackLoadCap * 100), (v) => { state.trackLoadCap = v / 100; }, (v) => v + ' %'),
  );
  $('btn-fail').onclick = () => { state.failedFraction = state.failedFraction > 0 ? 0 : 0.15; };
  $('btn-jam').onclick = () => { state.jamming = !state.jamming; if (!state.jamming) state.nulling = false; };
  $('btn-null').onclick = () => { if (state.jamming) state.nulling = !state.nulling; };

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
    if (e.code === 'Space') { e.preventDefault(); toggleRun(); }
    else if (e.key >= '1' && e.key <= '4') api.setViewMode(VIEW_MODES[Number(e.key) - 1]);
    else if (e.code === 'KeyE') state.explodeTarget = state.explodeTarget > 0.5 ? 0 : 1;
    else if (e.key === 'Escape') state.selectedTarget = null;
  });

  // ---- per-frame update -------------------------------------------------------------------
  const pill = $('status-pill');
  const ttBody = $('tt-body');
  ttBody.onclick = (e) => {
    const row = e.target.closest('tr[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    state.selectedTarget = state.selectedTarget === id ? null : id;
  };
  const sgn = (v, d) => (v > 0 ? '+' : '') + v.toFixed(d);
  // Rows are created once per target and updated in place: rebuilding the tbody every frame
  // would replace the element between a real mouse-down and mouse-up and swallow the click.
  const rowEls = new Map();
  function rowFor(id) {
    let tr = rowEls.get(id);
    if (tr) return tr;
    tr = document.createElement('tr');
    tr.dataset.id = String(id);
    tr.innerHTML = `<td>T${id}</td><td class="src"></td><td></td><td></td><td><span class="seen"></span> <span class="true"></span></td><td></td><td class="q"></td><td class="st"></td>`;
    rowEls.set(id, tr);
    return tr;
  }
  function updateTrackTable() {
    let k = 0;
    for (const tg of state.targets) {
      const lost = state.time - tg.lostAt < 3;
      const listed = tg.tracked || tg.tws || tg.confirmPending || lost || state.selectedTarget === tg.id;
      if (!listed) continue;
      const tr = rowFor(tg.id);
      const c = tr.children;
      const sel = state.selectedTarget === tg.id;
      setClass(tr, 'sel', sel);
      setText(c[1], tg.tracked ? 'Q' + tg.trackedBy : tg.tws ? 'TWS' : '—');
      setText(c[2], rangeKmOf(tg).toFixed(1));
      setText(c[3], `${sgn(tg.az * 57.2958, 1)} / ${sgn(tg.el * 57.2958, 1)}`);
      setText(c[4].children[0], sgn(foldVelocity(tg.vr, state.prf), 1));
      setText(c[4].children[1], sel ? `(${sgn(tg.vr, 0)})` : '');
      setText(c[5], tg.lastSeen > -Infinity ? Math.max(0, state.time - tg.lastSeen).toFixed(1) : '—');
      setText(c[6], (tg.tws || tg.tracked) ? '●'.repeat(Math.max(0, 3 - tg.misses)) + '○'.repeat(Math.min(3, tg.misses)) : '');
      const st = lost && !tg.tws && !tg.tracked ? ['lost', t('trk.lost')] : tg.confirmPending ? ['conf', t('trk.confirming')] : !tg.tws && !tg.tracked ? ['', t('trk.detected')] : ['', ''];
      setText(c[7], st[1]);
      setClass(c[7], 'lost', st[0] === 'lost');
      setClass(c[7], 'conf', st[0] === 'conf');
      if (ttBody.children[k] !== tr) ttBody.insertBefore(tr, ttBody.children[k] || null);
      k++;
    }
    while (ttBody.children.length > k) ttBody.lastElementChild.remove();
    return k;
  }
  const tel = document.querySelectorAll('[data-tel]');
  const insp = { code: $('insp-code'), name: $('insp-name'), desc: $('insp-desc'), design: $('insp-design'), mlabel: $('insp-metric-label'), mval: $('insp-metric-value'), munit: $('insp-metric-unit') };

  function statusPill() {
    const tm = state.telemetry;
    if (tm.arrayTempC > 80) return [t('status.overtemp'), 'amber'];
    if (state.jamming) return state.nulling ? [t('status.nulled'), 'teal'] : [t('status.jammed'), 'red'];
    if (state.failedFraction > 0) return [t('status.degraded', { db: (-20 * Math.log10(1 - state.failedFraction)).toFixed(1) }), 'amber'];
    return state.running ? [t('status.radiating'), 'teal'] : [t('status.ready'), 'grey'];
  }

  function rosterLine(b) {
    const qs = b.quadrants.map((q) => 'Q' + q).join(' ');
    if (b.type === 'search') {
      const period = PATTERN_PERIOD[state.scanPattern];
      const pt = b.patternTime ?? state.time * state.scanRate;
      let where;
      if (b.trackDwell) where = t('roster.trackDwell');
      else if (state.scanPattern === 'raster') where = t('roster.bar', { n: Math.floor((pt % 16) / 2) + 1 });
      else if (state.scanPattern === 'agile') where = t('roster.hop', { n: b.hops });
      else where = `${Math.round(((pt % period) / period) * 100)} %`;
      const pps = (2 + (8 * Math.log(state.prf / 200)) / Math.log(20)).toFixed(1);
      return t('roster.search', { id: b.id, qs, pattern: t(`patternShort.${state.scanPattern}`), where, width: b.widthDeg.toFixed(1), pps });
    }
    const tgt = b.targetId === null ? t('roster.acquiring') : t('roster.onTarget', { id: b.targetId, s: b.dwell.toFixed(1) });
    return t('roster.track', { id: b.id, qs, tgt, width: b.widthDeg.toFixed(1) });
  }

  function update() {
    const [ptxt, pcls] = statusPill();
    setText(pill, ptxt);
    for (const c of ['grey', 'teal', 'amber', 'red']) setClass(pill, c, c === pcls);
    for (const l of LANGS) setClass(langBtns[l], 'active', getLang() === l);

    for (const m of VIEW_MODES) setClass(viewBtns[m], 'active', state.viewMode === m);
    for (const c of CAMERA_PRESETS) setClass(camBtns[c], 'active', state.cameraPreset === c);
    for (const p of PARTS) {
      setClass(partItems[p.id], 'active', state.selectedPart === p.id);
      setClass(partItems[p.id], 'hover', state.hoveredPart === p.id);
    }
    for (const p of SCAN_PATTERNS) setClass(patBtns[p], 'active', state.scanPattern === p);
    setText($('vp-subtitle'), t('vp.subtitle', { view: t(`viewLabel.${state.viewMode}`) }));
    setClass($('idle-chip'), 'hidden', state.running || state.time > 0);
    setText(startBtn, state.running ? t('ctl.stop') : t('ctl.start'));
    setClass(startBtn, 'active', state.running);
    for (const s of syncSliders) s();
    for (const c of syncChecks) c();
    setClass($('pat-plot-wrap'), 'hidden', !state.patternCuts);
    setClass($('timeline-wrap'), 'hidden', !state.timelineVisible);
    setClass($('rdmap-wrap'), 'hidden', !state.rdMapVisible);
    {
      const tm = state.telemetry;
      setText($('pd-ambig'), t('pd.ambig', { v: tm.vUnambMs.toFixed(1), vb: tm.blindSpeedMs.toFixed(1), r: tm.unambRangeKm.toFixed(0) }));
      setClass($('tt-empty'), 'hidden', updateTrackTable() > 0);
      const selT = state.selectedTarget !== null ? state.targets.find((x) => x.id === state.selectedTarget) : null;
      if (selT) setText($('pd-target'), t('pd.target', { id: selT.id, vr: (selT.vr > 0 ? '+' : '') + selT.vr.toFixed(0), fv: (foldVelocity(selT.vr, state.prf) > 0 ? '+' : '') + foldVelocity(selT.vr, state.prf).toFixed(1) }));
      else setText($('pd-target'), tm.pdTargetId >= 0 ? t('pd.target', { id: tm.pdTargetId, vr: (tm.pdTargetVr > 0 ? '+' : '') + tm.pdTargetVr.toFixed(0), fv: (tm.pdTargetFv > 0 ? '+' : '') + tm.pdTargetFv.toFixed(1) }) : t('pd.none'));
      setText($('rd-readout'), t('rd.readout', { prf: state.prf, v: tm.vUnambMs.toFixed(1), r: tm.unambRangeKm.toFixed(0), mti: t(state.mti ? 'rd.on' : 'rd.off') }));
    }
    {
      const tm = state.telemetry;
      setText($('rm-load'), t('rm.load', { s: tm.rmSearchPct.toFixed(0), t: tm.rmTrackPct.toFixed(0), c: tm.rmConfirmPct.toFixed(0) }));
      setText($('rm-tracks'), t('rm.tracks', { n: tm.rmTracks, f: tm.rmFrameS ? tm.rmFrameS.toFixed(1) + ' s' : '—' }));
      setClass($('rm-overload'), 'hidden', !tm.rmOverload);
    }
    {
      const tm = state.telemetry;
      let txt = t('pat.readout', { bw: tm.patternBwDeg.toFixed(1), sll: tm.patternSllDb.toFixed(1), peak: tm.patternPeakDb.toFixed(1) });
      if (tm.gratingLobe) txt += ' · ' + t('pat.grating');
      setText($('pat-readout'), txt);
      setClass($('pat-readout'), 'amber', tm.gratingLobe);
    }

    const roster = $('beam-roster');
    const lines = state.beams.map((b) => `<div class="row"><i style="background:${hex(b.color)}"></i>${rosterLine(b)}</div>`).join('');
    if (roster.__h !== lines) { roster.__h = lines; roster.innerHTML = lines; }

    // subarray tiles: front view unless the camera is behind the array
    const behind = api.isCameraBehind();
    const order = behind ? [3, 2, 1, 0] : [2, 3, 0, 1];
    setText($('tiles-caption'), behind ? t('sub.rear') : t('sub.front'));
    for (let q = 0; q < 4; q++) {
      const d = tiles[q], mode = state.quadrantModes[q];
      setStyle(d, 'order', String(order.indexOf(q)));
      for (const m of QUADRANT_MODES) setClass(d, m, mode === m);
      setText(d.children[1], t(`mode.${mode}`));
      const beam = state.beams.find((b) => b.type === 'track' && b.quadrants[0] === q);
      setText(d.children[2], mode === 'track' ? (beam && beam.targetId !== null ? `→ T${beam.targetId}` : t('tile.acq')) : '');
    }
    setClass($('btn-fail'), 'active', state.failedFraction > 0);
    setText($('fail-readout'), state.failedFraction > 0 ? t('fail.readout', { db: (-20 * Math.log10(1 - state.failedFraction)).toFixed(1) }) : t('fail.nominal'));
    setClass($('btn-jam'), 'active', state.jamming);
    setClass($('btn-null'), 'active', state.nulling);
    $('btn-null').disabled = !state.jamming;

    // inspector
    if (shownPart !== state.selectedPart) {
      shownPart = state.selectedPart;
      const p = shownPart ? PART_BY_ID[shownPart] : null;
      setText(insp.code, p ? t('insp.sys', { code: p.code }) : t('insp.sysNone'));
      setText(insp.name, p ? tPart(p, 'name') : t('insp.none'));
      setText(insp.desc, p ? tPart(p, 'description') : t('insp.noneDesc'));
      setText(insp.design, p ? tPart(p, 'design') : '');
      setText(insp.mlabel, p ? tPart(p, 'metric') : '');
      setText(insp.munit, p ? (UNIT_KEY[p.unit] ? t(UNIT_KEY[p.unit]) : p.unit) : '');
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
