// HUD font-size control: scales the root font-size (every HUD size is in rem) between 80 % and
// 140 % in 10 % steps. Persisted per browser; the percentage readout resets to 100 %.
import { t, onLangChange } from '../i18n.js';

const STORAGE_KEY = 'radar-lab-fontscale';
const BASE_PX = 13;
const MIN = 0.8, MAX = 1.4, STEP = 0.1;
const PANELS_REM = 40.3;       // left + right sidebar widths (see grid-template-columns)
const MIN_VIEWPORT_SHARE = 0.4; // the 3-D viewport keeps at least this fraction of the window

// Largest scale at which the sidebars still leave the viewport its minimum share.
const maxForWindow = () =>
  Math.max(MIN, Math.min(MAX, Math.floor(((1 - MIN_VIEWPORT_SHARE) * window.innerWidth / (PANELS_REM * BASE_PX)) * 10) / 10));

export function mountFontSize() {
  const dec = document.getElementById('font-dec');
  const inc = document.getElementById('font-inc');
  const val = document.getElementById('font-val');
  let scale = 1;
  try { const v = parseFloat(localStorage.getItem(STORAGE_KEY)); if (v >= MIN && v <= MAX) scale = v; } catch { /* storage unavailable */ }

  function apply() {
    const max = maxForWindow();
    scale = Math.round(Math.max(MIN, Math.min(max, scale)) * 10) / 10;
    document.documentElement.style.fontSize = `${BASE_PX * scale}px`;
    val.textContent = `${Math.round(scale * 100)}%`;
    dec.disabled = scale <= MIN + 1e-6;
    inc.disabled = scale >= max - 1e-6;
    try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch { /* ignore */ }
  }
  function relabel() {
    dec.title = t('font.smaller');
    inc.title = t('font.larger');
    val.title = t('font.reset');
  }

  dec.onclick = () => { scale -= STEP; apply(); };
  inc.onclick = () => { scale += STEP; apply(); };
  val.onclick = () => { scale = 1; apply(); };
  window.addEventListener('resize', apply);
  onLangChange(relabel);
  relabel();
  apply();
  return { get scale() { return scale; }, set(v) { scale = v; apply(); } };
}
