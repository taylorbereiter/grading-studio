// The app's text size and full screen (Settings > Display). Text size is the current app's own setting (gs.disp ui: 0.9, 1, 1.15 or
// 1.3; src/app/display.js applyDisp), kept on this computer and read by both apps. The new app draws it as the current app does: the
// sidebar, the pages and the boxes grow, the paper being marked keeps its own zoom (shell.css, --uz).
// Full screen is the browser's (src/fullscreen.js): only when she asks, never kept, F or the button in Settings to go in and out.
export const SIZES = [0.9, 1, 1.15, 1.3];
export function uiSize() {
  try { const d = JSON.parse(localStorage.getItem('gs.disp') || 'null'), v = d && +d.ui; return SIZES.includes(v) ? v : 1; } catch { return 1; }
}
export function applySize(v = uiSize()) { document.documentElement.style.setProperty('--uz', String(SIZES.includes(+v) ? +v : 1)); }
export const fullCan = () => !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
export const fullOn = () => document.fullscreenElement === document.documentElement;
export async function fullToggle() {
  try {
    if (fullOn()) await document.exitFullscreen();
    else if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  } catch {}
}
