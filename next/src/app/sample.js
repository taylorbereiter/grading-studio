// The sample (src/samplemode.js, at the top of every page of both versions): while it is open, every name this page stores under
// is the sample's own, so the shell simply shows the made-up classes through the same layer.
//
// What fills the sample is made once, by the current app's grading page (src/sample.js builds it with that page's own code). If the
// new app is opened on a sample that is not made yet, it lets the writing lock go and opens the current page out of sight in a
// frame at the same address; that page makes the sample and marks it made (gs.sampleBuilt), and this page starts again on it.
import { stop as lockStop } from '../shared/lock.js';

const S = () => window.__gsSample || null;
export const sampleOn = () => !!(S() && S().on);
export const sampleReady = () => !sampleOn() || !!S().built;
export function enterSample() { const s = S(); if (!s || !s.enter()) return false; restart(); return true; }
export function leaveSample() { const s = S(); if (!s) return; s.leave(); restart(); }
function restart() { try { history.replaceState(null, '', location.pathname + location.search + '#/home'); } catch {} location.reload(); }

// The current app's grading page, relative to next/index.html.
const GRADING = '../index.html#/';
const builtKey = 'gs.sampleBuilt';   // read through the sample's names (samplemode.js adds "sample:")
// Resolves when the sample is made, or rejects after `wait` ms. onStep is told nothing but that it is under way.
export function buildSample(wait = 120000) {
  return new Promise((res, rej) => {
    lockStop();
    const f = document.createElement('iframe');
    f.src = GRADING; f.title = ''; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
    f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:800px;border:0;visibility:hidden';
    document.body.appendChild(f);
    const t0 = Date.now(), tick = setInterval(() => {
      let v = null; try { v = localStorage.getItem(builtKey); } catch {}
      if (v != null) { clearInterval(tick); setTimeout(() => { f.remove(); res(); }, 800); }   // the page reloads itself once it has made it
      else if (Date.now() - t0 > wait) { clearInterval(tick); f.remove(); rej(new Error('The sample was not made in time')); }
    }, 300);
  });
}
export const restartApp = restart;
