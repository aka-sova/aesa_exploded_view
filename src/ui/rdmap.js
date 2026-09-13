// Range–Doppler map: range up, velocity across, log-compressed cells with a scope colourmap,
// axis ticks, and a label on each target blip.
import { RD_NV, RD_NR } from '../radar/doppler.js';
import { t } from '../i18n.js';

const W = 184, H = 140, L = 28, B = 16, T = 4, R = 4;
const DB_LO = -35, DB_HI = 10;

export function createRdMap(canvas) {
  canvas.width = W * 2; canvas.height = H * 2;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  const off = document.createElement('canvas');
  off.width = RD_NV; off.height = RD_NR;
  const octx = off.getContext('2d');
  const img = octx.createImageData(RD_NV, RD_NR);
  const px = img.data;

  function colour(v, o) {
    const db = 10 * Math.log10(v + 1e-6);
    const s = Math.max(0, Math.min(1, (db - DB_LO) / (DB_HI - DB_LO)));
    let r, g, b;
    if (s < 0.6) { const k = s / 0.6; r = 8 + (46 - 8) * k; g = 14 + (230 - 14) * k; b = 26 + (214 - 26) * k; }
    else { const k = (s - 0.6) / 0.4; r = 46 + (255 - 46) * k; g = 230 + (255 - 230) * k; b = 214 + (255 - 214) * k; }
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
  }

  function draw(sample, state) {
    const cells = sample.cells;
    for (let rb = 0; rb < RD_NR; rb++) {
      const row = RD_NR - 1 - rb;            // range increases upward
      for (let vb = 0; vb < RD_NV; vb++) colour(cells[rb * RD_NV + vb], (row * RD_NV + vb) * 4);
    }
    octx.putImageData(img, 0, 0);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pw = W - L - R, ph = H - T - B;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, L, T, pw, ph);
    // frame + ticks
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(L + 0.5, T + 0.5, pw - 1, ph - 1);
    ctx.font = '500 7.5px "Geist Mono", "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = '#7d8996';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const rU = sample.rU, vUa = sample.vUa;
    for (const f of [0, 0.5, 1]) ctx.fillText((rU * f).toFixed(0), L - 3, T + ph - f * ph + (f === 1 ? 4 : f === 0 ? -4 : 0));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`−${vUa.toFixed(1)}`, L + 12, H - 2);
    ctx.fillText('0', L + pw / 2, H - 2);
    ctx.fillText(`+${vUa.toFixed(1)}`, L + pw - 12, H - 2);
    ctx.fillText(t('rd.axisV'), L + pw / 2, H - 9);
    ctx.save();
    ctx.translate(7, T + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'middle';
    ctx.fillText(t('rd.axisR'), 0, 0);
    ctx.restore();
    // zero-velocity line + clutter label
    const xz = L + pw / 2 + 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(xz, T); ctx.lineTo(xz, T + ph); ctx.stroke();
    ctx.setLineDash([]);
    if (!state.mti) {
      ctx.fillStyle = 'rgba(230,237,243,0.55)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(t('rd.clutter'), xz + 3, T + 3);
    }
    // blip labels
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const bl of sample.blips) {
      if (bl.amp < 0.05) continue;
      const x = L + ((bl.vBin + 0.5) / RD_NV) * pw, y = T + ph - ((bl.rBin + 0.5) / RD_NR) * ph;
      ctx.strokeStyle = '#f5a623';
      ctx.strokeRect(x - 4.5, y - 4.5, 9, 9);
      ctx.fillStyle = '#f5a623';
      ctx.fillText(`T${bl.id}`, x + 7, y);
    }
  }

  return { draw };
}
