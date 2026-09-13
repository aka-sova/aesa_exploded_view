// Rolling 60 s strip chart: beam azimuth (teal), elevation (amber), array temperature (red).
const N = 600;            // samples kept (10 Hz × 60 s)
const WINDOW_S = 60;
const H = 76;
const SERIES = [
  { key: 'az', lo: -70, hi: 70, color: '#2ee6d6' },
  { key: 'el', lo: -10, hi: 50, color: '#f5a623' },
  { key: 'temp', lo: 20, hi: 90, color: '#e24b4a' },
];

export function createStripChart(canvas) {
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  const buf = { az: new Float32Array(N), el: new Float32Array(N), temp: new Float32Array(N), t: new Float32Array(N) };
  let head = 0, count = 0, lastPush = -Infinity, now = 0;
  let w = 300, dpr = 1;

  function resize() {
    w = Math.max(120, parent.clientWidth);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = H + 'px';
    draw();
  }
  new ResizeObserver(resize).observe(parent);
  resize();

  function push(azDeg, elDeg, tempC, t) {
    now = t;
    if (t - lastPush < 0.1) return;
    lastPush = t;
    buf.az[head] = azDeg; buf.el[head] = elDeg; buf.temp[head] = tempC; buf.t[head] = t;
    head = (head + 1) % N;
    if (count < N) count++;
    draw();
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue('--chart-grid').trim() || 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = Math.round((H * i) / 4) + 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 1; i < 6; i++) {
      const x = Math.round((w * i) / 6) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    if (count < 2) return;
    for (const s of SERIES) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      let started = false;
      for (let k = 0; k < count; k++) {
        const i = (head - count + k + N) % N;
        const x = w - ((now - buf.t[i]) / WINDOW_S) * w;
        if (x < -2) continue;
        const y = H - ((buf[s.key][i] - s.lo) / (s.hi - s.lo)) * (H - 6) - 3;
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  return { push, draw };
}
