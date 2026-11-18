// Signing in to Google, as the current app does (src/app/drive.js): Google's own sign-in, a key that lasts an hour, kept for this
// window only (sessionStorage gs.gTok, shared with the Planner's chooser), and renewed by itself when it runs out unless she turned
// that off (gs.gAuto false: then the sync waits for a press on the Google line). Two kinds of access, never the whole Drive:
// drive.appdata (the app's own hidden folder, for the sync) and drive.file (only files she picks in Google's chooser, or the app makes).
// On an iPhone or iPad the sign-in goes to Google's page and comes back with the key in the address: that is taken out here, before
// the address is read by anything else (main.js loads this first, through whole/index.js).
import { googleEmail, googleClientId, googleAuto } from '../planning/index.js';
import { savePref, setGoogleToken } from '../planning/write.js';

const BUILT = typeof __GS_GCID__ === 'string' ? __GS_GCID__ : '';
export const SYNC_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export const PICK_SCOPE = 'https://www.googleapis.com/auth/drive.file ' + SYNC_SCOPE;
export const gcid = () => (/apps\.googleusercontent\.com$/.test(BUILT) ? BUILT : '') || String(googleClientId.json('') || '');
export const G = { token: null, exp: 0, scope: '', client: null, cscope: '', email: String(googleEmail.json('') || ''), waiters: [], quiet: false };
export const G_REDIRECT = typeof navigator !== 'undefined' && (navigator.standalone === true || /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
// Google sign-in works only on the hosted copy, in a page of its own (not a preview frame).
export const GOK = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && window.self === window.top;
const back = () => location.origin + location.pathname.replace(/index\.html$/, '');
const keep = () => { try { setGoogleToken(G.token ? { t: G.token, exp: G.exp, scope: G.scope } : null); } catch {} };
const told = new Set();
export const onGoogle = f => { told.add(f); return () => told.delete(f); };
const say = () => told.forEach(f => { try { f(); } catch (e) { console.error(e); } });

if (typeof location !== 'undefined') {
  const h = new URLSearchParams(location.hash.replace(/^#/, '')), want = (() => { try { return sessionStorage.getItem('gs.gState'); } catch { return null; } })();
  if ((h.get('access_token') || h.get('error')) && h.get('state')) {
    if (want && h.get('state') === want && h.get('access_token')) { G.token = h.get('access_token'); G.exp = Date.now() + (+h.get('expires_in') || 3600) * 1000; G.scope = h.get('scope') || SYNC_SCOPE; G.back = true; try { sessionStorage.setItem('gs.gTok', JSON.stringify({ t: G.token, exp: G.exp, scope: G.scope })); } catch {} }
    try { sessionStorage.removeItem('gs.gState'); history.replaceState(null, '', location.pathname + location.search); } catch {}
  } else try { const k = JSON.parse(sessionStorage.getItem('gs.gTok')); if (k && k.exp > Date.now()) { G.token = k.t; G.exp = k.exp; G.scope = k.scope || ''; } } catch {}
}
export function gRedirect(scope, quiet) {
  const st = crypto.getRandomValues(new Uint32Array(2)).join('');
  try { sessionStorage.setItem('gs.gState', st); } catch {}
  location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: gcid(), redirect_uri: back(), response_type: 'token', scope, include_granted_scopes: 'true', state: st, ...(G.email ? { login_hint: G.email } : {}), ...(quiet ? { prompt: 'none' } : {}) });
}
let gisP = null;
function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return gisP || (gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(Object.assign(new Error('offline'), { why: 'offline' })); }; document.head.appendChild(s); }));
}
export const gAuto = () => googleAuto.json(true) !== false;
export function setAuto(v) { savePref('gs.gAuto', !!v); say(); }
export const gHas = scope => scope.split(' ').every(x => G.scope.split(' ').includes(x));
export const gLive = () => !!G.token && Date.now() < G.exp - 60000;
const err = why => Object.assign(new Error(why), { why });
// A fresh key; silent when she's already signed in to Google in this browser. full: 'pick' for drive.file, else only the hidden folder.
export async function gToken(interactive, full) {
  const scope = full ? PICK_SCOPE : SYNC_SCOPE;
  if (G.token && Date.now() < G.exp - 60000 && gHas(scope)) return G.token;
  if (!gcid()) throw err('setup');
  if (!interactive && !gAuto()) throw err('signin');
  if (!interactive && G.quiet) throw err('away');   // a tab being left never opens Google's window or page
  if (G_REDIRECT) { gRedirect(scope); throw err('signin'); }
  await loadGis();
  if (!G.client || G.cscope !== scope) {
    G.cscope = scope;
    G.client = google.accounts.oauth2.initTokenClient({
      client_id: gcid(), scope, hint: G.email || undefined, include_granted_scopes: true,
      callback: r => { const w = G.waiters.splice(0); if (r.error) w.forEach(x => x.rej(err('signin'))); else { G.token = r.access_token; G.exp = Date.now() + (r.expires_in || 3600) * 1000; G.scope = r.scope || scope; keep(); w.forEach(x => x.res(G.token)); } },
      error_callback: e => { const w = G.waiters.splice(0); w.forEach(x => x.rej(err(e && e.type === 'popup_closed' ? 'closed' : 'signin'))); },
    });
  }
  // one window at a time: a second ask while Google's window is open waits for the same answer
  return new Promise((res, rej) => { G.waiters.push({ res, rej }); if (G.waiters.length === 1) G.client.requestAccessToken({ prompt: interactive && !G.email ? 'consent' : '' }); });
}
// A new key before this one runs out, for what this one already covers. The old one stays in use if Google doesn't answer.
export async function gRenew() {
  const was = { token: G.token, exp: G.exp, scope: G.scope }, all = PICK_SCOPE.split(' ').every(x => (was.scope || '').split(' ').includes(x));
  G.exp = 0;
  try { return await gToken(false, all ? 'pick' : false); } catch (e) { if (!G.exp) Object.assign(G, was); throw e; }
}
// Every call but the sync's own (sync true) is for files she picked or the app made (drive.file).
export async function gfetch(url, opt = {}, interactive, sync, again) {
  const tk = await gToken(interactive, sync === true ? false : 'pick');
  const r = await fetch(url.startsWith('http') ? url : 'https://www.googleapis.com/drive/v3/' + url, { ...opt, headers: { ...(opt.headers || {}), Authorization: 'Bearer ' + tk } });
  if (r.status === 401 && !again) { G.token = null; G.exp = 0; keep(); return gfetch(url, opt, interactive, sync, true); }
  if (!r.ok) { const e = err('drive'); e.status = r.status; e.message = 'Google Drive said ' + r.status + ': ' + ((await r.text()).match(/"message":\s*"([^"]+)/) || [, ''])[1]; throw e; }
  return r;
}
export const gsync = (u, o, i) => gfetch(u, o, i, true);
export function setEmail(v) { G.email = v || ''; savePref('gs.gEmail', v ? v : undefined); say(); }
export async function whoAmI() { const me = await (await gsync('about?fields=user(emailAddress)')).json(); setEmail(me.user.emailAddress); return G.email; }
export function signOut() {
  if (G.token && window.google && google.accounts && google.accounts.oauth2) try { google.accounts.oauth2.revoke(G.token); } catch {}
  G.token = null; G.exp = 0; G.scope = ''; keep(); setEmail('');
}
export const googleCan = () => GOK && !!gcid();
export const changed = say;
