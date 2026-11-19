// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */


// src/setupin.js
function stpPanelRecord() {
  const raw = localStorage.getItem('gsp.panel');
  if (raw == null) return {};
  const panel = JSON.parse(raw);
  if (!panel || typeof panel !== 'object' || Array.isArray(panel)) throw new Error('Unreadable gsp.panel');
  return panel;
}
// src/setupin.js
function stpPanelWidth(panel = stpPanelRecord()) {
  for (const raw of [panel.w, localStorage.getItem('gsn.besideW')]) {
    const w = typeof raw === 'string' && raw.trim() ? Number(raw) : raw;
    if (Number.isFinite(w) && w >= 300 && w <= 900) return w;
  }
  return null;
}
export { stpPanelRecord, stpPanelWidth };
