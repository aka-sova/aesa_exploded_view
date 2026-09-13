// Colour theme: 'dark' (default) or 'light'. Applied as data-theme on <html>; the stylesheet
// swaps its tokens from that attribute. The 3-D viewport keeps a dark canvas in both themes
// because the beam/dome glow is additive and would clip to white on a light background.
import { t, onLangChange } from '../i18n.js';

export const THEMES = ['dark', 'light'];
const STORAGE_KEY = 'radar-lab-theme';
const subscribers = new Set();
let theme = detect();

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(saved)) return saved;
  } catch { /* storage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getTheme() { return theme; }

export function setTheme(next) {
  if (!THEMES.includes(next)) return;
  const changed = next !== theme;
  theme = next;
  if (changed) { try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ } }
  apply();
}

export function onThemeChange(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }

let buttons = [];
function apply() {
  document.documentElement.dataset.theme = theme;
  for (const b of buttons) b.classList.toggle('active', b.dataset.theme === theme);
  for (const fn of subscribers) fn(theme);
}

export function mountTheme() {
  buttons = [...document.querySelectorAll('#theme-toggle [data-theme]')];
  for (const b of buttons) b.onclick = () => setTheme(b.dataset.theme);
  const relabel = () => { for (const b of buttons) b.title = t('theme.title'); };
  onLangChange(relabel);
  relabel();
  apply();
  return { get: getTheme, set: setTheme };
}
