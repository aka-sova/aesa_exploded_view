// Resource-manager timeline: the last few seconds of dwells per beam lane, plus event markers.
import { t } from '../i18n.js';

const H = 74, WINDOW_S = 6, LANES = 5, LABEL_W = 54, TOP = 12, ROW = 10, GAP = 2;
const TYPE_COLOR = { search: '#2ee6d6', track: '#f5a623', confirm: '#ffffff', acquire: '#7a5a1a', idle: '#3a4a5a' };
const EVENT_COLOR = { detect: '#ffffff', confirmed: '#f5a623', lost: '#e24b4a', overload: '#e24b4a' };

export function createTimeline(canvas) {
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  let w = 400, dpr = 1;

  function resize() {
    w = Math.max(160, parent.clientWidth);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = H + 'px';
  }
  new ResizeObserver(resize).observe(parent);
  resize();

  const x = (time, now) => LABEL_W + ((w - LABEL_W - 4) * (time - now + WINDOW_S)) / WINDOW_S;
  const laneY = (lane) => TOP + lane * (ROW + GAP);

  function draw(manager, now, state) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    ctx.font = '500 8px "Geist Mono", "JetBrains Mono", Consolas, monospace';
    ctx.textBaseline = 'middle';

    // lane rails + labels
    const labels = [t('tl.pooled'), 'Q0', 'Q1', 'Q2', 'Q3'];
    for (let l = 0; l < LANES; l++) {
      const y = laneY(l);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(LABEL_W, y, w - LABEL_W - 4, ROW);
      ctx.fillStyle = l === 0 ? '#e6edf3' : state.quadrantModes[l - 1] === 'track' ? '#f5a623' : '#55606c';
      ctx.textAlign = 'left';
      ctx.fillText(labels[l], 2, y + ROW / 2);
    }
    // second ticks
    ctx.fillStyle = '#55606c';
    ctx.textAlign = 'center';
    for (let s = 0; s <= WINDOW_S; s++) {
      const xx = Math.round(x(now - s, now)) + 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(xx, TOP - 2); ctx.lineTo(xx, laneY(LANES - 1) + ROW + 2); ctx.stroke();
      if (s > 0 && s < WINDOW_S) ctx.fillText(`−${s}s`, xx, H - 5);
    }
    // dwells
    const d = manager.dwells;
    for (let i = 0; i < d.length; i++) {
      const it = d[i];
      if (it.end < now - WINDOW_S) continue;
      const x0 = Math.max(LABEL_W, x(it.start, now)), x1 = x(Math.min(it.end, now), now);
      if (x1 <= x0) continue;
      ctx.fillStyle = TYPE_COLOR[it.type] || TYPE_COLOR.idle;
      ctx.fillRect(x0, laneY(it.lane), Math.max(1, x1 - x0), ROW);
    }
    // events (markers above lane 0)
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
    ctx.beginPath(); ctx.moveTo(xn, TOP - 8); ctx.lineTo(xn, laneY(LANES - 1) + ROW + 2); ctx.stroke();
    // legend
    ctx.textAlign = 'right';
    let lx = w - 4;
    for (const [type, key] of [['confirm', 'tl.confirm'], ['track', 'tl.track'], ['search', 'tl.search']]) {
      const label = t(key);
      ctx.fillStyle = '#7d8996';
      ctx.fillText(label, lx, H - 5);
      lx -= ctx.measureText(label).width + 10;
      ctx.fillStyle = TYPE_COLOR[type];
      ctx.fillRect(lx, H - 8, 6, 6);
      lx -= 12;
    }
  }

  return { draw };
}
