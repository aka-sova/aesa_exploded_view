// Guided tour: a sequence of stations, each of which configures the scene (camera, view mode,
// explode, scan pattern, subarray tasking, failures…), highlights the relevant HUD control and
// explains one idea. Exiting restores the settings the user had before the tour started.
import { t, onLangChange } from '../i18n.js';

const $ = (id) => document.getElementById(id);
const ALL_SEARCH = ['search', 'search', 'search', 'search'];

// Baseline every station starts from; stations then override what they need.
function baseline(s, api) {
  api.setViewMode('assembled');
  s.explodeTarget = 0;
  s.scanPattern = 'raster';
  s.quadrantModes.splice(0, 4, ...ALL_SEARCH);
  s.failedFraction = 0;
  s.jamming = false;
  s.nulling = false;
  s.prf = 1200;
  s.power = 60;
  s.scanRate = 1;
  s.selectedPart = null;
  s.spacingLambda = 0.5;
  s.taper = 0;
  s.patternSearch = true;
  s.patternTrack = true;
  s.patternCuts = true;
  s.trackRevisit = 1.0;
  s.trackLoadCap = 0.7;
  s.timelineVisible = true;
}

const STEPS = [
  { id: 'intro', highlight: [], apply(s, api) { baseline(s, api); api.setCameraPreset('front'); s.running = false; } },
  { id: 'stack', highlight: ['#explode', '#parts-list'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.explodeTarget = 1; s.running = false; } },
  { id: 'aperture', highlight: ['#inset'], apply(s, api) { baseline(s, api); api.setCameraPreset('front'); s.selectedPart = 'aperture'; s.running = false; } },
  { id: 'trm', highlight: [], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); api.setViewMode('xray'); s.explodeTarget = 0.35; s.selectedPart = 'trm'; s.running = false; } },
  { id: 'steering', highlight: ['#inset', '[data-tel="hops"]'], apply(s, api) { baseline(s, api); api.setCameraPreset('front'); s.scanPattern = 'sector'; s.selectedPart = 'bsc'; s.running = true; } },
  { id: 'beamwidth', highlight: ['[data-tel="beamwidthDeg"]', '[data-tel="scanLossDb"]'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.scanPattern = 'sector'; s.running = true; } },
  { id: 'pattern', highlight: ['#pattern-block'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.scanPattern = 'sector'; s.running = true; } },
  { id: 'pulses', highlight: ['#prf', '[data-tel="unambRangeKm"]'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.running = true; } },
  { id: 'dome', highlight: ['#scan-patterns'], apply(s, api) { baseline(s, api); api.setCameraPreset('dome'); s.running = true; } },
  { id: 'subarrays', highlight: ['#tiles'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.quadrantModes[3] = 'track'; s.running = true; } },
  { id: 'agile', highlight: ['#scan-patterns'], apply(s, api) { baseline(s, api); api.setCameraPreset('dome'); s.scanPattern = 'agile'; s.running = true; } },
  { id: 'manager', highlight: ['#manager-block', '#timeline-wrap'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.scanPattern = 'raster'; s.power = 100; s.trackRevisit = 0.6; s.running = true; } },
  { id: 'signal', highlight: ['#view-modes'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); api.setViewMode('signal'); s.explodeTarget = 0.6; s.running = true; } },
  { id: 'degradation', highlight: ['#btn-fail', '[data-tel="eirpLossDb"]'], apply(s, api) { baseline(s, api); api.setCameraPreset('front'); s.failedFraction = 0.15; s.running = true; } },
  { id: 'jamming', highlight: ['#btn-jam', '#jam-warning'], apply(s, api) { baseline(s, api); api.setCameraPreset('dome'); s.jamming = true; s.running = true; } },
  { id: 'nulling', highlight: ['#btn-null'], apply(s, api) { baseline(s, api); api.setCameraPreset('dome'); s.jamming = true; s.nulling = true; s.running = true; } },
  { id: 'thermal', highlight: ['[data-tel="arrayTempC"]', '#prf', '#power'], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.prf = 4000; s.power = 100; s.selectedPart = 'coldplate'; s.running = true; } },
  { id: 'end', highlight: [], apply(s, api) { baseline(s, api); api.setCameraPreset('rear'); s.running = true; } },
];
const SNAPSHOT_KEYS = ['viewMode', 'cameraPreset', 'explodeTarget', 'scanPattern', 'failedFraction', 'jamming', 'nulling', 'running', 'prf', 'power', 'scanRate', 'selectedPart', 'spacingLambda', 'taper', 'patternSearch', 'patternTrack', 'patternCuts', 'trackRevisit', 'trackLoadCap', 'timelineVisible'];

