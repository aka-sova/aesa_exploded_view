// 2-D antenna-pattern cuts: azimuth (solid, teal) and elevation (dashed, amber) in dB.
const H = 112;
const DB_MIN = -40;

export function createPatternPlot(canvas) {
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  let w = 200, dpr = 1, last = null;

  function resize() {
    w = Math.max(120, parent.clientWidth);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = H + 'px';
    if (last) draw(...last);
  }
  new ResizeObserver(resize).observe(parent);
  resize();

  const css = (name, fallback) => getComputedStyle(canvas).getPropertyValue(name).trim() || fallback;
  const x = (k, n) => 26 + ((w - 30) * k) / (n - 1);
  const y = (db) => 4 + (H - 16) * (1 - (Math.max(DB_MIN, Math.min(0, db)) - DB_MIN) / -DB_MIN);

  function draw(cutAz, cutEl, metrics) {
    last = [cutAz, cutEl, metrics];
    const n = cutAz.length;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    ctx.font = '500 8px "Geist Mono", "JetBrains Mono", Consolas, monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = css('--dim', '#55606c');
    ctx.strokeStyle = css('--chart-grid', 'rgba(255,255,255,0.07)');
    ctx.lineWidth = 1;
    for (let db = 0; db >= DB_MIN; db -= 10) {
      const yy = Math.round(y(db)) + 0.5;
      ctx.beginPath(); ctx.moveTo(26, yy); ctx.lineTo(w - 4, yy); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(String(db), 22, yy);
    }
    ctx.textAlign = 'center';
    for (let a = -90; a <= 90; a += 45) {
      const xx = Math.round(x(a + 90, n)) + 0.5;
      ctx.beginPath(); ctx.moveTo(xx, 4); ctx.lineTo(xx, H - 12); ctx.stroke();
      ctx.fillText(`${a}°`, xx, H - 5);
    }
    // −3 dB reference
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = css('--line2', 'rgba(255,255,255,0.14)');
    const y3 = Math.round(y(metrics.peakDb - 3)) + 0.5;
    ctx.beginPath(); ctx.moveTo(26, y3); ctx.lineTo(w - 4, y3); ctx.stroke();
    // curves
    const curve = (c, color, dash) => {
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const xx = x(k, n), yy = y(c[k]); if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    };
    curve(cutEl, css('--amber', '#f5a623'), [4, 3]);
    curve(cutAz, css('--accent', '#2ee6d6'), []);
    ctx.setLineDash([]);
  }

  return { draw };
}
