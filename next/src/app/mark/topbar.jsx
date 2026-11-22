// The marking screen's top bar and full screen (slice C, PR 5), loaded with More for this paper's part (mark/paper-more.jsx topbar),
// so the screen's own load stays as it was.
// Prog: how many are marked, how many are missing or excused, the class average (the one Insights gives) and the time tracker's
// line, as one button that opens Insights (src/app/panels.js renderProg, src/tracker.js tkAsgHtml).
// Full and FullBtn: full screen on the marking screen (src/fullscreen.js, src/app/wiring.js). The button in the View toolbar and F;
// in full screen the student list steps aside as she chose in Settings (gs.fullSide: 'hide', 'all' hides the tool dock as well,
// 'show'). It comes back while the pointer rests at the left edge, with the tab there (a finger), with / to find someone, and with
// [ until full screen ends (nothing is kept).
// items: the Setup menu's Gradebook, unit plan link and class page link (src/app/screens.js renderTopAtlas), and Bring back when
// something went to her assistant. commands: Find's lines while the assignment is open (A-001, A-004, C-062).
import { h, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { IconButton, Progress, ICONS } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { go } from '../router.js';
import { register } from '../../services/shortcuts.js';
import { addCommand } from '../../services/commands.js';
import { fullCan, fullOn, fullToggle } from '../../services/size.js';
import { prefs } from '../../students/prefs.js';
import { readLibrary } from '../../students/counts.js';
import { classLink } from '../../students/book.js';
import { engine as F, focusRead } from '../../students/focus.js';
import { onSaved } from '../../shared/saved.js';
import { gradeOf, noScore, fmtNum } from '../../engines/gcore.js';
import { UnitLink } from '../class/assignment.jsx';
import { LinkDialog } from '../class/classlink.jsx';
import './lines.js';
import './top-lines.js';

// the full screen marks, drawn to the icon set's 16 grid (the current app's #fullBtn)
ICONS.gsfull = '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>';
ICONS.gsfullx = '<path d="M6 2.5V6H2.5M10 2.5V6h3.5M13.5 10H10v3.5M2.5 10H6v3.5"/>';

/* ---------------- marked so far, and the average ---------------- */
const oneDp = v => fmtNum(Math.round(v * 10) / 10);
export function Prog({ batch, fm, X, onOpen }) {
  const sts = batch.students.filter(st => !st.gap || st.files.length), live = sts.filter(st => !noScore(st)), N = live.length, off = sts.length - N;
  const n = live.filter(st => (fm ? st.grade.fb : gradeOf(st).done)).length;
  const cs = !fm && X ? X.classStats() : null, has = !!(cs && cs.n);
  const tip = has ? t('top.pg_avg_tip', { n: cs.n, mean: oneDp(cs.mean), max: fmtNum(cs.max) }) : t('top.pg_tip');
  const say = fm ? t('top.pg_fb', { n, of: N }) : t('mark.marked_of', { n, of: N });
  // the time tracker's line for this assignment, read again as papers are marked
  const aid = batch.assignment && batch.assignment.id, [tk, setTk] = useState(null);
  useEffect(() => { if (!aid) return; let on = true; focusRead().then(() => { if (on) setTk({ a: F.tkAsg(aid), left: F.gpLeft(aid) }); }, () => {}); return () => { on = false; }; }, [aid, n]);
  const bits = [];
  if (tk && tk.a) { const { s, p } = tk.a, per = p ? Math.max(1, Math.round(s / 60 / p)) : 0;
    if (s >= 60) bits.push(t('top.tk_so_far', { time: F.tkDur(s) }));
    if (s >= 60 && per) bits.push(t('top.tk_per', { n: per }));
    if (tk.left >= 60) bits.push(t('top.tk_left', { time: F.tkDur(tk.left) }));
    if (tk.left >= 60 && p < 3) bits.push(t('top.tk_from', { n: p })); }
  return <span class="mk-prog">
    <button type="button" class="pg" title={tip} onClick={onOpen} data-prog>
      <span>{say}</span>{off > 0 && <span class="mute" data-progoff>{t('top.pg_off', { n: off })}</span>}
      {!fm && <b class={'pg-avg' + (has ? '' : ' none')} data-avg>{t('top.pg_avg', { v: has ? (cs.meanPct != null ? X.pctAvgText(cs.meanPct) : oneDp(cs.mean)) : '–' })}</b>}</button>
    <Progress value={n} max={Math.max(1, N)} label={say} />
    {bits.length > 0 && <span class="pg-tk mute" title={t('top.tk_tip')} data-progtk>{bits.join(' · ')}</span>}
  </span>;
}

/* ---------------- full screen ---------------- */
const SIDES = ['hide', 'all', 'show'];
const side = () => { const v = prefs.get('gs.fullSide', 'hide'); return SIDES.includes(v) ? v : 'hide'; };
const ds = () => document.documentElement.dataset;
const q = s => document.querySelector('.markscreen ' + s);
let pinned = false, peekT = 0;
const away = () => fullOn() && side() !== 'show' && innerWidth > 760;
// data-mkfs on the page (mark.css): the list away, and with 'all' the tool dock too; data-mkpeek: the list over the paper's edge
function draw() { const d = ds(); if (away() && !pinned) d.mkfs = side(); else { delete d.mkfs; delete d.mkpeek; delete d.mktools; } }
const held = () => { const l = q('.mk-list'); return !!l && (l.matches(':hover') || l.contains(document.activeElement) || !!l.querySelector('[aria-expanded="true"]')); };
function peek(on, wait) {
  clearTimeout(peekT);
  const now = () => { if (!ds().mkfs) return; if (on) { ds().mkpeek = ''; return; } if (held()) return; delete ds().mkpeek; };
  if (wait) peekT = setTimeout(now, wait); else now();
}
// [ in full screen: the list stays beside the paper until full screen ends, or [ again
export function pin() { if (!away()) return false; pinned = !pinned; draw(); return true; }
const useFull = () => { const [on, setOn] = useState(fullOn()); useEffect(() => { const f = () => setOn(fullOn()); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []); return on; };

export function FullBtn() {
  const on = useFull(); if (!fullCan()) return null;
  return <IconButton icon={on ? 'gsfullx' : 'gsfull'} label={t(on ? 'top.fs_leave' : 'top.fs_go')} kbd="F" aria-pressed={on ? 'true' : 'false'} onClick={fullToggle} data-full />;
}
// fm: whether F is Feedback complete now (feedback only), which it then stays, as in the current app
export function Full({ fm }) {
  useEffect(() => {
    let foldT = 0, dockT = 0, edgeT = 0;
    const changed = () => { pinned = false; draw(); };
    const off = register({ id: 'mark-full', keys: 'f', label: 'top.fs_go', when: () => fullCan() && !fm(), run: e => { if (!e.shiftKey) fullToggle(); } });
    // / to find someone: the list comes out first, so its find box can take the keyboard
    const key = e => { const el = e.target; if (e.key === '/' && ds().mkfs && !(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) peek(true); };
    const tools = () => q('.mk-tools'), dockHeld = () => { const d = tools(); return !!d && (d.matches(':hover') || d.contains(document.activeElement) || !!d.querySelector('[aria-expanded="true"]')); };
    const dock = (on, wait) => { clearTimeout(dockT); const now = () => { if (on) ds().mktools = ''; else if (!dockHeld()) delete ds().mktools; }; if (wait) dockT = setTimeout(now, wait); else now(); };
    const nearDock = (x, el) => { const m = q('.mk-mid'), d = tools(); if (d && el && d.contains(el)) return true; if (!m) return false; const l = m.getBoundingClientRect().left; return x >= l && x - l < 88; };
    const move = e => {
      if (!ds().mkfs || e.pointerType !== 'mouse') return;
      const el = e.target, inList = el && el.closest && el.closest('.mk-list,.mk-fsedge,.mk-fstab');
      // opened from the edge, the list may never have had the pointer come in: moving off it folds it all the same
      if (!('mkpeek' in ds()) || inList) { clearTimeout(foldT); foldT = 0; } else if (!foldT) foldT = setTimeout(() => { foldT = 0; peek(false); }, 450);
      if (ds().mkfs !== 'all') return;
      const n = nearDock(e.clientX, el), on = 'mktools' in ds();
      if (n && !on && !e.buttons) dock(true, 120); else if (!n && on) dock(false, 600); else if (n === on) clearTimeout(dockT);
    };
    // a finger: a tap in the dock's margin shows the dock, a tap elsewhere puts it away
    const down = e => { if (ds().mkfs !== 'all' || e.pointerType === 'mouse' || !e.target.closest || !e.target.closest('.mk-mid') || (tools() && tools().contains(e.target))) return; dock(nearDock(e.clientX) && !('mktools' in ds())); };
    // the left edge: a mouse rests there a moment with no button held (not a pen stroke run off the paper); a finger opens it at once
    // (the tab sits on the edge, so resting on it does the same)
    const edgeIn = e => { clearTimeout(edgeT); if (e.target.closest && e.target.closest('.mk-fsedge,.mk-fstab') && e.pointerType === 'mouse' && !e.buttons) edgeT = setTimeout(() => peek(true), 180); };
    const edgeOut = e => { if (e.target.closest && e.target.closest('.mk-fsedge,.mk-fstab')) clearTimeout(edgeT); };
    const focusIn = e => { if (e.target.closest && e.target.closest('.markscreen .mk-list')) peek(true); };
    const focusOut = e => { if (e.target.closest && e.target.closest('.markscreen .mk-list')) peek(false, 200); };
    const L = [['fullscreenchange', changed], ['pointermove', move], ['pointerdown', down], ['pointerover', edgeIn], ['pointerout', edgeOut], ['focusin', focusIn], ['focusout', focusOut]];
    L.forEach(([k, f]) => document.addEventListener(k, f)); addEventListener('keydown', key, true); addEventListener('resize', draw);
    const offSide = onSaved(e => { if (e.kind === 'setting' && e.id === 'gs.fullSide') draw(); });
    draw();
    return () => { off(); offSide(); L.forEach(([k, f]) => document.removeEventListener(k, f)); removeEventListener('keydown', key, true); removeEventListener('resize', draw);
      clearTimeout(foldT); clearTimeout(dockT); clearTimeout(edgeT); clearTimeout(peekT); pinned = false; const d = ds(); delete d.mkfs; delete d.mkpeek; delete d.mktools; };
  }, []);
  return <>
    <div class="mk-fsedge" aria-hidden="true" onPointerDown={e => { if (e.pointerType !== 'mouse') { e.preventDefault(); peek(true); } }} />
    <button type="button" class="mk-fstab" title={t('top.fs_tab') + ' ( [ )'} aria-label={t('top.fs_tab')} onClick={() => peek(true)} data-fstab><span aria-hidden="true">›</span></button>
  </>;
}

/* ---------------- the Setup menu's links, and Find ---------------- */
// the library, read once and again after it changes (the unit plan link and the class page link live there)
let LIB = null;
const lib = () => LIB || (LIB = readLibrary());
onSaved(e => { if (e.kind === 'library') LIB = null; });
const unitOf = (l, id) => { for (const c of [...(l.classes || []), ...(l.loose ? [l.loose] : [])]) for (const u of c.units || []) if ((u.items || []).some(it => it.id === id)) return u; return null; };
const visit = url => { const w = window.open(url, '_blank', 'noopener'); if (w) w.opener = null; };
// ctx: { batch, cls, share(back), dlg(Part) }: dlg shows a dialog of this part's (it is handed onClose)
export function items({ batch, cls, share, dlg }) {
  const L = lib(), out = [], aid = batch.assignment && batch.assignment.id;
  if (cls) out.push({ label: t('mark.cmd_book'), sub: t('top.book_tip'), icon: 'grades', onSelect: () => go('class', cls.id, 'grades') });
  const u = aid ? unitOf(L, aid) : null, tool = String((L.me || {}).unit || '').trim();
  if (u) out.push(u.atlas ? { label: tool ? t('mark.cw_ul_open_n', { name: tool }) : t('mark.cw_ul_open'), sub: t('top.su_link_tip'), icon: 'link', onSelect: () => visit(u.atlas) }
    : { label: tool ? t('mark.cw_ul_add_n', { name: tool }) : t('mark.cw_ul_add'), icon: 'link', onSelect: () => dlg(p => <UnitLink u={u} tool={tool} onClose={() => { LIB = null; p.onClose(); }} />) });
  const c = cls ? (L.classes || []).find(x => String(x.id) === String(cls.id)) : null, sys = String((L.me || {}).sys || '').trim(), url = c ? classLink(c) : '';
  if (c) out.push(url ? { label: sys || t('top.su_sys_open'), sub: t('top.su_link_tip'), icon: 'school', onSelect: () => visit(url) }
    : { label: sys ? t('top.su_sys_add_n', { name: sys }) : t('top.su_sys_add'), icon: 'school', onSelect: () => dlg(p => <LinkDialog c={c} sys={sys} url="" onClose={() => { LIB = null; p.onClose(); }} />) });
  // Bring back, once papers or marks went to her assistant (batch.share, the current app's own record)
  const sh = batch.share; if (sh && (sh.made || sh.marksMade)) out.push({ label: t('top.bb_menu'), icon: 'assist', onSelect: () => share(true) });
  return out;
}
// ctx: { group, share(back), view(tab, view), late() }
export function commands({ group, share, view, late }) {
  return [
    addCommand({ id: 'asg-bb', label: () => t('top.bb_menu'), group, icon: 'assist', run: () => share(true) }),
    addCommand({ id: 'asg-sheet', label: () => t('top.cmd_sheet'), group, icon: 'grades', run: () => view('grades', 'sheet') }),
    addCommand({ id: 'asg-cons', label: () => t('top.cmd_cons'), group, icon: 'chart', run: () => view('insights', 'cons') }),
    addCommand({ id: 'asg-ex', label: () => t('top.cmd_ex'), group, icon: 'library', run: () => go('library', 'examples') }),
    addCommand({ id: 'asg-late', label: () => t('top.cmd_late'), group, icon: 'upload', run: late }),
  ];
}