export function mountTutorial(state, api) {
  const card = $('tutorial'), viewport = $('viewport');
  const els = { step: $('tut-step'), title: $('tut-title'), body: $('tut-body'), tryLabel: $('tut-try-label'), tryText: $('tut-try-text'), tryBox: $('tut-try'), dots: $('tut-dots'), back: $('tut-back'), next: $('tut-next'), close: $('tut-close') };
  const button = $('btn-tutorial');
  let idx = -1, snapshot = null;
  let highlighted = [];

  function highlightTargets(selectors) {
    const out = [];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) out.push(el.closest('.slider-row, .tel-row') || el);
    }
    return out;
  }
  function clearHighlights() {
    for (const el of highlighted) el.classList.remove('tut-highlight');
    highlighted = [];
  }

  function render() {
    const step = STEPS[idx];
    els.step.textContent = t('tut.stepOf', { n: idx + 1, total: STEPS.length });
    els.title.textContent = t(`tut.${step.id}.title`);
    els.body.innerHTML = t(`tut.${step.id}.body`);
    const tryKey = `tut.${step.id}.try`;
    const tryText = t(tryKey);
    const hasTry = tryText !== tryKey;
    els.tryBox.classList.toggle('hidden', !hasTry);
    if (hasTry) { els.tryLabel.textContent = t('tut.try'); els.tryText.textContent = tryText; }
    els.back.textContent = t('tut.back');
    els.back.disabled = idx === 0;
    els.next.textContent = idx === STEPS.length - 1 ? t('tut.finish') : t('tut.next');
    els.close.title = t('tut.exit');
    els.dots.innerHTML = STEPS.map((_, i) => `<i class="${i === idx ? 'on' : i < idx ? 'done' : ''}"></i>`).join('');
    els.body.scrollTop = 0;
    clearHighlights();
    highlighted = highlightTargets(step.highlight);
    for (const el of highlighted) el.classList.add('tut-highlight');
  }

  function go(i) {
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    STEPS[idx].apply(state, api);
    render();
  }

  function start() {
    snapshot = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, state[k]]));
    snapshot.quadrantModes = [...state.quadrantModes];
    card.classList.remove('hidden');
    viewport.classList.add('tutorial-active');
    button.classList.add('active');
    go(0);
  }

  function stop() {
    if (idx < 0) return;
    clearHighlights();
    card.classList.add('hidden');
    viewport.classList.remove('tutorial-active');
    button.classList.remove('active');
    idx = -1;
    if (snapshot) {
      for (const k of SNAPSHOT_KEYS) if (k !== 'viewMode' && k !== 'cameraPreset') state[k] = snapshot[k];
      state.quadrantModes.splice(0, 4, ...snapshot.quadrantModes);
      api.setViewMode(snapshot.viewMode);
      api.setCameraPreset(snapshot.cameraPreset);
      snapshot = null;
    }
  }

  button.onclick = () => (idx >= 0 ? stop() : start());
  els.close.onclick = stop;
  els.back.onclick = () => go(idx - 1);
  els.next.onclick = () => (idx === STEPS.length - 1 ? stop() : go(idx + 1));
  window.addEventListener('keydown', (e) => {
    if (idx < 0) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (idx === STEPS.length - 1) stop(); else go(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'Escape') { e.preventDefault(); stop(); }
  });
  onLangChange(() => { if (idx >= 0) render(); });

  return { start, stop, isActive: () => idx >= 0, stepCount: STEPS.length };
}
