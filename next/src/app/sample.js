// The sample (src/samplemode.js, at the top of every page of both versions): while it is open, every name this page stores under
// is the sample's own, so the shell simply shows the made-up classes through the same layer.
//
// What fills the sample is made once, by the new app's own builder (whole/sample-build.js) from the same src/sample-data.js the current
// app uses, and marked made (gs.sampleBuilt) with the same stamp, so either app opens the sample the other made.

const S = () => window.__gsSample || null;
export const sampleOn = () => !!(S() && S().on);
export const sampleReady = () => !sampleOn() || !!S().built;
export function enterSample() { const s = S(); if (!s || !s.enter()) return false; restart(); return true; }
export function leaveSample() { const s = S(); if (!s) return; s.leave(); restart(); }
function restart() { try { history.replaceState(null, '', location.pathname + location.search + '#/home'); } catch {} location.reload(); }

// Resolves when the sample is made by make() (main.js hands it whole/sample-build.js, the new app's own builder, which holds both
// sides), or rejects after `wait` ms.
export function buildSample(make, wait = 120000) {
  return Promise.race([make().then(m => m.buildHere()), new Promise((_, rej) => setTimeout(() => rej(new Error('The sample was not made in time')), wait))]);
}
export const restartApp = restart;
