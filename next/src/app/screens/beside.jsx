// Her assistant from the sidebar (src/beside.js): with one, a click opens it her way, in a window on the right or a new tab; with
// others she switches to (Settings > Working with AI), a menu lists them with the one in use ticked, and Assistants and their links…
// Picking another opens it and makes it the one in use, with its own link (settings-more.jsx's use, as src/beside.js besideUse).
// Esc closes the menu and goes back to the link, Up and Down move. Loaded by focus/side.js on the first plain click on the link; what
// reads and changes her settings comes with Settings' own part (router.js PARTS.setmore), so nothing on the way here reaches either side.
import { h, render } from 'preact';
import { Icon } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { PARTS, href } from '../router.js';
import './prefs-lines.js';

let S = null, KNOWN = [];   // screens/settings-more.jsx: openBeside, urlClean, change, readLibrary, meNow, and the assistants the app knows
const usual = n => { const a = KNOWN.find(x => x[0].toLowerCase() === String(n || '').trim().toLowerCase()); return a ? a[1] : ''; };
const nameOf = m => String(m.ai == null ? (m.scale12 ? KNOWN[1][0] : '') : m.ai).trim().slice(0, 30);
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
// The one in use first, then the others the app knows or she gave a link for, less the ones she took off the list; each with a link.
function besideList(m) {
  const a = nameOf(m), link = a ? S.urlClean(m.aiUrl) || usual(a) : ''; if (!link) return [];
  const urls = m.aiUrls && typeof m.aiUrls === 'object' ? m.aiUrls : {}, off = Array.isArray(m.aiOff) ? m.aiOff : [];
  const names = [...new Set(KNOWN.map(x => x[0]).concat(Object.keys(urls)))].filter(n => n.toLowerCase() !== a.toLowerCase() && !off.includes(n));
  return [{ name: a, link, own: link !== usual(a), cur: true }].concat(names.map(n => ({ name: n, link: S.urlClean(urls[n]) || usual(n), own: !!S.urlClean(urls[n]) })).filter(x => x.link));
}
function use(name) {
  return S.change(t('prefs.ai_step'), me => {
    const was = nameOf(me), urls = { ...(me.aiUrls && typeof me.aiUrls === 'object' ? me.aiUrls : {}) };
    if (was) { if (S.urlClean(me.aiUrl)) urls[was] = S.urlClean(me.aiUrl); else delete urls[was]; }
    const u = S.urlClean(urls[name]); delete urls[name];
    me.ai = name; if (u) me.aiUrl = u; else delete me.aiUrl;
    if (Object.keys(urls).length) me.aiUrls = urls; else delete me.aiUrls;
  }, t('prefs.ai_now', { name }));
}

let box = null, anchor = null;
function shut(back) {
  if (!box) return;
  render(null, box); box.remove(); box = null;
  document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', keys, true);
  if (anchor) { anchor.setAttribute('aria-expanded', 'false'); if (back) anchor.focus({ preventScroll: true }); }
}
const away = e => { if (box && !box.contains(e.target) && !anchor.contains(e.target)) shut(false); };
function keys(e) {
  if (!box) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return shut(true); }
  if (e.key === 'Tab') return shut(false);
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault(); e.stopPropagation();
  const rows = [...box.querySelectorAll('[role=menuitem]')], i = rows.indexOf(document.activeElement), n = rows.length;
  rows[(i + (e.key === 'ArrowDown' ? 1 : -1) + n) % n].focus();
}
function Rows({ list, tab }) {
  const pick = (e, x) => {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault(); shut(true);
    if (!x.cur) use(x.name);
    S.openBeside(x.link, tab);
  };
  return <div class="pop bsmenu" role="menu" aria-label={t('prefs.ai_beside')} data-bsmenu>
    <div class="mh">{t('prefs.ai_beside')}</div>
    {list.map(x => <a class="mi" role="menuitem" href={x.link} target="_blank" rel="noopener" aria-current={x.cur ? 'true' : undefined} data-bsname={x.name} onClick={e => pick(e, x)}>
      <span class="i chk">{x.cur ? <Icon name="check" size="xs" /> : null}</span><span class="mt"><b data-raw>{x.name}</b>{x.own ? <small data-raw>{host(x.link)}</small> : null}</span></a>)}
    <div class="sep" />
    <a class="mi" role="menuitem" href={href('settings', 'ai')} onClick={() => shut(false)} data-bsset><span class="i chk" /><span class="mt">{t('prefs.ai_all')}</span></a>
  </div>;
}
// The sidebar link pressed: the menu when there are several, else her assistant opened her way. A second press closes the menu.
export async function besidePress(a) {
  if (box) return shut(true);
  S = S || await PARTS.setmore(); KNOWN = S.KNOWN;
  const m = S.meNow(S.readLibrary()), list = besideList(m), tab = m.aiOpen === 'tab';
  if (list.length < 2) { const x = list[0]; return S.openBeside(x ? x.link : a.href, tab); }
  anchor = a; box = document.createElement('div'); document.body.appendChild(box);
  render(<Rows list={list} tab={tab} />, box);
  const pop = box.firstChild, r = a.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
  pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right + 8)) + 'px'; pop.style.top = Math.max(8, Math.min(innerHeight - hh - 8, r.bottom - hh + 6)) + 'px';
  a.setAttribute('aria-expanded', 'true');
  document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', keys, true);
  const first = pop.querySelector('[role=menuitem]'); if (first) first.focus({ preventScroll: true });
}
