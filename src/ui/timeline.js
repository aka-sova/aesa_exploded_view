// Resource-manager timeline: the last few seconds of dwells, one lane for the pooled beam and one
// per quadrant that is currently a dedicated track beam, plus event markers.
import { t } from '../i18n.js';

const WINDOW_S = 6, LABEL_W = 78, TOP = 12, ROW = 10, GAP = 3, FOOT = 14;
const TYPE_COLOR = { search: '#2ee6d6', track: '#f5a623', confirm: '#ffffff', acquire: '#7a5a1a', idle: '#3a4a5a' };
const EVENT_COLOR = { detect: '#ffffff', confirmed: '#f5a623', lost: '#e24b4a', overload: '#e24b4a' };

export function createTimeline(canvas) {
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  let w = 400, h = 0, dpr = 1;
  const lanes = [];   // { lane, label, color } rebuilt each frame from state

  function applySize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  new ResizeObserver(() => { w = Math.max(160, parent.clientWidth); applySize(); }).observe(parent);
  w = Math.max(160, parent.clientWidth);

  const x = (time, now) => LABEL_W + ((w - LABEL_W - 4) * (time - now + WINDOW_S)) / WINDOW_S;
  const rowY = (row) => TOP + row * (ROW + GAP);

  function buildLanes(state) {
    lanes.length = 0;
    const pooled = [];
    for (let q = 0; q < 4; q++) if (state.quadrantModes[q] === 'search') pooled.push('Q' + q);
    lanes.push({ lane: 0, label: pooled.length ? `${t('tl.pooled')} ${pooled.join(' ')}` : t('tl.pooled'), color: '#e6edf3' });
    for (let q = 0; q < 4; q++) {
      if (state.quadrantModes[q] !== 'track') continue;
      const beam = state.beams.find((b) => b.type === 'track' && b.quadrants[0] === q);
      const tgt = beam && beam.targetId !== null ? ` → T${beam.targetId}` : ` · ${t('roster.acquiring')}`;
      lanes.push({ lane: 1 + q, label: `Q${q}${tgt}`, color: '#f5a623' });
    }
    const need = TOP + lanes.length * (ROW + GAP) + FOOT;
    if (need !== h) { h = need; applySize(); }
  }

  function draw(manager, now, state) {
    buildLanes(state);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = '500 8px "Geist Mono", "JetBrains Mono", Consolas, monospace';
    ctx.textBaseline = 'middle';

    const rowOf = new Map();
    lanes.forEach((l, i) => rowOf.set(l.lane, i));
    // rails + labels
    for (let i = 0; i < lanes.length; i++) {
      const y = rowY(i);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(LABEL_W, y, w - LABEL_W - 4, ROW);
      ctx.fillStyle = lanes[i].color;
      ctx.textAlign = 'left';
      ctx.fillText(lanes[i].label, 2, y + ROW / 2, LABEL_W - 6);
    }
    // second ticks
    const railBottom = rowY(lanes.length - 1) + ROW + 2;
    ctx.fillStyle = '#55606c';
    ctx.textAlign = 'center';
    for (let s = 0; s <= WINDOW_S; s++) {
      const xx = Math.round(x(now - s, now)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(xx, TOP - 2); ctx.lineTo(xx, railBottom); ctx.stroke();
      if (s > 0 && s < WINDOW_S) ctx.fillText(`−${s}s`, xx, h - 6);
    }
    // dwells: pooled blocks touch; dedicated updates keep a 1 px gap so they read as a train of dwells
    const d = manager.dwells;
    for (let i = 0; i < d.length; i++) {
      const it = d[i];
      if (it.end < now - WINDOW_S) continue;
      const row = rowOf.get(it.lane);
      if (row === undefined) continue;
      const x0 = Math.max(LABEL_W, x(it.start, now)), x1 = x(Math.min(it.end, now), now) - (it.lane ? 1 : 0);
      if (x1 <= x0) continue;
      ctx.fillStyle = TYPE_COLOR[it.type] || TYPE_COLOR.idle;
      ctx.fillRect(x0, rowY(row), Math.max(1, x1 - x0), ROW);
    }
    // events (markers above the pooled lane)
    const e = manager.events;
    for (let i = 0; i < e.length; i++) {
      const ev = e[i];
      if (ev.t < now - WINDOW_S) continue;
      const xx = x(ev.t, now);
      ctx.fillStyle = EVENT_COLOR[ev.type] || '#ffffff';
      ctx.beginPath(); ctx.moveTo(xx, TOP - 1); ctx.lineTo(xx - 3, TOP - 7); ctx.lineTo(xx + 3, TOP - 7); ctx.closePath(); ctx.fill();
    }
    // now line
    const xn = Math.round(x(now, now)) + 0.5;
    ctx.strokeStyle = '#e6edf3';
    ctx.beginPath(); ctx.moveTo(xn, TOP - 8); ctx.lineTo(xn, railBottom); ctx.stroke();
    // legend
    ctx.textAlign = 'right';
    let lx = w - 4;
    for (const [type, key] of [['confirm', 'tl.confirm'], ['track', 'tl.track'], ['search', 'tl.search']]) {
      const label = t(key);
      ctx.fillStyle = '#7d8996';
      ctx.fillText(label, lx, h - 6);
      lx -= ctx.measureText(label).width + 10;
      ctx.fillStyle = TYPE_COLOR[type];
      ctx.fillRect(lx, h - 9, 6, 6);
      lx -= 12;
    }
  }

  return { draw };
}
